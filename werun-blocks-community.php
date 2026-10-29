<?php
/**
 * Plugin Name:       werun.Blocks.Community
 * Plugin URI:        https://github.com/werundev/wp-werun-blocks-community
 * Description:       Corporate blocks for the block editor: hero, sections, CTAs, feature and logo grids, stats, tabs, pricing and comparison, FAQ, testimonials, timelines, video, carousels, a visual query builder for any post type, jobs from your ATS and forms from the usual providers.
 * Version:           1.0.1
 * Requires at least: 6.6
 * Requires PHP:      7.4
 * Author:            werun.dev
 * Author URI:        https://werun.dev
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       werun-blocks-community
 *
 * @package werun-blocks-community
 */

defined( 'ABSPATH' ) || exit;

define( 'WERUN_BLOCKS_COMMUNITY_VERSION', '1.0.1' );
define( 'WERUN_BLOCKS_COMMUNITY_FILE', __FILE__ );
define( 'WERUN_BLOCKS_COMMUNITY_DIR', plugin_dir_path( __FILE__ ) );
define( 'WERUN_BLOCKS_COMMUNITY_URL', plugin_dir_url( __FILE__ ) );

require_once WERUN_BLOCKS_COMMUNITY_DIR . 'includes/helpers.php';

require_once WERUN_BLOCKS_COMMUNITY_DIR . 'includes/admin/class-ui.php';

// Saved styles: a block's styles and options, reused on other pages.
require_once WERUN_BLOCKS_COMMUNITY_DIR . 'includes/presets/class-presets.php';
\Werun\BlocksCommunity\Presets\Presets::register();

// Signed tokens (query configs, gating tickets, downloads) and the
// Integrations settings (maps, privacy, forms, jobs, gating).
require_once WERUN_BLOCKS_COMMUNITY_DIR . 'includes/security/class-signer.php';
require_once WERUN_BLOCKS_COMMUNITY_DIR . 'includes/integrations/class-secret.php';
require_once WERUN_BLOCKS_COMMUNITY_DIR . 'includes/integrations/class-integrations.php';

/**
 * Feature areas, each with its own loader: accessibility (colour contrast and
 * the background a block sits on), PHP side of the shared modules (consent
 * placeholder, video/carousel markup helpers), query engine, forms, resource
 * gating, jobs (ATS), table of contents, Integrations screen. A missing
 * loader is skipped, so an area can be left out of a build.
 */
foreach ( array( 'a11y', 'modules', 'query', 'forms', 'gate', 'jobs', 'toc', 'admin/integrations' ) as $wrbc_area ) {
	$wrbc_loader = WERUN_BLOCKS_COMMUNITY_DIR . 'includes/' . $wrbc_area . '/loader.php';
	if ( is_readable( $wrbc_loader ) ) {
		require_once $wrbc_loader;
	}
}
unset( $wrbc_area, $wrbc_loader );

/**
 * The blocks, parents first. Each folder under build/ holds the compiled
 * block.json, editor script, styles, render.php and, where it has one, the
 * front-end script.
 */
const WERUN_BLOCKS_COMMUNITY_BLOCKS = array(
	'hero',
	'section',
	'cta',
	'media-text',
	'features',
	'feature',
	'logos',
	'stats',
	'stat',
	'tabs',
	'tab',
	'toc',
	'query',
	'pricing',
	'pricing-plan',
	'comparison',
	'accordion',
	'accordion-item',
	'testimonials',
	'testimonial',
	'timeline',
	'timeline-item',
	'video',
	'carousel',
	'slide',
	'jobs',
	'form',
	'notice',
);

/**
 * Shared front-end modules (build/shared/<name>.js from src/shared/view/),
 * registered as wrbc-<name> so block.json viewScript arrays can list them.
 * Contract: docs/shared-modules.md. Extra dependencies between modules here;
 * the WordPress packages come from each module's .asset.php.
 */
const WERUN_BLOCKS_COMMUNITY_MODULES = array(
	'consent'  => array(),
	'carousel' => array(),
	'counter'  => array(),
	'video'    => array( 'wrbc-consent' ),
	'tabs'     => array(),
	'filter'   => array(),
	'map'      => array( 'wrbc-consent' ),
	'gate'     => array( 'wrbc-consent' ),
);

add_action( 'init', 'wrbc_register_blocks' );
function wrbc_register_blocks() {
	// Shared by every block: icons, animations, buttons, the section header.
	wp_register_style( 'wrbc-shared', WERUN_BLOCKS_COMMUNITY_URL . 'assets/shared.css', array(), WERUN_BLOCKS_COMMUNITY_VERSION );
	wp_register_script(
		'wrbc-shared-view',
		WERUN_BLOCKS_COMMUNITY_URL . 'assets/shared-view.js',
		array(),
		WERUN_BLOCKS_COMMUNITY_VERSION,
		array(
			'in_footer' => true,
			'strategy'  => 'defer',
		)
	);

	// Dialog, consent placeholder, chips, carousel track: what the shared modules draw.
	wp_register_style( 'wrbc-modules', WERUN_BLOCKS_COMMUNITY_URL . 'assets/modules.css', array( 'wrbc-shared' ), WERUN_BLOCKS_COMMUNITY_VERSION );

	foreach ( WERUN_BLOCKS_COMMUNITY_MODULES as $module => $deps ) {
		$asset = WERUN_BLOCKS_COMMUNITY_DIR . 'build/shared/' . $module . '.asset.php';
		$meta  = is_readable( $asset ) ? include $asset : array(
			'dependencies' => array(),
			'version'      => WERUN_BLOCKS_COMMUNITY_VERSION,
		);
		wp_register_script(
			'wrbc-' . $module,
			WERUN_BLOCKS_COMMUNITY_URL . 'build/shared/' . $module . '.js',
			array_merge( (array) $meta['dependencies'], $deps ),
			$meta['version'],
			array(
				'in_footer' => true,
				'strategy'  => 'defer',
			)
		);
		wp_set_script_translations( 'wrbc-' . $module, 'werun-blocks-community' );
	}

	// Leaflet (vendored, never from a CDN). Never enqueued: wrbc-map injects it
	// after consent or a click, from the URLs in wrbcModules.leaflet.
	$leaflet = WERUN_BLOCKS_COMMUNITY_URL . 'assets/vendor/leaflet/';
	wp_add_inline_script(
		'wrbc-consent',
		'window.wrbcModules = ' . wp_json_encode(
			array(
				'leaflet'      => array(
					'js'         => $leaflet . 'leaflet.js',
					'css'        => $leaflet . 'leaflet.css',
					'clusterJs'  => $leaflet . 'leaflet.markercluster.js',
					'clusterCss' => $leaflet . 'MarkerCluster.css',
					'clusterDefaultCss' => $leaflet . 'MarkerCluster.Default.css',
					'images'     => $leaflet . 'images/',
				),
				'integrations' => \Werun\BlocksCommunity\Integrations\Integrations::public_settings(),
				'rest'         => esc_url_raw( rest_url( 'wrbc/v1/' ) ),
			),
			JSON_HEX_TAG | JSON_HEX_AMP
		) . ';',
		'before'
	);

	foreach ( WERUN_BLOCKS_COMMUNITY_BLOCKS as $block ) {
		if ( file_exists( WERUN_BLOCKS_COMMUNITY_DIR . 'build/' . $block . '/block.json' ) ) {
			register_block_type( WERUN_BLOCKS_COMMUNITY_DIR . 'build/' . $block );
		}
	}
}

/** The editor's icon picker reads the plugin's own URL from here. */
add_action( 'enqueue_block_editor_assets', 'wrbc_editor_settings' );
function wrbc_editor_settings() {
	// The picker and the inspector live outside the canvas iframe, so the
	// icon styles are loaded there too.
	wp_enqueue_style( 'wrbc-editor', WERUN_BLOCKS_COMMUNITY_URL . 'assets/editor.css', array( 'wrbc-shared' ), WERUN_BLOCKS_COMMUNITY_VERSION );

	// "Saved styles" panel on the parent blocks (src/presets).
	$presets = WERUN_BLOCKS_COMMUNITY_DIR . 'build/presets/index.asset.php';
	if ( is_readable( $presets ) ) {
		$asset = include $presets;
		wp_enqueue_script( 'wrbc-presets', WERUN_BLOCKS_COMMUNITY_URL . 'build/presets/index.js', $asset['dependencies'], $asset['version'], true );
		wp_set_script_translations( 'wrbc-presets', 'werun-blocks-community' );
	}
	wp_register_script( 'wrbc-editor-settings', '', array(), WERUN_BLOCKS_COMMUNITY_VERSION, true );
	wp_enqueue_script( 'wrbc-editor-settings' );
	wp_add_inline_script(
		'wrbc-editor-settings',
		'window.wrbcSettings = ' . wp_json_encode(
			array(
				'iconsPath'    => '/wrbc/v1/icons',
				'lucideUrl'    => 'https://lucide.dev/icons/',
				'animatedUrl'  => 'https://lucide-animated.com/icons/',
				'version'      => WERUN_BLOCKS_COMMUNITY_VERSION,
				// Non-secret Integrations values and has* flags; secrets never leave PHP.
				'integrations' => \Werun\BlocksCommunity\Integrations\Integrations::editor_settings(),
				// The palette, gradients and page colours includes/a11y resolves with, for src/shared/contrast.js.
				'colors'       => array(
					'palette'   => (object) wrbc_preset_map( 'palette' ),
					'gradients' => (object) wrbc_preset_map( 'gradients' ),
					'page'      => wrbc_page_colors(),
				),
			),
			JSON_HEX_TAG | JSON_HEX_AMP
		) . ';'
	);
}

/**
 * Media + text takes colours from the palette only: the editor hides custom
 * colours, and this drops a custom value typed in the code editor.
 */
add_filter( 'render_block_data', 'wrbc_media_text_palette_only' );
function wrbc_media_text_palette_only( $block ) {
	if ( 'werun-community/media-text' === ( $block['blockName'] ?? '' ) && isset( $block['attrs']['style'] ) && is_array( $block['attrs']['style'] ) ) {
		unset( $block['attrs']['style']['color'], $block['attrs']['style']['elements']['link']['color'] );
	}
	return $block;
}

/**
 * Entrance reveal guard: [data-wrbc-reveal] content is only hidden (until it
 * scrolls into view) under html.wrbc-js. This adds the class before the page
 * paints and removes it if shared-view.js hasn't started within 3 seconds,
 * so nothing stays invisible when scripts are off, blocked or slow (a CSP
 * that blocks inline scripts just means no reveal animation).
 */
add_action( 'wp_head', 'wrbc_reveal_guard', 1 );
function wrbc_reveal_guard() {
	wp_print_inline_script_tag( 'document.documentElement.classList.add("wrbc-js");setTimeout(function(){if(!window.wrbcReveal){document.documentElement.classList.remove("wrbc-js");}},3000);' );
}

/** A category of its own in the inserter. */
add_filter( 'block_categories_all', 'wrbc_block_category', 10, 1 );
function wrbc_block_category( $categories ) {
	array_unshift(
		$categories,
		array(
			'slug'  => 'werun-community',
			'title' => __( 'werun.Blocks.Community', 'werun-blocks-community' ),
			'icon'  => null,
		)
	);
	return $categories;
}

/**
 * GET /wp-json/wrbc/v1/icons: every Lucide icon with its tags, and the
 * Lucide Animated presets, for the editor's picker. Editors only; the page
 * itself never needs it, because render.php prints each icon inline.
 */
add_action( 'rest_api_init', 'wrbc_register_rest' );
function wrbc_register_rest() {
	register_rest_route(
		'wrbc/v1',
		'/icons',
		array(
			'methods'             => 'GET',
			'permission_callback' => function () {
				return current_user_can( 'edit_posts' );
			},
			'callback'            => function () {
				$tags     = json_decode( (string) file_get_contents( WERUN_BLOCKS_COMMUNITY_DIR . 'includes/lucide-tags.json' ), true );
				$response = rest_ensure_response(
					array(
						'icons'    => wrbc_icon_data(),
						'tags'     => is_array( $tags ) ? $tags : array(),
						'animated' => wrbc_animated_presets(),
					)
				);
				$response->header( 'Cache-Control', 'private, max-age=86400' );
				return $response;
			},
		)
	);
}
