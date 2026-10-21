<?php
/**
 * ?wrbc_download=<token>: verifies the signed link (purpose "download",
 * expiry), that the resource is still published and still downloads the
 * same attachment, then redirects to the file or streams it
 * (Integrations gating.delivery).
 *
 * @package werun-blocks-community
 */

namespace Werun\BlocksCommunity\Gate;

use Werun\BlocksCommunity\Integrations\Integrations;
use Werun\BlocksCommunity\Security\Signer;

defined( 'ABSPATH' ) || exit;

/**
 * Download.
 */
final class Download {

	/** Hooks. */
	public static function register(): void {
		add_action( 'template_redirect', array( __CLASS__, 'maybe_serve' ), 0 );
	}

	/** Serves the download when the request asks for one. */
	public static function maybe_serve(): void {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- the token is signed.
		if ( ! isset( $_GET[ Gate::QUERY ] ) ) {
			return;
		}
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$token = sanitize_text_field( wp_unslash( $_GET[ Gate::QUERY ] ) );
		$p     = preg_match( '/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/', $token ) ? Signer::verify( $token, 'download' ) : null;
		if ( null === $p || ! isset( $p['r'], $p['f'] ) ) {
			self::deny( __( 'This download link has expired. Go back to the page to get a new one.', 'werun-blocks-community' ), 403 );
		}
		$resource   = (int) $p['r'];
		$attachment = (int) $p['f'];
		if ( ! Gate::file_matches( (int) $resource, (int) $attachment ) ) {
			self::deny( __( 'This download is no longer available.', 'werun-blocks-community' ), 410 );
		}
		nocache_headers();
		header( 'X-Robots-Tag: noindex, nofollow' );
		header( 'Referrer-Policy: no-referrer' );
		if ( 'stream' === Integrations::get( 'gating.delivery' ) ) {
			self::stream( $attachment );
		}
		$url = wp_get_attachment_url( $attachment );
		if ( ! $url ) {
			self::deny( __( 'This download is no longer available.', 'werun-blocks-community' ), 410 );
		}
		wp_redirect( $url, 302, 'werun.Blocks.Community' ); // phpcs:ignore WordPress.Security.SafeRedirect.wp_redirect_wp_redirect -- WordPress's own attachment URL (may be on a CDN).
		exit;
	}

	/**
	 * Streams the file: only a real file inside the uploads folder, of a type
	 * WordPress allows to upload.
	 *
	 * @param int $attachment Attachment id.
	 */
	private static function stream( int $attachment ): void {
		$path    = self::file( $attachment );
		if ( '' === $path ) {
			self::deny( __( 'This download is no longer available.', 'werun-blocks-community' ), 404 );
		}
		$type = wp_check_filetype( $path );
		$name = sanitize_file_name( wp_basename( $path ) );
		while ( ob_get_level() > 0 ) {
			ob_end_clean();
		}
		header( 'Content-Type: ' . $type['type'] );
		header( 'Content-Length: ' . (string) filesize( $path ) );
		header( 'Content-Disposition: attachment; filename="' . $name . '"; filename*=UTF-8\'\'' . rawurlencode( $name ) );
		header( 'X-Content-Type-Options: nosniff' );
		header( "Content-Security-Policy: default-src 'none'; sandbox" );
		readfile( $path ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_readfile -- streaming a download.
		exit;
	}

	/**
	 * The attachment's real path when it is a readable file inside uploads and
	 * an allowed upload type; '' otherwise.
	 *
	 * @param int $attachment Attachment id.
	 */
	public static function file( int $attachment ): string {
		$file    = (string) get_attached_file( $attachment, true );
		$real    = '' !== $file ? realpath( $file ) : false;
		$uploads = wp_get_upload_dir();
		$base    = realpath( (string) $uploads['basedir'] );
		if ( false === $real || false === $base || 0 !== strpos( $real, rtrim( $base, DIRECTORY_SEPARATOR ) . DIRECTORY_SEPARATOR ) || ! is_file( $real ) || ! is_readable( $real ) ) {
			return '';
		}
		$type = wp_check_filetype( $real );
		return empty( $type['type'] ) ? '' : $real;
	}

	/**
	 * Ends the request with an error page.
	 *
	 * @param string $message Message.
	 * @param int    $status  HTTP status.
	 */
	private static function deny( string $message, int $status ): void {
		nocache_headers();
		header( 'X-Robots-Tag: noindex, nofollow' );
		// The page title says what happened, not just "Download" (WCAG 2.4.2).
		wp_die( esc_html( $message ), esc_html__( 'Download not available', 'werun-blocks-community' ), array( 'response' => $status, 'back_link' => true ) );
	}
}
