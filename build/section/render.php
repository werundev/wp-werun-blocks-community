<?php
/**
 * Section: front-end markup. Any blocks inside ($content), an optional header,
 * a background image with overlay, and one or two columns.
 *
 * Effective values mirror edit.js (see "The same rules as render.php" there).
 *
 * @var array    $attributes Block attributes.
 * @var string   $content    Rendered inner blocks.
 * @var WP_Block $block      Block instance.
 *
 * @package werun-blocks-community
 */

defined( 'ABSPATH' ) || exit;

$a     = $attributes;
$uid   = wrbc_uid( $a, 'wrbc-section' );
$scale = array( 'none', 'sm', 'md', 'lg', 'xl' );
$style = isset( $a['style'] ) && is_array( $a['style'] ) ? $a['style'] : array();
$color = isset( $style['color'] ) && is_array( $style['color'] ) ? $style['color'] : array();

$tag    = in_array( $a['tagName'] ?? '', array( 'section', 'div', 'article', 'aside' ), true ) ? $a['tagName'] : 'section';
$pad_d  = in_array( $a['paddingY'] ?? '', $scale, true ) ? $a['paddingY'] : 'lg';
$pad_t  = in_array( $a['paddingYTablet'] ?? '', $scale, true ) ? $a['paddingYTablet'] : '';
$pad_m  = in_array( $a['paddingYMobile'] ?? '', $scale, true ) ? $a['paddingYMobile'] : '';
$cols   = 'two' === ( $a['columns'] ?? '' ) ? 'two' : 'one';
$ratio  = in_array( $a['columnsRatio'] ?? '', array( '50-50', '60-40', '40-60' ), true ) ? $a['columnsRatio'] : '50-50';
$gap    = max( 0, min( 120, (int) ( $a['columnGap'] ?? 48 ) ) );
$inner  = in_array( $a['innerWidth'] ?? '', array( 'content', 'wide', 'full', 'custom' ), true ) ? $a['innerWidth'] : 'wide';
$max_w  = max( 320, min( 1920, (int) ( $a['innerMaxWidth'] ?? 1200 ) ) );
$valign = in_array( $a['verticalAlign'] ?? '', array( 'start', 'center', 'end' ), true ) ? $a['verticalAlign'] : 'center';

$min_unit = 'px' === ( $a['minHeightUnit'] ?? '' ) ? 'px' : 'vh';
$min_h    = max( 0, min( (int) ( $a['minHeight'] ?? 0 ), 'px' === $min_unit ? 2000 : 100 ) );

// Background image: only with the "Image" background and a picture chosen.
$bg_id   = (int) ( $a['bgImageId'] ?? 0 );
// A rejected URL (javascript:, …) is no image, not an empty src under an overlay.
$bg_url  = esc_url_raw( wrbc_text( $a['bgImageUrl'] ?? '' ) );
$has_img = 'image' === ( $a['bgType'] ?? '' ) && ( $bg_id > 0 || '' !== $bg_url );
$fixed   = $has_img && wrbc_on( $a, 'bgFixed', false );
$focal   = isset( $a['bgFocal'] ) && is_array( $a['bgFocal'] ) ? $a['bgFocal'] : array();
$focal_x = is_numeric( $focal['x'] ?? null ) ? max( 0, min( 1, (float) $focal['x'] ) ) : 0.5;
$focal_y = is_numeric( $focal['y'] ?? null ) ? max( 0, min( 1, (float) $focal['y'] ) ) : 0.5;

$bg_html = '';
if ( $has_img ) {
	$bg_html = $bg_id > 0
		? wp_get_attachment_image(
			$bg_id,
			'full',
			false,
			array(
				'class' => 'wrbc-section__bg-img',
				'alt'   => '',
				'sizes' => '100vw',
			)
		)
		: '';
	if ( '' === $bg_html && '' !== $bg_url ) {
		$bg_html = '<img class="wrbc-section__bg-img" src="' . esc_url( $bg_url ) . '" alt="" decoding="async">';
	}
}
// A deleted attachment with no URL left: no background image after all.
$has_img = '' !== $bg_html;
$fixed   = $has_img && $fixed;

// A text colour set on the block wins, so the light/dark helper does nothing then.
$has_text_color = ! empty( $a['textColor'] ) || ! empty( $color['text'] );
$tone           = $has_text_color ? 'auto' : ( in_array( $a['textTone'] ?? '', array( 'light', 'dark' ), true ) ? $a['textTone'] : 'auto' );
$has_bg         = $has_img || ! empty( $a['backgroundColor'] ) || ! empty( $a['gradient'] ) || ! empty( $color['background'] ) || ! empty( $color['gradient'] );
$align          = wrbc_text( $a['align'] ?? '' );

// Colours (docs/accessibility.md); edit.js computes the same. Over a picture
// the text colour is always known, so the overlay can be held to the floor
// that keeps it readable over the lightest and the darkest pixel: "automatic"
// takes what the overlay calls for (light text on a dark overlay).
$colors   = wrbc_block_colors( $a );
$overlay  = '';
$img_text = '';
$over_o   = 0;
if ( $has_img ) {
	$overlay = substr( wrbc_color_hex( wrbc_color_rgba( wrbc_text( $a['overlayColor'] ?? '' ) ) ), 0, 7 );
	$overlay = '' !== $overlay ? $overlay : '#000000';
	if ( 'auto' === $tone && ! $has_text_color ) {
		$tone = true === wrbc_is_dark_color( $overlay ) ? 'light' : 'dark';
	}
	$img_text = '' !== $colors['text'] ? $colors['text'] : ( 'dark' === $tone ? WERUN_BLOCKS_COMMUNITY_INK : WERUN_BLOCKS_COMMUNITY_PAPER );
	// An older, lower stored value never reaches the page.
	$over_o = wrbc_overlay_opacity( $a['overlayOpacity'] ?? 55, $img_text, $overlay );
}
// What everything inside sits on: the section's own colour, gradient, picture
// or tone, else the background around it (a dark group, another section).
$surface = wrbc_surface( $a, $block );
if ( $has_img ) {
	// Light text: the picture is a dark surface for everything inside it.
	$tone_class = true === wrbc_is_dark_color( $img_text ) ? 'wrbc-is-light' : 'wrbc-is-dark';
} else {
	$tone_class = wrbc_tone_class( $surface, wrbc_context_background( $block ) );
}
// The light/dark text on the section's own colour or gradient: the readable
// version when the chosen tone doesn't reach 4.5:1 there (the closest colour
// to it; the stored tone stays). Without a colour of its own the tone says
// what's behind (a dark theme area), so it's taken as it is.
$own_bg    = ! $has_img && ( '' !== $colors['background'] || $colors['gradient'] ) ? wrbc_block_surface( $a, 'werun-community/section' ) : '';
$tone_text = '';
if ( 'auto' !== $tone && '' !== $own_bg ) {
	$picked    = 'light' === $tone ? WERUN_BLOCKS_COMMUNITY_PAPER : WERUN_BLOCKS_COMMUNITY_INK;
	$tone_text = wrbc_readable_color( $picked, $own_bg, WERUN_BLOCKS_COMMUNITY_AA_TEXT );
	$tone_text = strtolower( $tone_text ) !== $picked ? $tone_text : '';
}
// Secondary text (the header's intro) on the section's own colour: as much of
// the text colour as 4.5:1 needs there (more than the 76 % default on a
// mid-dark colour). Over a picture it's the full text colour (style.scss).
$muted   = 0;
$text_is = '' !== $colors['text'] ? $colors['text'] : ( '' !== $tone_text ? $tone_text : ( 'light' === $tone || ( 'auto' === $tone && 'wrbc-is-dark' === $tone_class ) ? WERUN_BLOCKS_COMMUNITY_PAPER : ( 'dark' === $tone ? WERUN_BLOCKS_COMMUNITY_INK : '' ) ) );
$fg      = '' !== $own_bg && '' !== $text_is ? wrbc_color_rgba( $text_is ) : null;
for ( $pct = 76; null !== $fg && $pct <= 100; $pct++ ) {
	$muted = $pct;
	if ( wrbc_contrast_ratio( array( $fg[0], $fg[1], $fg[2], $pct / 100 ), $own_bg ) >= WERUN_BLOCKS_COMMUNITY_AA_TEXT ) {
		break;
	}
}
// As a solid colour: WordPress strips color-mix() from a block's inline style.
$muted = $muted > 76 ? wrbc_color_hex( wrbc_color_over( array( $fg[0], $fg[1], $fg[2], $muted / 100 ), wrbc_color_rgba( $own_bg ) ) ) : '';

$accent_vars = wrbc_accent_vars( array(), $surface );
// Over a picture only the text colour is sure to read (the overlay is held for
// it): links and anything else in the accent take it there.
if ( $has_img ) {
	$accent_vars['--wrbc-accent-text'] = $img_text;
}

// Header parts with content (wrbc_section_header() skips the empty ones; an
// all-empty header would print an empty box).
$title       = wrbc_text( $a['title'] ?? '' );
$has_title   = '' !== trim( wp_strip_all_tags( $title ) );
$eyebrow     = wrbc_text( $a['eyebrow'] ?? '' );
$has_eyebrow = wrbc_on( $a, 'showEyebrow' ) && '' !== trim( wp_strip_all_tags( $eyebrow ) );
$intro       = wrbc_text( $a['intro'] ?? '' );
$has_intro   = wrbc_on( $a, 'showIntro' ) && '' !== trim( wp_strip_all_tags( $intro ) );
$has_header  = wrbc_on( $a, 'showHeader', false ) && ( $has_title || $has_eyebrow || $has_intro );
$header     = '';
if ( $has_header ) {
	$header_attrs = array(
		'showHeader'  => true,
		// Only parts with text: wrbc_section_header() prints any non-empty value (a lone <br> too).
		'showEyebrow' => $has_eyebrow,
		'showIntro'   => $has_intro,
		'eyebrow'     => $has_eyebrow ? $eyebrow : '',
		'title'       => $has_title ? $title : '',
		'intro'       => $has_intro ? $intro : '',
		'headerAlign' => 'center' === ( $a['headerAlign'] ?? '' ) ? 'center' : 'left',
		'titleLevel'  => (int) ( $a['titleLevel'] ?? 2 ),
	);
	$header       = wrbc_section_header( $header_attrs, $uid );
}

$has_content = '' !== trim( (string) $content );
if ( ! $has_content && '' === $header && ! $has_bg ) {
	return;
}

$classes = array(
	'wrbc-root',
	'wrbc-section',
	'wrbc-section--cols-' . $cols,
	'wrbc-section--inner-' . $inner,
	'wrbc-section--valign-' . $valign,
	'wrbc-section--py-' . $pad_d,
	$uid,
);
if ( '' !== $pad_t ) {
	$classes[] = 'wrbc-section--py-t-' . $pad_t;
}
if ( '' !== $pad_m ) {
	$classes[] = 'wrbc-section--py-m-' . $pad_m;
}
if ( 'two' === $cols ) {
	$classes[] = 'wrbc-section--ratio-' . $ratio;
	if ( wrbc_on( $a, 'mobileReverse', false ) ) {
		$classes[] = 'wrbc-section--mobile-reverse';
	}
}
if ( 'auto' !== $tone ) {
	$classes[] = 'wrbc-section--tone-' . $tone;
}
if ( '' !== $tone_class ) {
	$classes[] = $tone_class;
}
if ( $has_img ) {
	$classes[] = 'has-bg-image';
}
if ( $fixed ) {
	$classes[] = 'wrbc-section--fixed';
}
if ( $min_h > 0 ) {
	$classes[] = 'has-min-height';
}
// Full width, or a coloured band: the content keeps a gutter from the edges.
if ( 'full' === $align || $has_bg ) {
	$classes[] = 'has-gutter';
}

$wrapper_attrs = array(
	'id'    => $uid,
	'class' => implode( ' ', $classes ),
	'style' => wrbc_css_vars(
		array_merge(
			array(
				'--wrbc-section-max'     => 'custom' === $inner ? $max_w . 'px' : '',
				'--wrbc-section-min-h'   => $min_h > 0 ? $min_h . $min_unit : '',
				'--wrbc-section-gap'     => 'two' === $cols ? $gap . 'px' : '',
				'--wrbc-section-focal'   => $has_img ? round( $focal_x * 100, 2 ) . '% ' . round( $focal_y * 100, 2 ) . '%' : '',
				'--wrbc-section-overlay' => $overlay,
				'--wrbc-section-over-o'  => $has_img ? $over_o / 100 : '',
				// The text colour over the picture: focus rings there use it (style.scss).
				'--wrbc-section-text'    => $img_text,
				'--wrbc-section-tone'    => $tone_text,
				'--wrbc-muted'           => $muted,
			),
			// The accent readable on this background (header eyebrow, focus ring, links).
			$accent_vars
		)
	),
);
if ( '' !== $header && $has_title && 'div' !== $tag ) {
	$wrapper_attrs['aria-labelledby'] = $uid . '-title';
}
$reveal = wrbc_on( $a, 'reveal', false ) ? ' data-wrbc-reveal' : '';

printf( '<%1$s %2$s>', tag_escape( $tag ), get_block_wrapper_attributes( $wrapper_attrs ) ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
if ( '' !== $bg_html ) {
	// data-wrbc-backdrop: the editor's contrast audit and the a11y harness read the text over them as over any image.
	echo '<span class="wrbc-section__bg" aria-hidden="true" data-wrbc-backdrop="image">' . $bg_html . '</span><span class="wrbc-section__overlay" aria-hidden="true" data-wrbc-backdrop="overlay"></span>'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
}
if ( $has_content || '' !== $header ) {
	echo '<div class="wrbc-section__inner"' . $reveal . '>'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
	echo $header; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- built by wrbc_section_header() from escaped parts.
	if ( $has_content ) {
		printf(
			'<div class="wrbc-section__content%1$s">%2$s</div>',
			'one' === $cols ? ' is-layout-flow' : '',
			$content // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- rendered inner blocks.
		);
	}
	echo '</div>';
}
printf( '</%s>', tag_escape( $tag ) );
