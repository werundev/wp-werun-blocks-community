<?php
/**
 * Removes everything the a11y harness (and block tests) created:
 * - posts of any type and status with post meta _wrbc_a11y_fixture = 1
 *   (fixture content, attachments with their files, test pages),
 * - pages titled "WRB A11Y …" even without the meta,
 * - terms with term meta _wrbc_a11y_fixture = 1,
 * - the wp-content/uploads/wrbc-a11y folder,
 * - the jobs cache of the fixture boards and the query meta-key caches,
 * - with "all": the mu-plugin wp-content/mu-plugins/wrbc-a11y-fixtures.php.
 *
 *   cd <wp root> && wp eval-file <harness>/cleanup.php [all] [dry]
 *   (WP-CLI refuses unknown --flags: use the words, or harness/cleanup.sh --all)
 *
 * @package wrbc-a11y-fixtures
 */

defined( 'ABSPATH' ) || exit;

$opts = array_map(
	static function ( $a ) {
		return ltrim( (string) $a, '-' );
	},
	(array) ( $args ?? array() )
);
$all  = in_array( 'all', $opts, true );
$dry  = in_array( 'dry', $opts, true ) || in_array( 'dry-run', $opts, true );

global $wpdb;
$admin = get_users( array( 'role' => 'administrator', 'number' => 1, 'orderby' => 'ID', 'fields' => 'ID' ) );
wp_set_current_user( $admin ? (int) $admin[0] : 0 );

$done = array(
	'posts'       => 0,
	'attachments' => 0,
	'terms'       => 0,
	'files'       => 0,
);

// phpcs:disable WordPress.DB.DirectDatabaseQuery
$ids = $wpdb->get_col( "SELECT DISTINCT post_id FROM {$wpdb->postmeta} WHERE meta_key = '_wrbc_a11y_fixture' AND meta_value = '1'" );
$ids = array_merge( $ids, $wpdb->get_col( $wpdb->prepare( "SELECT ID FROM {$wpdb->posts} WHERE post_type = 'page' AND post_title LIKE %s", $wpdb->esc_like( 'WRB A11Y ' ) . '%' ) ) );
// phpcs:enable
$ids = array_unique( array_map( 'intval', $ids ) );

// Posts first (their thumbnails are fixture attachments too), attachments after.
$attachments = array();
foreach ( $ids as $id ) {
	$type = get_post_type( $id );
	if ( ! $type ) {
		continue;
	}
	if ( 'attachment' === $type ) {
		$attachments[] = $id;
		continue;
	}
	if ( ! $dry ) {
		wp_delete_post( $id, true );
	}
	++$done['posts'];
}
foreach ( $attachments as $id ) {
	if ( ! $dry ) {
		wp_delete_attachment( $id, true );
	}
	++$done['attachments'];
}

// Terms (the fixture taxonomies are registered while the mu-plugin is loaded).
// phpcs:ignore WordPress.DB.DirectDatabaseQuery
$terms = $wpdb->get_results( "SELECT tm.term_id, tt.taxonomy FROM {$wpdb->termmeta} tm JOIN {$wpdb->term_taxonomy} tt ON tt.term_id = tm.term_id WHERE tm.meta_key = '_wrbc_a11y_fixture' AND tm.meta_value = '1'" );
foreach ( (array) $terms as $row ) {
	if ( ! $dry ) {
		if ( taxonomy_exists( $row->taxonomy ) ) {
			wp_delete_term( (int) $row->term_id, $row->taxonomy );
		} else {
			// Taxonomy not registered (mu-plugin already gone): remove the rows directly.
			$wpdb->delete( $wpdb->term_relationships, array( 'term_taxonomy_id' => (int) $wpdb->get_var( $wpdb->prepare( "SELECT term_taxonomy_id FROM {$wpdb->term_taxonomy} WHERE term_id = %d", $row->term_id ) ) ) ); // phpcs:ignore
			$wpdb->delete( $wpdb->term_taxonomy, array( 'term_id' => (int) $row->term_id ) ); // phpcs:ignore
			$wpdb->delete( $wpdb->termmeta, array( 'term_id' => (int) $row->term_id ) ); // phpcs:ignore
			$wpdb->delete( $wpdb->terms, array( 'term_id' => (int) $row->term_id ) ); // phpcs:ignore
		}
	}
	++$done['terms'];
}

// The uploads folder of the fixtures (files left by a failed run).
$up  = wp_upload_dir();
$dir = trailingslashit( $up['basedir'] ) . 'wrbc-a11y';
if ( is_dir( $dir ) ) {
	foreach ( (array) glob( $dir . '/*' ) as $file ) {
		if ( is_file( $file ) ) {
			if ( ! $dry ) {
				wp_delete_file( $file );
			}
			++$done['files'];
		}
	}
	if ( ! $dry ) {
		@rmdir( $dir ); // phpcs:ignore WordPress.PHP.NoSilencedErrors,WordPress.WP.AlternativeFunctions
	}
}

// Caches that remember fixture data.
if ( ! $dry ) {
	foreach ( array( 'post', 'page', 'team', 'event', 'location', 'resource', 'case_study', 'testimonial_cpt' ) as $type ) {
		delete_transient( 'wrbc_qmk_' . md5( $type ) );
	}
	if ( class_exists( '\Werun\BlocksCommunity\Jobs\Jobs' ) ) {
		foreach ( \Werun\BlocksCommunity\Jobs\Providers::ids() as $provider ) {
			foreach ( array( 'acme', 'acme-empty', 'acme-404' ) as $board ) {
				foreach ( array( '', 'eu', 'com' ) as $region ) {
					$key = \Werun\BlocksCommunity\Jobs\Jobs::key( array( 'provider' => $provider, 'slug' => $board, 'region' => $region ) );
					delete_transient( $key );
					delete_transient( $key . '_lock' );
					delete_option( $key . '_stale' );
				}
			}
		}
	}
	wp_cache_flush();
}

$mu = WPMU_PLUGIN_DIR . '/wrbc-a11y-fixtures.php';
if ( $all && file_exists( $mu ) ) {
	if ( ! $dry ) {
		wp_delete_file( $mu );
	}
	$done['mu-plugin'] = 'removed';
}

WP_CLI::success( ( $dry ? '[dry run] ' : '' ) . 'Removed: ' . wp_json_encode( $done ) );
