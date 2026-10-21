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

	/**
	 * One icon from the sprite.
	 *
	 * @param string $name Icon id without prefix, e.g. "eye".
	 */
	public static function icon( string $name ): string {
		return sprintf( '<svg class="werun-blocks-community-ui-icon" aria-hidden="true" focusable="false"><use href="#werun-blocks-community-icon-%s"></use></svg>', esc_attr( $name ) );
	}
}
