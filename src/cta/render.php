<?php
/**
 * Call to action: front-end markup.
 *
 * Effective values mirror edit.js (the "same rules" block there).
 *
 * @var array    $attributes Block attributes.
 * @var string   $content    Unused (no inner blocks).
 * @var WP_Block $block      Block instance.
 *
 * @package werun-blocks-community
 */

defined( 'ABSPATH' ) || exit;

$a      = $attributes;
$uid    = wrbc_uid( $a, 'wrbc-cta' );
$layout = in_array( $a['layout'] ?? '', array( 'centered', 'split', 'strip', 'card' ), true ) ? $a['layout'] : 'centered';
$radius = array(
	'pill'    => '999px',
	'rounded' => '10px',
	'square'  => '0px',
);

// The same rules as edit.js: an image only in the split and centred layouts,
// the alignment choice only for the card (centred is centred, split and strip
// read left to right), the image side only for split with an image.
$media_ok  = in_array( $layout, array( 'split', 'centered' ), true );
$media_id  = (int) ( $a['mediaId'] ?? 0 );
// A rejected URL (javascript:, …) is no image, not an empty src with alt text.
$media_url = esc_url_raw( wrbc_text( $a['mediaUrl'] ?? '' ) );
$show_img  = $media_ok && wrbc_on( $a, 'showMedia', false ) && ( $media_id > 0 || '' !== $media_url );
$align     = 'card' === $layout ? ( 'left' === ( $a['contentAlign'] ?? '' ) ? 'left' : 'center' ) : ( 'centered' === $layout ? 'center' : 'left' );
$ratio     = in_array( $a['mediaRatio'] ?? '', array( '1/1', '4/3', '3/2', '16/9', '3/4' ), true ) ? $a['mediaRatio'] : 'auto';
$width     = max( 480, min( 1600, (int) ( $a['contentWidth'] ?? 1100 ) ) );
$level     = max( 2, min( 4, (int) ( $a['titleLevel'] ?? 2 ) ) );
$reveal    = wrbc_on( $a, 'reveal' ) ? ' data-wrbc-reveal' : '';

$has_text = static function ( $value ) {
	return '' !== trim( wp_strip_all_tags( wrbc_text( $value ) ) );
};
$title     = wrbc_rich( $a['title'] ?? '' );
$has_title = $has_text( $title );
$eyebrow   = wrbc_on( $a, 'showEyebrow' ) && $has_text( $a['eyebrow'] ?? '' );
$text      = wrbc_on( $a, 'showText' ) && $has_text( $a['text'] ?? '' );
$show_pri  = wrbc_on( $a, 'showPrimary' ) && $has_text( $a['primaryLabel'] ?? '' );
$show_sec  = wrbc_on( $a, 'showSecondary' ) && $has_text( $a['secondaryLabel'] ?? '' );

if ( ! $has_title && ! $eyebrow && ! $text && ! $show_pri && ! $show_sec && ! $show_img ) {
	return;
}

// Background image behind the banner (behind the card in the card layout).
$bg_id   = (int) ( $a['bgImageId'] ?? 0 );
$bg_url  = esc_url_raw( wrbc_text( $a['bgImageUrl'] ?? '' ) );
$bg_html = '';
if ( $bg_id > 0 ) {
	$bg_html = wp_get_attachment_image(
		$bg_id,
		'full',
		false,
		array(
			'class'             => 'wrbc-cta__bg',
			'alt'               => '',
			'sizes'             => '100vw',
			// The editor's contrast audit and the a11y harness read text over it as over any image.
			'data-wrbc-backdrop' => 'image',
		)
	);
}
if ( '' === $bg_html && '' !== $bg_url ) {
	$bg_html = '<img class="wrbc-cta__bg" src="' . esc_url( $bg_url ) . '" alt="" decoding="async" loading="lazy" data-wrbc-backdrop="image">';
}

// ── Colours (docs/accessibility.md); edit.js computes the same ──────────────
// What the text sits on: the block's own colour, gradient or picture, else the
// background around it (a dark section or group).
$colors      = wrbc_block_colors( $a );
$surface     = wrbc_surface( $a, $block );
$accent_base = null !== wrbc_color_rgba( wrbc_text( $a['accentColor'] ?? '' ) ) ? wrbc_text( $a['accentColor'] ) : WERUN_BLOCKS_COMMUNITY_ACCENT;
// --wrbc-accent, the text on it (automatic, or the chosen one made readable),
// its hover fill and the accent made readable as text on the background.
$accent_vars = wrbc_accent_vars( $a, $surface );
// Secondary text on a colour the block paints: as much of the text colour as
// 4.5:1 needs there (more than the 76 % default on a mid-dark colour).
$muted_for = static function ( $fg, $bg ) {
	$text = '' !== $fg && '' !== $bg ? wrbc_color_rgba( $fg ) : null;
	$pct  = 0;
	for ( $p = 76; null !== $text && $p <= 100; $p++ ) {
		$pct = $p;
		if ( wrbc_contrast_ratio( array( $text[0], $text[1], $text[2], $p / 100 ), $bg ) >= WERUN_BLOCKS_COMMUNITY_AA_TEXT ) {
			break;
		}
	}
	return $pct > 76 ? $pct : 0;
};

$overlay  = '';
$img_text = '';
$over_o   = 0;
$btn_bgs  = array( $surface ); // What the primary button's fill must stand out from.
if ( '' !== $bg_html ) {
	$overlay = substr( wrbc_color_hex( wrbc_color_rgba( wrbc_text( $a['overlayColor'] ?? '' ) ) ), 0, 7 );
	$overlay = '' !== $overlay ? $overlay : '#000000';
	// The text over the picture: the chosen colour, else what the overlay calls for.
	$img_text = '' !== $colors['text'] ? $colors['text'] : ( true === wrbc_is_dark_color( $overlay ) ? WERUN_BLOCKS_COMMUNITY_PAPER : WERUN_BLOCKS_COMMUNITY_INK );
	// Never under the floor that keeps that text readable over any image (an
	// older, lower stored value included). The card's text sits on the card:
	// behind it the overlay is only decoration.
	$over_o = 'card' === $layout
		? max( 0, min( 95, is_numeric( $a['overlayOpacity'] ?? null ) ? (int) $a['overlayOpacity'] : 55 ) )
		: wrbc_overlay_opacity( $a['overlayOpacity'] ?? 55, $img_text, $overlay );
	// Light text: the picture is a dark surface for everything on it.
	$tone_class = true === wrbc_is_dark_color( $img_text ) ? 'wrbc-is-light' : 'wrbc-is-dark';
	$layer      = wrbc_color_rgba( $overlay );
	$layer[3]   = $over_o / 100;
	$btn_bgs    = array( wrbc_color_over( $layer, array( 255.0, 255.0, 255.0, 1.0 ) ), wrbc_color_over( $layer, array( 0.0, 0.0, 0.0, 1.0 ) ) );
	// Over a picture only the text colour is sure to read (the overlay is held
	// for it): links and anything else in the accent take it there.
	if ( 'card' !== $layout ) {
		$accent_vars['--wrbc-accent-text'] = $img_text;
	}
} else {
	$tone_class = wrbc_tone_class( $surface, wrbc_context_background( $block ) );
}
$text_is    = '' !== $colors['text'] ? $colors['text'] : ( 'wrbc-is-dark' === $tone_class ? WERUN_BLOCKS_COMMUNITY_PAPER : ( 'wrbc-is-light' === $tone_class ? WERUN_BLOCKS_COMMUNITY_INK : '' ) );
$own_bg     = '' === $bg_html && ( '' !== $colors['background'] || $colors['gradient'] ) ? wrbc_block_surface( $a, 'werun-community/cta' ) : '';
$root_muted = $muted_for( $text_is, $own_bg );
// As a solid colour: WordPress strips color-mix() from a block's inline style.
if ( $root_muted ) {
	$fg         = wrbc_color_rgba( $text_is );
	$root_muted = wrbc_color_hex( wrbc_color_over( array( $fg[0], $fg[1], $fg[2], $root_muted / 100 ), wrbc_color_rgba( $own_bg ) ) );
}

// The floating card paints its own colour (white unless chosen): its text,
// accent text, focus ring and secondary text are worked out against it.
$card_vars  = array();
$card_class = '';
if ( 'card' === $layout ) {
	$chosen  = wrbc_color_rgba( wrbc_text( $a['cardBg'] ?? '' ) );
	$under   = wrbc_color_rgba( '' !== $surface ? $surface : WERUN_BLOCKS_COMMUNITY_PAPER );
	$card_bg = null === $chosen ? WERUN_BLOCKS_COMMUNITY_PAPER : wrbc_color_hex( $chosen[3] < 1 && null !== $under ? wrbc_color_over( $chosen, $under ) : $chosen );
	$card_tx = null !== wrbc_color_rgba( wrbc_text( $a['cardText'] ?? '' ) ) ? wrbc_text( $a['cardText'] ) : '';
	// The chosen card text, made readable on the card when it isn't (the closest
	// colour to it); none chosen on a chosen card colour: white or ink.
	$card_fg = '' !== $card_tx ? wrbc_readable_color( $card_tx, $card_bg, WERUN_BLOCKS_COMMUNITY_AA_TEXT ) : ( null !== $chosen ? wrbc_on_color( $card_bg ) : WERUN_BLOCKS_COMMUNITY_INK );
	$card_at = wrbc_readable_color( $accent_base, $card_bg, WERUN_BLOCKS_COMMUNITY_AA_TEXT );
	$card_mu = $muted_for( $card_fg, $card_bg );
	$card_class = wrbc_tone_class( $card_bg, $surface );
	$card_vars  = array(
		'--wrbc-cta-card-bg'     => wrbc_text( $a['cardBg'] ?? '' ),
		'--wrbc-cta-card-fg'     => '' !== $card_tx || null !== $chosen ? $card_fg : '',
		'--wrbc-cta-card-accent' => strtolower( $card_at ) !== strtolower( $accent_base ) ? $card_at : '',
		'--wrbc-cta-card-muted'  => $card_mu ? $card_mu . '%' : '',
	);
	$btn_bgs = array( $card_bg );
}
// The primary button's fill on a background of (almost) the same colour: a
// ring in the colour that reads there shows where the button is.
$ring = '';
foreach ( $btn_bgs as $btn_bg ) {
	if ( '' !== $btn_bg && wrbc_contrast_ratio( $accent_base, $btn_bg ) < WERUN_BLOCKS_COMMUNITY_AA_UI ) {
		$ring = '' !== $img_text && 'card' !== $layout ? $img_text : wrbc_on_color( $btn_bg );
	}
}

$classes = array(
	'wrbc-root',
	'wrbc-cta',
	'wrbc-cta--' . $layout,
	'wrbc-cta--align-' . $align,
	$uid,
);
if ( $show_img ) {
	$classes[] = 'has-media';
	if ( 'split' === $layout ) {
		$classes[] = 'wrbc-cta--media-' . ( 'left' === ( $a['mediaPosition'] ?? '' ) ? 'left' : 'right' );
		if ( wrbc_on( $a, 'mobileMediaFirst', false ) ) {
			$classes[] = 'wrbc-cta--mobile-media-first';
		}
	}
}
if ( '' !== $bg_html ) {
	$classes[] = 'has-bg-image';
}
if ( '' !== $tone_class ) {
	$classes[] = $tone_class;
}
if ( '' !== $ring ) {
	$classes[] = 'wrbc-cta--btn-ring';
}

$wrapper_attrs = array(
	'id'    => $uid,
	'class' => implode( ' ', $classes ),
	'style' => wrbc_css_vars(
		array_merge(
			$accent_vars,
			array(
				'--wrbc-icon-size'   => wrbc_px( $a['iconSize'] ?? '' ),
				'--wrbc-icon-stroke' => $a['iconStroke'] ?? '',
				'--wrbc-btn-radius'  => $radius[ $a['buttonShape'] ?? '' ] ?? '',
				'--wrbc-cta-max'     => $width . 'px',
				'--wrbc-media-ratio' => 'auto' !== $ratio ? str_replace( '/', ' / ', $ratio ) : '',
				'--wrbc-overlay'     => $overlay,
				'--wrbc-overlay-o'   => '' !== $bg_html ? $over_o / 100 : '',
				// The text colour over the picture: focus rings there use it (style.scss).
				'--wrbc-cta-text'    => 'card' !== $layout ? $img_text : '',
				'--wrbc-cta-ring'    => $ring,
				'--wrbc-muted'       => $root_muted ? $root_muted : '',
			),
			$card_vars
		)
	),
);
if ( $has_title ) {
	$wrapper_attrs['aria-labelledby'] = $uid . '-title';
}

$media_html = '';
if ( $show_img ) {
	$media_html = $media_id > 0
		? wp_get_attachment_image(
			$media_id,
			'large',
			false,
			array(
				'class' => 'wrbc-cta__img',
				'alt'   => wrbc_text( $a['mediaAlt'] ?? '' ),
				'sizes' => 'split' === $layout ? '(min-width: 760px) 50vw, 100vw' : '(min-width: 600px) 480px, 100vw',
			)
		)
		: '';
	if ( '' === $media_html && '' !== $media_url ) {
		$media_html = '<img class="wrbc-cta__img" src="' . esc_url( $media_url ) . '" alt="' . esc_attr( wrbc_text( $a['mediaAlt'] ?? '' ) ) . '" loading="lazy" decoding="async">';
	}
}
$figure = '' !== $media_html ? '<figure class="wrbc-cta__media">' . $media_html . '</figure>' : '';
// Centred shows the image above the text: it comes first in the markup too, so
// the reading order is the order on screen (split keeps the text first and only
// moves the picture, which is never focusable).
$media_first = 'centered' === $layout;

// A button without a URL isn't a link ("#" goes nowhere): its label prints as
// text, and the editor says so. Same test in edit.js (isLink()).
$button = static function ( $class, $label, $icon_before, $icon_after, $url, $new_tab ) {
	$url = trim( wrbc_text( $url ) );
	if ( '' === $url || '#' === $url || '' === esc_url( $url ) ) {
		return '<span class="wrbc-cta__btn wrbc-cta__btn--text"><span>' . wrbc_rich( $label ) . '</span></span>';
	}
	return '<a class="' . esc_attr( $class ) . '" ' . wrbc_link_attrs( $url, $new_tab ) . '>' . $icon_before . '<span>' . wrbc_rich( $label ) . '</span>' . $icon_after . wrbc_new_tab_note( $new_tab ) . '</a>';
};
?>
<section <?php echo get_block_wrapper_attributes( $wrapper_attrs ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>>
	<?php if ( '' !== $bg_html ) : ?>
		<?php echo $bg_html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
		<span class="wrbc-cta__overlay" aria-hidden="true" data-wrbc-backdrop="overlay"></span>
	<?php endif; ?>
	<div class="<?php echo esc_attr( trim( 'wrbc-cta__inner ' . $card_class ) ); ?>"<?php echo $reveal; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>>
		<?php if ( $media_first ) : ?>
			<?php echo $figure; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
		<?php endif; ?>
		<div class="wrbc-cta__content">
			<?php if ( $eyebrow || $has_title || $text ) : ?>
				<div class="wrbc-cta__copy">
					<?php if ( $eyebrow ) : ?>
						<p class="wrbc-cta__eyebrow wrbc-anim-host"><?php echo wrbc_icon( $a['eyebrowIcon'] ?? array() ); // phpcs:ignore ?><span><?php echo wrbc_rich( $a['eyebrow'] ); // phpcs:ignore ?></span></p>
					<?php endif; ?>
					<?php if ( $has_title ) : ?>
						<?php printf( '<h%1$d class="wrbc-cta__title" id="%2$s-title">%3$s</h%1$d>', (int) $level, esc_attr( $uid ), $title ); // phpcs:ignore ?>
					<?php endif; ?>
					<?php if ( $text ) : ?>
						<p class="wrbc-cta__text"><?php echo wrbc_rich( $a['text'] ); // phpcs:ignore ?></p>
					<?php endif; ?>
				</div>
			<?php endif; ?>
			<?php if ( $show_pri || $show_sec ) : ?>
				<div class="wrbc-cta__actions">
					<?php
					if ( $show_pri ) {
						echo $button( 'wrbc-btn wrbc-cta__btn wrbc-anim-host', $a['primaryLabel'], '', wrbc_icon( $a['primaryIcon'] ?? array() ), $a['primaryUrl'] ?? '', ! empty( $a['primaryNewTab'] ) ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped parts.
					}
					if ( $show_sec ) {
						echo $button( 'wrbc-btn wrbc-btn--outline wrbc-cta__btn wrbc-anim-host', $a['secondaryLabel'], wrbc_icon( $a['secondaryIcon'] ?? array() ), '', $a['secondaryUrl'] ?? '', ! empty( $a['secondaryNewTab'] ) ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped parts.
					}
					?>
				</div>
			<?php endif; ?>
		</div>
		<?php if ( ! $media_first ) : ?>
			<?php echo $figure; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
		<?php endif; ?>
	</div>
</section>
