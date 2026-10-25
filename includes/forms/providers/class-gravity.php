<?php
/**
 * Gravity Forms (form plugin on this site): picked from its list, rendered with its
 * shortcode, submissions seen by the server (hard gating, includes/gate/).
 *
 * @package werun-blocks-community
 */

namespace Werun\BlocksCommunity\Forms\Providers;

use Werun\BlocksCommunity\Forms\Native_Provider;

defined( 'ABSPATH' ) || exit;

/**
 * GravityForms.
 */
final class GravityForms extends Native_Provider {

	public function id(): string {
		return 'gravity';
	}

	public function label(): string {
		return 'Gravity Forms';
	}

	public function is_available(): bool {
		return class_exists( '\\GFAPI' );
	}

	public function client_event(): string {
		return 'jquery:gform_confirmation_loaded';
	}

	public function list_forms(): array {
		if ( ! $this->is_available() ) {
			return array();
		}
		return self::pairs(
			(array) \GFAPI::get_forms( true, false, 'title' ),
			static function ( $f ) {
				return $f['id'] ?? 0;
			},
			static function ( $f ) {
				return $f['title'] ?? '';
			}
		);
	}

	protected function exists( int $id ): bool {
		$form = \GFAPI::get_form( $id );
		return is_array( $form ) && ! empty( $form['is_active'] ) && empty( $form['is_trash'] );
	}

	protected function shortcode( int $id ): string {
		return '[gravityform id="' . $id . '" title="false" description="false" ajax="true"]';
	}
}
