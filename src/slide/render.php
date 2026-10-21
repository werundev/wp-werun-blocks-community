<?php
/**
 * Slide: one slide of a carousel. Its blocks ($content) over an optional
 * background image (an <img>, so it is lazy-loaded and has a srcset) and
 * overlay. Background colour, text colour and padding come from the block
 * supports; the carousel sets the default padding, ratio and min height, and
 * passes its slide style, slide background, accent and text colour as context.
 *
 * Colours (docs/accessibility.md): whatever the slide's text sits on — the
 * overlay over its photo, its own background, the carousel's slide
 * background or the shadow card's white — gives the slide its tone class
 * (wrbc-is-dark / wrbc-is-light), a readable text colour when the author chose
 * none, and the accent made readable on it (links, focus rings). Editor
 * twin: slideColors() in colors.js.
 *
 * @var array    $attributes Block attributes.
 * @var string   $content    Rendered inner blocks.
 * @var WP_Block $block      Block instance.
 *
 * @package werun-blocks-community
 */

defined( 'ABSPATH' ) || exit;

// Runs in its own scope: nothing here becomes a global.
( static function ( $attributes, $content, $block ) {
$a      = $attributes;
$ctx    = is_array( $block->context ?? null ) ? $block->context : array();
$bg_id  = is_numeric( $a['bgId'] ?? null ) ? absint( $a['bgId'] ) : 0;
$bg_url = wrbc_text( $a['bgUrl'] ?? '' );
$bg_url = '' !== esc_url( $bg_url ) ? $bg_url : ''; // No javascript:, data: …
$focal  = is_array( $a['bgFocal'] ?? null ) ? $a['bgFocal'] : array();
$fx     = max( 0, min( 1, is_numeric( $focal['x'] ?? null ) ? (float) $focal['x'] : 0.5 ) );
$fy     = max( 0, min( 1, is_numeric( $focal['y'] ?? null ) ? (float) $focal['y'] : 0.5 ) );

// A heading of the template left empty prints nothing: screen readers would
// still announce and list an empty "heading level 3". (The editor keeps it,
// with its placeholder.)
$content = (string) preg_replace( '~<h([1-6])\b[^>]*>(?:\s|&nbsp;|&#160;|<br\s*/?>)*</h\1>~i', '', (string) $content );
// Whether any text sits on the slide: a background image needs its readable
// overlay only then (colors.js: hasText()).
$has_text = '' !== trim( (string) preg_replace( '/[\s\x{00A0}]+/u', ' ', html_entity_decode( wp_strip_all_tags( $content ), ENT_QUOTES | ENT_HTML5, 'UTF-8' ) ) );

// Decorative by default (alt="", hidden from screen readers); with alt text
// (a slide that is only a photo) the image is read like any other.
$bg_alt = trim( wp_strip_all_tags( wrbc_text( $a['bgAlt'] ?? '' ) ) );
$bg     = '';
// data-wrbc-backdrop marks the image and its overlay for the contrast checks
// (docs/accessibility.md), as in edit.js.
if ( $bg_id ) {
	$bg_attrs = array(
		'class'             => 'wrbc-slide__bg',
		'alt'               => $bg_alt,
		'loading'           => 'lazy',
		'decoding'          => 'async',
		'sizes'             => '(max-width: 1200px) 100vw, 1200px',
		'data-wrbc-backdrop' => 'image',
	);
	if ( '' === $bg_alt ) {
		$bg_attrs['aria-hidden'] = 'true';
	}
	$bg = wp_get_attachment_image( $bg_id, 'large', false, $bg_attrs );
}
if ( '' === $bg && '' !== $bg_url ) {
	$bg = '<img class="wrbc-slide__bg" src="' . esc_url( $bg_url ) . '" alt="' . esc_attr( $bg_alt ) . '"' . ( '' === $bg_alt ? ' aria-hidden="true"' : '' ) . ' loading="lazy" decoding="async" data-wrbc-backdrop="image">';
}

$own_text  = wrbc_block_colors( $a )['text']; // the slide's own text colour (Color panel): never overridden
$root_text = wrbc_block_colors(
	array(
		'textColor' => $ctx['werun-community/carousel/textColor'] ?? '',
		'style'     => $ctx['werun-community/carousel/style'] ?? array(),
	)
)['text']; // the carousel's (Color panel), which the slides inherit
$around    = wrbc_context_background( $block ); // the carousel's background, or what's around it
$under     = wrbc_color_rgba( $around );
$under     = null !== $under ? $under : array( 255.0, 255.0, 255.0, 1.0 );
$ov_color = wrbc_text( $a['overlayColor'] ?? '' );
$ov_color = '' !== wrbc_css_value( $ov_color ) && null !== wrbc_color_rgba( $ov_color ) ? $ov_color : '';
$overlay  = 0;  // overlay opacity, 0–90
$paint    = ''; // what the text sits on, one colour (the worst case over a photo)
$tone     = '';
$fg       = ''; // text colour printed when the author chose none

if ( '' !== $bg ) {
	$chosen = is_numeric( $a['overlayOpacity'] ?? null ) ? max( 0, min( 90, (float) $a['overlayOpacity'] ) ) : 0;
	if ( $has_text ) {
		// Text on a photo: the overlay never goes under the opacity that keeps
		// it readable over any image (its lightest and darkest pixel), for the
		// text colour it really gets: the author's, else white or ink for the
		// overlay. Unset = that minimum (55 % black for white text).
		$ov_color = '' !== $ov_color ? $ov_color : '#000000';
		$text_for = '' !== $own_text ? $own_text : wrbc_on_color( $ov_color );
		$overlay  = wrbc_overlay_opacity( $chosen, $text_for, $ov_color, WERUN_BLOCKS_COMMUNITY_AA_TEXT, 90 );
		$layer    = wrbc_color_rgba( $ov_color );
		$layer[3] = $overlay / 100;
		$on_white = wrbc_color_over( $layer, array( 255.0, 255.0, 255.0, 1.0 ) );
		$on_black = wrbc_color_over( $layer, array( 0.0, 0.0, 0.0, 1.0 ) );
		// Dark when even a white pixel ends up dark; when the two pixels disagree
		// (only past the 90 % cap) the text colour decides.
		$dark     = true === wrbc_is_dark_color( $on_white ) || ( true === wrbc_is_dark_color( $on_black ) && false === wrbc_is_dark_color( $text_for ) );
		// The worst pixel for that tone: the lighter result under light text, the darker under dark text.
		$paint = wrbc_color_hex( $dark ? $on_white : $on_black );
		// A photo is never the page: the slide always says which tone it is.
		$tone = $dark ? 'wrbc-is-dark' : 'wrbc-is-light';
		$fg   = '' === $own_text ? $text_for : '';
	} elseif ( '' !== $ov_color ) {
		$overlay = (int) round( $chosen ); // a photo alone: only the tint the author asked for (none unless set)
	}
} else {
	$own_bg = wrbc_block_surface( $a, 'werun-community/slide' ); // its own Color panel background or gradient
	$style  = wrbc_text( $ctx['werun-community/carousel/slideStyle'] ?? '' );
	$style  = in_array( $style, array( 'plain', 'bordered', 'filled', 'shadow' ), true ) ? $style : 'filled';
	$picked = 'plain' !== $style ? wrbc_text( $ctx['werun-community/carousel/slideBg'] ?? '' ) : '';
	$picked = '' !== wrbc_css_value( $picked ) ? wrbc_color_rgba( $picked ) : null;
	if ( '' !== $own_bg ) {
		// Native Color panel: the tone gives the automatic text; a chosen text colour stays (ContrastAudit warns).
		$paint = $own_bg;
		$tone  = wrbc_tone_class( $paint, $around );
	} elseif ( null !== $picked && $picked[3] > 0 ) {
		// The carousel's slide background, over what's around it when translucent:
		// a pair the block controls, so the text it gets is readable.
		$paint = wrbc_color_hex( wrbc_color_over( $picked, $under ) );
		$tone  = wrbc_tone_class( $paint, $around );
		if ( '' === $own_text ) {
			$fg = '' !== $root_text ? wrbc_readable_color( $root_text, $paint, WERUN_BLOCKS_COMMUNITY_AA_TEXT ) : wrbc_on_color( $paint );
		}
	} elseif ( 'shadow' === $style ) {
		$paint = WERUN_BLOCKS_COMMUNITY_PAPER; // the shadow card's own white
		$tone  = wrbc_tone_class( $paint, $around );
	} elseif ( 'filled' === $style ) {
		// The filled card's own tint (--wrbc-surface: 4 % of the text colour) over
		// what's around it: a shade lighter on dark, so the accent is measured on it.
		$tint_text = '' !== $own_text ? $own_text : ( '' !== $root_text ? $root_text : ( true === wrbc_is_dark_color( $around ) ? WERUN_BLOCKS_COMMUNITY_PAPER : wrbc_page_colors()['text'] ) );
		$tint      = wrbc_color_rgba( $tint_text );
		if ( null !== $tint ) {
			$tint[3] = 0.04;
			$paint   = wrbc_color_hex( wrbc_color_over( $tint, $under ) );
			$tone    = wrbc_tone_class( $paint, $around );
		}
	}
}

// The accent as links and focus rings on that background (the carousel's
// --wrbc-accent-text is made for its own background).
$accent_text = '';
if ( '' !== $paint ) {
	$accent      = wrbc_text( $ctx['werun-community/carousel/accentColor'] ?? '' );
	$accent      = '' !== $accent && null !== wrbc_color_rgba( $accent ) ? $accent : WERUN_BLOCKS_COMMUNITY_ACCENT;
	$accent_text = wrbc_readable_color( $accent, $paint, WERUN_BLOCKS_COMMUNITY_AA_TEXT );
}

$extra = array(
	'class' => implode( ' ', array_filter( array( 'wrbc-slide', '' !== $bg ? 'has-bg-image' : '', $tone ) ) ),
	'style' => wrbc_css_vars(
		array(
			'--wrbc-focal'       => '' !== $bg ? round( $fx * 100, 2 ) . '% ' . round( $fy * 100, 2 ) . '%' : '',
			'--wrbc-overlay'     => $overlay ? $ov_color : '',
			'--wrbc-overlay-o'   => $overlay ? $overlay / 100 : '',
			'color'             => $fg,
			'--wrbc-accent-text' => $accent_text,
			'--wrbc-focus'       => $accent_text,
		)
	),
);
$attrs = get_block_wrapper_attributes( $extra );
?>
<div <?php echo $attrs; // phpcs:ignore ?> data-wrbc-slide>
	<?php echo $bg; // phpcs:ignore -- built above, escaped ?>
	<?php if ( $overlay ) : ?>
		<span class="wrbc-slide__overlay" aria-hidden="true" data-wrbc-backdrop="overlay"></span>
	<?php endif; ?>
	<div class="wrbc-slide__content">
		<?php echo $content; // phpcs:ignore -- rendered inner blocks ?>
	</div>
</div>
<?php
} )( $attributes, $content, $block );
