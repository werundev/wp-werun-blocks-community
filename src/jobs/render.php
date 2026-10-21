<?php
/**
 * Jobs: front-end markup. Built by Werun\BlocksCommunity\Jobs\Render
 * (includes/jobs/class-render.php) from the cached board, so the page never
 * waits for the ATS once the board has been fetched.
 *
 * @var array    $attributes Block attributes.
 * @var string   $content    Unused (dynamic block).
 * @var WP_Block $block      Block instance.
 *
 * @package werun-blocks-community
 */

defined( 'ABSPATH' ) || exit;

if ( class_exists( '\\Werun\\BlocksCommunity\\Jobs\\Render' ) ) {
	// $block: the render context (what the block sits on) for its colours.
	echo \Werun\BlocksCommunity\Jobs\Render::block( is_array( $attributes ) ? $attributes : array(), isset( $block ) && $block instanceof WP_Block ? $block : null ); // phpcs:ignore WordPress.Security.EscapeOutput -- escaped piece by piece in Render.
}
