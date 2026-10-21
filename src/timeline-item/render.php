<?php
/**
 * Timeline item: front-end markup, one <li> of the timeline's <ol>. Where the
 * date goes and what the marker shows come from the timeline (context).
 *
 * @var array    $attributes Block attributes.
 * @var string   $content    Unused.
 * @var WP_Block $block      Block instance.
 *
 * @package werun-blocks-community
 */

defined( 'ABSPATH' ) || exit;

if ( ! function_exists( 'wrbc_timeline_datetime' ) ) {
	/**
	 * The machine-readable form of a timeline date for <time datetime>, or ''
	 * when the label is not a date ("Step 1", "Q3 2024"). Twin of
	 * timelineDatetime() in src/timeline-item/datetime.js.
	 *
	 * @param mixed $date     The label as typed: "2019", "March 2021", "5 March 2021"…
	 * @param mixed $explicit The machine-readable date set in the sidebar, if any.
	 */
	function wrbc_timeline_datetime( $date, $explicit = '' ) {
		// YYYY, YYYY-MM or a real YYYY-MM-DD (no February 30th).
		$iso = static function ( $value ) {
			if ( ! preg_match( '/^(\d{4})(?:-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?)?$/', $value, $p ) ) {
				return false;
			}
			return empty( $p[3] ) || checkdate( (int) $p[2], (int) $p[3], (int) $p[1] );
		};
		$own = trim( wrbc_text( $explicit ) );
		if ( $iso( $own ) ) {
			return $own;
		}
		$text = html_entity_decode( wp_strip_all_tags( wrbc_text( $date ) ), ENT_QUOTES | ENT_HTML5, 'UTF-8' );
		$text = trim( preg_replace( '/[\s\x{00A0}]+/u', ' ', $text ) );
		if ( $iso( $text ) ) {
			return $text;
		}
		$month = static function ( $name ) {
			global $wp_locale;
			$key   = rtrim( mb_strtolower( $name ), '.' );
			$en    = array( 'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december' );
			$lists = array( $en, array_map( static fn( $m ) => substr( $m, 0, 3 ), $en ) );
			if ( $wp_locale ) {
				$lists[] = array_values( $wp_locale->month );
				$lists[] = array_values( $wp_locale->month_abbrev );
			}
			foreach ( $lists as $list ) {
				foreach ( array_values( $list ) as $i => $m ) {
					if ( rtrim( mb_strtolower( (string) $m ), '.' ) === $key ) {
						return $i + 1;
					}
				}
			}
			return 0;
		};
		$build = static function ( $year, $m, $day = 0 ) {
			if ( ! $m ) {
				return '';
			}
			if ( ! $day ) {
				return sprintf( '%04d-%02d', $year, $m );
			}
			return checkdate( $m, (int) $day, (int) $year ) ? sprintf( '%04d-%02d-%02d', $year, $m, $day ) : '';
		};
		if ( preg_match( '/^([^\d\s,]+)\.? (?:de )?(\d{4})$/u', $text, $x ) ) {
			return $build( $x[2], $month( $x[1] ) );
		}
		if ( preg_match( '/^([^\d\s,]+)\.? (\d{1,2}),? (\d{4})$/u', $text, $x ) ) {
			return $build( $x[3], $month( $x[1] ), $x[2] );
		}
		if ( preg_match( '/^(\d{1,2})\.? (?:de )?([^\d\s,]+)\.? (?:de )?(\d{4})$/u', $text, $x ) ) {
			return $build( $x[3], $month( $x[2] ), $x[1] );
		}
		return '';
	}
}

if ( ! function_exists( 'wrbc_timeline_card_colors' ) ) {
	/**
	 * An item's card with a background of its own (a chosen card colour, or
	 * the white of shadow cards), a pair the block controls
	 * (docs/accessibility.md, "Colours the author picks"): its tone class, so
	 * its text, links and focus ring follow; the accent as text made readable
	 * on it; and the block's own text colour, when one was chosen, as the
	 * closest colour to it that reads on the card. Twin of cardColors() in
	 * src/timeline/effective.js.
	 *
	 * @param mixed  $style   Card style (plain, bordered, filled, shadow).
	 * @param mixed  $card_bg Chosen card background ('' = none).
	 * @param mixed  $accent  Chosen accent ('' = the default).
	 * @param string $surface What the timeline sits on (wrbc_context_background()).
	 * @param string $text    The timeline's chosen text colour ('' = none).
	 * @return array{ class: string, vars: array }
	 */
	function wrbc_timeline_card_colors( $style, $card_bg, $accent, $surface, $text = '' ) {
		$style  = in_array( $style, array( 'plain', 'bordered', 'filled', 'shadow' ), true ) ? $style : 'bordered';
		$own    = 'plain' === $style ? '' : wrbc_text( $card_bg );
		$own    = ( '' === $own && 'shadow' === $style ) ? WERUN_BLOCKS_COMMUNITY_PAPER : $own;
		$rgba   = '' !== $own ? wrbc_color_rgba( $own ) : null;
		$accent = wrbc_text( $accent );
		$text   = wrbc_text( $text );
		if ( null === $rgba ) {
			// Filled cards without a colour of their own are a 4 % tint of the
			// text colour, a background the block controls too: their links take
			// the accent, which render.php of the timeline made readable on it.
			return array(
				'class' => 'filled' === $style ? 'wrbc-timeline-item__card--colored' : '',
				'vars'  => array(),
			);
		}
		// A translucent card colour shows the surface through; kept exact (not
		// rounded to hex), as a contrast checker composites it.
		$under = wrbc_color_rgba( $surface );
		$bg    = wrbc_color_over( $rgba, null !== $under ? $under : array( 255.0, 255.0, 255.0, 1.0 ) );
		$tone  = wrbc_tone_class( $bg, $surface );
		$min   = WERUN_BLOCKS_COMMUNITY_AA_TEXT;
		$color = wrbc_readable_color( '' !== $accent && null !== wrbc_color_rgba( $accent ) ? $accent : WERUN_BLOCKS_COMMUNITY_ACCENT, $bg, $min );
		$vars  = array(
			'--wrbc-accent-text' => $color,
			'--wrbc-focus'       => $color,
		);
		if ( '' !== $text && null !== wrbc_color_rgba( $text ) ) {
			$vars['color'] = wrbc_readable_color( $text, $bg, $min );
		} elseif ( '' === $tone ) {
			// A mid-tone card on a light page: the page's text, or its secondary
			// shade (76 %), may not read on it. Then the card takes a tone of its own.
			$page = wrbc_color_rgba( wrbc_page_colors()['text'] );
			if ( null !== $page ) {
				$page[3] = 0.76;
				if ( wrbc_contrast_ratio( wrbc_color_over( $page, $bg ), $bg ) < WERUN_BLOCKS_COMMUNITY_AA_TEXT ) {
					$tone = wrbc_is_dark_color( $bg ) ? 'wrbc-is-dark' : 'wrbc-is-light';
				}
			}
		}
		// The secondary text (--wrbc-muted: the text colour at 85 % on dark, 76 %
		// otherwise; the tones' text is white / black) as a solid colour that
		// still reads on this card.
		$ink = $vars['color'] ?? ( 'wrbc-is-dark' === $tone ? WERUN_BLOCKS_COMMUNITY_PAPER : ( 'wrbc-is-light' === $tone ? '#000000' : '' ) );
		$fg  = '' !== $ink ? wrbc_color_rgba( $ink ) : null;
		if ( null !== $fg ) {
			$fg[3]               = 'wrbc-is-dark' === $tone ? 0.85 : 0.76;
			$vars['--wrbc-muted'] = wrbc_readable_color( wrbc_color_hex( wrbc_color_over( $fg, $bg ) ), $bg, $min );
		}
		// A card colour the author picked, or one with a tone of its own: the
		// links in its text take the accent made readable on it (style.scss).
		$colored = '' !== wrbc_text( $card_bg ) || '' !== $tone;
		return array(
			'class' => trim( $tone . ( $colored ? ' wrbc-timeline-item__card--colored' : '' ) ),
			'vars'  => $vars,
		);
	}
}

$a   = $attributes;
$ctx = $block->context;
$get = static function ( $key, $fallback ) use ( $ctx ) {
	return array_key_exists( 'werun-community/timeline/' . $key, $ctx ) ? $ctx[ 'werun-community/timeline/' . $key ] : $fallback;
};

$uid    = wrbc_uid( $a, 'wrbc-tl-item' );
$marker = $get( 'markerStyle', 'dot' );
$marker = in_array( $marker, array( 'dot', 'icon', 'number', 'year' ), true ) ? $marker : 'dot';
// Under a printed section title the item titles are one level below it, so
// no level is skipped or inverted (twin: itemTitleLevel() in timeline/effective.js).
$header_title = $get( 'showHeader', false ) && '' !== trim( wp_strip_all_tags( wrbc_text( $get( 'title', '' ) ) ) );
$level        = $header_title
	? max( 2, min( 4, (int) $get( 'titleLevel', 2 ) ) ) + 1
	: max( 2, min( 6, (int) $get( 'itemTitleLevel', 3 ) ) );
// Twin of edit.js: with year markers the date is the marker; otherwise in the
// card or on the other side of the line.
$date_at = 'year' === $marker ? 'marker' : ( 'opposite' === $get( 'datePosition', 'card' ) ? 'opposite' : 'card' );

$has_title = '' !== trim( wp_strip_all_tags( wrbc_text( $a['title'] ?? '' ) ) );
$has_text  = '' !== trim( wp_strip_all_tags( wrbc_text( $a['text'] ?? '' ) ) );
$date_text = trim( wp_strip_all_tags( wrbc_text( $a['date'] ?? '' ) ) );

$image = '';
if ( $get( 'showImages', true ) ) {
	$alt = trim( wrbc_text( $a['imageAlt'] ?? '' ) );
	$id  = isset( $a['imageId'] ) && is_numeric( $a['imageId'] ) ? (int) $a['imageId'] : 0;
	if ( $id > 0 && wp_attachment_is_image( $id ) ) {
		// The item's own alt, even empty (decorative), as in the editor: an
		// empty one must not bring back the media library's text.
		$image = wp_get_attachment_image(
			$id,
			'medium_large',
			false,
			array(
				'class' => 'wrbc-timeline-item__img',
				'alt'   => $alt,
			)
		);
	} else {
		$src = esc_url( trim( wrbc_text( $a['imageUrl'] ?? '' ) ), array( 'http', 'https' ) );
		if ( '' !== $src ) {
			$image = sprintf( '<img class="wrbc-timeline-item__img" src="%1$s" alt="%2$s" loading="lazy" decoding="async">', $src, esc_attr( $alt ) );
		}
	}
}

if ( '' === $date_text && ! $has_title && ! $has_text && '' === $image ) {
	return;
}

$date_html = '';
if ( '' !== $date_text ) {
	$datetime  = wrbc_timeline_datetime( $a['date'], $a['dateTime'] ?? '' );
	// The date is plain text (no formats in the editor): printed as text, so
	// markup typed into the attribute can't end up inside <time>.
	$label     = esc_html( html_entity_decode( $date_text, ENT_QUOTES | ENT_HTML5, 'UTF-8' ) );
	$date_html = '' !== $datetime
		? '<time datetime="' . esc_attr( $datetime ) . '">' . $label . '</time>'
		: '<span>' . $label . '</span>';
}

// The marker. Dot, icon and number are decoration (the list already numbers
// the items); a year marker is the date itself, so it is read.
$marker_html = '';
if ( 'year' === $marker ) {
	$marker_html = '<div class="wrbc-timeline-item__marker wrbc-timeline-item__marker--year">' . $date_html . '</div>';
} elseif ( 'icon' === $marker ) {
	// Its own icon, or the timeline's while it has none ({} hides it here).
	// An item without an icon gets a plain dot.
	$icon        = isset( $a['icon'] ) && is_array( $a['icon'] ) ? $a['icon'] : $get( 'markerIcon', array( 'name' => 'circle-check' ) );
	$svg         = wrbc_icon( $icon );
	$marker_html = '<div class="wrbc-timeline-item__marker wrbc-timeline-item__marker--' . ( '' !== $svg ? 'icon' : 'dot' ) . '" aria-hidden="true">' . $svg . '</div>';
} else {
	$marker_html = '<div class="wrbc-timeline-item__marker wrbc-timeline-item__marker--' . $marker . '" aria-hidden="true"></div>';
}

// The card, only when it has something in it (a year marker or a date across
// the line can be all an item shows): no empty box.
$card = $image;
if ( 'card' === $date_at && '' !== $date_html ) {
	$card .= '<p class="wrbc-timeline-item__date">' . $date_html . '</p>';
}
if ( $has_title ) {
	$card .= sprintf( '<h%1$d class="wrbc-timeline-item__title" id="%2$s-title">%3$s</h%1$d>', (int) $level, esc_attr( $uid ), wrbc_rich( $a['title'] ) );
}
if ( $has_text ) {
	$card .= '<p class="wrbc-timeline-item__text">' . wrbc_rich( $a['text'] ) . '</p>';
}

// A card with its own background (cardBg, or shadow cards' white) on the
// surface the timeline sits on: the top of the render context here.
$card_text   = wrbc_block_colors(
	array(
		'textColor' => $get( 'textColor', '' ),
		'style'     => $get( 'style', array() ),
	)
)['text'];
$card_colors = wrbc_timeline_card_colors( $get( 'cardStyle', 'bordered' ), $get( 'cardBg', '' ), $get( 'accentColor', '' ), wrbc_context_background(), $card_text );
$card_class  = 'wrbc-timeline-item__card' . ( '' !== $card_colors['class'] ? ' ' . $card_colors['class'] : '' );
$card_style  = wrbc_css_vars( $card_colors['vars'] );

$classes   = array( 'wrbc-timeline-item', 'wrbc-anim-host', $uid );
$highlight = ! empty( $a['highlight'] );
if ( $highlight ) {
	$classes[] = 'is-highlight';
}
if ( 'opposite' === $date_at && '' !== $date_html ) {
	$classes[] = 'has-opposite-date';
}
$extra = array(
	'id'    => $uid,
	'class' => implode( ' ', $classes ),
);
if ( $get( 'reveal', true ) ) {
	$extra['data-wrbc-reveal'] = '';
}
?>
<li <?php echo get_block_wrapper_attributes( $extra ); // phpcs:ignore ?>>
	<?php if ( $highlight ) : ?>
		<?php // The highlight is shown by the marker's ring and the card's border: said in words too. ?>
		<span class="wrbc-sr-only"><?php esc_html_e( 'Highlighted:', 'werun-blocks-community' ); ?> </span>
	<?php endif; ?>
	<?php if ( 'opposite' === $date_at && '' !== $date_html ) : ?>
		<p class="wrbc-timeline-item__date wrbc-timeline-item__date--opposite"><?php echo $date_html; // phpcs:ignore -- escaped above ?></p>
	<?php endif; ?>
	<div class="wrbc-timeline-item__axis"><?php echo $marker_html; // phpcs:ignore -- escaped above ?></div>
	<?php if ( '' !== $card ) : ?>
		<div class="<?php echo esc_attr( $card_class ); ?>"<?php echo '' !== $card_style ? ' style="' . esc_attr( $card_style ) . '"' : ''; ?>><?php echo $card; // phpcs:ignore -- escaped above ?></div>
	<?php endif; ?>
</li>
