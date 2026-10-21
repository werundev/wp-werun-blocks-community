<?php
/**
 * Ninja Forms (form plugin on this site): picked from its list, rendered with its
 * shortcode, submissions seen by the server (hard gating, includes/gate/).
 *
 * @package werun-blocks-community
 */

namespace Werun\BlocksCommunity\Forms\Providers;

use Werun\BlocksCommunity\Forms\Native_Provider;

defined( 'ABSPATH' ) || exit;

/**
 * NinjaForms.
 */
final class NinjaForms extends Native_Provider {

	public function id(): string {
		return 'ninja';
	}

	public function label(): string {
		return 'Ninja Forms';
	}

	public function is_available(): bool {
		return function_exists( 'Ninja_Forms' );
	}

	public function client_event(): string {
		return 'nf';
	}

	public function list_forms(): array {
		if ( ! $this->is_available() ) {
			return array();
		}
		return self::pairs(
			(array) \Ninja_Forms()->form()->get_forms(),
			static function ( $f ) {
				return $f->get_id();
			},
			static function ( $f ) {
				return $f->get_setting( 'title' );
			}
		);
	}

	protected function exists( int $id ): bool {
		foreach ( $this->list_forms() as $form ) {
			if ( (int) $form['id'] === $id ) {
				return true;
			}
		}
		return false;
	}

	protected function shortcode( int $id ): string {
		return '[ninja_form id=' . $id . ']';
	}
}
