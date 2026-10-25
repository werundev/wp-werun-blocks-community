<?php
/**
 * Resource gating: tickets, the "remembered" cookie and download links.
 *
 * A resource is a published post whose download is an attachment (post meta
 * _wrbc_download_id, filter wrbc_gate_attachment_id), or an attachment itself.
 *
 * - Ticket (Signer purpose "gate"): {r: resource id, p: page id, f: attachment
 *   id, n: nonce, m: hard|soft, k: "provider:form" for hard tickets}. Printed
 *   on the page by the form block and the query block's resource cards.
 * - Cookie wrbc_gate (purpose "gate-cookie"): {ids: [resource ids], h: [ids
 *   unlocked by a verified (hard) submission]}, so a returning visitor gets
 *   the link without the form (gating.remember_days). A hard gate only trusts
 *   "h": a soft unlock of the same resource elsewhere never opens it.
 * - Download link: home_url( '?wrbc_download=<token>' ), purpose "download",
 *   {r, f}, valid gating.unlock_minutes.
 *
 * Nothing personal is stored: tickets, cookies and links only hold ids, and
 * the rate limit keeps a salted hash of the IP for ten minutes.
 *
 * @package werun-blocks-community
 */

namespace Werun\BlocksCommunity\Gate;

use Werun\BlocksCommunity\Integrations\Integrations;
use Werun\BlocksCommunity\Security\Signer;

defined( 'ABSPATH' ) || exit;

/**
 * Gate.
 */
final class Gate {

	public const META   = '_wrbc_download_id';
	public const COOKIE = 'wrbc_gate';
	public const QUERY  = 'wrbc_download';

	/** Most resource ids one cookie remembers (newest kept). */
	private const MAX_REMEMBERED = 40;

	/** Hooks. */
	public static function register(): void {
		add_action( 'init', array( __CLASS__, 'register_meta' ) );
	}

	/** The download attachment of a post, editable in the editor (REST) by whoever can edit the post. */
	public static function register_meta(): void {
		register_post_meta(
			'',
			self::META,
			array(
				'type'              => 'integer',
				'single'            => true,
				'default'           => 0,
				// Edit context only: the public wp/v2 view never says which file a gated resource holds.
				'show_in_rest'      => array(
					'schema' => array(
						'type'    => 'integer',
						'context' => array( 'edit' ),
					),
				),
				'sanitize_callback' => 'absint',
				'auth_callback'     => static function ( $allowed, $key, $post_id ) {
					return current_user_can( 'edit_post', (int) $post_id );
				},
			)
		);
	}

	/**
	 * The attachment a resource downloads, 0 when none.
	 *
	 * @param int $resource Resource post id.
	 */
	public static function attachment_id( int $resource ): int {
		$post = $resource > 0 ? get_post( $resource ) : null;
		if ( ! $post ) {
			return 0;
		}
		$id = 'attachment' === $post->post_type ? $post->ID : (int) get_post_meta( $post->ID, self::META, true );
		$id = (int) apply_filters( 'wrbc_gate_attachment_id', $id, $post );
		$at = $id > 0 ? get_post( $id ) : null;
		return ( $at && 'attachment' === $at->post_type && 'inherit' === $at->post_status ) ? $at->ID : 0;
	}

	/**
	 * Whether a resource is published and has a download.
	 *
	 * @param int $resource Resource post id.
	 */
	public static function is_available( int $resource ): bool {
		$post = $resource > 0 ? get_post( $resource ) : null;
		if ( ! $post ) {
			return false;
		}
		if ( 'attachment' === $post->post_type ) {
			$parent    = (int) $post->post_parent;
			$published = 'inherit' === $post->post_status && ( 0 === $parent || 'publish' === get_post_status( $parent ) );
		} else {
			$published = 'publish' === $post->post_status && is_post_type_viewable( $post->post_type ) && '' === $post->post_password;
		}
		return $published && self::attachment_id( $resource ) > 0;
	}

	/**
	 * Whether a signed ticket's file is still this resource's download: the
	 * resource is published (is_available() without the _wrbc_download_id
	 * requirement) and the file is a live attachment that the resource still
	 * points to — its _wrbc_download_id, or any of its meta values (the query
	 * block lets the editor pick the meta field that holds the file).
	 *
	 * @param int $resource Resource post id.
	 * @param int $file     Attachment id from the signed ticket.
	 */
	public static function file_matches( int $resource, int $file ): bool {
		$post = $resource > 0 ? get_post( $resource ) : null;
		$at   = $file > 0 ? get_post( $file ) : null;
		if ( ! $post || ! $at || 'attachment' !== $at->post_type || 'inherit' !== $at->post_status ) {
			return false;
		}
		if ( 'attachment' === $post->post_type ) {
			return $post->ID === $file && self::is_available( $resource );
		}
		if ( 'publish' !== $post->post_status || ! is_post_type_viewable( $post->post_type ) || '' !== $post->post_password ) {
			return false;
		}
		if ( self::attachment_id( $resource ) === $file ) {
			return true;
		}
		foreach ( get_post_meta( $resource ) as $key => $values ) {
			if ( is_protected_meta( $key, 'post' ) && self::META !== $key ) {
				continue;
			}
			foreach ( (array) $values as $value ) {
				if ( is_numeric( $value ) && (int) $value === $file ) {
					return true;
				}
			}
		}
		return false;
	}

	/**
	 * A gate ticket for a resource, '' when it has nothing to download.
	 *
	 * @param int    $resource Resource post id.
	 * @param int    $page     Page the form is on (0 outside a singular view).
	 * @param string $mode     hard (a native form the server verifies) | soft.
	 * @param string $form     "provider:formId" for hard tickets: only that form's submissions count.
	 */
	public static function ticket( int $resource, int $page = 0, string $mode = 'soft', string $form = '' ): string {
		if ( ! self::is_available( $resource ) ) {
			return '';
		}
		$payload = array(
			'r' => $resource,
			'p' => max( 0, $page ),
			'f' => self::attachment_id( $resource ),
			'n' => wp_generate_password( 12, false ),
			'm' => 'hard' === $mode ? 'hard' : 'soft',
		);
		if ( 'hard' === $payload['m'] ) {
			$payload['k'] = $form;
		}
		// Pages are cached: the ticket outlives a typical page cache.
		return Signer::sign( $payload, 'gate', (int) apply_filters( 'wrbc_gate_ticket_ttl', 2 * DAY_IN_SECONDS ) );
	}

	/**
	 * A ticket's payload with typed fields, or null.
	 *
	 * @param mixed $token Ticket from a request.
	 */
	public static function read_ticket( $token ): ?array {
		$t = Signer::verify( $token, 'gate' );
		if ( null === $t || ! isset( $t['r'], $t['f'], $t['n'] ) || ! is_numeric( $t['r'] ) || ! is_numeric( $t['f'] ) ) {
			return null;
		}
		return array(
			'r' => (int) $t['r'],
			'p' => (int) ( $t['p'] ?? 0 ),
			'f' => (int) $t['f'],
			'n' => wrbc_text( $t['n'] ),
			'm' => 'hard' === ( $t['m'] ?? '' ) ? 'hard' : 'soft',
			'k' => wrbc_text( $t['k'] ?? '' ),
		);
	}

	/**
	 * A download link valid for gating.unlock_minutes, '' when unavailable.
	 *
	 * @param int $resource Resource post id.
	 * @param int $file     The ticket's attachment (the query block's download
	 *                      field may name a meta other than _wrbc_download_id);
	 *                      0 = the resource's own download.
	 */
	public static function download_url( int $resource, int $file = 0 ): string {
		if ( $file > 0 ) {
			if ( ! self::file_matches( $resource, $file ) ) {
				return '';
			}
		} elseif ( self::is_available( $resource ) ) {
			$file = self::attachment_id( $resource );
		} else {
			return '';
		}
		$token = Signer::sign(
			array(
				'r' => $resource,
				'f' => $file,
			),
			'download',
			60 * (int) Integrations::get( 'gating.unlock_minutes' )
		);
		return add_query_arg( self::QUERY, rawurlencode( $token ), home_url( '/' ) );
	}

	/**
	 * Resource ids the visitor's cookie remembers.
	 *
	 * @param bool $hard Only those unlocked by a verified (hard) submission.
	 */
	public static function remembered_ids( bool $hard = false ): array {
		$raw  = isset( $_COOKIE[ self::COOKIE ] ) ? sanitize_text_field( wp_unslash( $_COOKIE[ self::COOKIE ] ) ) : '';
		$c    = '' === $raw ? null : Signer::verify( $raw, 'gate-cookie' );
		$list = $hard ? 'h' : 'ids';
		$ids  = is_array( $c ) && is_array( $c[ $list ] ?? null ) ? $c[ $list ] : array();
		return array_values( array_filter( array_map( 'intval', $ids ) ) );
	}

	/**
	 * Whether the visitor already unlocked a resource.
	 *
	 * @param int  $resource Resource post id.
	 * @param bool $hard     Only through a verified (hard) submission: what a hard gate needs.
	 */
	public static function remembered( int $resource, bool $hard = false ): bool {
		return $resource > 0 && in_array( $resource, self::remembered_ids( $hard ), true );
	}

	/**
	 * Remembers a resource in the signed cookie (remember_days; with 0, only
	 * for the unlock window).
	 *
	 * @param int  $resource Resource post id.
	 * @param bool $hard     Unlocked by a verified (hard) submission.
	 */
	public static function remember( int $resource, bool $hard = false ): void {
		$days = (int) Integrations::get( 'gating.remember_days' );
		$ttl  = $days > 0 ? $days * DAY_IN_SECONDS : 60 * (int) Integrations::get( 'gating.unlock_minutes' );
		$add  = static function ( array $ids, int $id ): array {
			$ids = array_values( array_unique( array_merge( array_diff( $ids, array( $id ) ), array( $id ) ) ) );
			return array_slice( $ids, -self::MAX_REMEMBERED );
		};
		$ids  = $add( self::remembered_ids(), $resource );
		$hids = self::remembered_ids( true );
		if ( $hard ) {
			$hids = $add( $hids, $resource );
		}
		$hids = array_values( array_intersect( $hids, $ids ) );
		$val  = Signer::sign(
			array(
				'ids' => $ids,
				'h'   => $hids,
			),
			'gate-cookie',
			$ttl
		);
		$_COOKIE[ self::COOKIE ] = $val; // This request sees it too.
		if ( headers_sent() ) {
			return;
		}
		setcookie(
			self::COOKIE,
			$val,
			array(
				'expires'  => time() + $ttl,
				'path'     => COOKIEPATH ? COOKIEPATH : '/',
				'domain'   => COOKIE_DOMAIN ? COOKIE_DOMAIN : '',
				'secure'   => is_ssl(),
				'httponly' => true,
				'samesite' => 'Lax',
			)
		);
	}

	/** Resources the editor can pick: posts with a download file. */
	public static function resources(): array {
		$posts = get_posts(
			array(
				'post_type'      => array_values( get_post_types( array( 'public' => true ) ) ),
				'post_status'    => 'publish',
				'posts_per_page' => 100,
				'meta_key'       => self::META, // phpcs:ignore WordPress.DB.SlowDBQuery -- editor only.
				'meta_compare'   => '>',
				'meta_value'     => 0, // phpcs:ignore WordPress.DB.SlowDBQuery
				'meta_type'      => 'NUMERIC',
				'no_found_rows'  => true,
			)
		);
		$out   = array();
		foreach ( $posts as $post ) {
			if ( self::is_available( $post->ID ) ) {
				$out[] = array(
					'id'    => $post->ID,
					'title' => wp_strip_all_tags( get_the_title( $post ) ),
					'type'  => $post->post_type,
				);
			}
		}
		return $out;
	}
}
