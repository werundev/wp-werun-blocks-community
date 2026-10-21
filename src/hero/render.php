<?php
/**
 * Hero: front-end markup.
 *
 * @var array    $attributes Block attributes.
 * @var string   $content    Unused (no inner blocks).
 * @var WP_Block $block      Block instance.
 *
 * @package werun-blocks-community
 */

defined( 'ABSPATH' ) || exit;

$a        = $attributes;
$uid      = wrbc_uid( $a, 'wrbc-hero' );
$layout   = 'centered' === $a['layout'] ? 'centered' : 'split';
$ratio    = max( 30, min( 70, (int) $a['splitRatio'] ) );
$radius   = array(
	'pill'    => '999px',
	'rounded' => '10px',
	'square'  => '0px',
);
$reveal   = wrbc_on( $a, 'reveal' ) ? ' data-wrbc-reveal' : '';
$min_unit = 'px' === $a['minHeightUnit'] ? 'px' : 'vh';
$min_h    = max( 0, min( (int) $a['minHeight'], 'px' === $min_unit ? 2000 : 100 ) );
$heading  = wrbc_rich( $a['heading'] );
$has_head = '' !== trim( wp_strip_all_tags( $heading ) );
$show_pri = wrbc_on( $a, 'showPrimary' ) && '' !== trim( wp_strip_all_tags( wrbc_text( $a['primaryLabel'] ) ) );
$show_sec = wrbc_on( $a, 'showSecondary' ) && '' !== trim( wp_strip_all_tags( wrbc_text( $a['secondaryLabel'] ) ) );
$eyebrow  = wrbc_on( $a, 'showEyebrow' ) && '' !== trim( wp_strip_all_tags( wrbc_text( $a['eyebrow'] ) ) );
$has_txt  = wrbc_on( $a, 'showText' ) && '' !== trim( wp_strip_all_tags( wrbc_text( $a['text'] ) ) );

// Lines and figures with text (block JSON can hold any type in a list): no empty <ul> / <dl>.
$points = array();
if ( wrbc_on( $a, 'showPoints' ) && is_array( $a['points'] ) ) {
	foreach ( $a['points'] as $point ) {
		$line = is_array( $point ) ? wrbc_text( $point['text'] ?? '' ) : '';
		if ( '' !== trim( wp_strip_all_tags( $line ) ) ) {
			$points[] = $line;
		}
	}
}
$stats = array();
if ( wrbc_on( $a, 'showStats', false ) && is_array( $a['stats'] ) ) {
	foreach ( $a['stats'] as $stat ) {
		$stat  = is_array( $stat ) ? $stat : array();
		$value = wrbc_text( $stat['value'] ?? '' );
		$label = wrbc_text( $stat['label'] ?? '' );
		if ( '' !== trim( wp_strip_all_tags( $value . $label ) ) ) {
			$stats[] = array( $value, $label );
		}
	}
}

// The image: an attachment, else a stored URL; a deleted attachment or a
// rejected URL leaves no empty <figure> (and no image column).
$img_html = '';
if ( wrbc_on( $a, 'showMedia' ) ) {
	$img_alt = wrbc_text( $a['mediaAlt'] ?? '' );
	if ( ! empty( $a['mediaId'] ) ) {
		$img_html = wp_get_attachment_image(
			(int) $a['mediaId'],
			'large',
			false,
			array(
				'class'         => 'wrbc-hero__img',
				'alt'           => $img_alt,
				'loading'       => 'eager',
				'fetchpriority' => 'high',
				'sizes'         => 'centered' === $layout ? '(min-width: 1024px) 1024px, 100vw' : '(min-width: 960px) 50vw, 100vw',
			)
		);
	}
	$img_src = esc_url( wrbc_text( $a['mediaUrl'] ?? '' ) );
	if ( '' === $img_html && '' !== $img_src ) {
		$img_html = '<img class="wrbc-hero__img" src="' . $img_src . '" alt="' . esc_attr( $img_alt ) . '" loading="eager">';
	}
}
$show_img    = '' !== $img_html;
$has_content = $eyebrow || $has_head || $has_txt || $points || $show_pri || $show_sec || $stats;

/*
 * Video background (wrbc-video background mode, docs/shared-modules.md): a
 * media library file only. The attachment's own URL when the id is a video,
 * otherwise a stored URL only inside this site's uploads folder.
 * Twin: wrbc_video_block_media_url() in src/video/helpers.php.
 */
$media_url = static function ( $id, $url, $prefix ) {
	$id = is_numeric( $id ) ? (int) $id : 0;
	if ( $id > 0 ) {
		$file = wp_get_attachment_url( $id );
		return ( $file && 0 === strpos( (string) get_post_mime_type( $id ), $prefix ) ) ? esc_url_raw( $file, array( 'http', 'https' ) ) : '';
	}
	$url = is_scalar( $url ) ? trim( (string) $url ) : '';
	if ( '' === $url || preg_match( '/["\'<>\s\\\\]/', $url ) ) {
		return '';
	}
	$base  = set_url_scheme( trailingslashit( wp_get_upload_dir()['baseurl'] ), 'https' );
	$check = set_url_scheme( $url, 'https' );
	if ( 0 !== strpos( $check, $base ) || false !== strpos( substr( $check, strlen( $base ) ), '..' ) ) {
		return '';
	}
	return esc_url_raw( $url, array( 'http', 'https' ) );
};
$bg_video  = $media_url( $a['bgVideoId'] ?? 0, $a['bgVideoUrl'] ?? '', 'video/' );
$has_video = '' !== $bg_video;
// The still under the video (and instead of it): its own poster, else the background image.
$poster_url = $has_video ? $media_url( $a['bgVideoPosterId'] ?? 0, $a['bgVideoPosterUrl'] ?? '', 'image/' ) : '';
$bg_img_id  = ( $has_video && '' !== $poster_url ) ? (int) ( $a['bgVideoPosterId'] ?? 0 ) : (int) ( $a['bgImageId'] ?? 0 );
$bg_img_url = ( $has_video && '' !== $poster_url ) ? $poster_url : esc_url_raw( wrbc_text( $a['bgImageUrl'] ?? '' ) ); // a rejected URL: no background
$has_bg     = '' !== $bg_img_url || $has_video;
$controls   = in_array( $a['bgVideoControls'] ?? '', array( 'bottom-right', 'bottom-left', 'top-right', 'top-left' ), true ) ? $a['bgVideoControls'] : 'bottom-right';
if ( ! $has_content && ! $show_img && ! $has_bg ) {
	return; // nothing to show: no empty section
}
if ( $has_video ) {
	wp_enqueue_script( 'wrbc-video' ); // only heroes with a video load the module
}

/*
 * Colours (docs/accessibility.md). Over a background image or video the text
 * sits on the overlay over any pixel: its colour is the one chosen, else the
 * overlay's own text colour (what the tone class prints). The overlay never
 * goes under the opacity that keeps that text readable over a white and a
 * black pixel, and the colours are checked against the overlay over the
 * worse of the two. Without an image: the block's own background, or the one
 * around it. Twin: the same lines in edit.js.
 */
$overlay_rgba = wrbc_color_rgba( wrbc_text( $a['overlayColor'] ?? '' ) );
$overlay      = null !== $overlay_rgba ? wrbc_color_hex( array( $overlay_rgba[0], $overlay_rgba[1], $overlay_rgba[2], 1.0 ) ) : '#000000';
$chosen_text  = wrbc_block_colors( $a )['text'];
$image_text   = '' !== $chosen_text ? $chosen_text : wrbc_on_color( $overlay );
$overlay_o    = wrbc_overlay_opacity( $a['overlayOpacity'] ?? 55, $image_text, $overlay );
if ( $has_bg ) {
	$layer    = wrbc_color_rgba( $overlay );
	$layer[3] = $overlay_o / 100;
	$on_white = wrbc_color_over( $layer, array( 255.0, 255.0, 255.0, 1.0 ) );
	$on_black = wrbc_color_over( $layer, array( 0.0, 0.0, 0.0, 1.0 ) );
	$surface  = wrbc_color_hex( wrbc_contrast_ratio( $image_text, $on_white ) <= wrbc_contrast_ratio( $image_text, $on_black ) ? $on_white : $on_black );
} else {
	// No background after all: the stored keys must not read as one to
	// wrbc_surface(). The hero is stricter than wrbc_has_background_media() (a
	// video only from this site's uploads and of a video type, an image only
	// with its URL), so it decides here.
	$surface = wrbc_surface( array_diff_key( $a, array_flip( array( 'bgImageId', 'bgImageUrl', 'bgVideoId', 'bgVideoUrl' ) ) ), $block );
}
$tone = wrbc_tone_class( $surface, wrbc_context_background( $block ) );
// Over an image the text is set for the overlay whatever is around: a light
// overlay keeps its dark text on a light page too.
if ( $has_bg && '' === $tone && false === wrbc_is_dark_color( $surface ) ) {
	$tone = 'wrbc-is-light';
}

$classes = array(
	'wrbc-root',
	'wrbc-hero',
	'wrbc-hero--' . $layout,
	'wrbc-hero--media-' . ( 'left' === $a['mediaPosition'] ? 'left' : 'right' ),
	'wrbc-hero--valign-' . sanitize_html_class( $a['verticalAlign'] ),
	$uid,
);
if ( '' !== $tone ) {
	$classes[] = $tone;
}
if ( $show_img ) {
	$classes[] = 'has-media';
}
if ( wrbc_on( $a, 'mobileMediaFirst', false ) ) {
	$classes[] = 'wrbc-hero--mobile-media-first';
}
if ( $has_bg ) {
	$classes[] = 'has-bg-image';
}
if ( $has_video ) {
	$classes[] = 'has-bg-video';
	// The side the pause button is on keeps room for it in the padding (style.scss).
	$classes[] = 'wrbc-hero--toggle-' . ( 0 === strpos( $controls, 'top' ) ? 'top' : 'bottom' );
	if ( ! wrbc_on( $a, 'bgVideoMobile' ) ) {
		$classes[] = 'wrbc-hero--video-no-mobile';
	}
}

$style = wrbc_css_vars(
	array_merge(
		// The accent, its label (automatic, or the picked one made readable),
		// the hover fill away from the label, and the accent readable as text
		// and focus ring on $surface.
		wrbc_accent_vars( $a, $surface ),
		array(
			// Same ranges as the editor (IconSizeControls with maxSize 32, Content width).
			'--wrbc-icon-size'   => wrbc_px( max( 12, min( 32, (int) $a['iconSize'] ) ) ),
			'--wrbc-icon-stroke' => max( 1, min( 3, (float) $a['iconStroke'] ) ),
			'--wrbc-btn-radius'  => $radius[ $a['buttonShape'] ] ?? '',
			'--wrbc-split-a'     => $ratio . 'fr',
			'--wrbc-split-b'     => ( 100 - $ratio ) . 'fr',
			'--wrbc-hero-max'    => wrbc_px( max( 640, min( 1600, (int) $a['contentWidth'] ) ) ),
			'--wrbc-hero-min-h'  => $min_h > 0 ? $min_h . $min_unit : '',
			'--wrbc-media-ratio' => preg_match( '#^\d+/\d+$#', (string) $a['mediaRatio'] ) ? str_replace( '/', ' / ', $a['mediaRatio'] ) : '',
			'--wrbc-media-fit'   => 'contain' === $a['mediaFit'] ? 'contain' : 'cover',
			'--wrbc-overlay'     => $overlay,
			'--wrbc-overlay-o'   => $overlay_o / 100, // never under the readable floor (an older stored value included)
		)
	)
);

// A button without a URL ('' or '#', or one esc_url() refuses) isn't a link:
// its label prints as text with the same look (docs/accessibility.md).
$has_url = static function ( $url ) {
	$url = trim( wrbc_text( $url ) );
	return '' !== $url && '#' !== $url && '' !== esc_url( $url );
};
$button  = static function ( $label, $url, $new_tab, $icon, $icon_first, $outline ) use ( $has_url ) {
	$link  = $has_url( $url );
	$class = 'wrbc-btn' . ( $outline ? ' wrbc-btn--outline' : '' ) . ' wrbc-hero__btn' . ( $link ? ' wrbc-anim-host' : ' wrbc-hero__btn--static' );
	$inner = '<span>' . wrbc_rich( $label ) . '</span>';
	$inner = $icon_first ? $icon . $inner : $inner . $icon;
	if ( ! $link ) {
		return '<span class="' . esc_attr( $class ) . '">' . $inner . '</span>';
	}
	return '<a class="' . esc_attr( $class ) . '" ' . wrbc_link_attrs( $url, $new_tab ) . '>' . $inner . wrbc_new_tab_note( $new_tab ) . '</a>';
};

$wrapper_attrs = array(
	'id'    => $uid,
	'class' => implode( ' ', $classes ),
	'style' => $style,
);
if ( $has_head ) {
	$wrapper_attrs['aria-labelledby'] = $uid . '-heading';
}
$wrapper = get_block_wrapper_attributes( $wrapper_attrs );
$level   = max( 1, min( 3, (int) $a['headingLevel'] ) );
?>
<section <?php echo $wrapper; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>>
	<?php if ( $has_bg ) : ?>
		<?php
		// data-wrbc-backdrop: the editor's contrast check (and the audit) read the text against the image's lightest and darkest pixels.
		if ( '' !== $bg_img_url ) {
			echo $bg_img_id > 0
				? wp_get_attachment_image( $bg_img_id, 'full', false, array( 'class' => 'wrbc-hero__bg', 'alt' => '', 'loading' => 'eager', 'fetchpriority' => 'high', 'data-wrbc-backdrop' => 'image' ) )
				: '<img class="wrbc-hero__bg" src="' . esc_url( $bg_img_url ) . '" alt="" loading="eager" fetchpriority="high" data-wrbc-backdrop="image">'; // phpcs:ignore
		}
		?>
		<?php if ( $has_video ) : ?>
			<?php
			$video_opts = array(
				'provider' => 'file',
				'mode'     => 'background',
				'src'      => $bg_video,
				'mobile'   => wrbc_on( $a, 'bgVideoMobile' ),
				'labels'   => array(
					'play'  => __( 'Play background video', 'werun-blocks-community' ),
					'pause' => __( 'Pause background video', 'werun-blocks-community' ),
				),
			);
			?>
			<div class="wrbc-hero__video" data-wrbc-backdrop="image" data-wrbc-video="<?php echo esc_attr( wp_json_encode( $video_opts, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES ) ); ?>">
				<?php // No src: wrbc-video sets it unless reduced motion / Save-Data, so nothing downloads without JS. ?>
				<video class="wrbc-video__bg wrbc-hero__bg-video" muted loop playsinline preload="none" disablepictureinpicture disableremoteplayback aria-hidden="true" tabindex="-1"></video>
				<button type="button" class="wrbc-hero__video-toggle wrbc-hero__video-toggle--<?php echo esc_attr( $controls ); ?>" data-wrbc-video-toggle aria-label="<?php echo esc_attr__( 'Pause background video', 'werun-blocks-community' ); ?>" hidden>
					<svg class="wrbc-hero__video-pause" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
					<svg class="wrbc-hero__video-play" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14z"/></svg>
				</button>
			</div>
		<?php endif; ?>
		<span class="wrbc-hero__overlay" data-wrbc-backdrop="overlay" aria-hidden="true"></span>
	<?php endif; ?>
	<div class="wrbc-hero__inner">
		<?php if ( $has_content ) : ?>
		<div class="wrbc-hero__content"<?php echo $reveal; // phpcs:ignore ?>>
			<?php if ( $eyebrow ) : ?>
				<p class="wrbc-hero__eyebrow wrbc-hero__eyebrow--<?php echo esc_attr( 'plain' === $a['eyebrowStyle'] ? 'plain' : 'pill' ); ?> wrbc-anim-host">
					<?php echo wrbc_icon( $a['eyebrowIcon'] ); // phpcs:ignore ?>
					<span><?php echo wrbc_rich( $a['eyebrow'] ); // phpcs:ignore ?></span>
				</p>
			<?php endif; ?>

			<?php if ( $has_head ) : ?>
				<?php printf( '<h%1$d class="wrbc-hero__heading" id="%2$s-heading">%3$s</h%1$d>', (int) $level, esc_attr( $uid ), $heading ); // phpcs:ignore ?>
			<?php endif; ?>

			<?php if ( $has_txt ) : ?>
				<p class="wrbc-hero__text"><?php echo wrbc_rich( $a['text'] ); // phpcs:ignore ?></p>
			<?php endif; ?>

			<?php if ( $points ) : ?>
				<?php // role="list": Safari / VoiceOver drop the list semantics of a list without bullets. ?>
				<ul class="wrbc-hero__points" role="list">
					<?php foreach ( $points as $line ) : ?>
						<li class="wrbc-hero__point"><?php echo wrbc_icon( $a['pointsIcon'] ); // phpcs:ignore ?><span><?php echo wrbc_rich( $line ); // phpcs:ignore ?></span></li>
					<?php endforeach; ?>
				</ul>
			<?php endif; ?>

			<?php if ( $show_pri || $show_sec ) : ?>
				<div class="wrbc-hero__actions">
					<?php
					if ( $show_pri ) {
						echo $button( $a['primaryLabel'], $a['primaryUrl'] ?? '', ! empty( $a['primaryNewTab'] ), wrbc_icon( $a['primaryIcon'] ), false, false ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped in $button().
					}
					if ( $show_sec ) {
						echo $button( $a['secondaryLabel'], $a['secondaryUrl'] ?? '', ! empty( $a['secondaryNewTab'] ), wrbc_icon( $a['secondaryIcon'] ), true, true ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped in $button().
					}
					?>
				</div>
			<?php endif; ?>

			<?php if ( $stats ) : ?>
				<dl class="wrbc-hero__stats">
					<?php foreach ( $stats as $stat ) : ?>
						<div class="wrbc-hero__stat">
							<dt class="wrbc-hero__stat-label"><?php echo wrbc_rich( $stat[1] ); // phpcs:ignore ?></dt>
							<dd class="wrbc-hero__stat-value"><?php echo wrbc_rich( $stat[0] ); // phpcs:ignore ?></dd>
						</div>
					<?php endforeach; ?>
				</dl>
			<?php endif; ?>
		</div>
		<?php endif; ?>

		<?php if ( $show_img ) : ?>
			<figure class="wrbc-hero__media"<?php echo $reveal ? ' data-wrbc-reveal style="--wrbc-reveal-delay:.15s"' : ''; // phpcs:ignore ?>>
				<?php echo $img_html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- wp_get_attachment_image() or escaped parts. ?>
			</figure>
		<?php endif; ?>
	</div>
</section>
