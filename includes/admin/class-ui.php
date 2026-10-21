<?php
/**
 * Helpers shared by the werun.Blocks.Community admin screens (assets/admin/,
 * werun-blocks-community-ui-* kit).
 *
 * @package werun-blocks-community
 */

namespace Werun\BlocksCommunity\Admin;

defined( 'ABSPATH' ) || exit;

/**
 * Admin UI helpers.
 */
final class Ui {

	/** Public documentation (werun.dev knowledge base). */
	public const DOCS_URL = 'https://crm.werun.dev/knowledge-base/category/werun-blocks-community';

	/** Support: GitHub issues. */
	public const SUPPORT_URL = 'https://github.com/werundev/wp-werun-blocks-community/issues';

	/**
	 * werun.dev contact page for custom work, in the admin's language.
	 *
	 * @param string $medium Where the link is (utm_medium).
	 */
	public static function custom_work_url( string $medium ): string {
		$page = 0 === strpos( get_user_locale(), 'es' ) ? 'https://werun.dev/es/contacto' : 'https://werun.dev/contact';
		return add_query_arg(
			array(
				'utm_source'   => 'werun-blocks-community',
				'utm_medium'   => $medium,
				'utm_campaign' => 'custom-work',
			),
			$page
		);
	}

	/**
	 * One icon from the sprite.
	 *
	 * @param string $name Icon id without prefix, e.g. "eye".
	 */
	public static function icon( string $name ): string {
		return sprintf( '<svg class="werun-blocks-community-ui-icon" aria-hidden="true" focusable="false"><use href="#werun-blocks-community-icon-%s"></use></svg>', esc_attr( $name ) );
	}
}
