<?php
/**
 * Feature grid: front-end markup. The cards are its inner blocks ($content).
 *
 * @var array    $attributes Block attributes.
 * @var string   $content    Rendered feature cards.
 * @var WP_Block $block      Block instance.
 *
 * @package werun-blocks-community
 */

defined( 'ABSPATH' ) || exit;

require_once dirname( __DIR__ ) . '/feature/colors.php';

$a   = $attributes;
$uid = wrbc_uid( $a, 'wrbc-features' );

// The same rules as edit.js: "beside" needs an icon or a badge to sit beside
// the text, and a plain card (no box) can only lift on hover.
$card_style = in_array( $a['cardStyle'], array( 'plain', 'bordered', 'filled', 'shadow' ), true ) ? $a['cardStyle'] : 'bordered';
$layout     = ( 'inline' === $a['layout'] && ( wrbc_on( $a, 'showIcon' ) || wrbc_on( $a, 'showBadge' ) ) ) ? 'inline' : 'stacked';
$hover      = in_array( $a['hover'], array( 'none', 'lift', 'border', 'accent' ), true ) ? $a['hover'] : 'lift';
if ( 'plain' === $card_style && 'lift' !== $hover ) {
	$hover = 'none';
}

$link_style = in_array( $a['linkStyle'], array( 'link', 'button', 'card' ), true ) ? $a['linkStyle'] : 'link';
// Same limits as the editor's sliders (edit.js, IconSizeControls).
$num = static function ( $value, $min, $max, $fallback ) {
	return max( $min, min( $max, is_numeric( $value ) ? 0 + $value : $fallback ) );
};

// What the grid sits on: its own background (Color panel), or the one around
// it (a dark section or group). Its text, accent and focus ring follow it
// (docs/accessibility.md); every card does the same for its own background
// (wrbc_feature_colors() in src/feature/render.php). Twin in edit.js.
$surface = wrbc_surface( $a, $block );

$classes = array(
	'wrbc-root',
	'wrbc-features',
	'wrbc-features--' . $card_style,
	'wrbc-features--' . $layout,
	'wrbc-features--align-' . ( 'center' === $a['contentAlign'] ? 'center' : 'left' ),
	'wrbc-features--hover-' . $hover,
	'wrbc-features--link-' . $link_style,
	$uid,
	wrbc_tone_class( $surface, wrbc_context_background( $block ) ),
);
if ( wrbc_on( $a, 'equalHeight' ) ) {
	$classes[] = 'is-equal-height';
}

$style = wrbc_css_vars(
	array_merge(
		// The accent, and the accent as text (eyebrow, links, icons, focus
		// ring) made readable on the surface when it needs to be.
		wrbc_accent_vars( $a, $surface ),
		array(
			'--wrbc-cols-d'      => max( 1, min( 6, (int) $a['columnsDesktop'] ) ),
			'--wrbc-cols-t'      => max( 1, min( 4, (int) $a['columnsTablet'] ) ),
			'--wrbc-cols-m'      => max( 1, min( 2, (int) $a['columnsMobile'] ) ),
			'--wrbc-gap'         => wrbc_px( $num( $a['gap'] ?? null, 0, 80, 24 ) ),
			'--wrbc-icon-bg'     => $a['iconBg'] ?? '',
			'--wrbc-card-bg'     => $a['cardBg'] ?? '',
			'--wrbc-card-border' => $a['cardBorderColor'] ?? '',
			'--wrbc-radius'      => wrbc_px( $num( $a['cardRadius'] ?? null, 0, 40, 14 ) ),
			'--wrbc-card-pad'    => wrbc_px( $num( $a['cardPadding'] ?? null, 0, 64, 28 ) ),
			'--wrbc-icon-size'   => wrbc_px( $num( $a['iconSize'] ?? null, 12, 64, 24 ) ),
			'--wrbc-icon-stroke' => $num( $a['iconStroke'] ?? null, 1, 3, 2 ),
		)
	)
);

$extra = array(
	'id'    => $uid,
	'class' => implode( ' ', array_filter( $classes ) ),
	'style' => $style,
);
// Only when the header really prints a title (wrbc_section_header() skips an empty one).
if ( wrbc_on( $a, 'showHeader' ) && '' !== trim( wp_strip_all_tags( wrbc_text( $a['title'] ?? '' ) ) ) ) {
	$extra['aria-labelledby'] = $uid . '-title';
}
$header = wrbc_section_header( $a, $uid );
if ( '' === trim( $content ) && '' === $header ) {
	return; // No cards and no header: no empty section.
}
?>
<section <?php echo get_block_wrapper_attributes( $extra ); // phpcs:ignore ?>>
	<?php echo $header; // phpcs:ignore -- escaped by wrbc_section_header() ?>
	<?php if ( '' !== trim( $content ) ) : ?>
		<div class="wrbc-features__grid" role="list">
			<?php echo $content; // phpcs:ignore -- rendered inner blocks ?>
		</div>
	<?php endif; ?>
</section>
