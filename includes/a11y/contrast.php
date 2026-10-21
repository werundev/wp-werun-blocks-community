<?php
/**
 * Colour contrast (WCAG 2.2, 1.4.3 and 1.4.11): read a CSS colour, measure
 * the contrast of two colours, pick a readable one, and tell dark from light.
 *
 * JS twin: src/shared/contrast.js (same names in camelCase, same maths), so
 * the editor preview and the page pick the same colours. Contract and rules:
 * docs/accessibility.md.
 *
 * @package werun-blocks-community
 */

defined( 'ABSPATH' ) || exit;

/** Text on light backgrounds (slate 900, 17.85:1 on white) and on dark ones. */
const WERUN_BLOCKS_COMMUNITY_INK   = '#0f172a';
const WERUN_BLOCKS_COMMUNITY_PAPER = '#ffffff';

/** The accent every block starts with (--wrbc-accent in assets/shared.css). */
const WERUN_BLOCKS_COMMUNITY_ACCENT = '#4f46e5';

/** Minimum ratios: text, large text (24 px, or 18.66 px bold) and non-text (controls, focus, meaningful icons). */
const WERUN_BLOCKS_COMMUNITY_AA_TEXT  = 4.5;
const WERUN_BLOCKS_COMMUNITY_AA_LARGE = 3.0;
const WERUN_BLOCKS_COMMUNITY_AA_UI    = 3.0;

/**
 * The palette (or gradients) of the site as slug => value, from the default,
 * theme and user origins (later ones win), keyed by the slug and by the
 * spelling of its CSS variable (accent1 → accent-1). The editor gets the
 * same map in wrbcSettings.colors, so both sides resolve presets alike.
 *
 * @param string $kind "palette" or "gradients".
 */
function wrbc_preset_map( $kind = 'palette' ) {
	static $presets = array();
	$kind = 'gradients' === $kind ? 'gradients' : 'palette';
	if ( ! isset( $presets[ $kind ] ) ) {
		$presets[ $kind ] = array();
		$field            = 'gradients' === $kind ? 'gradient' : 'color';
		$settings         = function_exists( 'wp_get_global_settings' ) ? wp_get_global_settings( array( 'color', $kind ) ) : array();
		foreach ( array( 'default', 'theme', 'custom' ) as $origin ) {
			$entries = isset( $settings[ $origin ] ) && is_array( $settings[ $origin ] ) ? $settings[ $origin ] : array();
			foreach ( $entries as $entry ) {
				if ( isset( $entry['slug'], $entry[ $field ] ) && is_scalar( $entry['slug'] ) && is_scalar( $entry[ $field ] ) ) {
					$presets[ $kind ][ (string) $entry['slug'] ]                      = (string) $entry[ $field ];
					$presets[ $kind ][ _wp_to_kebab_case( (string) $entry['slug'] ) ] = (string) $entry[ $field ];
				}
			}
		}
	}
	return $presets[ $kind ];
}

/**
 * A palette colour (or gradient) by slug, '' when there's none.
 *
 * @param string $slug Preset slug, e.g. "contrast".
 * @param string $kind "palette" or "gradients".
 */
function wrbc_preset_color( $slug, $kind = 'palette' ) {
	$map = wrbc_preset_map( $kind );
	return $map[ wrbc_text( $slug ) ] ?? '';
}

/**
 * A number from a CSS colour argument: "50%" is half of $max, a plain number
 * is itself (alpha and hsl() saturation/lightness take 0–1 or 0–100 %).
 *
 * @param string $value Argument.
 * @param float  $max   What 100 % means.
 */
function wrbc_css_number( $value, $max ) {
	$value = trim( (string) $value );
	if ( ! preg_match( '/^[+-]?(\d+\.?\d*|\.\d+)(%|deg)?$/', $value, $m ) ) {
		return null;
	}
	$number = (float) $value;
	return '%' === ( $m[2] ?? '' ) ? $number / 100 * $max : $number;
}

/**
 * Splits a function's arguments on the commas at depth 0
 * ("in srgb, rgb(1,2,3) 40%, #fff" → 3 parts).
 *
 * @param string $args Inside of the parentheses.
 */
function wrbc_css_split_args( $args ) {
	$parts = array();
	$depth = 0;
	$part  = '';
	$len   = strlen( $args );
	for ( $i = 0; $i < $len; $i++ ) {
		$char = $args[ $i ];
		if ( '(' === $char ) {
			++$depth;
		} elseif ( ')' === $char ) {
			--$depth;
		}
		if ( ',' === $char && 0 === $depth ) {
			$parts[] = trim( $part );
			$part    = '';
			continue;
		}
		$part .= $char;
	}
	$parts[] = trim( $part );
	return $parts;
}

/**
 * A CSS colour as array( r, g, b, a ) — channels 0–255, alpha 0–1 — or null
 * when it can't be known on the server (currentColor, a theme's own
 * variable, a function this doesn't read). Reads #rgb #rgba #rrggbb
 * #rrggbbaa, rgb()/rgba(), hsl()/hsla() (comma or space syntax), white,
 * black, transparent, palette presets (var(--wp--preset--color--x) and the
 * block attribute form var:preset|color|x) and color-mix(in srgb, …) of any
 * of those.
 *
 * @param mixed $color CSS colour.
 * @param int   $depth Internal: presets that point at presets.
 */
function wrbc_color_rgba( $color, $depth = 0 ) {
	if ( is_array( $color ) ) {
		return 4 === count( $color ) ? array_map( 'floatval', array_values( $color ) ) : null;
	}
	if ( ! is_scalar( $color ) || $depth > 4 ) {
		return null;
	}
	$c = strtolower( trim( (string) $color ) );
	if ( '' === $c ) {
		return null;
	}
	$named = array(
		'transparent' => array( 0.0, 0.0, 0.0, 0.0 ),
		'white'       => array( 255.0, 255.0, 255.0, 1.0 ),
		'black'       => array( 0.0, 0.0, 0.0, 1.0 ),
	);
	if ( isset( $named[ $c ] ) ) {
		return $named[ $c ];
	}

	if ( preg_match( '/^var:preset\|color\|([a-z0-9_-]+)$/', $c, $m ) || preg_match( '/^var\(\s*--wp--preset--color--([a-z0-9_-]+)\s*(?:,[^()]*)?\)$/', $c, $m ) ) {
		return wrbc_color_rgba( wrbc_preset_color( $m[1] ), $depth + 1 );
	}

	if ( preg_match( '/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/', $c, $m ) ) {
		$hex = $m[1];
		if ( strlen( $hex ) <= 4 ) {
			$hex = preg_replace( '/(.)/', '$1$1', $hex );
		}
		return array(
			(float) hexdec( substr( $hex, 0, 2 ) ),
			(float) hexdec( substr( $hex, 2, 2 ) ),
			(float) hexdec( substr( $hex, 4, 2 ) ),
			8 === strlen( $hex ) ? hexdec( substr( $hex, 6, 2 ) ) / 255 : 1.0,
		);
	}

	if ( preg_match( '/^(rgba?|hsla?)\(\s*([^()]*)\)$/', $c, $m ) ) {
		$parts = preg_split( '#[\s,/]+#', trim( $m[2] ), -1, PREG_SPLIT_NO_EMPTY );
		if ( count( $parts ) < 3 || count( $parts ) > 4 ) {
			return null;
		}
		$alpha = isset( $parts[3] ) ? wrbc_css_number( $parts[3], 1 ) : 1.0;
		if ( 0 === strpos( $m[1], 'rgb' ) ) {
			$rgb = array( wrbc_css_number( $parts[0], 255 ), wrbc_css_number( $parts[1], 255 ), wrbc_css_number( $parts[2], 255 ) );
		} else {
			$h = wrbc_css_number( $parts[0], 360 );
			$s = wrbc_css_number( $parts[1], 1 );
			$l = wrbc_css_number( $parts[2], 1 );
			if ( null === $h || null === $s || null === $l ) {
				return null;
			}
			// hsl(120 50 50) without % means percentages too.
			$s   = $s > 1 ? $s / 100 : $s;
			$l   = $l > 1 ? $l / 100 : $l;
			$rgb = wrbc_hsl_to_rgb( $h, $s, $l );
		}
		if ( in_array( null, $rgb, true ) || null === $alpha ) {
			return null;
		}
		$rgb   = array_map(
			static function ( $v ) {
				return max( 0.0, min( 255.0, (float) $v ) );
			},
			$rgb
		);
		$rgb[] = max( 0.0, min( 1.0, (float) $alpha ) );
		return $rgb;
	}

	if ( 0 === strpos( $c, 'color-mix(' ) && ')' === substr( $c, -1 ) ) {
		$args = wrbc_css_split_args( substr( $c, 10, -1 ) );
		if ( 3 !== count( $args ) || ! preg_match( '/^in\s+srgb$/', $args[0] ) ) {
			return null;
		}
		$colors = array();
		$pcts   = array();
		foreach ( array( $args[1], $args[2] ) as $arg ) {
			$pct = null;
			if ( preg_match( '/^(.*?)\s+([\d.]+)%$/', $arg, $p ) ) {
				$arg = $p[1];
				$pct = (float) $p[2];
			} elseif ( preg_match( '/^([\d.]+)%\s+(.*)$/', $arg, $p ) ) {
				$arg = $p[2];
				$pct = (float) $p[1];
			}
			$rgba = wrbc_color_rgba( $arg, $depth + 1 );
			if ( null === $rgba ) {
				return null;
			}
			$colors[] = $rgba;
			$pcts[]   = $pct;
		}
		if ( null === $pcts[0] && null === $pcts[1] ) {
			$pcts = array( 50.0, 50.0 );
		} elseif ( null === $pcts[0] ) {
			$pcts[0] = 100 - $pcts[1];
		} elseif ( null === $pcts[1] ) {
			$pcts[1] = 100 - $pcts[0];
		}
		$sum = $pcts[0] + $pcts[1];
		if ( $sum <= 0 ) {
			return null;
		}
		// Percentages that add up to less than 100 % make the result translucent.
		$scale = min( 1, $sum / 100 );
		$p     = $pcts[0] / $sum;
		$alpha = $colors[0][3] * $p + $colors[1][3] * ( 1 - $p );
		if ( $alpha <= 0 ) {
			return array( 0.0, 0.0, 0.0, 0.0 );
		}
		$out = array();
		for ( $i = 0; $i < 3; $i++ ) {
			// Premultiplied, as the spec mixes.
			$out[] = ( $colors[0][ $i ] * $colors[0][3] * $p + $colors[1][ $i ] * $colors[1][3] * ( 1 - $p ) ) / $alpha;
		}
		$out[] = $alpha * $scale;
		return $out;
	}

	return null;
}

/** hsl() → rgb, channels 0–255. */
function wrbc_hsl_to_rgb( $h, $s, $l ) {
	$h = fmod( fmod( (float) $h, 360 ) + 360, 360 ) / 360;
	$s = max( 0.0, min( 1.0, (float) $s ) );
	$l = max( 0.0, min( 1.0, (float) $l ) );
	if ( 0.0 === $s ) {
		return array( $l * 255, $l * 255, $l * 255 );
	}
	$q   = $l < 0.5 ? $l * ( 1 + $s ) : $l + $s - $l * $s;
	$p   = 2 * $l - $q;
	$hue = static function ( $t ) use ( $p, $q ) {
		$t = $t < 0 ? $t + 1 : ( $t > 1 ? $t - 1 : $t );
		if ( $t < 1 / 6 ) {
			return $p + ( $q - $p ) * 6 * $t;
		}
		if ( $t < 1 / 2 ) {
			return $q;
		}
		if ( $t < 2 / 3 ) {
			return $p + ( $q - $p ) * ( 2 / 3 - $t ) * 6;
		}
		return $p;
	};
	return array( $hue( $h + 1 / 3 ) * 255, $hue( $h ) * 255, $hue( $h - 1 / 3 ) * 255 );
}

/** array( r, g, b, a ) → "#rrggbb" ("#rrggbbaa" when translucent), '' for null. */
function wrbc_color_hex( $rgba ) {
	$rgba = wrbc_color_rgba( $rgba );
	if ( null === $rgba ) {
		return '';
	}
	$hex = '#';
	for ( $i = 0; $i < 3; $i++ ) {
		$hex .= str_pad( dechex( (int) round( $rgba[ $i ] ) ), 2, '0', STR_PAD_LEFT );
	}
	if ( $rgba[3] < 1 ) {
		$hex .= str_pad( dechex( (int) round( $rgba[3] * 255 ) ), 2, '0', STR_PAD_LEFT );
	}
	return $hex;
}

/**
 * A translucent colour painted over another: the opaque result.
 *
 * @param array $top   Colour on top.
 * @param array $under Colour under it (made opaque over white first).
 */
function wrbc_color_over( array $top, array $under ) {
	if ( $under[3] < 1 ) {
		$under = wrbc_color_over( $under, array( 255.0, 255.0, 255.0, 1.0 ) );
	}
	$a = $top[3];
	return array(
		$top[0] * $a + $under[0] * ( 1 - $a ),
		$top[1] * $a + $under[1] * ( 1 - $a ),
		$top[2] * $a + $under[2] * ( 1 - $a ),
		1.0,
	);
}

/**
 * Mixes two colours in sRGB ($amount of $to, 0–1), opaque.
 *
 * @param array $from   Colour.
 * @param array $to     Colour.
 * @param float $amount Share of $to.
 */
function wrbc_color_mix( array $from, array $to, $amount ) {
	$out = array();
	for ( $i = 0; $i < 3; $i++ ) {
		$out[] = $from[ $i ] + ( $to[ $i ] - $from[ $i ] ) * $amount;
	}
	$out[] = 1.0;
	return $out;
}

/** WCAG relative luminance of an opaque colour. */
function wrbc_luminance( array $rgba ) {
	$channel = static function ( $v ) {
		$v /= 255;
		return $v <= 0.04045 ? $v / 12.92 : pow( ( $v + 0.055 ) / 1.055, 2.4 );
	};
	return 0.2126 * $channel( $rgba[0] ) + 0.7152 * $channel( $rgba[1] ) + 0.0722 * $channel( $rgba[2] );
}

/**
 * The contrast ratio of a text/icon colour on a background, 1–21, or 0 when
 * either colour can't be read. A translucent background is painted over the
 * page background first, a translucent foreground over the result.
 *
 * @param mixed $fg Foreground colour.
 * @param mixed $bg Background colour.
 */
function wrbc_contrast_ratio( $fg, $bg ) {
	$fg = wrbc_color_rgba( $fg );
	$bg = wrbc_color_rgba( $bg );
	if ( null === $fg || null === $bg ) {
		return 0.0;
	}
	if ( $bg[3] < 1 ) {
		$page = wrbc_color_rgba( wrbc_page_colors()['background'] );
		$bg   = wrbc_color_over( $bg, $page ? $page : array( 255.0, 255.0, 255.0, 1.0 ) );
	}
	if ( $fg[3] < 1 ) {
		$fg = wrbc_color_over( $fg, $bg );
	}
	$l1 = wrbc_luminance( $fg );
	$l2 = wrbc_luminance( $bg );
	return ( max( $l1, $l2 ) + 0.05 ) / ( min( $l1, $l2 ) + 0.05 );
}

/**
 * The text colour for a background: white when it reaches 4.5:1, else ink
 * (#0f172a) when that does, else pure black — on a few mid-tones (indigo
 * #6366f1, violet #8b5cf6) neither white nor ink reaches 4.5:1 but black
 * does, and one of white/black always does. '' when the background can't
 * be read.
 *
 * @param mixed $bg Background colour.
 */
function wrbc_on_color( $bg ) {
	if ( null === wrbc_color_rgba( $bg ) ) {
		return '';
	}
	$paper = wrbc_contrast_ratio( WERUN_BLOCKS_COMMUNITY_PAPER, $bg );
	if ( $paper >= WERUN_BLOCKS_COMMUNITY_AA_TEXT ) {
		return WERUN_BLOCKS_COMMUNITY_PAPER;
	}
	if ( wrbc_contrast_ratio( WERUN_BLOCKS_COMMUNITY_INK, $bg ) >= WERUN_BLOCKS_COMMUNITY_AA_TEXT ) {
		return WERUN_BLOCKS_COMMUNITY_INK;
	}
	return wrbc_contrast_ratio( '#000000', $bg ) >= $paper ? '#000000' : WERUN_BLOCKS_COMMUNITY_PAPER;
}

/**
 * $fg as it is when it already reaches $min on $bg (or either can't be read),
 * otherwise the closest colour to it that does: $fg mixed towards white or
 * ink, as little as needed. Keeps a brand colour recognisable.
 *
 * @param mixed $fg  Text/icon colour.
 * @param mixed $bg  Background.
 * @param float $min Ratio to reach (4.5 text, 3 large text and non-text).
 */
function wrbc_readable_color( $fg, $bg, $min = WERUN_BLOCKS_COMMUNITY_AA_TEXT ) {
	$from = wrbc_color_rgba( $fg );
	$back = wrbc_color_rgba( $bg );
	if ( null === $from || null === $back || wrbc_contrast_ratio( $from, $back ) >= $min ) {
		return is_array( $fg ) ? wrbc_color_hex( $fg ) : wrbc_text( $fg );
	}
	if ( $back[3] < 1 ) {
		$page = wrbc_color_rgba( wrbc_page_colors()['background'] );
		$back = wrbc_color_over( $back, $page ? $page : array( 255.0, 255.0, 255.0, 1.0 ) );
	}
	if ( $from[3] < 1 ) {
		$from = wrbc_color_over( $from, $back );
	}
	$to = wrbc_color_rgba( wrbc_on_color( $back ) );
	// Aim a hair above the target: the result is rounded to a hex colour,
	// and checkers (axe) must see it pass too.
	$goal = $min + 0.02;
	// The ratio isn't monotonic when $fg starts on the wrong side of $bg, so
	// walk in steps and then refine between the last miss and the first hit.
	$miss = 0.0;
	for ( $step = 1; $step <= 20; $step++ ) {
		$hit = $step / 20;
		if ( wrbc_contrast_ratio( wrbc_color_mix( $from, $to, $hit ), $back ) >= $goal ) {
			for ( $i = 0; $i < 6; $i++ ) {
				$mid = ( $miss + $hit ) / 2;
				if ( wrbc_contrast_ratio( wrbc_color_mix( $from, $to, $mid ), $back ) >= $goal ) {
					$hit = $mid;
				} else {
					$miss = $mid;
				}
			}
			// Check the rounded colour itself, nudging on until it passes.
			for ( ; $hit < 1; $hit = min( 1, $hit + 0.01 ) ) {
				$hex = wrbc_color_hex( wrbc_color_mix( $from, $to, $hit ) );
				if ( wrbc_contrast_ratio( $hex, $back ) >= $min ) {
					return $hex;
				}
			}
			break;
		}
		$miss = $hit;
	}
	return wrbc_color_hex( $to );
}

/**
 * Whether a background is dark (white text reads better than ink on it),
 * null when it can't be read or is mostly transparent.
 *
 * @param mixed $bg Background colour.
 */
function wrbc_is_dark_color( $bg ) {
	$rgba = wrbc_color_rgba( $bg );
	if ( null === $rgba || $rgba[3] < 0.5 ) {
		return null;
	}
	return WERUN_BLOCKS_COMMUNITY_PAPER === wrbc_on_color( $rgba );
}

/**
 * The tone class for an element that paints $bg: "wrbc-is-dark" on a dark
 * background, "wrbc-is-light" on a light one inside a dark context (so the
 * text turns dark again), '' otherwise. assets/shared.css turns the tokens
 * (text, accent text, focus ring) around for each.
 *
 * @param mixed      $bg      The element's own background.
 * @param mixed|null $context What's around it (for a block root:
 *                            wrbc_context_background( $block )); null = the
 *                            current render context.
 */
function wrbc_tone_class( $bg, $context = null ) {
	$dark = wrbc_is_dark_color( $bg );
	if ( true === $dark ) {
		return 'wrbc-is-dark';
	}
	if ( false === $dark ) {
		$around = null === $context ? wrbc_context_background() : $context;
		return true === wrbc_is_dark_color( $around ) ? 'wrbc-is-light' : '';
	}
	return '';
}

/**
 * Smallest overlay opacity (0–100) that keeps $text readable on top of any
 * image: checked against a white and a black pixel under the overlay.
 * 100 when even a full overlay doesn't reach $min.
 *
 * @param mixed      $text    Text colour.
 * @param mixed      $overlay Overlay colour (its own alpha is ignored).
 * @param float      $min     4.5 for text, 3 for large text only.
 * @param mixed|null $tint    A translucent layer the text also sits on (a
 *                            hover tint, a pill), painted over the overlay.
 */
function wrbc_min_overlay_opacity( $text, $overlay, $min = WERUN_BLOCKS_COMMUNITY_AA_TEXT, $tint = null ) {
	$fg   = wrbc_color_rgba( $text );
	$ov   = wrbc_color_rgba( $overlay );
	$tint = null === $tint ? null : wrbc_color_rgba( $tint );
	if ( null === $fg || null === $ov ) {
		return 0;
	}
	for ( $pct = 0; $pct <= 100; $pct++ ) {
		$ov[3] = $pct / 100;
		$light = wrbc_color_over( $ov, array( 255.0, 255.0, 255.0, 1.0 ) );
		$dark  = wrbc_color_over( $ov, array( 0.0, 0.0, 0.0, 1.0 ) );
		if ( null !== $tint ) {
			$light = wrbc_color_over( $tint, $light );
			$dark  = wrbc_color_over( $tint, $dark );
		}
		if ( wrbc_contrast_ratio( $fg, $light ) >= $min && wrbc_contrast_ratio( $fg, $dark ) >= $min ) {
			return $pct;
		}
	}
	return 100;
}

/**
 * The overlay opacity a block renders with over a background image: the
 * one chosen, but never under the minimum that keeps its text readable over
 * any image (wrbc_min_overlay_opacity()), and never over $max. Twin:
 * overlayOpacity() in src/shared/contrast.js; OverlayOpacityControl
 * applies the same floor in the editor.
 *
 * @param mixed $value   Chosen opacity (0–100).
 * @param mixed $text    Text colour on the image ('' = white or ink, whichever reads on the overlay colour).
 * @param mixed $overlay Overlay colour ('' = black).
 * @param float $min     4.5, or 3 when every text on the image is large.
 * @param int   $max     The control's maximum.
 */
function wrbc_overlay_opacity( $value, $text = '', $overlay = '', $min = WERUN_BLOCKS_COMMUNITY_AA_TEXT, $max = 95 ) {
	$overlay = '' !== wrbc_text( $overlay ) ? $overlay : '#000000';
	// No text colour chosen: the text the block draws on its overlay, which reads on it.
	$text    = '' !== wrbc_text( $text ) ? $text : wrbc_on_color( $overlay );
	$floor   = wrbc_min_overlay_opacity( $text, $overlay, $min );
	$value = is_numeric( $value ) ? (float) $value : 0;
	return (int) round( max( 0, min( $max, max( $value, $floor ) ) ) );
}

/**
 * The page's own background and text colours: the theme's global styles,
 * white and #1e1e1e for themes that don't say. Filter wrbc_page_colors to
 * describe a dark classic theme.
 */
function wrbc_page_colors() {
	static $colors = null;
	if ( null === $colors ) {
		$styles = function_exists( 'wp_get_global_styles' ) ? wp_get_global_styles( array( 'color' ) ) : array();
		$bg     = wrbc_color_hex( wrbc_color_rgba( $styles['background'] ?? '' ) );
		$text   = wrbc_color_hex( wrbc_color_rgba( $styles['text'] ?? '' ) );
		$colors = apply_filters(
			'wrbc_page_colors',
			array(
				// An opaque colour only: a translucent one says nothing about what's under it.
				'background' => 7 === strlen( $bg ) ? $bg : '#ffffff',
				'text'       => '' !== $text ? $text : '#1e1e1e',
			)
		);
	}
	return $colors;
}

/**
 * The colours a block sets through its Color panel (supports.color),
 * resolved to hex: background, text and the stops of a gradient.
 *
 * @param array $attributes Block attributes.
 * @return array{ background: string, text: string, gradient: string[] }
 */
function wrbc_block_colors( $attributes ) {
	$a     = is_array( $attributes ) ? $attributes : array();
	$style = isset( $a['style']['color'] ) && is_array( $a['style']['color'] ) ? $a['style']['color'] : array();
	$pick  = static function ( $slug, $custom ) {
		$value = '' !== wrbc_text( $slug ) ? wrbc_preset_color( $slug ) : wrbc_text( $custom );
		return wrbc_color_hex( wrbc_color_rgba( $value ) );
	};
	$stops    = array();
	$gradient = '' !== wrbc_text( $a['gradient'] ?? '' ) ? wrbc_preset_color( $a['gradient'], 'gradients' ) : wrbc_text( $style['gradient'] ?? '' );
	if ( '' !== $gradient && preg_match_all( '/#[0-9a-f]{3,8}\b|(?:rgba?|hsla?)\([^()]*\)|var\(--wp--preset--color--[a-z0-9_-]+\)/i', $gradient, $found ) ) {
		foreach ( $found[0] as $stop ) {
			$hex = wrbc_color_hex( wrbc_color_rgba( $stop ) );
			if ( '' !== $hex ) {
				$stops[] = $hex;
			}
		}
	}
	return array(
		'background' => $pick( $a['backgroundColor'] ?? '', $style['background'] ?? '' ),
		'text'       => $pick( $a['textColor'] ?? '', $style['text'] ?? '' ),
		'gradient'   => $stops,
	);
}

/**
 * The background a block paints behind its own content, as one colour for
 * contrast decisions, or '' when it paints none (or it can't be known):
 * - its Color panel background, or the worst stop of its gradient (the
 *   lightest of a dark gradient, the darkest of a light one; '' when the
 *   stops are both dark and light);
 * - core/cover: its overlay when the editor marked it dark, white otherwise;
 * - werun blocks with a background image and overlay: the overlay over the
 *   worst image pixel, when that's the same tone over white and black;
 * - werun-community/section's text tone (light text = dark background) without a colour.
 *
 * @param array  $attributes Block attributes.
 * @param string $name       Block name.
 */
function wrbc_block_surface( $attributes, $name = '' ) {
	$a      = is_array( $attributes ) ? $attributes : array();
	$colors = wrbc_block_colors( $a );
	if ( '' !== $colors['background'] ) {
		$rgba = wrbc_color_rgba( $colors['background'] );
		if ( $rgba[3] >= 0.5 ) {
			return $colors['background'];
		}
	}
	if ( $colors['gradient'] ) {
		$tones = array_map( 'wrbc_is_dark_color', $colors['gradient'] );
		$dark  = ! in_array( false, $tones, true ) && ! in_array( null, $tones, true );
		$light = ! in_array( true, $tones, true ) && ! in_array( null, $tones, true );
		if ( ! $dark && ! $light ) {
			return '';
		}
		$by_lum = $colors['gradient'];
		usort(
			$by_lum,
			static function ( $x, $y ) {
				return wrbc_luminance( wrbc_color_over( wrbc_color_rgba( $x ), array( 255.0, 255.0, 255.0, 1.0 ) ) ) <=> wrbc_luminance( wrbc_color_over( wrbc_color_rgba( $y ), array( 255.0, 255.0, 255.0, 1.0 ) ) );
			}
		);
		return $dark ? end( $by_lum ) : reset( $by_lum );
	}

	if ( 'core/cover' === $name ) {
		$overlay = '' !== wrbc_text( $a['overlayColor'] ?? '' ) ? wrbc_preset_color( $a['overlayColor'] ) : wrbc_text( $a['customOverlayColor'] ?? '' );
		$dark    = ! isset( $a['isDark'] ) || $a['isDark'];
		if ( $dark ) {
			return true === wrbc_is_dark_color( $overlay ) ? wrbc_color_hex( wrbc_color_rgba( $overlay ) ) : WERUN_BLOCKS_COMMUNITY_INK;
		}
		return WERUN_BLOCKS_COMMUNITY_PAPER;
	}

	if ( 0 === strpos( (string) $name, 'werun-community/' ) ) {
		$has_image = wrbc_has_background_media( $a );
		if ( 'werun-community/section' === $name && 'image' !== ( $a['bgType'] ?? 'none' ) ) {
			$has_image = false;
		}
		if ( $has_image ) {
			$defaults = wrbc_block_defaults( $name );
			$overlay  = wrbc_color_rgba( wrbc_text( $a['overlayColor'] ?? ( $defaults['overlayColor'] ?? '' ) ) );
			$opacity  = is_numeric( $a['overlayOpacity'] ?? null ) ? (float) $a['overlayOpacity'] : (float) ( $defaults['overlayOpacity'] ?? 0 );
			if ( null !== $overlay ) {
				// The opacity the block renders with: the readable floor for its text applies (wrbc_overlay_opacity()).
				$text       = wrbc_block_colors( $a )['text'];
				$overlay[3] = wrbc_overlay_opacity( $opacity, $text, wrbc_color_hex( array( $overlay[0], $overlay[1], $overlay[2], 1.0 ) ) ) / 100;
				$on_white   = wrbc_color_over( $overlay, array( 255.0, 255.0, 255.0, 1.0 ) );
				$on_black   = wrbc_color_over( $overlay, array( 0.0, 0.0, 0.0, 1.0 ) );
				$dark_white = wrbc_is_dark_color( $on_white );
				if ( $dark_white === wrbc_is_dark_color( $on_black ) ) {
					// The lighter result is the worst case for light text, the darker one for
					// dark text; rounded towards that worst case too, so a colour made
					// readable against it never lands a fraction under on the page.
					$worst = $dark_white ? $on_white : $on_black;
					$round = $dark_white ? 'ceil' : 'floor';
					return wrbc_color_hex( array( $round( $worst[0] ), $round( $worst[1] ), $round( $worst[2] ), 1.0 ) );
				}
			}
			return '';
		}
		// A chosen text colour wins over the stored tone (as section's render.php does).
		if ( 'werun-community/section' === $name && '' === wrbc_block_colors( $a )['text'] ) {
			$tone = $a['textTone'] ?? 'auto';
			if ( 'light' === $tone ) {
				return WERUN_BLOCKS_COMMUNITY_INK;
			}
			if ( 'dark' === $tone ) {
				return WERUN_BLOCKS_COMMUNITY_PAPER;
			}
		}
	}
	return '';
}

/**
 * Whether a block really shows a background image or video: an attachment
 * that still exists, or else a URL the page would print (http/https). A
 * refused or deleted background doesn't count, so it can't turn the tone
 * dark over a white page. Pairs: bgImageId/bgImageUrl, bgId/bgUrl,
 * bgVideoId/bgVideoUrl. JS twin: hasBackgroundMedia().
 *
 * @param array $a Block attributes.
 */
function wrbc_has_background_media( $a ) {
	foreach ( array( array( 'bgImageId', 'bgImageUrl' ), array( 'bgId', 'bgUrl' ), array( 'bgVideoId', 'bgVideoUrl' ) ) as $pair ) {
		$id  = isset( $a[ $pair[0] ] ) && is_numeric( $a[ $pair[0] ] ) ? (int) $a[ $pair[0] ] : 0;
		$url = wrbc_text( $a[ $pair[1] ] ?? '' );
		if ( $id > 0 ? 'attachment' === get_post_type( $id ) : ( '' !== $url && '' !== esc_url_raw( $url, array( 'http', 'https' ) ) ) ) {
			return true;
		}
	}
	return false;
}

/**
 * The attribute defaults of a registered block, from its block.json.
 *
 * @param string $name Block name.
 */
function wrbc_block_defaults( $name ) {
	static $cache = array();
	if ( ! isset( $cache[ $name ] ) ) {
		$cache[ $name ] = array();
		$type           = WP_Block_Type_Registry::get_instance()->get_registered( $name );
		if ( $type && is_array( $type->attributes ) ) {
			foreach ( $type->attributes as $key => $schema ) {
				if ( is_array( $schema ) && array_key_exists( 'default', $schema ) ) {
					$cache[ $name ][ $key ] = $schema['default'];
				}
			}
		}
	}
	return $cache[ $name ];
}

/**
 * The background behind a block's content: its own (wrbc_block_surface()),
 * or the one around it (wrbc_context_background()).
 *
 * @param array                $attributes Block attributes.
 * @param WP_Block|string|null $block      The block ($block in render.php) or its name.
 */
function wrbc_surface( $attributes, $block = null ) {
	$name = $block instanceof WP_Block ? $block->name : wrbc_text( $block );
	$own  = wrbc_block_surface( $attributes, $name );
	return '' !== $own ? $own : wrbc_context_background( $block instanceof WP_Block ? $block : null );
}

/**
 * Custom properties for a block's accent, with the colours derived from it:
 * - --wrbc-on-accent: the chosen one made readable on the accent, or
 *   white/ink, whichever reads on a custom accent (the default accent keeps
 *   the stylesheet's white);
 * - --wrbc-accent-hover: the hover/focus fill, lightened instead of darkened
 *   when the label is dark (printed only then);
 * - --wrbc-accent-text: the accent as text, links, icons and focus ring on
 *   the block's background, lightened or darkened only as much as 4.5:1
 *   needs (printed only when it differs from the accent).
 * Merge the result into wrbc_css_vars().
 *
 * @param array  $a       Attributes.
 * @param string $surface Background the accent text sits on (wrbc_surface( $a, $block )); '' = wrbc_surface( $a ).
 * @param array  $keys    Attribute names: accent and on-accent.
 */
function wrbc_accent_vars( $a, $surface = '', $keys = array( 'accentColor', 'onAccentColor' ) ) {
	$accent = wrbc_text( $a[ $keys[0] ] ?? '' );
	$on     = wrbc_text( $a[ $keys[1] ] ?? '' );
	// A value that isn't a colour (hand-edited "#zzz") would void every fill
	// that uses it: print nothing, so the stylesheet's default applies. A
	// var() is kept, it may be a theme's own colour.
	$valid = static function ( $value ) {
		return '' === $value || null !== wrbc_color_rgba( $value ) || 0 === strpos( strtolower( trim( $value ) ), 'var(' );
	};
	$accent = $valid( $accent ) ? $accent : '';
	$on     = $valid( $on ) ? $on : '';
	$vars   = array(
		'--wrbc-accent'    => $accent,
		'--wrbc-on-accent' => '',
	);
	$base = '' !== $accent && null !== wrbc_color_rgba( $accent ) ? $accent : WERUN_BLOCKS_COMMUNITY_ACCENT;
	if ( '' !== $on ) {
		// A chosen label colour, as close to it as 4.5:1 on the accent allows.
		$vars['--wrbc-on-accent'] = wrbc_readable_color( $on, $base, WERUN_BLOCKS_COMMUNITY_AA_TEXT );
	} elseif ( '' !== $accent ) {
		$vars['--wrbc-on-accent'] = wrbc_on_color( $accent );
	}
	// Hover/focus fill: away from the label colour, so the label keeps its
	// contrast (the stylesheet darkens, which suits a white label).
	if ( '' !== $vars['--wrbc-on-accent'] && false === wrbc_is_dark_color( $vars['--wrbc-on-accent'] ) ) {
		// A light label: darken (the default) — nothing to print.
	} elseif ( '' !== $vars['--wrbc-on-accent'] ) {
		$vars['--wrbc-accent-hover'] = wrbc_color_hex( wrbc_color_mix( wrbc_color_rgba( $base ), array( 255.0, 255.0, 255.0, 1.0 ), 0.14 ) );
	}
	$surface = '' !== $surface ? $surface : wrbc_surface( $a );
	if ( '' !== $surface ) {
		$text = wrbc_readable_color( $base, $surface, WERUN_BLOCKS_COMMUNITY_AA_TEXT );
		// On a dark surface always print it: otherwise .wrbc-is-dark's fallback
		// mix would replace an accent that already reads there.
		if ( strtolower( $text ) !== strtolower( $base ) || true === wrbc_is_dark_color( $surface ) ) {
			$vars['--wrbc-accent-text'] = $text;
		}
	}
	return $vars;
}
