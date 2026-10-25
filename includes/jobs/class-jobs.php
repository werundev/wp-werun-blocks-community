<?php
/**
 * Jobs of one board, cached stale-while-revalidate.
 *
 * - Fresh copy: transient wrbc_jobs_{md5(provider|slug|region)}, TTL from
 *   Integrations jobs.ttl (minutes).
 * - Last good copy: option wrbc_jobs_{md5}_stale (autoload off).
 * - Fresh copy expired: the page renders the last good copy and a
 *   single cron event (wrbc_jobs_refresh) fetches the board again. Only the
 *   very first render of a board ever waits for the ATS (with a 30 s lock so
 *   concurrent first renders don't all fetch); if that first fetch fails, an
 *   empty "last good copy" is stored so later renders don't wait either.
 * - A failed refresh keeps the last good copy and backs off (a fresh copy of
 *   the old data for min(TTL, 15 min)).
 *
 * @package werun-blocks-community
 */

namespace Werun\BlocksCommunity\Jobs;

use Werun\BlocksCommunity\Integrations\Integrations;

defined( 'ABSPATH' ) || exit;

/**
 * Jobs.
 */
final class Jobs {

	public const HOOK = 'wrbc_jobs_refresh';

	/** Jobs kept per board (the block never renders more). */
	public const MAX = 300;

	/** Cron and nothing else at load. */
	public static function register(): void {
		add_action( self::HOOK, array( __CLASS__, 'cron' ), 10, 3 );
	}

	/**
	 * A validated board config. Empty provider / slug take the Integrations
	 * defaults; the region is dropped when the provider has no such region.
	 *
	 * @param mixed $provider Provider id or ''.
	 * @param mixed $slug     Board slug or ''.
	 * @param mixed $region   Region or ''.
	 * @return array|\WP_Error { provider, slug, region }
	 */
	public static function config( $provider, $slug, $region = '' ) {
		$default  = (string) Integrations::get( 'jobs.provider' );
		$provider = is_string( $provider ) && '' !== $provider ? $provider : $default;
		$adapter  = Providers::get( $provider );
		if ( ! $adapter ) {
			return new \WP_Error( 'wrbc_jobs_provider', __( 'Unknown job board provider.', 'werun-blocks-community' ) );
		}
		$slug = is_string( $slug ) ? trim( $slug ) : '';
		// The default board belongs to the default provider only.
		if ( '' === $slug && $adapter->needs_slug() && $provider === $default ) {
			$slug = (string) Integrations::get( 'jobs.board' );
		}
		if ( ! $adapter->needs_slug() ) {
			$slug = '';
		} elseif ( '' === $slug ) {
			return new \WP_Error( 'wrbc_jobs_no_board', __( 'Set the board slug (or a default board in Integrations).', 'werun-blocks-community' ) );
		} elseif ( ! preg_match( Adapter::SLUG, $slug ) ) {
			return new \WP_Error( 'wrbc_jobs_slug', __( 'The board slug may only hold letters, digits, - and _ (up to 64).', 'werun-blocks-community' ) );
		}
		$region = is_string( $region ) && array_key_exists( $region, $adapter->regions() ) ? $region : '';
		return array(
			'provider' => $provider,
			'slug'     => $slug,
			'region'   => $region,
		);
	}

	/** Cache key of a board. */
	public static function key( array $cfg ): string {
		return 'wrbc_jobs_' . md5( $cfg['provider'] . '|' . $cfg['slug'] . '|' . $cfg['region'] );
	}

	/** TTL in seconds. */
	public static function ttl(): int {
		return max( 5, (int) Integrations::get( 'jobs.ttl' ) ) * MINUTE_IN_SECONDS;
	}

	/**
	 * Jobs for a render: never waits for the ATS once a board has been fetched.
	 *
	 * @return array { jobs, total, fetched, error, stale }
	 */
	public static function get( array $cfg ): array {
		$key   = self::key( $cfg );
		$fresh = get_transient( $key );
		if ( is_array( $fresh ) && isset( $fresh['jobs'] ) ) {
			return self::shape( $fresh, false );
		}
		$stale = get_option( $key . '_stale' );
		if ( is_array( $stale ) && isset( $stale['jobs'] ) ) {
			self::schedule( $cfg );
			return self::shape( $stale, true );
		}
		// First render of this board.
		if ( get_transient( $key . '_lock' ) ) {
			return self::shape( array( 'error' => __( 'The job list is loading.', 'werun-blocks-community' ) ), true );
		}
		set_transient( $key . '_lock', 1, 30 );
		$result = self::refresh( $cfg );
		delete_transient( $key . '_lock' );
		if ( is_wp_error( $result ) ) {
			return self::shape( array( 'error' => $result->get_error_message() ), true );
		}
		return self::shape( $result, false );
	}

	/**
	 * Fetch and normalize now, without touching the cache.
	 *
	 * @return array|\WP_Error { jobs, total, fetched, error }
	 */
	public static function fetch( array $cfg ) {
		$adapter = Providers::get( $cfg['provider'] );
		if ( ! $adapter ) {
			return new \WP_Error( 'wrbc_jobs_provider', __( 'Unknown job board provider.', 'werun-blocks-community' ) );
		}
		$raw = $adapter->fetch( $cfg );
		if ( is_wp_error( $raw ) ) {
			return $raw;
		}
		$jobs = array();
		$seen = array();
		foreach ( (array) $raw as $item ) {
			$job = $adapter->normalize( $item );
			$job = $job ? Job::finish( $job, $adapter ) : null;
			if ( ! $job || isset( $seen[ $job['id'] ] ) ) {
				continue;
			}
			$seen[ $job['id'] ] = true;
			$jobs[]             = $job;
		}
		return array(
			'jobs'    => array_slice( $jobs, 0, self::MAX ),
			'total'   => count( $jobs ),
			'fetched' => time(),
			'error'   => '',
		);
	}

	/**
	 * Fetch now and store; on failure keep the last good copy and back off.
	 *
	 * @return array|\WP_Error
	 */
	public static function refresh( array $cfg ) {
		$key    = self::key( $cfg );
		$result = self::fetch( $cfg );
		if ( ! is_wp_error( $result ) ) {
			set_transient( $key, $result, self::ttl() );
			update_option( $key . '_stale', $result, false );
			return $result;
		}
		$stale = get_option( $key . '_stale' );
		if ( ! is_array( $stale ) || ! isset( $stale['jobs'] ) ) {
			$stale = array(
				'jobs'    => array(),
				'total'   => 0,
				'fetched' => 0,
			);
		}
		$stale['error'] = $result->get_error_message();
		update_option( $key . '_stale', $stale, false );
		set_transient( $key, $stale, min( self::ttl(), 15 * MINUTE_IN_SECONDS ) );
		return $result;
	}

	/** Forget the fresh copy (the last good copy stays for renders). */
	public static function clear( array $cfg ): void {
		delete_transient( self::key( $cfg ) );
	}

	/** One background refresh per board at a time. */
	public static function schedule( array $cfg ): void {
		$args = array( $cfg['provider'], $cfg['slug'], $cfg['region'] );
		if ( ! wp_next_scheduled( self::HOOK, $args ) ) {
			wp_schedule_single_event( time(), self::HOOK, $args );
		}
	}

	/**
	 * Cron: the args are validated again (they come from the cron option).
	 *
	 * @param mixed $provider Provider id.
	 * @param mixed $slug     Board slug.
	 * @param mixed $region   Region.
	 */
	public static function cron( $provider = '', $slug = '', $region = '' ): void {
		if ( ! is_string( $provider ) || '' === $provider ) {
			return;
		}
		$cfg = self::config( $provider, $slug, $region );
		if ( ! is_wp_error( $cfg ) ) {
			self::refresh( $cfg );
		}
	}

	/** A payload with every key. */
	private static function shape( array $data, bool $stale ): array {
		return array(
			'jobs'    => isset( $data['jobs'] ) && is_array( $data['jobs'] ) ? $data['jobs'] : array(),
			'total'   => (int) ( $data['total'] ?? 0 ),
			'fetched' => (int) ( $data['fetched'] ?? 0 ),
			'error'   => (string) ( $data['error'] ?? '' ),
			'stale'   => $stale,
		);
	}
}
