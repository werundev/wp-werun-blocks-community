<?php
/**
 * What every adapter shares: the hosts an apply link may point at, the
 * region enum, whether a board slug or an API key is needed, and the slug
 * as it goes into a path or a host name.
 *
 * @package werun-blocks-community
 */

namespace Werun\BlocksCommunity\Jobs;

defined( 'ABSPATH' ) || exit;

/**
 * Adapter.
 */
abstract class Adapter implements Adapter_Interface {

	/** What a board slug may be (same as Integrations jobs.board and the editor). */
	public const SLUG = '/^[A-Za-z0-9_-]{1,64}$/';

	/**
	 * Registrable domains of the provider: an apply link must be https on one
	 * of them (or a careers subdomain of the posting's site), else the
	 * posting URL is used.
	 */
	public function hosts(): array {
		return array();
	}

	/** Region value => label. '' is the provider default. */
	public function regions(): array {
		return array( '' => __( 'Default', 'werun-blocks-community' ) );
	}

	/** Whether the board slug is required. */
	public function needs_slug(): bool {
		return true;
	}

	/** Integrations secret the adapter needs ('' for none, see optional_secret()). */
	public function secret(): string {
		return '';
	}

	/** Whether the secret is only a fallback (works without it). */
	public function optional_secret(): bool {
		return false;
	}

	/** Slug for a URL path. */
	protected function path_slug( array $cfg ): string {
		return rawurlencode( (string) ( $cfg['slug'] ?? '' ) );
	}

	/**
	 * Slug as a host label: lower case, letters, digits and inner hyphens.
	 *
	 * @return string|\WP_Error
	 */
	protected function host_slug( array $cfg ) {
		$slug = strtolower( (string) ( $cfg['slug'] ?? '' ) );
		if ( ! preg_match( '/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/', $slug ) ) {
			return new \WP_Error( 'wrbc_jobs_slug', __( 'This provider needs a subdomain: letters, digits and hyphens only.', 'werun-blocks-community' ) );
		}
		return $slug;
	}

	/** The region from the config, if this adapter has it. */
	protected function region( array $cfg ): string {
		$region = (string) ( $cfg['region'] ?? '' );
		return array_key_exists( $region, $this->regions() ) ? $region : '';
	}

	/** A list of arrays out of a decoded value (drops anything else). */
	protected static function rows( $value ): array {
		return is_array( $value ) ? array_values( array_filter( $value, 'is_array' ) ) : array();
	}

	/** An error for a payload that isn't what the provider sends. */
	protected static function bad_payload(): \WP_Error {
		return new \WP_Error( 'wrbc_jobs_payload', __( 'The provider answered with something that is not a job list.', 'werun-blocks-community' ) );
	}
}
