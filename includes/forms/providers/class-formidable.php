<?php
/**
 * Formidable Forms (form plugin on this site): picked from its list, rendered with its
 * shortcode, submissions seen by the server (hard gating, includes/gate/).
 *
 * @package werun-blocks-community
 */

namespace Werun\BlocksCommunity\Forms\Providers;

use Werun\BlocksCommunity\Forms\Native_Provider;

defined( 'ABSPATH' ) || exit;

/**
 * Formidable.
 */
final class Formidable extends Native_Provider {

	public function id(): string {
		return 'formidable';
	}

	public function label(): string {
		return 'Formidable Forms';
	}

	public function is_available(): bool {
		return class_exists( '\\FrmForm' );
	}

	public function client_event(): string {
		return 'jquery:frmFormComplete';
	}

	public function list_forms(): array {
		if ( ! $this->is_available() ) {
			return array();
		}
		return self::pairs(
			(array) \FrmForm::getAll(
				array(
					'is_template'    => 0,
					'status'         => 'published',
					'parent_form_id' => array( null, 0 ),
				),
				'name'
			),
			static function ( $f ) {
				return $f->id;
			},
			static function ( $f ) {
				return '' !== (string) $f->name ? $f->name : '#' . $f->id;
			}
		);
	}

	protected function exists( int $id ): bool {
		$form = \FrmForm::getOne( $id );
		return $form && 'published' === $form->status && empty( $form->is_template );
	}

	protected function shortcode( int $id ): string {
		return '[formidable id="' . $id . '"]';
	}
}
