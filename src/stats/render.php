<?php
/**
 * Stats: front-end markup. The stats are its inner blocks ($content).
 *
 * @var array    $attributes Block attributes.
 * @var string   $content    Rendered stats.
 * @var WP_Block $block      Block instance.
 *
 * @package werun-blocks-community
 */

defined( 'ABSPATH' ) || exit;

if ( ! function_exists( 'wrbc_stats_effective' ) ) {
	/**
	 * The values the stats block renders with. Twin of effective() in
	 * src/stats/effective.js: same enums, same clamps.
	 *
	 * @param array $a Block attributes.
	 */
	function wrbc_stats_effective( array $a ) {
		$clamp  = static function ( $value, $min, $max, $fallback ) {
			return is_numeric( $value ) ? max( $min, min( $max, 0 + $value ) ) : $fallback;
		};
		$one_of = static function ( $value, $options, $fallback ) {
			return in_array( $value, $options, true ) ? $value : $fallback;
		};
		$layout     = $one_of( $a['layout'] ?? '', array( 'row', 'cards', 'large' ), 'row' );
		$cards      = 'cards' === $layout;
		$icon_style = $one_of( $a['iconStyle'] ?? '', array( 'none', 'circle', 'square', 'outline' ), 'none' );
		return array(
			'layout'      => $layout,
			'cards'       => $cards,
			'align'       => ( isset( $a['contentAlign'] ) && 'left' === $a['contentAlign'] ) ? 'left' : 'center',
			'card_style'  => $one_of( $a['cardStyle'] ?? '', array( 'bordered', 'filled', 'shadow' ), 'filled' ),
			// Cards have their own box: separators are for the row and large layouts.
			'separators'  => ! $cards && wrbc_on( $a, 'separators', true ),
			'icon_style'  => $icon_style,
			'icon_has_bg' => wrbc_on( $a, 'showIcon', false ) && in_array( $icon_style, array( 'circle', 'square' ), true ),
			'cols_d'      => (int) round( $clamp( $a['columnsDesktop'] ?? null, 1, 6, 4 ) ),
			'cols_t'      => (int) round( $clamp( $a['columnsTablet'] ?? null, 1, 4, 2 ) ),
			'cols_m'      => (int) round( $clamp( $a['columnsMobile'] ?? null, 1, 2, 1 ) ),
			'number_size' => $clamp( $a['numberSize'] ?? null, 1.5, 8, 3 ),
			// The ranges of the editor controls.
			'gap'         => $clamp( $a['gap'] ?? null, 0, 96, 32 ),
			'card_radius' => $clamp( $a['cardRadius'] ?? null, 0, 40, 14 ),
			'card_pad'    => $clamp( $a['cardPadding'] ?? null, 0, 64, 28 ),
			'icon_size'   => $clamp( $a['iconSize'] ?? null, 12, 64, 28 ),
			'icon_stroke' => $clamp( $a['iconStroke'] ?? null, 1, 3, 2 ),
		);
	}
}

$a        = $attributes;
$uid      = wrbc_uid( $a, 'wrbc-stats' );
$e        = wrbc_stats_effective( $a );
$has_icon = wrbc_on( $a, 'showIcon', false );
// What the stats sit on: the block's own background, or the one around it
// (a dark section or group). Text, accent and focus ring follow it
// (docs/accessibility.md); each card does the same for its own background
// (wrbc_stat_colors() in src/stat/render.php).
$surface = wrbc_surface( $a, $block );

$classes = array(
	'wrbc-root',
	'wrbc-stats',
	'wrbc-stats--' . $e['layout'],
	'wrbc-stats--align-' . $e['align'],
	$uid,
	wrbc_tone_class( $surface, wrbc_context_background( $block ) ),
);
if ( $e['cards'] ) {
	$classes[] = 'wrbc-stats--card-' . $e['card_style'];
}
if ( $e['separators'] ) {
	$classes[] = 'wrbc-stats--sep';
}

$style = wrbc_css_vars(
	array_merge(
		// The accent, and the accent as text (numbers, icons, links, focus
		// ring) made readable on the surface when it needs to be.
		wrbc_accent_vars( $a, $surface ),
		array(
			'--wrbc-cols-d'      => $e['cols_d'],
			'--wrbc-cols-t'      => $e['cols_t'],
			'--wrbc-cols-m'      => $e['cols_m'],
			'--wrbc-gap'         => wrbc_px( $e['gap'] ),
			'--wrbc-stats-sep'   => $e['separators'] ? ( $a['separatorColor'] ?? '' ) : '',
			'--wrbc-card-bg'     => $e['cards'] ? ( $a['cardBg'] ?? '' ) : '',
			'--wrbc-card-border' => ( $e['cards'] && 'bordered' === $e['card_style'] ) ? ( $a['cardBorderColor'] ?? '' ) : '',
			'--wrbc-radius'      => $e['cards'] ? wrbc_px( $e['card_radius'] ) : '',
			'--wrbc-card-pad'    => $e['cards'] ? wrbc_px( $e['card_pad'] ) : '',
			'--wrbc-icon-size'   => $has_icon ? wrbc_px( $e['icon_size'] ) : '',
			'--wrbc-icon-stroke' => $has_icon ? $e['icon_stroke'] : '',
			'--wrbc-icon-color'  => $has_icon ? ( $a['iconColor'] ?? '' ) : '',
			'--wrbc-icon-bg'     => $e['icon_has_bg'] ? ( $a['iconBg'] ?? '' ) : '',
			'--wrbc-stat-size'   => wrbc_px( $e['number_size'], 'em' ),
		)
	)
);

$extra = array(
	'id'    => $uid,
	'class' => implode( ' ', array_filter( $classes ) ),
	'style' => $style,
);
if ( wrbc_on( $a, 'showHeader', false ) && '' !== trim( wp_strip_all_tags( wrbc_text( $a['title'] ?? '' ) ) ) ) {
	$extra['aria-labelledby'] = $uid . '-title';
}
// wrbc_section_header() reads a missing showHeader as on; this block's default is off.
$header_attrs               = $a;
$header_attrs['showHeader'] = wrbc_on( $a, 'showHeader', false );
// A part that is only markup ("<em></em>", "<br>") counts as empty: the
// shared header tests the raw value, so it would print an empty tag.
foreach ( array( 'title', 'eyebrow', 'intro' ) as $part ) {
	$value                 = wrbc_text( $a[ $part ] ?? '' );
	$header_attrs[ $part ] = '' === trim( wp_strip_all_tags( $value ) ) ? '' : $value;
}
$header_html = wrbc_section_header( $header_attrs, $uid );
$has_stats = '' !== trim( (string) $content );
// No stats and no header: nothing to show, no empty section.
if ( ! $has_stats && '' === $header_html ) {
	return;
}
?>
<section <?php echo get_block_wrapper_attributes( $extra ); // phpcs:ignore ?>>
	<?php echo $header_html; // phpcs:ignore -- wrbc_section_header() output ?>
	<?php if ( $has_stats ) : ?>
		<div class="wrbc-stats__grid" role="list">
			<?php echo $content; // phpcs:ignore -- rendered inner blocks ?>
		</div>
	<?php endif; ?>
</section>
