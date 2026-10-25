<?php
/**
 * WordPress side of audit.mjs (run with wp eval-file, data through a JSON file):
 *
 *   wp eval-file bridge.php <in.json> <out.json>
 *
 * in.json: {
 *   "pages": [ { "key": "cta-centered--light", "title": "WRB A11Y cta cta-centered [light]", "content": "<!-- wp:… -->" } ],
 *   "auth":  true            // also return admin auth cookies (editor checks)
 * }
 * out.json: { "pages": { key: { id, url, edit, status } }, "warnings": [], "auth": {…}, "debugLog": "/path" }
 *
 * Pages: published, meta _wrbc_a11y_fixture = 1, found again by that meta +
 * the exact title and updated in place. Tokens in the content are resolved
 * from the seeded fixtures (seed.php keys):
 *   {{img:KEY}} attachment id   {{url:KEY}} attachment URL (full size)
 *   {{post:KEY}} post id        {{term:taxonomy/Name or slug}} term id
 *   {{home}} home URL
 *
 * @package wrbc-a11y-fixtures
 */

defined( 'ABSPATH' ) || exit;

list( $in_file, $out_file ) = array_pad( (array) ( $args ?? array() ), 2, '' );
if ( '' === $in_file || ! is_readable( $in_file ) || '' === $out_file ) {
	WP_CLI::error( 'usage: wp eval-file bridge.php <in.json> <out.json>' );
}
$in = json_decode( (string) file_get_contents( $in_file ), true ); // phpcs:ignore WordPress.WP.AlternativeFunctions
if ( ! is_array( $in ) ) {
	WP_CLI::error( 'bad input JSON' );
}

global $wpdb;
$admin = get_users( array( 'role' => 'administrator', 'number' => 1, 'orderby' => 'ID', 'fields' => 'ID' ) );
$admin = $admin ? (int) $admin[0] : 0;
wp_set_current_user( $admin );
kses_remove_filters();

$out = array(
	'pages'    => array(),
	'warnings' => array(),
	'home'     => home_url( '/' ),
	'debugLog' => ( defined( 'WP_DEBUG_LOG' ) && is_string( WP_DEBUG_LOG ) ) ? WP_DEBUG_LOG : WP_CONTENT_DIR . '/debug.log',
);

/** Fixture post id by seed key. */
$by_key = static function ( $key ) use ( $wpdb ) {
	// phpcs:ignore WordPress.DB.DirectDatabaseQuery
	return (int) $wpdb->get_var( $wpdb->prepare( "SELECT post_id FROM {$wpdb->postmeta} WHERE meta_key = '_wrbc_a11y_key' AND meta_value = %s ORDER BY post_id ASC LIMIT 1", $key ) );
};

$resolve = static function ( $content, $page_key ) use ( $by_key, &$out ) {
	return preg_replace_callback(
		'/\{\{(img|url|post|term|home)(?::([^}]+))?\}\}/',
		static function ( $m ) use ( $by_key, &$out, $page_key ) {
			$kind = $m[1];
			$arg  = isset( $m[2] ) ? trim( $m[2] ) : '';
			switch ( $kind ) {
				case 'home':
					return esc_url_raw( home_url( '/' ) );
				case 'img':
				case 'post':
					$id = $by_key( $arg );
					if ( ! $id ) {
						$out['warnings'][] = "$page_key: unknown fixture key '$arg' (run seed.php)";
						return '0';
					}
					return (string) $id;
				case 'url':
					$id  = $by_key( $arg );
					$url = $id ? wp_get_attachment_url( $id ) : '';
					if ( ! $url ) {
						$out['warnings'][] = "$page_key: no attachment URL for '$arg'";
						return '';
					}
					return $url;
				case 'term':
					list( $tax, $name ) = array_pad( explode( '/', $arg, 2 ), 2, '' );
					$term               = get_term_by( 'slug', sanitize_title( $name ), $tax );
					if ( ! $term ) {
						$term = get_term_by( 'name', $name, $tax );
					}
					if ( ! $term ) {
						$out['warnings'][] = "$page_key: unknown term '$arg'";
						return '0';
					}
					return (string) $term->term_id;
			}
			return $m[0];
		},
		(string) $content
	);
};

foreach ( (array) ( $in['pages'] ?? array() ) as $page ) {
	$key     = (string) ( $page['key'] ?? '' );
	$title   = (string) ( $page['title'] ?? '' );
	$content = $resolve( (string) ( $page['content'] ?? '' ), $key );
	if ( '' === $key || 0 !== strpos( $title, 'WRB A11Y ' ) ) {
		$out['warnings'][] = "skipped page '$title': the title must start with 'WRB A11Y '";
		continue;
	}
	// phpcs:ignore WordPress.DB.DirectDatabaseQuery
	$id = (int) $wpdb->get_var(
		$wpdb->prepare(
			"SELECT p.ID FROM {$wpdb->posts} p INNER JOIN {$wpdb->postmeta} m ON m.post_id = p.ID AND m.meta_key = '_wrbc_a11y_fixture' AND m.meta_value = '1'
			WHERE p.post_type = 'page' AND p.post_title = %s AND p.post_status <> 'trash' ORDER BY p.ID ASC LIMIT 1",
			$title
		)
	);
	$status = 'unchanged';
	$fields = array(
		'post_type'      => 'page',
		'post_status'    => 'publish',
		'post_title'     => $title,
		'post_content'   => $content,
		'post_author'    => $admin,
		'comment_status' => 'closed',
		'ping_status'    => 'closed',
	);
	if ( $id ) {
		$current = get_post( $id );
		if ( $current->post_content !== $content || 'publish' !== $current->post_status ) {
			$fields['ID'] = $id;
			$result       = wp_update_post( wp_slash( $fields ), true );
			$status       = 'updated';
		} else {
			$result = $id;
		}
	} else {
		$result = wp_insert_post( wp_slash( $fields ), true );
		$status = 'created';
	}
	if ( is_wp_error( $result ) ) {
		$out['warnings'][] = "$key: " . $result->get_error_message();
		continue;
	}
	$id = (int) $result;
	update_post_meta( $id, '_wrbc_a11y_fixture', 1 );
	update_post_meta( $id, '_wrbc_a11y_page', $key );
	// Parse check: blocks that the parser can't read come back as freeform HTML.
	foreach ( parse_blocks( $content ) as $block ) {
		if ( null === $block['blockName'] && '' !== trim( $block['innerHTML'] ) ) {
			$out['warnings'][] = "$key: content outside any block (check the fixture markup): " . substr( trim( wp_strip_all_tags( $block['innerHTML'] ) ), 0, 80 );
		}
	}
	$out['pages'][ $key ] = array(
		'id'     => $id,
		'url'    => get_permalink( $id ),
		'edit'   => admin_url( 'post.php?post=' . $id . '&action=edit' ),
		'status' => $status,
	);
}

if ( ! empty( $in['auth'] ) && $admin ) {
	$exp         = time() + 2 * HOUR_IN_SECONDS;
	$host        = (string) wp_parse_url( home_url(), PHP_URL_HOST );
	$out['auth'] = array(
		'user'    => $admin,
		'admin'   => admin_url(),
		'cookies' => array(
			array(
				'name'     => SECURE_AUTH_COOKIE,
				'value'    => wp_generate_auth_cookie( $admin, $exp, 'secure_auth' ),
				'domain'   => $host,
				'path'     => '/',
				'expires'  => $exp,
				'httpOnly' => true,
				'secure'   => true,
				'sameSite' => 'Lax',
			),
			array(
				'name'     => LOGGED_IN_COOKIE,
				'value'    => wp_generate_auth_cookie( $admin, $exp, 'logged_in' ),
				'domain'   => $host,
				'path'     => '/',
				'expires'  => $exp,
				'httpOnly' => true,
				'secure'   => true,
				'sameSite' => 'Lax',
			),
		),
	);
}

file_put_contents( $out_file, wp_json_encode( $out ) ); // phpcs:ignore WordPress.WP.AlternativeFunctions
WP_CLI::log( sprintf( 'bridge: %d pages, %d warnings', count( $out['pages'] ), count( $out['warnings'] ) ) );
