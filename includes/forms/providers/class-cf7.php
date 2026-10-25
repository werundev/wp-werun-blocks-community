<?php
/**
 * Contact Form 7 (form plugin on this site): picked from its list, rendered with its
 * shortcode, submissions seen by the server (hard gating, includes/gate/).
 *
 * @package werun-blocks-community
 */

namespace Werun\BlocksCommunity\Forms\Providers;

use Werun\BlocksCommunity\Forms\Native_Provider;

defined( 'ABSPATH' ) || exit;

/**
 * ContactForm7.
 */
final class ContactForm7 extends Native_Provider {

	public function id(): string {
		return 'cf7';
	}

	public function label(): string {
		return 'Contact Form 7';
	}

	public function is_available(): bool {
		return class_exists( '\\WPCF7_ContactForm' );
	}

	public function client_event(): string {
		return 'dom:wpcf7mailsent';
	}

	public function list_forms(): array {
		if ( ! $this->is_available() ) {
			return array();
		}
		return self::pairs(
			\WPCF7_ContactForm::find(
				array(
					'posts_per_page' => 200,
					'orderby'        => 'title',
					'order'          => 'ASC',
				)
			),
			static function ( $f ) {
				return $f->id();
			},
			static function ( $f ) {
				return $f->title();
			}
		);
	}

	protected function exists( int $id ): bool {
		$post = get_post( $id );
		return $post && 'wpcf7_contact_form' === $post->post_type && 'publish' === $post->post_status;
	}

	protected function shortcode( int $id ): string {
		return '[contact-form-7 id="' . $id . '"]';
	}
}
