<?php
/**
 * WPForms (form plugin on this site): picked from its list, rendered with its
 * shortcode, submissions seen by the server (hard gating, includes/gate/).
 *
 * @package werun-blocks-community
 */

namespace Werun\BlocksCommunity\Forms\Providers;

use Werun\BlocksCommunity\Forms\Native_Provider;

defined( 'ABSPATH' ) || exit;

/**
 * WPForms.
 */
final class WPForms extends Native_Provider {

	public function id(): string {
		return 'wpforms';
	}

	public function label(): string {
		return 'WPForms';
	}

	public function is_available(): bool {
		return function_exists( 'wpforms' );
	}

	public function client_event(): string {
		return 'jquery:wpformsAjaxSubmitSuccess';
	}

	public function list_forms(): array {
		if ( ! $this->is_available() ) {
			return array();
		}
		return self::pairs(
			get_posts(
				array(
					'post_type'      => 'wpforms',
					'post_status'    => 'publish',
					'posts_per_page' => 200,
					'orderby'        => 'title',
					'order'          => 'ASC',
					'no_found_rows'  => true,
				)
			),
			static function ( $p ) {
				return $p->ID;
			},
			static function ( $p ) {
				return $p->post_title;
			}
		);
	}

	protected function exists( int $id ): bool {
		$post = get_post( $id );
		return $post && 'wpforms' === $post->post_type && 'publish' === $post->post_status;
	}

	protected function shortcode( int $id ): string {
		return '[wpforms id="' . $id . '"]';
	}
}
