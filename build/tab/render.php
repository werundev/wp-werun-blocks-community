<?php
/**
 * Tab: one panel of a tabs block. The tab button itself is printed by the
 * tabs block (src/tabs/render.php), which reads this panel's id.
 *
 * The heading inside the panel is what labels it when the tab list is not
 * there (no JavaScript): the stylesheet hides it once the tabs work.
 *
 * @var array    $attributes Block attributes.
 * @var string   $content    Rendered panel content.
 * @var WP_Block $block      Block instance.
 *
 * @package werun-blocks-community
 */

defined( 'ABSPATH' ) || exit;

$a   = $attributes;
$ctx = $block->context;
$uid = wrbc_uid( $a, 'wrbc-tab' );

// One level below the section title when the tabs block shows one, h3
// otherwise. The title is clamped like wrbc_section_header() (h2–h4), so the
// panel headings never skip a level (h3–h5).
$level = ! empty( $ctx['werun-community/tabs/showHeader'] ) ? min( 4, max( 2, (int) ( $ctx['werun-community/tabs/titleLevel'] ?? 2 ) ) ) + 1 : 3;
$label = wrbc_rich( $a['label'] ?? '' );

// A panel with its own background colour: its text, links and focus rings
// follow that colour rather than the block's (docs/accessibility.md), with
// the tabs block's accent made readable on it. Twin: src/tab/edit.js.
$own_bg = wrbc_block_surface( $a, $block->name );
$tone   = '';
$vars   = array();
if ( '' !== $own_bg ) {
	$tone   = wrbc_tone_class( $own_bg, wrbc_context_background( $block ) );
	$accent = wrbc_text( $ctx['werun-community/tabs/accentColor'] ?? '' );
	$text   = wrbc_readable_color( '' !== $accent && null !== wrbc_color_rgba( $accent ) ? $accent : WERUN_BLOCKS_COMMUNITY_ACCENT, $own_bg, WERUN_BLOCKS_COMMUNITY_AA_TEXT );
	$vars   = array(
		'--wrbc-accent-text' => $text,
		'--wrbc-focus'       => $text,
	);
}

// No tabindex here: wrbc-tabs makes the open panel focusable (0) and the
// others not (-1). Without JavaScript the panels are plain sections, not
// extra stops in the Tab order.
$extra = array(
	'id'                 => $uid,
	'class'              => trim( 'wrbc-tab ' . $tone ),
	'role'               => 'tabpanel',
	'aria-labelledby'    => $uid . '-tab',
	'data-wrbc-tab-panel' => '',
);
if ( $vars ) {
	$extra['style'] = wrbc_css_vars( $vars );
}
?>
<section <?php echo get_block_wrapper_attributes( $extra ); // phpcs:ignore ?>>
	<?php
	if ( '' !== trim( wp_strip_all_tags( $label ) ) ) {
		printf( '<h%1$d class="wrbc-tab__heading">%2$s</h%1$d>', (int) $level, $label ); // phpcs:ignore -- wrbc_rich()
	} else {
		// No label: the tabs block names it "Tab N" (it knows the position).
		printf( '<h%1$d class="wrbc-tab__heading" data-wrbc-tab-fallback></h%1$d>', (int) $level );
	}
	?>
	<div class="wrbc-tab__content"><?php echo $content; // phpcs:ignore -- rendered inner blocks ?></div>
</section>
