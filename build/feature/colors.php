<?php
/**
 * Feature grid colours (docs/accessibility.md): each card's tone, the accent
 * made readable on it, the badge's text on its tint, the picked icon colour.
 *
 * Required with require_once from build/feature/render.php and
 * build/features/render.php (copied by --webpack-copy-php). Twins:
 * featureBadgeColor(), featureIconColor() and featureColors() in colors.js.
 *
 * @package werun-blocks-community
 */

defined( 'ABSPATH' ) || exit;

if ( ! function_exists( 'wrbc_feature_badge_color' ) ) {
	/**
	 * The badge's text: the accent made readable on the badge's tint (12 % of
	 * the accent) over $bg. Aimed at 4.6:1: the browser paints that tint
	 * itself (color-mix over the card), and its rounding may differ a little.
	 *
	 * @param string $base The accent.
	 * @param string $bg   The card's (opaque) background.
	 */
	function wrbc_feature_badge_color( $base, $bg ) {
		$accent = wrbc_color_rgba( $base );
		$under  = wrbc_color_rgba( $bg );
		if ( null === $accent || null === $under ) {
			return '';
		}
		$tint = wrbc_color_over( array( $accent[0], $accent[1], $accent[2], 0.12 ), $under );
		return wrbc_readable_color( $base, wrbc_color_hex( $tint ), WERUN_BLOCKS_COMMUNITY_AA_TEXT + 0.1 );
	}
}

if ( ! function_exists( 'wrbc_feature_icon_color' ) ) {
	/**
	 * The icons' colour on a card when the grid picks an icon colour or an
	 * icon background (docs/accessibility.md, "Colours the author picks"):
	 * the picked colour (or the accent as text) made readable, 3:1, on the
	 * holder (the icon background or the accent's tint, over the card) or,
	 * without a holder, on the card. '' when nothing is picked: the accent
	 * as text then applies, readable already.
	 *
	 * @param array  $grid        The grid's values: iconStyle, iconColor, iconBg, accentColor.
	 * @param string $bg          The card's (opaque) background.
	 * @param string $accent_text The accent as text on that card.
	 */
	function wrbc_feature_icon_color( array $grid, $bg, $accent_text ) {
		$picked = wrbc_text( $grid['iconColor'] ?? '' );
		$picked = null !== wrbc_color_rgba( $picked ) ? $picked : '';
		$holder = in_array( $grid['iconStyle'] ?? 'square', array( 'circle', 'square' ), true );
		$own_bg = $holder ? wrbc_color_rgba( wrbc_text( $grid['iconBg'] ?? '' ) ) : null;
		if ( '' === $picked && null === $own_bg ) {
			return '';
		}
		$under = wrbc_color_rgba( $bg );
		if ( null === $under ) {
			return $picked;
		}
		if ( null !== $own_bg ) {
			$under = wrbc_color_over( $own_bg, $under );
		} elseif ( $holder ) {
			$accent = wrbc_color_rgba( wrbc_text( $grid['accentColor'] ?? '' ) );
			$accent = null !== $accent ? $accent : wrbc_color_rgba( WERUN_BLOCKS_COMMUNITY_ACCENT );
			$under  = wrbc_color_over( array( $accent[0], $accent[1], $accent[2], 0.12 ), $under );
		}
		return wrbc_readable_color( '' !== $picked ? $picked : $accent_text, wrbc_color_hex( $under ), WERUN_BLOCKS_COMMUNITY_AA_UI );
	}
}

if ( ! function_exists( 'wrbc_feature_colors' ) ) {
	/**
	 * What a feature card paints, and how its colours stay readable on it.
	 * Its background is its own (Color panel), the grid's card colour, or the
	 * card style's (shadow: white; filled: 4 % of the text colour); a
	 * transparent card shows the grid's surface.
	 * - class: the tone class when that background is of the other tone than
	 *   the grid's surface (shadow cards in a dark section, dark cards on a
	 *   white page), so text nobody picked follows it. Never over a text
	 *   colour chosen in the grid's Color panel: that one stays, and the
	 *   editor's contrast warning says when it doesn't read;
	 * - vars: the accent as text and focus ring made readable on the card
	 *   when the grid's own (made for its surface) don't fit or a tone class
	 *   would reset them, the badge's text on its tint, and the icon colour
	 *   the grid picks made readable on the card (wrbc_feature_icon_color());
	 * - custom: whether the card paints a colour of its own (its Color panel
	 *   or the grid's card colour), not only the style's white or tint.
	 *
	 * @param array  $a      The card's attributes.
	 * @param array  $grid   The grid's values (context): cardStyle, cardBg, accentColor, textColor, style, iconStyle, iconColor, iconBg.
	 * @param string $around The background around the card: the grid's surface.
	 * @return array{ class: string, vars: array, bg: string, custom: bool }
	 */
	function wrbc_feature_colors( array $a, array $grid, $around ) {
		$white = array( 255.0, 255.0, 255.0, 1.0 );
		$under = wrbc_color_rgba( $around );
		$under = null === $under ? $white : wrbc_color_over( $under, $white );
		$own   = wrbc_block_surface( $a, 'werun-community/feature' );
		$bg    = '' !== $own ? wrbc_color_rgba( $own ) : null;
		if ( null === $bg ) {
			$style = in_array( $grid['cardStyle'] ?? '', array( 'plain', 'bordered', 'filled', 'shadow' ), true ) ? $grid['cardStyle'] : 'bordered';
			$bg    = wrbc_color_rgba( wrbc_text( $grid['cardBg'] ?? '' ) );
		}
		// A colour of its own (the card's, or the grid's card colour), not only the style's white or tint.
		$custom = null !== $bg;
		if ( ! $custom ) {
			if ( 'shadow' === $style ) {
				$bg = $white;
			} elseif ( 'filled' === $style ) {
				// --wrbc-surface: 4 % of the text colour, light on a dark surface and dark on a light one.
				$bg = true === wrbc_is_dark_color( $under ) ? array( 255.0, 255.0, 255.0, 0.04 ) : array( 0.0, 0.0, 0.0, 0.04 );
			}
		}
		$under_hex = wrbc_color_hex( $under );
		$bg_hex    = null === $bg ? $under_hex : wrbc_color_hex( wrbc_color_over( $bg, $under ) );

		$class      = wrbc_is_dark_color( $bg_hex ) === wrbc_is_dark_color( $under_hex ) ? '' : wrbc_tone_class( $bg_hex, $under_hex );
		$grid_text  = wrbc_block_colors(
			array(
				'textColor' => $grid['textColor'] ?? '',
				'style'     => is_array( $grid['style'] ?? null ) ? $grid['style'] : array(),
			)
		)['text'];
		if ( '' !== $grid_text && '' === wrbc_block_colors( $a )['text'] ) {
			$class = ''; // The grid's own text colour (Color panel) is never overridden.
		}

		$accent = wrbc_text( $grid['accentColor'] ?? '' );
		$base   = '' !== $accent && null !== wrbc_color_rgba( $accent ) ? $accent : WERUN_BLOCKS_COMMUNITY_ACCENT;
		$text   = wrbc_readable_color( $base, $bg_hex, WERUN_BLOCKS_COMMUNITY_AA_TEXT );
		$vars   = array( '--wrbc-features-badge' => wrbc_feature_badge_color( $base, $bg_hex ) );
		if ( '' !== $class || strtolower( $text ) !== strtolower( wrbc_readable_color( $base, $under_hex, WERUN_BLOCKS_COMMUNITY_AA_TEXT ) ) ) {
			$vars['--wrbc-accent-text'] = $text;
			$vars['--wrbc-focus']       = $text;
		}
		$icon = wrbc_feature_icon_color( $grid, $bg_hex, $text );
		if ( '' !== $icon ) {
			$vars['--wrbc-icon-color'] = $icon;
		}
		return array(
			'class'  => $class,
			'vars'   => $vars,
			'bg'     => $bg_hex,
			'custom' => $custom,
		);
	}
}
