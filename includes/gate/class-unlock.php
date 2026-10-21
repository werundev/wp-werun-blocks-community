<?php
/**
 * POST wrbc/v1/gate/unlock { ticket } (public, signed input only).
 *
 * Verifies the ticket; the resource must still be published and still
 * download attachment f. Hard tickets need the mark a verified submission
 * left (used once) or a hard unlock in the visitor's cookie; soft tickets are only
 * rate-limited per IP. Answers { url } (a download link valid
 * gating.unlock_minutes) and sets the signed wrbc_gate cookie.
 *
 * @package werun-blocks-community
 */

namespace Werun\BlocksCommunity\Gate;

defined( 'ABSPATH' ) || exit;

/**
 * Unlock.
 */
final class Unlock {

	/** Unlock attempts per IP per window. */
	private const LIMIT = 20;

	/** Window in seconds. */
	private const WINDOW = 10 * MINUTE_IN_SECONDS;

	/** Hooks. */
	public static function register(): void {
		add_action( 'rest_api_init', array( __CLASS__, 'routes' ) );
	}

	/** Route. */
	public static function routes(): void {
		register_rest_route(
			'wrbc/v1',
			'/gate/unlock',
			array(
				'methods'             => 'POST',
				'permission_callback' => '__return_true', // Public: the ticket is the authorisation.
				'args'                => array(
					'ticket' => array(
						'type'     => 'string',
						'required' => true,
						'maxLength' => 4096,
					),
				),
				'callback'            => array( __CLASS__, 'unlock' ),
			)
		);
	}

	/**
	 * Unlocks a resource.
	 *
	 * @param \WP_REST_Request $request Request.
	 */
	public static function unlock( \WP_REST_Request $request ) {
		if ( ! self::within_limit() ) {
			return new \WP_Error( 'wrbc_gate_rate', __( 'Too many attempts. Try again in a few minutes.', 'werun-blocks-community' ), array( 'status' => 429 ) );
		}
		$ticket = (string) $request->get_param( 'ticket' );
		$t      = Gate::read_ticket( $ticket );
		if ( null === $t ) {
			return new \WP_Error( 'wrbc_gate_ticket', __( 'This download link is no longer valid. Reload the page and try again.', 'werun-blocks-community' ), array( 'status' => 403 ) );
		}
		if ( ! Gate::file_matches( (int) $t['r'], (int) $t['f'] ) || ( $t['p'] > 0 && 'publish' !== get_post_status( $t['p'] ) ) ) {
			return new \WP_Error( 'wrbc_gate_gone', __( 'This download is no longer available.', 'werun-blocks-community' ), array( 'status' => 410 ) );
		}
		if ( 'hard' === $t['m'] ) {
			$key = Hard::key( $ticket );
			if ( get_transient( $key ) ) {
				delete_transient( $key ); // Once.
			} elseif ( ! Gate::remembered( $t['r'], true ) ) { // A soft unlock elsewhere never opens a hard gate.
				return new \WP_Error( 'wrbc_gate_pending', __( 'Send the form first.', 'werun-blocks-community' ), array( 'status' => 403 ) );
			}
		}
		Gate::remember( $t['r'], 'hard' === $t['m'] );
		// The ticket's own file: the query block may gate a meta other than _wrbc_download_id.
		$response = rest_ensure_response( array( 'url' => Gate::download_url( $t['r'], $t['f'] ) ) );
		$response->header( 'Cache-Control', 'no-store' );
		$response->header( 'X-Robots-Tag', 'noindex, nofollow' );
		return $response;
	}

	/** Counts an attempt for this IP (salted hash, never the IP) and says whether it is allowed. */
	private static function within_limit(): bool {
		$ip = isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : '';
		if ( '' === $ip ) {
			return true;
		}
		$key   = 'wrbc_gate_rl_' . substr( hash_hmac( 'sha256', $ip, wp_salt( 'nonce' ) ), 0, 24 );
		$entry = get_transient( $key );
		$now   = time();
		if ( ! is_array( $entry ) || (int) ( $entry['t'] ?? 0 ) + self::WINDOW < $now ) {
			$entry = array(
				'c' => 0,
				't' => $now,
			);
		}
		++$entry['c'];
		set_transient( $key, $entry, self::WINDOW );
		return $entry['c'] <= (int) apply_filters( 'wrbc_gate_rate_limit', self::LIMIT );
	}
}
