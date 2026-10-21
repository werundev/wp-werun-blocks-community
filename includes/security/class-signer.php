<?php
/**
 * Signed tokens: a JSON payload plus an HMAC, for data the page prints and a
 * request sends back (the query block's config, gating tickets, download
 * links). Whoever holds a token can read it, but can't change or widen it.
 *
 * Token: base64url(json) . "." . base64url(hmac-sha256). The key is derived
 * from the site's auth salt and the purpose, so a token for one purpose is
 * never valid for another. An optional expiry ("exp", Unix time) is checked.
 * Rotating the salts invalidates every token.
 *
 * @package werun-blocks-community
 */

namespace Werun\BlocksCommunity\Security;

defined( 'ABSPATH' ) || exit;

/**
 * Signer.
 */
final class Signer {

	/** Longest token accepted, in bytes. */
	private const MAX_BYTES = 16384;

	/**
	 * Signs a payload.
	 *
	 * @param array  $payload Data (JSON-encodable).
	 * @param string $purpose What the token is for, e.g. "query", "gate", "download".
	 * @param int    $ttl     Seconds until it expires; 0 = never.
	 */
	public static function sign( array $payload, string $purpose, int $ttl = 0 ): string {
		if ( $ttl > 0 ) {
			$payload['exp'] = time() + $ttl;
		}
		$body = self::b64( (string) wp_json_encode( $payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) );
		return $body . '.' . self::b64( hash_hmac( 'sha256', $body, self::key( $purpose ), true ) );
	}

	/**
	 * The payload of a valid, unexpired token for that purpose, or null.
	 *
	 * @param mixed  $token   Token from a request.
	 * @param string $purpose Expected purpose.
	 */
	public static function verify( $token, string $purpose ): ?array {
		if ( ! is_string( $token ) || '' === $token || strlen( $token ) > self::MAX_BYTES || 1 !== substr_count( $token, '.' ) ) {
			return null;
		}
		list( $body, $sig ) = explode( '.', $token );
		$expected           = self::b64( hash_hmac( 'sha256', $body, self::key( $purpose ), true ) );
		if ( ! hash_equals( $expected, $sig ) ) {
			return null;
		}
		$json    = base64_decode( strtr( $body, '-_', '+/' ), true ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_decode -- token encoding.
		$payload = false === $json ? null : json_decode( $json, true );
		if ( ! is_array( $payload ) ) {
			return null;
		}
		if ( isset( $payload['exp'] ) && (int) $payload['exp'] < time() ) {
			return null;
		}
		return $payload;
	}

	/**
	 * A short, stable id for a payload (no secret: for cache keys and URL params).
	 *
	 * @param array $payload Data.
	 */
	public static function id( array $payload ): string {
		return substr( md5( (string) wp_json_encode( $payload ) ), 0, 8 );
	}

	/**
	 * Key for a purpose.
	 *
	 * @param string $purpose Purpose.
	 */
	private static function key( string $purpose ): string {
		return hash( 'sha256', wp_salt( 'auth' ) . '|werun-blocks-community|' . $purpose . '|v1', true );
	}

	/**
	 * base64url without padding.
	 *
	 * @param string $data Bytes.
	 */
	private static function b64( string $data ): string {
		return rtrim( strtr( base64_encode( $data ), '+/', '-_' ), '=' ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode -- token encoding.
	}
}
