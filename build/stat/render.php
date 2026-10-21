<?php
/**
 * Stat: front-end markup. What it shows comes from the stats block (context)
 * and from its own switches.
 *
 * The number is printed as the editor typed it (SEO, no JS). When it holds a
 * number and counting is on, the same text carries the wrbc-counter options
 * (docs/shared-modules.md): the module counts up to it once in view.
 *
 * @var array    $attributes Block attributes.
 * @var string   $content    Unused.
 * @var WP_Block $block      Block instance.
 *
 * @package werun-blocks-community
 */

defined( 'ABSPATH' ) || exit;

if ( ! function_exists( 'wrbc_stat_parse' ) ) {
	/**
	 * The number of a stat split for the counter, or null when there is
	 * nothing to count. Twin of parseStat() in src/stat/number.js: one
	 * separator followed by exactly three digits groups thousands, any other
	 * single one is the decimal mark; with both, the last is the decimal
	 * mark; spaces always group.
	 *
	 * @param mixed $raw The number attribute ("1,200+", "$4.5M", "98%").
	 * @return array|null { to, decimals, grouping, prefix, suffix }
	 */
	function wrbc_stat_parse( $raw ) {
		$text = trim( html_entity_decode( wp_strip_all_tags( wrbc_text( $raw ) ), ENT_QUOTES | ENT_HTML5, 'UTF-8' ) );
		if ( '' === $text || mb_strlen( $text ) > 80 ) {
			return null;
		}
		if ( ! preg_match( '/^(\D*?)(\d(?:[\d.,\x{00A0}\x{202F} ]*\d)?)(.*)$/su', $text, $m ) ) {
			return null;
		}
		list( , $prefix, $num, $suffix ) = $m;
		$plain     = preg_replace( '/[\x{00A0}\x{202F} ]/u', ' ', $num );
		$has_space = false !== strpos( $plain, ' ' );
		$dots      = substr_count( $num, '.' );
		$commas    = substr_count( $num, ',' );
		$decimal   = '';
		if ( $dots && $commas ) {
			$decimal = strrpos( $num, '.' ) > strrpos( $num, ',' ) ? '.' : ',';
		} elseif ( $dots || $commas ) {
			$sep   = $dots ? '.' : ',';
			$after = strlen( $num ) - strrpos( $num, $sep ) - 1;
			if ( 1 === ( $dots ? $dots : $commas ) && ( 3 !== $after || $has_space ) ) {
				$decimal = $sep;
			}
		}
		$int  = $plain;
		$frac = '';
		if ( '' !== $decimal ) {
			$pos  = strrpos( $plain, $decimal );
			$int  = substr( $plain, 0, $pos );
			$frac = substr( $plain, $pos + 1 );
			if ( preg_match( '/\D/', $frac ) || strlen( $frac ) > 4 ) {
				return null;
			}
		}
		$groups = preg_split( '/[., ]/', $int );
		if ( count( $groups ) > 1 ) {
			if ( ! preg_match( '/^\d{1,3}$/', $groups[0] ) ) {
				return null;
			}
			foreach ( array_slice( $groups, 1 ) as $group ) {
				if ( ! preg_match( '/^\d{3}$/', $group ) ) {
					return null;
				}
			}
		}
		$digits = implode( '', $groups );
		if ( ! preg_match( '/^\d+$/', $digits ) || strlen( $digits ) > 15 ) {
			return null;
		}
		return array(
			'to'       => '' === $frac ? (int) $digits : round( (float) ( $digits . '.' . $frac ), strlen( $frac ) ),
			'decimals' => strlen( $frac ),
			'grouping' => count( $groups ) > 1,
			'prefix'   => $prefix,
			'suffix'   => $suffix,
		);
	}
}

if ( ! function_exists( 'wrbc_stat_page_color' ) ) {
	/**
	 * A colour as it reaches the page in a custom property, '' when it
	 * doesn't: wrbc_css_vars(), then get_block_wrapper_attributes()'s
	 * safecss_filter_attr(), which drops colour functions such as rgba().
	 * Twin of pageValue() in src/stat/colors.js.
	 *
	 * @param mixed $value Colour attribute.
	 */
	function wrbc_stat_page_color( $value ) {
		return (string) substr( safecss_filter_attr( wrbc_css_vars( array( '--x' => $value ) ) ), 4 );
	}
}

if ( ! function_exists( 'wrbc_stat_readable_on' ) ) {
	/**
	 * wrbc_readable_color() for a colour on a layer over another background.
	 * A translucent layer is read twice: as painted, and with its alpha the
	 * way browsers print it in computed styles (two decimals: 20/255 →
	 * 0.08), which is what axe and other checkers blend with. Twin of
	 * readableOn() in src/stat/colors.js.
	 *
	 * @param mixed $fg    Colour.
	 * @param array $layer The layer, [ r, g, b, a ].
	 * @param array $under What's under it, opaque.
	 * @param float $min   Ratio to reach.
	 */
	function wrbc_stat_readable_on( $fg, array $layer, array $under, $min ) {
		$out = wrbc_readable_color( $fg, wrbc_color_hex( wrbc_color_over( $layer, $under ) ), $min );
		if ( $layer[3] < 1 ) {
			$layer[3] = round( $layer[3], 2 );
			$out      = wrbc_readable_color( $out, wrbc_color_hex( wrbc_color_over( $layer, $under ) ), $min );
		}
		return $out;
	}
}

if ( ! function_exists( 'wrbc_stat_colors' ) ) {
	/**
	 * What keeps a stat readable on what it paints — its own background
	 * (Color panel) or its card's — and on what it sits on. Twin of
	 * statColors() in src/stat/colors.js (docs/accessibility.md):
	 * - the tone class (light or dark text) for its background, unless a
	 *   text colour was chosen on the stats block: the Color panel is never
	 *   overridden (the editor's contrast warning says when it fails);
	 * - the accent as text and focus ring, readable on that background;
	 * - the icon colour (the stats block's own picker, or the accent) made
	 *   readable (3:1) on the icon's holder or the stat's background.
	 *
	 * @param array  $a      The stat's attributes.
	 * @param array  $stats  The stats block's values (context): layout, cardStyle, cardBg, accentColor, textColor, style, showIcon, iconStyle, iconColor, iconBg.
	 * @param string $around The background around the stat: the stats block's surface.
	 * @return array{ class: string, vars: array }
	 */
	function wrbc_stat_colors( array $a, array $stats, $around ) {
		$white  = array( 255.0, 255.0, 255.0, 1.0 );
		$under  = wrbc_color_rgba( $around );
		$under  = null === $under ? $white : wrbc_color_over( $under, $white );
		$accent = wrbc_text( $stats['accentColor'] ?? '' );
		$base   = '' !== $accent && null !== wrbc_color_rgba( $accent ) ? $accent : WERUN_BLOCKS_COMMUNITY_ACCENT;
		// What the stats block prints for its surface (wrbc_accent_vars()).
		$text  = wrbc_readable_color( $base, wrbc_color_hex( $under ), WERUN_BLOCKS_COMMUNITY_AA_TEXT );
		$paint = wrbc_color_hex( $under );
		$class = '';
		$vars  = array();

		$bg  = null;
		$own = wrbc_block_surface( $a, 'werun-community/stat' );
		if ( '' !== $own ) {
			$bg = wrbc_color_rgba( $own );
		} elseif ( 'cards' === ( $stats['layout'] ?? '' ) ) {
			$style = in_array( $stats['cardStyle'] ?? '', array( 'bordered', 'filled', 'shadow' ), true ) ? $stats['cardStyle'] : 'filled';
			$bg    = wrbc_color_rgba( wrbc_stat_page_color( $stats['cardBg'] ?? '' ) );
			if ( null === $bg && 'shadow' === $style ) {
				$bg = wrbc_color_rgba( WERUN_BLOCKS_COMMUNITY_PAPER );
			} elseif ( null === $bg && 'filled' === $style ) {
				// --wrbc-surface is 4 % of the text colour: at its darkest on a
				// light background, its lightest on a dark one.
				$bg = true === wrbc_is_dark_color( $under ) ? array( 255.0, 255.0, 255.0, 0.04 ) : array( 0.0, 0.0, 0.0, 0.04 );
			}
		}
		if ( null !== $bg ) {
			$paint  = wrbc_color_hex( wrbc_color_over( $bg, $under ) );
			$chosen = wrbc_block_colors(
				array(
					'textColor' => $stats['textColor'] ?? '',
					'style'     => $stats['style'] ?? array(),
				)
			)['text'];
			if ( '' === $chosen ) {
				$class = wrbc_tone_class( $paint, $under );
			}
			$card = wrbc_stat_readable_on( $base, $bg, $under, WERUN_BLOCKS_COMMUNITY_AA_TEXT );
			// Its own values when the stats block's don't fit this background,
			// or the tone class would reset them.
			if ( '' !== $class || strtolower( $card ) !== strtolower( $text ) ) {
				$text                      = $card;
				$vars['--wrbc-accent-text'] = $card;
				$vars['--wrbc-focus']       = $card;
			}
		}

		if ( ! empty( $stats['showIcon'] ) ) {
			// The holder: the icon background picked, or the accent at 12 %
			// (assets/shared.css); none for a plain icon or a ring.
			$fill = array( 0.0, 0.0, 0.0, 0.0 );
			if ( in_array( $stats['iconStyle'] ?? '', array( 'circle', 'square' ), true ) ) {
				$fill = wrbc_color_rgba( wrbc_stat_page_color( $stats['iconBg'] ?? '' ) );
				if ( null === $fill ) {
					$fill    = wrbc_color_rgba( wrbc_stat_page_color( $accent ) );
					$fill    = null === $fill ? wrbc_color_rgba( WERUN_BLOCKS_COMMUNITY_ACCENT ) : $fill;
					$fill[3] = 0.12 * $fill[3];
				}
			}
			$picked = wrbc_stat_page_color( $stats['iconColor'] ?? '' );
			$icon   = '' !== $picked && null !== wrbc_color_rgba( $picked ) ? $picked : $text;
			$fixed  = wrbc_stat_readable_on( $icon, $fill, wrbc_color_rgba( $paint ), WERUN_BLOCKS_COMMUNITY_AA_UI );
			if ( strtolower( $fixed ) !== strtolower( $icon ) ) {
				$vars['--wrbc-icon-color'] = $fixed;
			}
		}

		return array(
			'class' => $class,
			'vars'  => $vars,
		);
	}
}

$a   = $attributes;
$ctx = $block->context;
$get = static function ( $key, $fallback ) use ( $ctx ) {
	return array_key_exists( 'werun-community/stats/' . $key, $ctx ) ? $ctx[ 'werun-community/stats/' . $key ] : $fallback;
};

$number = trim( wp_strip_all_tags( wrbc_text( $a['number'] ?? '' ) ) );
$label  = trim( wp_strip_all_tags( wrbc_text( $a['label'] ?? '' ) ) );
if ( '' === $number && '' === $label ) {
	return;
}

// Its own icon, or the stats block's while it has none of its own; an own
// icon without a name ({}, "Remove") hides it on this stat. Twin in edit.js.
$icon_html = '';
if ( $get( 'showIcon', false ) ) {
	$icon      = isset( $a['icon'] ) && is_array( $a['icon'] ) ? $a['icon'] : $get( 'itemIcon', array( 'name' => 'trending-up' ) );
	$icon_html = wrbc_icon_wrap( $icon, $get( 'iconStyle', 'none' ), 'wrbc-stat__icon' );
}
$show_desc = $get( 'showDescription', false ) && empty( $a['hideDescription'] ) && '' !== trim( wp_strip_all_tags( wrbc_text( $a['description'] ?? '' ) ) );

$count = null;
if ( '' !== $number && $get( 'animate', true ) && empty( $a['noCount'] ) ) {
	$count = wrbc_stat_parse( $a['number'] );
}

$colors = wrbc_stat_colors(
	$a,
	array(
		'layout'      => $get( 'layout', 'row' ),
		'cardStyle'   => $get( 'cardStyle', 'filled' ),
		'cardBg'      => $get( 'cardBg', '' ),
		'accentColor' => $get( 'accentColor', '' ),
		'textColor'   => $get( 'textColor', '' ),
		'style'       => $get( 'style', array() ),
		'showIcon'    => $get( 'showIcon', false ),
		'iconStyle'   => $get( 'iconStyle', 'none' ),
		'iconColor'   => $get( 'iconColor', '' ),
		'iconBg'      => $get( 'iconBg', '' ),
	),
	wrbc_context_background( $block )
);

$uid     = wrbc_uid( $a, 'wrbc-stat' );
$classes = array( 'wrbc-stat', 'wrbc-anim-host', $uid, $colors['class'] );
if ( '' !== $icon_html ) {
	$classes[] = 'has-icon';
}
$extra = array(
	'id'    => $uid,
	'class' => implode( ' ', array_filter( $classes ) ),
	'role'  => 'listitem',
);
if ( $colors['vars'] ) {
	$extra['style'] = wrbc_css_vars( $colors['vars'] );
}
if ( $get( 'reveal', true ) ) {
	$extra['data-wrbc-reveal'] = '';
}

$number_html = '';
if ( '' !== $number ) {
	$text  = html_entity_decode( $number, ENT_QUOTES | ENT_HTML5, 'UTF-8' );
	$value = esc_html( $text );
	// A figure of up to 12 characters stays on one line and shrinks to fit
	// the stat (style.scss: .wrbc-stat__number--fit); longer text wraps.
	// Twin: fitLength() in src/stat/number.js.
	$len        = mb_strlen( $text );
	$number_tag = $len <= 12 ? '<p class="wrbc-stat__number wrbc-stat__number--fit" style="--wrbc-stat-len:' . (int) $len . '">' : '<p class="wrbc-stat__number">';
	if ( $count ) {
		// At most 5 s (WCAG 2.2.2: longer motion would need a pause button).
		// Same range as the editor control (src/stats/effective.js).
		$duration = max( 300, min( 5000, (int) $get( 'counterDuration', 1600 ) ) );
		$options  = array(
			'to'       => $count['to'],
			'from'     => 0,
			'decimals' => $count['decimals'],
			'grouping' => $count['grouping'],
			'prefix'   => $count['prefix'],
			'suffix'   => $count['suffix'],
			'duration' => $duration,
		);
		// Shortest form of the float (4.9, not 4.9000000000000004) whatever php.ini says.
		$precision = ini_get( 'serialize_precision' );
		ini_set( 'serialize_precision', '-1' ); // phpcs:ignore WordPress.PHP.IniSet.Risky
		$json = wp_json_encode( $options );
		ini_set( 'serialize_precision', $precision ); // phpcs:ignore WordPress.PHP.IniSet.Risky
		$value = '<span class="wrbc-stat__value" data-wrbc-count="' . esc_attr( $json ) . '">' . $value . '</span>';
	} else {
		$value = '<span class="wrbc-stat__value">' . $value . '</span>';
	}
	$number_html = $number_tag . $value . '</p>';
}
$label_html = '' !== $label ? '<p class="wrbc-stat__label">' . wrbc_rich( $a['label'] ) . '</p>' : '';
// Reading order follows what is seen: a label shown above comes first.
$main = 'above' === $get( 'labelPosition', 'below' ) ? $label_html . $number_html : $number_html . $label_html;
?>
<div <?php echo get_block_wrapper_attributes( $extra ); // phpcs:ignore ?>>
	<?php echo $icon_html; // phpcs:ignore -- wrbc_icon_wrap() output ?>
	<div class="wrbc-stat__main"><?php echo $main; // phpcs:ignore -- escaped above ?></div>
	<?php if ( $show_desc ) : ?>
		<p class="wrbc-stat__desc"><?php echo wrbc_rich( $a['description'] ); // phpcs:ignore ?></p>
	<?php endif; ?>
</div>
