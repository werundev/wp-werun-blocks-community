<?php
/**
 * Timeline: front-end markup. The items are its inner blocks ($content),
 * each an <li> of one ordered list. Horizontal: a scroll-snap track that
 * works without JS (scrollbar, keyboard); view.js adds the arrows.
 *
 * @var array    $attributes Block attributes.
 * @var string   $content    Rendered items.
 * @var WP_Block $block      Block instance.
 *
 * @package werun-blocks-community
 */

defined( 'ABSPATH' ) || exit;

if ( ! function_exists( 'wrbc_timeline_effective' ) ) {
	/**
	 * The values the timeline renders with. Twin of effective() in
	 * src/timeline/effective.js: same enums, same clamps.
	 *
	 * @param array $a Block attributes.
	 */
	function wrbc_timeline_effective( array $a ) {
		$clamp       = static function ( $value, $min, $max, $fallback ) {
			return is_numeric( $value ) ? max( $min, min( $max, 0 + $value ) ) : $fallback;
		};
		$one_of      = static function ( $value, $options, $fallback ) {
			return in_array( $value, $options, true ) ? $value : $fallback;
		};
		$orientation = $one_of( $a['orientation'] ?? '', array( 'vertical', 'alternating', 'horizontal' ), 'vertical' );
		$line_style  = $one_of( $a['lineStyle'] ?? '', array( 'solid', 'dashed', 'dotted', 'none' ), 'solid' );
		$marker      = $one_of( $a['markerStyle'] ?? '', array( 'dot', 'icon', 'number', 'year' ), 'dot' );
		$card_style  = $one_of( $a['cardStyle'] ?? '', array( 'plain', 'bordered', 'filled', 'shadow' ), 'bordered' );
		return array(
			'orientation' => $orientation,
			'horizontal'  => 'horizontal' === $orientation,
			'alternating' => 'alternating' === $orientation,
			'start'       => ( isset( $a['alternateStart'] ) && 'start' === $a['alternateStart'] ) ? 'start' : 'end',
			'item_width'  => (int) round( $clamp( $a['itemWidth'] ?? null, 200, 520, 300 ) ),
			'arrows'      => 'horizontal' === $orientation && wrbc_on( $a, 'showArrows', true ),
			'line_style'  => $line_style,
			'has_line'    => 'none' !== $line_style,
			'line_width'  => $clamp( $a['lineWidth'] ?? null, 1, 6, 2 ),
			'marker'      => $marker,
			// With year markers the date is the marker itself.
			'date_at'     => 'year' === $marker ? 'marker' : $one_of( $a['datePosition'] ?? '', array( 'card', 'opposite' ), 'card' ),
			'card_style'  => $card_style,
			'boxed'       => 'plain' !== $card_style,
			'icon_size'   => $clamp( $a['iconSize'] ?? null, 12, 40, 18 ),
			// The ranges of the editor controls.
			'icon_stroke' => $clamp( $a['iconStroke'] ?? null, 1, 3, 2 ),
			'gap'         => $clamp( $a['gap'] ?? null, 0, 96, 32 ),
			'card_radius' => $clamp( $a['cardRadius'] ?? null, 0, 40, 14 ),
			'card_pad'    => $clamp( $a['cardPadding'] ?? null, 0, 64, 24 ),
		);
	}
}

if ( ! function_exists( 'wrbc_timeline_colors' ) ) {
	/**
	 * The timeline's colours (docs/accessibility.md): its tone class, the
	 * accent vars (on-accent, accent as text) and the text on the markers.
	 * Twin of timelineColors() in src/timeline/effective.js.
	 *
	 * @param array  $a       Block attributes.
	 * @param array  $e       wrbc_timeline_effective().
	 * @param string $surface What the content sits on (wrbc_surface()).
	 * @param string $around  What's around the block (wrbc_context_background()).
	 * @return array{ class: string, vars: array }
	 */
	function wrbc_timeline_colors( array $a, array $e, $surface, $around ) {
		$tone = wrbc_tone_class( $surface, $around );
		// The dates sit in the cards: on filled cards without a colour of their
		// own that's the surface tinted with 4 % of the text colour (--wrbc-surface).
		$accent_bg = $surface;
		if ( 'filled' === $e['card_style'] && '' === wrbc_text( $a['cardBg'] ?? '' ) ) {
			$ink = wrbc_block_colors( $a )['text'];
			if ( '' === $ink ) {
				if ( 'wrbc-is-dark' === $tone ) {
					$ink = WERUN_BLOCKS_COMMUNITY_PAPER;
				} else {
					// The tones' text: white on dark (above), black on light.
					$ink = 'wrbc-is-light' === $tone ? '#000000' : wrbc_page_colors()['text'];
				}
			}
			$fg = wrbc_color_rgba( $ink );
			$bg = wrbc_color_rgba( $surface );
			if ( null !== $fg && null !== $bg ) {
				$fg[3]     = 0.04;
				$accent_bg = wrbc_color_hex( wrbc_color_over( $fg, $bg ) );
			}
		}
		$vars = wrbc_accent_vars( $a, $accent_bg );
		// Text and icons on the markers: a chosen colour made readable on the
		// marker, or the automatic on-colour of a chosen marker colour (the
		// highlight ring uses it on dots too); otherwise --wrbc-on-accent.
		$fill   = wrbc_text( $a['markerColor'] ?? '' );
		$accent = wrbc_text( $a['accentColor'] ?? '' );
		$on     = 'dot' !== $e['marker'] ? wrbc_text( $a['markerTextColor'] ?? '' ) : '';
		if ( '' !== $on ) {
			$on = wrbc_readable_color( $on, '' !== $fill ? $fill : ( '' !== $accent ? $accent : WERUN_BLOCKS_COMMUNITY_ACCENT ), WERUN_BLOCKS_COMMUNITY_AA_TEXT );
		} elseif ( '' !== $fill ) {
			$on = wrbc_on_color( $fill );
		}
		$vars['--wrbc-tl-marker-text'] = $on;
		return array(
			'class' => $tone,
			'vars'  => $vars,
		);
	}
}

$a   = $attributes;
$uid = wrbc_uid( $a, 'wrbc-timeline' );
$e   = wrbc_timeline_effective( $a );
// What the timeline sits on (its own background, or the one around it), and
// the colours that read on it.
$colors = wrbc_timeline_colors( $a, $e, wrbc_surface( $a, $block ), wrbc_context_background( $block ) );

$classes = array(
	'wrbc-root',
	'wrbc-timeline',
	'wrbc-timeline--' . $e['orientation'],
	'wrbc-timeline--marker-' . $e['marker'],
	'wrbc-timeline--date-' . $e['date_at'],
	'wrbc-timeline--card-' . $e['card_style'],
	'wrbc-timeline--line-' . $e['line_style'],
	$uid,
);
if ( $e['alternating'] ) {
	$classes[] = 'wrbc-timeline--start-' . $e['start'];
}
if ( '' !== $colors['class'] ) {
	$classes[] = $colors['class'];
}

$is_icon = 'icon' === $e['marker'];
$style   = wrbc_css_vars(
	array_merge(
		array(
			'--wrbc-gap'            => wrbc_px( $e['gap'] ),
			'--wrbc-tl-line-w'      => $e['has_line'] ? wrbc_px( $e['line_width'] ) : '',
			'--wrbc-tl-line-color'  => $e['has_line'] ? ( $a['lineColor'] ?? '' ) : '',
			'--wrbc-tl-item-w'      => $e['horizontal'] ? wrbc_px( $e['item_width'] ) : '',
			'--wrbc-tl-marker'      => $a['markerColor'] ?? '',
			'--wrbc-icon-size'      => $is_icon ? wrbc_px( $e['icon_size'] ) : '',
			'--wrbc-icon-stroke'    => $is_icon ? $e['icon_stroke'] : '',
			'--wrbc-card-bg'        => $e['boxed'] ? ( $a['cardBg'] ?? '' ) : '',
			'--wrbc-card-border'    => 'bordered' === $e['card_style'] ? ( $a['cardBorderColor'] ?? '' ) : '',
			'--wrbc-radius'         => $e['boxed'] ? wrbc_px( $e['card_radius'] ) : '',
			'--wrbc-card-pad'       => $e['boxed'] ? wrbc_px( $e['card_pad'] ) : '',
		),
		// --wrbc-accent, --wrbc-on-accent, --wrbc-accent-text, --wrbc-tl-marker-text.
		$colors['vars']
	)
);

$has_title = wrbc_on( $a, 'showHeader', false ) && '' !== trim( wp_strip_all_tags( wrbc_text( $a['title'] ?? '' ) ) );
$extra     = array(
	'id'    => $uid,
	'class' => implode( ' ', $classes ),
	'style' => $style,
);
if ( $has_title ) {
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

$has_items = '' !== trim( (string) $content );
// No items and no header: nothing to show, no empty section or list.
if ( ! $has_items && '' === $header_html ) {
	return;
}
$list = $has_items ? '<ol class="wrbc-timeline__list" role="list">' . $content . '</ol>' : '';
?>
<section <?php echo get_block_wrapper_attributes( $extra ); // phpcs:ignore ?>>
	<?php echo $header_html; // phpcs:ignore -- wrbc_section_header() output ?>
	<?php if ( $e['horizontal'] && $has_items ) : ?>
		<?php
		// A focusable, named group: the arrow keys scroll it without JS.
		// view.js keeps tabindex, role and name only while it overflows and an
		// item has nothing focusable that would bring it into view
		// (docs/accessibility.md: scrollers). A group, not a region: no
		// landmark, and not the section's own name.
		$track_label = $has_title
			/* translators: %s: the timeline's title. */
			? sprintf( __( '%s, use the arrow keys to scroll', 'werun-blocks-community' ), trim( wp_strip_all_tags( wrbc_text( $a['title'] ) ) ) )
			: __( 'Timeline, use the arrow keys to scroll', 'werun-blocks-community' );
		?>
		<div class="wrbc-timeline__viewport" id="<?php echo esc_attr( $uid ); ?>-track" data-wrbc-tl-track tabindex="0" role="group" aria-label="<?php echo esc_attr( $track_label ); ?>">
			<?php echo $list; // phpcs:ignore -- rendered inner blocks ?>
		</div>
		<?php if ( $e['arrows'] ) : ?>
			<div class="wrbc-timeline__nav" data-wrbc-tl-nav hidden>
				<button type="button" class="wrbc-timeline__arrow" data-wrbc-tl-prev aria-controls="<?php echo esc_attr( $uid ); ?>-track" aria-label="<?php esc_attr_e( 'Scroll back', 'werun-blocks-community' ); ?>">
					<?php echo wrbc_icon( 'chevron-left' ); // phpcs:ignore ?>
				</button>
				<button type="button" class="wrbc-timeline__arrow" data-wrbc-tl-next aria-controls="<?php echo esc_attr( $uid ); ?>-track" aria-label="<?php esc_attr_e( 'Scroll forward', 'werun-blocks-community' ); ?>">
					<?php echo wrbc_icon( 'chevron-right' ); // phpcs:ignore ?>
				</button>
			</div>
		<?php endif; ?>
	<?php else : ?>
		<?php echo $list; // phpcs:ignore -- rendered inner blocks ?>
	<?php endif; ?>
</section>
