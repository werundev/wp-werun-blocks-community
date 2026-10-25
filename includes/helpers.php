<?php
/**
 * Helpers every render.php uses: ids, CSS custom properties, icons, links.
 *
 * @package werun-blocks-community
 */

defined( 'ABSPATH' ) || exit;

/** The animation presets assets/shared.css defines. */
const WERUN_BLOCKS_COMMUNITY_ANIMATIONS = array( 'none', 'draw', 'wiggle', 'nudge-x', 'nudge-y', 'bounce', 'pulse', 'spin', 'pop', 'float', 'shake', 'tilt' );
const WERUN_BLOCKS_COMMUNITY_TRIGGERS   = array( 'hover', 'inview', 'loop' );

/**
 * The id an instance renders with: the HTML anchor set under Advanced when
 * there is one (stable, for links and custom CSS), otherwise one generated
 * for this request. wp_unique_id() counts per request, so two copies of the
 * same block on one page, or a block duplicated in the editor, never share it.
 *
 * @param array  $attributes Block attributes.
 * @param string $prefix     Block slug, e.g. "wrbc-features".
 */
function wrbc_uid( $attributes, $prefix ) {
	// The characters the editor's anchor field allows, case kept, so the ids
	// derived from it (-title, -q, …) match the element's own id.
	$anchor = preg_replace( '/[^A-Za-z0-9_:.-]/', '', wrbc_text( $attributes['anchor'] ?? '' ) );
	if ( '' !== $anchor ) {
		return $anchor;
	}
	return wp_unique_id( $prefix . '-' );
}

/**
 * An attribute as a string: '' for arrays, objects and null. Block comment
 * JSON can hold any type, whatever block.json declares inside an array.
 *
 * @param mixed $value Raw value.
 */
function wrbc_text( $value ) {
	return is_scalar( $value ) ? (string) $value : '';
}

/** CSS functions a value may use: colors and math, nothing that loads a resource. */
const WERUN_BLOCKS_COMMUNITY_CSS_FUNCTIONS = array( 'rgb', 'rgba', 'hsl', 'hsla', 'hwb', 'lab', 'lch', 'oklab', 'oklch', 'color-mix', 'var', 'calc', 'min', 'max', 'clamp' );

/**
 * A CSS value safe to put inside a style attribute: colors, lengths,
 * numbers, var() and color-mix(). Only letters, digits and # . , % ( ) + - *
 * and spaces, no "//", and only the functions above: url(), image-set() and
 * the like can't load anything. Anything else is dropped.
 *
 * @param mixed $value Raw value.
 */
function wrbc_css_value( $value ) {
	if ( is_bool( $value ) || ! is_scalar( $value ) ) {
		return '';
	}
	$value = trim( (string) $value );
	if ( '' === $value || strlen( $value ) > 200 || ! preg_match( '#^[A-Za-z0-9\#.,%()+\-*/\s]+$#', $value ) || false !== strpos( $value, '//' ) ) {
		return '';
	}
	preg_match_all( '/([A-Za-z-]+)\s*\(/', $value, $calls );
	foreach ( $calls[1] as $function ) {
		if ( ! in_array( strtolower( $function ), WERUN_BLOCKS_COMMUNITY_CSS_FUNCTIONS, true ) ) {
			return '';
		}
	}
	return $value;
}

/**
 * CSS custom properties for an instance's wrapper, from a name => value map.
 * Empty values are skipped so the stylesheet's defaults apply.
 *
 * @param array $vars Property => value.
 */
function wrbc_css_vars( array $vars ) {
	$out = array();
	foreach ( $vars as $name => $value ) {
		$value = wrbc_css_value( $value );
		// WordPress keeps no colour function in a block wrapper's style
		// attribute (safecss_filter_attr() drops rgb(), hsl(), color-mix()):
		// a colour it can read goes out as hex, with alpha when translucent.
		if ( '' !== $value && preg_match( '/^(rgba?|hsla?|color-mix)\s*\(/i', $value ) && function_exists( 'wrbc_color_rgba' ) ) {
			$hex   = wrbc_color_hex( wrbc_color_rgba( $value ) );
			$value = '' !== $hex ? $hex : $value;
		}
		if ( '' !== $value ) {
			$out[] = $name . ':' . $value;
		}
	}
	return implode( ';', $out );
}

/** A number with a unit, or '' when it is not set. */
function wrbc_px( $value, $unit = 'px' ) {
	return ( is_numeric( $value ) && '' !== (string) $value ) ? ( 0 + $value ) . $unit : '';
}

/** Lucide icons, name => inner SVG markup. */
function wrbc_icon_data() {
	static $icons = null;
	if ( null === $icons ) {
		$icons = include WERUN_BLOCKS_COMMUNITY_DIR . 'includes/lucide-icons.php';
	}
	return $icons;
}

/** The icons Lucide Animated animates, name => CSS preset. */
function wrbc_animated_presets() {
	static $presets = null;
	if ( null === $presets ) {
		$presets = include WERUN_BLOCKS_COMMUNITY_DIR . 'includes/lucide-animated.php';
	}
	return $presets;
}

/**
 * One Lucide icon as inline SVG.
 *
 * @param array|string $icon {
 *     @type string $name    Lucide name, e.g. "sparkles".
 *     @type string $lib     "lucide" or "animated" (Lucide Animated).
 *     @type string $anim    A preset from WERUN_BLOCKS_COMMUNITY_ANIMATIONS; "auto" takes the
 *                           Lucide Animated preset for that icon.
 *     @type string $trigger hover, inview or loop.
 * }
 * @param array        $args { @type string $class, @type string $label (makes it a labelled image) }
 */
function wrbc_icon( $icon, $args = array() ) {
	if ( is_string( $icon ) ) {
		$icon = array( 'name' => $icon );
	}
	if ( ! is_array( $icon ) ) {
		return '';
	}
	$icon  = wp_parse_args(
		$icon,
		array(
			'name'    => '',
			'lib'     => 'lucide',
			'anim'    => 'none',
			'trigger' => 'hover',
		)
	);
	$name  = sanitize_key( wrbc_text( $icon['name'] ) );
	$icons = wrbc_icon_data();
	if ( '' === $name || ! isset( $icons[ $name ] ) ) {
		return '';
	}

	$anim = wrbc_text( $icon['anim'] );
	if ( 'auto' === $anim || ( 'animated' === $icon['lib'] && ( '' === $anim || 'none' === $anim ) ) ) {
		$presets = wrbc_animated_presets();
		$anim    = isset( $presets[ $name ] ) ? $presets[ $name ] : 'draw';
	}
	if ( ! in_array( $anim, WERUN_BLOCKS_COMMUNITY_ANIMATIONS, true ) ) {
		$anim = 'none';
	}
	$trigger = in_array( $icon['trigger'], WERUN_BLOCKS_COMMUNITY_TRIGGERS, true ) ? (string) $icon['trigger'] : 'hover';

	$classes = array( 'wrbc-icon', 'wrbc-icon--' . $name );
	if ( 'none' !== $anim ) {
		array_push( $classes, 'wrbc-anim', 'wrbc-anim--' . $anim, 'wrbc-anim-t--' . $trigger );
	}
	if ( ! empty( $args['class'] ) ) {
		$classes[] = $args['class'];
	}

	$inner = $icons[ $name ];
	if ( 'draw' === $anim ) {
		// Normalised length 1, so one dasharray draws every shape in step.
		$inner = preg_replace( '/<(path|line|polyline|polygon|circle|ellipse|rect)\b/', '<$1 pathLength="1"', $inner );
	}

	$a11y = ! empty( $args['label'] )
		? 'role="img" aria-label="' . esc_attr( $args['label'] ) . '"'
		: 'aria-hidden="true" focusable="false"';

	return sprintf(
		'<svg xmlns="http://www.w3.org/2000/svg" class="%1$s" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" %2$s>%3$s</svg>',
		esc_attr( implode( ' ', $classes ) ),
		$a11y,
		$inner // Generated from lucide-static at build time, never from user input.
	);
}

/** An icon inside its holder span (plain, circle, square or outline). */
function wrbc_icon_wrap( $icon, $style = 'none', $extra_class = '' ) {
	$svg = wrbc_icon( $icon );
	if ( '' === $svg ) {
		return '';
	}
	$style = in_array( $style, array( 'none', 'circle', 'square', 'outline' ), true ) ? $style : 'none';
	return sprintf(
		'<span class="wrbc-icon-wrap wrbc-icon-wrap--%1$s %2$s">%3$s</span>',
		esc_attr( $style ),
		esc_attr( $extra_class ),
		$svg
	);
}

/** href, and target/rel when it opens in a new tab. */
function wrbc_link_attrs( $url, $new_tab = false ) {
	// A rejected URL (javascript:, …) comes back empty from esc_url(): link nowhere, not to the page itself.
	$href = esc_url( wrbc_text( $url ) ? wrbc_text( $url ) : '#' );
	$out  = 'href="' . ( '' !== $href ? $href : '#' ) . '"';
	if ( $new_tab ) {
		$out .= ' target="_blank" rel="noopener noreferrer"';
	}
	return $out;
}

/** Rich text from an attribute, with the tags RichText can produce. */
function wrbc_rich( $value ) {
	return wp_kses_post( wrbc_text( $value ) );
}

/**
 * Whether an accordion is rendering its answers for the FAQPage schema.
 *
 * @param bool|null $set New state, or null to read it.
 */
function wrbc_in_faq_schema( $set = null ) {
	static $on = false;
	if ( null !== $set ) {
		$on = (bool) $set;
	}
	return $on;
}

/** A truthy attribute, reading a missing one as its default. */
function wrbc_on( $attributes, $key, $fallback = true ) {
	return isset( $attributes[ $key ] ) ? (bool) $attributes[ $key ] : $fallback;
}

/**
 * The optional section header (eyebrow, title, intro) parent blocks share.
 *
 * @param array  $a      Attributes: showHeader, eyebrow, title, intro, headerAlign, titleLevel.
 * @param string $uid    Instance id, so the section can be labelled by its title.
 */
function wrbc_section_header( $a, $uid ) {
	if ( ! wrbc_on( $a, 'showHeader', true ) ) {
		return '';
	}
	// Nothing to show: no empty <header>.
	$has_eyebrow = wrbc_on( $a, 'showEyebrow', true ) && '' !== trim( wp_strip_all_tags( wrbc_text( $a['eyebrow'] ?? '' ) ) );
	$has_title   = '' !== trim( wp_strip_all_tags( wrbc_text( $a['title'] ?? '' ) ) );
	$has_intro   = wrbc_on( $a, 'showIntro', true ) && '' !== trim( wp_strip_all_tags( wrbc_text( $a['intro'] ?? '' ) ) );
	if ( ! $has_eyebrow && ! $has_title && ! $has_intro ) {
		return '';
	}
	$level = isset( $a['titleLevel'] ) ? max( 2, min( 4, (int) $a['titleLevel'] ) ) : 2;
	$align = ( isset( $a['headerAlign'] ) && 'center' === $a['headerAlign'] ) ? ' wrbc-header--center' : '';
	// A div, not <header>: outside <main> and a sectioning element a header is a
	// second banner landmark.
	$out   = '<div class="wrbc-header' . $align . '">';
	if ( $has_eyebrow ) {
		$out .= '<p class="wrbc-header__eyebrow">' . wrbc_rich( $a['eyebrow'] ) . '</p>';
	}
	if ( $has_title ) {
		$out .= sprintf( '<h%1$d class="wrbc-header__title" id="%2$s-title">%3$s</h%1$d>', $level, esc_attr( $uid ), wrbc_rich( $a['title'] ) );
	}
	if ( $has_intro ) {
		$out .= '<p class="wrbc-header__intro">' . wrbc_rich( $a['intro'] ) . '</p>';
	}
	return $out . '</div>';
}

/**
 * The visually hidden note for a link that opens a new tab, the same words
 * in every block: '' when it doesn't.
 *
 * @param bool $new_tab Whether the link opens a new tab.
 */
function wrbc_new_tab_note( $new_tab ) {
	return $new_tab ? ' <span class="wrbc-sr-only">' . esc_html__( '(opens in a new tab)', 'werun-blocks-community' ) . '</span>' : '';
}
