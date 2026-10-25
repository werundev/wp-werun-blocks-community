<?php
/**
 * Read-only GETs to an ATS: wp_safe_remote_get (no private or loopback
 * hosts), 8 s timeout, at most 2 redirects, 2 MB, only 200 with the expected
 * content type. XML is parsed without network access, DTDs or entities.
 *
 * @package werun-blocks-community
 */

namespace Werun\BlocksCommunity\Jobs;

defined( 'ABSPATH' ) || exit;

/**
 * Http.
 */
final class Http {

	public const MAX_BYTES = 2097152;

	/**
	 * Body of a GET.
	 *
	 * @param string $url     Built from a constant host.
	 * @param string $expect  "json" or "xml".
	 * @param array  $headers Extra headers.
	 * @return string|\WP_Error
	 */
	public static function get( string $url, string $expect, array $headers = array() ) {
		$response = wp_safe_remote_get(
			$url,
			array(
				'timeout'             => 8,
				'redirection'         => 2,
				'limit_response_size' => self::MAX_BYTES,
				'user-agent'          => 'werun.Blocks.Community/' . ( defined( 'WERUN_BLOCKS_COMMUNITY_VERSION' ) ? WERUN_BLOCKS_COMMUNITY_VERSION : '2' ) . '; ' . home_url( '/' ),
				'headers'             => array_merge(
					array( 'Accept' => 'json' === $expect ? 'application/json' : 'application/xml, text/xml' ),
					$headers
				),
			)
		);
		if ( is_wp_error( $response ) ) {
			return new \WP_Error( 'wrbc_jobs_http', __( 'Could not reach the provider.', 'werun-blocks-community' ) . ' ' . $response->get_error_message() );
		}
		$code = (int) wp_remote_retrieve_response_code( $response );
		if ( 200 !== $code ) {
			$message = in_array( $code, array( 401, 403 ), true )
				? __( 'The provider refused the request: check the API key in Integrations.', 'werun-blocks-community' )
				: ( 404 === $code
					? __( 'Board not found: check the slug.', 'werun-blocks-community' )
					/* translators: %d: HTTP status code */
					: sprintf( __( 'The provider answered with status %d.', 'werun-blocks-community' ), $code ) );
			return new \WP_Error( 'wrbc_jobs_status', $message, array( 'status' => $code ) );
		}
		$type = strtolower( (string) wp_remote_retrieve_header( $response, 'content-type' ) );
		if ( false === strpos( $type, $expect ) ) {
			return new \WP_Error( 'wrbc_jobs_type', __( 'The provider answered with an unexpected content type.', 'werun-blocks-community' ) );
		}
		$body = (string) wp_remote_retrieve_body( $response );
		if ( strlen( $body ) >= self::MAX_BYTES ) {
			return new \WP_Error( 'wrbc_jobs_size', __( 'The job list is larger than 2 MB.', 'werun-blocks-community' ) );
		}
		return $body;
	}

	/**
	 * Decoded JSON (an array) of a GET.
	 *
	 * @return array|\WP_Error
	 */
	public static function json( string $url, array $headers = array() ) {
		$body = self::get( $url, 'json', $headers );
		if ( is_wp_error( $body ) ) {
			return $body;
		}
		$data = json_decode( $body, true, 64 );
		if ( ! is_array( $data ) ) {
			return new \WP_Error( 'wrbc_jobs_json', __( 'The provider answered with invalid JSON.', 'werun-blocks-community' ) );
		}
		return $data;
	}

	/**
	 * Parsed XML of a GET.
	 *
	 * @return \SimpleXMLElement|\WP_Error
	 */
	public static function xml( string $url, array $headers = array() ) {
		$body = self::get( $url, 'xml', $headers );
		return is_wp_error( $body ) ? $body : self::parse_xml( $body );
	}

	/**
	 * XML without DTDs, entities or network: a document type declaration is
	 * refused before libxml sees it (XXE, billion laughs).
	 *
	 * @return \SimpleXMLElement|\WP_Error
	 */
	public static function parse_xml( string $body ) {
		// NUL bytes: UTF-16/32 would hide a DOCTYPE from the pattern (libxml decodes it).
		if ( '' === trim( $body ) || false !== strpos( $body, "\0" ) || preg_match( '/<!\s*(DOCTYPE|ENTITY)/i', $body ) ) {
			return new \WP_Error( 'wrbc_jobs_xml', __( 'The provider answered with XML that is not allowed (document type or entities).', 'werun-blocks-community' ) );
		}
		$previous = libxml_use_internal_errors( true );
		$xml      = simplexml_load_string( $body, 'SimpleXMLElement', LIBXML_NONET );
		libxml_clear_errors();
		libxml_use_internal_errors( $previous );
		if ( false === $xml ) {
			return new \WP_Error( 'wrbc_jobs_xml', __( 'The provider answered with invalid XML.', 'werun-blocks-community' ) );
		}
		// Whatever the encoding: no document type got through.
		$dom = dom_import_simplexml( $xml );
		if ( $dom && $dom->ownerDocument && null !== $dom->ownerDocument->doctype ) {
			return new \WP_Error( 'wrbc_jobs_xml', __( 'The provider answered with XML that is not allowed (document type or entities).', 'werun-blocks-community' ) );
		}
		return $xml;
	}
}
