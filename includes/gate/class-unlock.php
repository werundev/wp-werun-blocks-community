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

	/**
	 * The last request can_unlock() answered and its answer.
	 *
	 * @var array{0: \WP_REST_Request, 1: true|\WP_Error}|null
	 */
	private static $checked = null;

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
				// Public (visitors who sent the form): the signed ticket authorises it.
				'permission_callback' => array( __CLASS__, 'can_unlock' ),
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
	 * Within the per-IP limit and with a ticket this site signed (purpose
	 * "gate", not expired).
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return true|\WP_Error
	 */
	public static function can_unlock( \WP_REST_Request $request ) {
		// WordPress asks again after the answer, for the Allow header (rest_send_allow_header()): one attempt per request.
		if ( null === self::$checked || self::$checked[0] !== $request ) {
			if ( ! self::within_limit() ) {
				$answer = new \WP_Error( 'wrbc_gate_rate', __( 'Too many attempts. Try again in a few minutes.', 'werun-blocks-community' ), array( 'status' => 429 ) );
			} else {
				$answer = null === Gate::read_ticket( (string) $request->get_param( 'ticket' ) ) ? self::invalid() : true;
			}
			self::$checked = array( $request, $answer );
		}
		return self::$checked[1];
	}

	/**
	 * Unlocks a resource.
	 *
	 * @param \WP_REST_Request $request Request.
	 */
	public static function unlock( \WP_REST_Request $request ) {
		$ticket = (string) $request->get_param( 'ticket' );
		$t      = Gate::read_ticket( $ticket ); // can_unlock() already refused anything else.
		if ( null === $t ) {
			return self::invalid();
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

	/** The answer to a ticket that is not valid (any more). */
	private static function invalid(): \WP_Error {
		return new \WP_Error( 'wrbc_gate_ticket', __( 'This download link is no longer valid. Reload the page and try again.', 'werun-blocks-community' ), array( 'status' => 403 ) );
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
