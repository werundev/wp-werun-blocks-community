<?php
/**
 * Fluent Forms (form plugin on this site): picked from its list, rendered with its
 * shortcode, submissions seen by the server (hard gating, includes/gate/).
 *
 * @package werun-blocks-community
 */

namespace Werun\BlocksCommunity\Forms\Providers;

use Werun\BlocksCommunity\Forms\Native_Provider;

defined( 'ABSPATH' ) || exit;

/**
 * FluentForms.
 */
final class FluentForms extends Native_Provider {

	public function id(): string {
		return 'fluent';
	}

	public function label(): string {
		return 'Fluent Forms';
	}

	public function is_available(): bool {
		return defined( 'FLUENTFORM' ) || function_exists( 'wpFluentForm' );
	}

	public function client_event(): string {
		return 'jquery:fluentform_submission_success';
	}

	public function list_forms(): array {
		if ( ! $this->is_available() ) {
			return array();
		}
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- the plugin's own table, read for the editor only.
		$rows = $wpdb->get_results( $wpdb->prepare( "SELECT id, title FROM {$wpdb->prefix}fluentform_forms WHERE status = %s ORDER BY title LIMIT 200", 'published' ) );
		return self::pairs(
			(array) $rows,
			static function ( $r ) {
				return $r->id;
			},
			static function ( $r ) {
				return $r->title;
			}
		);
	}

	protected function exists( int $id ): bool {
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery
		return (bool) $wpdb->get_var( $wpdb->prepare( "SELECT id FROM {$wpdb->prefix}fluentform_forms WHERE id = %d AND status = %s", $id, 'published' ) );
	}

	protected function shortcode( int $id ): string {
		return '[fluentform id="' . $id . '"]';
	}
}
