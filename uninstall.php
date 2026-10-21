<?php
/**
 * Runs when werun.Blocks.Community is deleted from the Plugins screen: removes its
 * settings, encrypted keys, caches and scheduled events. Page content and
 * saved styles (posts of type wrbc_preset) stay: they are the site's work.
 *
 * @package werun-blocks-community
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

global $wpdb;

foreach ( array( 'wrbc_integrations' ) as $werun_blocks_community_option ) {
	delete_option( $werun_blocks_community_option );
}

// Encrypted keys (wrbc_secret_*), jobs caches and last good copies (wrbc_jobs_*),
// and every wrbc transient (query and meta-key caches, rate limits, gate marks).
// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- one-off cleanup by prefix.
$wpdb->query(
	$wpdb->prepare(
		"DELETE FROM {$wpdb->options} WHERE option_name LIKE %s OR option_name LIKE %s OR option_name LIKE %s OR option_name LIKE %s OR option_name LIKE %s OR option_name LIKE %s",
		$wpdb->esc_like( 'wrbc_secret_' ) . '%',
		$wpdb->esc_like( 'wrbc_jobs_' ) . '%',
		$wpdb->esc_like( '_transient_wrbc_' ) . '%',
		$wpdb->esc_like( '_transient_timeout_wrbc_' ) . '%',
		$wpdb->esc_like( '_transient_werun_blocks_community_' ) . '%',
		$wpdb->esc_like( '_transient_timeout_werun_blocks_community_' ) . '%'
	)
);

wp_unschedule_hook( 'wrbc_jobs_refresh' );
