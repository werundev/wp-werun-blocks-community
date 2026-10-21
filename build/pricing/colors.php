<?php
/**
 * Colours the pricing table works out from its settings and the background
 * it sits on, so every part stays readable (docs/accessibility.md). Loaded
 * by render.php here and by the plans' render.php (they render first).
 * Twin of src/pricing/colors.js: same rules, same results.
 *
 * Picked colours are never stored changed, only what's printed is
 * (docs/accessibility.md, "Colours the author picks").
 *
 * @package werun-blocks-community
 */

defined( 'ABSPATH' ) || exit;

if ( ! function_exists( 'wrbc_pricing_fill_text' ) ) {
	/**
	 * The text on an accent fill (buttons, badge, the selected period), and
	 * the fill's hover colour when that text is dark: $on when it reaches
	 * 4.5:1 on $fill, otherwise white or black, whichever does (one of them
	 * always does; ink and white can both miss on a mid-tone such as
	 * #6366f1). The shared buttons darken the fill on hover and focus, which
	 * would take dark text under 4.5:1: a dark text gets a lightened fill.
	 *
	 * @param string $fill The fill.
	 * @param string $on   The text on it (picked and corrected, or automatic).
	 * @return array{ on: string, hover: string } hover is '' for light text.
	 */
	function wrbc_pricing_fill_text( $fill, $on ) {
		if ( wrbc_contrast_ratio( $on, $fill ) < WERUN_BLOCKS_COMMUNITY_AA_TEXT ) {
			$on = wrbc_contrast_ratio( WERUN_BLOCKS_COMMUNITY_PAPER, $fill ) >= WERUN_BLOCKS_COMMUNITY_AA_TEXT ? WERUN_BLOCKS_COMMUNITY_PAPER : '#000000';
		}
		$hover = '';
		if ( true === wrbc_is_dark_color( $on ) ) {
			$hover = wrbc_color_hex( wrbc_color_mix( wrbc_color_rgba( $fill ), array( 255.0, 255.0, 255.0, 1.0 ), 0.14 ) );
		}
		return array(
			'on'    => $on,
			'hover' => $hover,
		);
	}
}

if ( ! function_exists( 'wrbc_pricing_table_colors' ) ) {
	/**
	 * What the table prints on top of wrbc_accent_vars(): the text on the
	 * accent fills when the automatic or picked one doesn't reach 4.5:1 (with
	 * its hover colour), and the "Save" note's colour: accent text on a 14 %
	 * accent tint over the switch's 4 % track, at its darkest on a light
	 * background (4 % black) and its lightest on a dark one (4 % white).
	 * Twin of tableColors() in colors.js.
	 *
	 * @param array  $a       The table's attributes.
	 * @param string $surface The table's background (wrbc_surface()).
	 * @param array  $accent  wrbc_accent_vars() for it.
	 * @return array Custom properties.
	 */
	function wrbc_pricing_table_colors( array $a, $surface, array $accent ) {
		$vars = array();
		$fill = wrbc_text( $a['accentColor'] ?? '' );
		$fill = '' !== $fill && null !== wrbc_color_rgba( $fill ) ? $fill : WERUN_BLOCKS_COMMUNITY_ACCENT;
		$on   = '' !== wrbc_text( $accent['--wrbc-on-accent'] ?? '' ) ? $accent['--wrbc-on-accent'] : WERUN_BLOCKS_COMMUNITY_PAPER;
		$text = wrbc_pricing_fill_text( $fill, $on );
		if ( strtolower( $text['on'] ) !== strtolower( $on ) ) {
			$vars['--wrbc-on-accent']    = $text['on'];
			$vars['--wrbc-accent-hover'] = '' !== $text['hover'] ? $text['hover'] : 'initial';
		}

		$back = wrbc_color_rgba( $surface );
		if ( ! empty( $a['showToggle'] ) && null !== $back ) {
			$back                    = wrbc_color_over( $back, array( 255.0, 255.0, 255.0, 1.0 ) );
			$tint                    = true === wrbc_is_dark_color( wrbc_color_hex( $back ) ) ? array( 255.0, 255.0, 255.0, 0.04 ) : array( 0.0, 0.0, 0.0, 0.04 );
			$base                    = wrbc_color_rgba( $fill );
			$note                    = wrbc_color_over( array( $base[0], $base[1], $base[2], 0.14 ), wrbc_color_over( $tint, $back ) );
			$vars['--wrbc-save-text'] = wrbc_readable_color( $fill, wrbc_color_hex( $note ), WERUN_BLOCKS_COMMUNITY_AA_TEXT );
		}
		return $vars;
	}
}

if ( ! function_exists( 'wrbc_pricing_plan_colors' ) ) {
	/**
	 * What a plan paints behind its content, and what keeps the plan readable
	 * on it. The background: its own Color panel background, the featured
	 * background, the plan background, the white of the Shadow style, the 4 %
	 * tint of the Filled style, or for the featured plan a 6 % accent tint
	 * over whatever is under it (as style.scss paints them); a Border plan is
	 * transparent and takes the table's tone. On it:
	 * - the tone class (light or dark context for links, focus, muted text);
	 * - its text: the table's chosen text colour made readable on it (the
	 *   closest colour to it); without one, the tone class's, or on the
	 *   style's own white or tints what it inherits when that reads, and on a
	 *   background the author chose white, ink or black (whichever reads);
	 * - muted text and the accent as text and focus ring for that background;
	 * - on a featured plan whose chosen background hides the accent fills
	 *   (button, badge: under 3:1), the accent made to stand out from it (the
	 *   closest colour at 3:1), with its text and hover colour to match.
	 * Twin of planColors() in colors.js.
	 *
	 * @param array  $a        The plan's attributes.
	 * @param array  $table    The table's values (context): cardStyle, cardBg, featuredBg, accentColor, onAccentColor, textColor, style.
	 * @param string $around   The background around the plan (wrbc_context_background()).
	 * @param bool   $featured Whether it's the featured plan.
	 * @return array{ class: string, vars: array }
	 */
	function wrbc_pricing_plan_colors( array $a, array $table, $around, $featured ) {
		$min    = WERUN_BLOCKS_COMMUNITY_AA_TEXT;
		$white  = array( 255.0, 255.0, 255.0, 1.0 );
		$same   = static function ( $x, $y ) {
			return strtolower( (string) $x ) === strtolower( (string) $y );
		};
		$found  = wrbc_color_rgba( $around );
		$back   = null === $found ? $white : wrbc_color_over( $found, $white );
		$under  = wrbc_color_hex( $back );
		$accent = wrbc_text( $table['accentColor'] ?? '' );
		$accent = '' !== $accent && null !== wrbc_color_rgba( $accent ) ? $accent : WERUN_BLOCKS_COMMUNITY_ACCENT;
		$style  = in_array( $table['cardStyle'] ?? '', array( 'bordered', 'filled', 'shadow' ), true ) ? $table['cardStyle'] : 'bordered';
		$own    = wrbc_block_surface( $a, 'werun-community/pricing-plan' );
		$feat   = wrbc_color_rgba( wrbc_text( $table['featuredBg'] ?? '' ) );
		$card   = wrbc_color_rgba( wrbc_text( $table['cardBg'] ?? '' ) );
		$bg     = null;
		$chosen = true;
		if ( '' !== $own ) {
			$bg = wrbc_color_rgba( $own );
		} elseif ( $featured && null !== $feat ) {
			$bg = $feat;
		} elseif ( null !== $card ) {
			$bg = wrbc_color_over( $card, $back );
			if ( $featured ) {
				$bg = wrbc_color_mix( $bg, wrbc_color_rgba( $accent ), 0.06 );
			}
		} else {
			$chosen = false;
			if ( $featured ) {
				$bg = wrbc_color_mix( 'shadow' === $style ? wrbc_color_rgba( WERUN_BLOCKS_COMMUNITY_PAPER ) : $back, wrbc_color_rgba( $accent ), 0.06 );
			} elseif ( 'shadow' === $style ) {
				$bg = wrbc_color_rgba( WERUN_BLOCKS_COMMUNITY_PAPER );
			} elseif ( 'filled' === $style ) {
				// --wrbc-surface is 4 % of the text colour: black on a light background, white on a dark one.
				$bg = wrbc_color_over( true === wrbc_is_dark_color( $under ) ? array( 255.0, 255.0, 255.0, 0.04 ) : array( 0.0, 0.0, 0.0, 0.04 ), $back );
			}
		}
		if ( null === $bg ) {
			return array(
				'class' => '',
				'vars'  => array(),
			);
		}
		$hex  = wrbc_color_hex( wrbc_color_over( $bg, $back ) );
		$tone = wrbc_tone_class( $hex, $under );
		$vars = array();

		// Text: its own colour (Color panel: never changed, the warning says when
		// it doesn't read), or the table's made readable here, or an automatic one.
		$text       = wrbc_block_colors( $a )['text'];
		$table_text = wrbc_block_colors(
			array(
				'textColor' => $table['textColor'] ?? '',
				'style'     => $table['style'] ?? array(),
			)
		)['text'];
		if ( '' === $text && '' !== $table_text ) {
			// Printed when it changes, or a tone class would replace it.
			$text = wrbc_readable_color( $table_text, $hex, $min );
			if ( '' !== $tone || ! $same( $text, $table_text ) ) {
				$vars['--wrbc-plan-text'] = $text;
			}
		} elseif ( '' === $text ) {
			// The tone class's, or on the style's own white or tints the theme's
			// (made for a page like that); a background the author chose gets
			// white, ink or black.
			if ( 'wrbc-is-dark' === $tone ) {
				$kept = WERUN_BLOCKS_COMMUNITY_PAPER;
			} elseif ( 'wrbc-is-light' === $tone ) {
				$kept = WERUN_BLOCKS_COMMUNITY_INK;
			} elseif ( ! $chosen ) {
				$kept = true === wrbc_is_dark_color( $under ) ? WERUN_BLOCKS_COMMUNITY_PAPER : wrbc_page_colors()['text'];
			} else {
				$kept = '';
			}
			if ( '' !== $kept && wrbc_contrast_ratio( $kept, $hex ) >= $min ) {
				$text = $kept;
			} else {
				$text                    = wrbc_on_color( $hex );
				$vars['--wrbc-plan-text'] = $text;
			}
		}
		$ink = wrbc_color_rgba( $text );
		if ( null !== $ink ) {
			$ink[3] = 'wrbc-is-dark' === $tone ? 0.85 : 0.76;
			$muted  = wrbc_color_hex( wrbc_color_over( $ink, wrbc_color_rgba( $hex ) ) );
			if ( wrbc_contrast_ratio( $muted, $hex ) < $min ) {
				$vars['--wrbc-muted'] = wrbc_readable_color( $muted, $hex, $min );
			}
		}

		// The accent as text, links and focus ring: its own when the table's
		// (made for the table's background) doesn't fit, or a tone class would
		// reset it.
		$accent_text = wrbc_readable_color( $accent, $hex, $min );
		if ( '' !== $tone || ! $same( $accent_text, wrbc_readable_color( $accent, $under, $min ) ) ) {
			$vars['--wrbc-accent-text'] = $accent_text;
			$vars['--wrbc-focus']       = $accent_text;
		}

		// A featured plan on a chosen background that hides the accent fills
		// (button, badge): the accent made to stand out from it, and the text on
		// the fills (picked, or automatic) and their hover colour to match.
		if ( $featured && $chosen && wrbc_contrast_ratio( $accent, $hex ) < WERUN_BLOCKS_COMMUNITY_AA_UI ) {
			$fill   = wrbc_readable_color( $accent, $hex, WERUN_BLOCKS_COMMUNITY_AA_UI );
			$picked = wrbc_text( $table['onAccentColor'] ?? '' );
			$on     = '' !== $picked && null !== wrbc_color_rgba( $picked ) ? wrbc_readable_color( $picked, $fill, $min ) : wrbc_on_color( $fill );
			$on     = wrbc_pricing_fill_text( $fill, $on );

			$vars['--wrbc-accent']       = $fill;
			$vars['--wrbc-on-accent']    = $on['on'];
			$vars['--wrbc-accent-hover'] = '' !== $on['hover'] ? $on['hover'] : 'initial';
		}

		$class = array( $tone );
		if ( isset( $vars['--wrbc-plan-text'] ) ) {
			$class[] = 'has-plan-text';
		}
		if ( $chosen ) {
			$class[] = 'has-plan-bg';
		}
		return array(
			'class' => trim( implode( ' ', $class ) ),
			'vars'  => $vars,
		);
	}
}
