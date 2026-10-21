<?php
/**
 * Media and text: front-end markup.
 *
 * Effective values mirror edit.js and media-control.js (hasMedia(), videoId()).
 * Video follows the wrbc-video contract (docs/shared-modules.md): a facade
 * button, nothing from the provider loads until it is pressed.
 *
 * Reading order: the DOM follows the stacked (phone) order, the only one that
 * is a sequence; side by side, the grid places the media left or right. So
 * screen readers and the keyboard meet the parts in the order phones show.
 * Side by side, "media first" with the media on the right (or "text first"
 * with it on the left) moves focus from the right column to the left one when
 * the media is a video: accepted (2.1 audit), the order doesn't change meaning.
 *
 * @var array    $attributes Block attributes.
 * @var string   $content    Unused (no inner blocks).
 * @var WP_Block $block      Block instance.
 *
 * @package werun-blocks-community
 */

defined( 'ABSPATH' ) || exit;

// Runs in its own scope: nothing here becomes a global.
( static function ( $attributes, $content, $block ) {
$a      = $attributes;
$uid    = wrbc_uid( $a, 'wrbc-media-text' );
$media  = isset( $a['media'] ) && is_array( $a['media'] ) ? $a['media'] : array();
$ratios = array( '1/1', '4/3', '3/2', '16/9', '3/4' );
$ratio  = in_array( $a['mediaRatio'] ?? '', $ratios, true ) ? $a['mediaRatio'] : '4/3';
$side   = 'right' === ( $a['mediaPosition'] ?? '' ) ? 'right' : 'left';
$order  = 'text-first' === ( $a['mobileOrder'] ?? '' ) ? 'text-first' : 'media-first';
$valign = in_array( $a['verticalAlign'] ?? '', array( 'start', 'center', 'end' ), true ) ? $a['verticalAlign'] : 'center';
$level  = is_numeric( $a['titleLevel'] ?? null ) ? max( 2, min( 4, (int) $a['titleLevel'] ) ) : 2; // H2–H4, as cta, form and the section header
$reveal = wrbc_on( $a, 'reveal' ) ? ' data-wrbc-reveal' : '';
$radius = array(
	'pill'    => '999px',
	'rounded' => '10px',
	'square'  => '0px',
);

$has_text = static function ( $value ) {
	return '' !== trim( wp_strip_all_tags( wrbc_text( $value ) ) );
};

// ── Media: an image, or a validated video (same rules as hasMedia() in media-control.js).
$type       = 'video' === ( $media['type'] ?? '' ) ? 'video' : 'image';
$alt        = wrbc_text( $media['alt'] ?? '' );
$media_id   = is_numeric( $media['id'] ?? null ) ? (int) $media['id'] : 0;
$media_url  = wrbc_text( $media['url'] ?? '' );
$media_html = '';
$video      = null;
$focal_x    = 0.5;
$focal_y    = 0.5;

if ( 'image' === $type ) {
	$focal   = isset( $a['mediaFocal'] ) && is_array( $a['mediaFocal'] ) ? $a['mediaFocal'] : array();
	$focal_x = is_numeric( $focal['x'] ?? null ) ? max( 0, min( 1, (float) $focal['x'] ) ) : 0.5;
	$focal_y = is_numeric( $focal['y'] ?? null ) ? max( 0, min( 1, (float) $focal['y'] ) ) : 0.5;
	if ( $media_id > 0 ) {
		$media_html = wp_get_attachment_image(
			$media_id,
			'large',
			false,
			array(
				'class' => 'wrbc-media-text__img',
				'alt'   => $alt,
				'sizes' => '(min-width: 720px) 50vw, 100vw',
			)
		);
	}
	if ( '' === $media_html && '' !== $media_url ) {
		$media_html = '<img class="wrbc-media-text__img" src="' . esc_url( $media_url ) . '" alt="' . esc_attr( $alt ) . '" loading="lazy" decoding="async">';
	}
} else {
	$provider = in_array( $media['provider'] ?? '', array( 'youtube', 'vimeo', 'file' ), true ) ? $media['provider'] : '';
	$vid      = wrbc_text( $media['videoId'] ?? '' );
	if ( 'youtube' === $provider && preg_match( '/^[A-Za-z0-9_-]{11}$/', $vid ) ) {
		$video = array(
			'provider' => 'youtube',
			'id'       => $vid,
			'src'      => '',
		);
	} elseif ( 'vimeo' === $provider && preg_match( '/^\d{6,12}$/', $vid ) ) {
		$video = array(
			'provider' => 'vimeo',
			'id'       => $vid,
			'src'      => '',
		);
	} elseif ( 'file' === $provider && $media_id > 0 && 0 === strpos( (string) get_post_mime_type( $media_id ), 'video/' ) ) {
		// Only an attachment from the media library, never a free URL.
		$src = wp_get_attachment_url( $media_id );
		if ( $src ) {
			$video = array(
				'provider' => 'file',
				'id'       => '',
				'src'      => $src,
			);
			// Captions (WCAG 1.2.2): a WebVTT file from the media library, in the site's language.
			$vtt_id  = is_numeric( $media['captionsId'] ?? null ) ? (int) $media['captionsId'] : 0;
			$vtt_url = $vtt_id > 0 ? (string) wp_get_attachment_url( $vtt_id ) : '';
			if ( '' !== $vtt_url && ( 0 === strpos( (string) get_post_mime_type( $vtt_id ), 'text/vtt' ) || preg_match( '/\.vtt$/i', $vtt_url ) ) ) {
				$video['tracks'] = array(
					array(
						'kind'    => 'captions',
						'src'     => $vtt_url,
						'srclang' => get_bloginfo( 'language' ),
						'label'   => __( 'Captions', 'werun-blocks-community' ),
						'default' => true,
					),
				);
			}
		}
	}
}
$has_media = '' !== $media_html || null !== $video;
if ( null !== $video ) {
	wp_enqueue_script( 'wrbc-video' ); // only blocks with a video load the module
}

// ── Text column.
$title     = wrbc_rich( $a['title'] ?? '' );
$has_title = $has_text( $title );
$show_text = $has_text( $a['text'] ?? '' );
$points    = array();
if ( wrbc_on( $a, 'showPoints' ) && is_array( $a['points'] ?? null ) ) {
	foreach ( $a['points'] as $point ) {
		$line = is_array( $point ) ? wrbc_text( $point['text'] ?? '' ) : '';
		if ( $has_text( $line ) ) {
			$points[] = $line;
		}
	}
}
$show_btn = wrbc_on( $a, 'showButton' ) && $has_text( $a['buttonLabel'] ?? '' );
$btn_type = in_array( $a['buttonStyle'] ?? '', array( 'solid', 'outline', 'link' ), true ) ? $a['buttonStyle'] : 'solid';
// "#" (the default) or a URL esc_url() refuses is no link: the label prints as
// text, not as a fake link (docs/accessibility.md, Operation). Twin: hasUrl in edit.js.
$btn_url = trim( wrbc_text( $a['buttonUrl'] ?? '' ) );
$has_url = '' !== $btn_url && '#' !== $btn_url && '' !== esc_url( $btn_url );

if ( ! $has_media && ! $has_title && ! $show_text && ! $points && ! $show_btn ) {
	return;
}

// The video's name (play button, player title): its own title, else the
// block's title, so a screen reader never hears only "Play video: Video".
$video_name = trim( wp_strip_all_tags( '' !== trim( $alt ) ? $alt : $title ) );
// A text version of the video (WCAG 1.2.1 / 1.2.3), shown under it in a disclosure.
$transcript = null !== $video ? trim( wrbc_text( $media['transcript'] ?? '' ) ) : '';

// ── Colours (docs/accessibility.md). Twin: the same steps in edit.js.
// Accent and its on-colour are palette slugs, printed as the preset's custom
// property (a design token) with the colour as fallback. A slug the palette no
// longer has (theme switched) is dropped, as the editor does, so the shared
// default applies.
$preset_var = static function ( $slug ) {
	$slug  = wrbc_text( $slug );
	$color = preg_match( '/^[A-Za-z0-9_-]+$/', $slug ) ? wrbc_color_hex( wrbc_color_rgba( wrbc_preset_color( $slug ) ) ) : '';
	return '' !== $color ? 'var(--wp--preset--color--' . _wp_to_kebab_case( $slug ) . ', ' . $color . ')' : '';
};
$accent    = $preset_var( $a['accentColor'] ?? '' );
$on_accent = $preset_var( $a['onAccentColor'] ?? '' );
// What the block sits on: its own Color panel background, or the one around it.
$surface = wrbc_surface( $a, $block );
$own_bg  = wrbc_block_surface( $a, 'werun-community/media-text' );
$colors  = wrbc_block_colors( $a );
$tone    = wrbc_tone_class( $surface, wrbc_context_background( $block ) );
if ( '' === $tone && '' !== $own_bg && '' === $colors['text'] ) {
	// Its own light background and no text colour: ink text. The theme's text
	// colour is made for its page, not for a mid-tone such as vivid cyan blue.
	$tone = 'wrbc-is-light';
}
// Secondary text: the token's mix of the text colour where that reads on the
// background, the text colour itself where it wouldn't (mid-tones such as
// vivid purple). Mixes as in assets/shared.css: 85 % on dark, 76 % otherwise.
$text_color = '' !== $colors['text'] ? $colors['text'] : ( 'wrbc-is-dark' === $tone ? WERUN_BLOCKS_COMMUNITY_PAPER : ( 'wrbc-is-light' === $tone ? WERUN_BLOCKS_COMMUNITY_INK : wrbc_page_colors()['text'] ) );
$muted_mix  = 'color-mix(in srgb, ' . $text_color . ' ' . ( 'wrbc-is-dark' === $tone ? 85 : 76 ) . '%, transparent)';
$muted_ok   = wrbc_contrast_ratio( $muted_mix, $surface );
// Accent, its readable version on the surface and the text on it: automatic
// on a custom accent, a picked one corrected to 4.5:1 (the stored value stays).
$accent_css = wrbc_accent_vars(
	array(
		'accentColor'   => $accent,
		'onAccentColor' => $on_accent,
	),
	$surface
);
// The on-colour and the hover fill only where something sits on the accent:
// a solid button, the play badge (and the consent button that comes with a video).
if ( ! ( ( $show_btn && $has_url && 'solid' === $btn_type ) || null !== $video ) ) {
	unset( $accent_css['--wrbc-on-accent'], $accent_css['--wrbc-accent-hover'] );
}

$classes = array(
	'wrbc-root',
	'wrbc-media-text',
	'wrbc-media-text--media-' . $side,
	'wrbc-media-text--' . $order,
	'wrbc-media-text--valign-' . $valign,
	$uid,
);
$classes[] = $has_media ? 'has-media' : 'wrbc-media-text--no-media';
if ( null !== $video ) {
	$classes[] = 'has-video';
}
if ( '' !== $tone ) {
	$classes[] = $tone;
}

$wrapper_attrs = array(
	'id'    => $uid,
	'class' => implode( ' ', $classes ),
	'style' => wrbc_css_vars(
		array_merge(
			$accent_css,
			array(
				'--wrbc-muted'       => $muted_ok > 0 && $muted_ok < WERUN_BLOCKS_COMMUNITY_AA_TEXT ? 'currentColor' : '',
				'--wrbc-icon-size'   => wrbc_px( $a['iconSize'] ?? '' ),
				'--wrbc-icon-stroke' => $a['iconStroke'] ?? '',
				'--wrbc-btn-radius'  => $show_btn && $has_url && 'link' !== $btn_type ? ( $radius[ $a['buttonShape'] ?? '' ] ?? '' ) : '',
				'--wrbc-mt-ratio'    => $has_media ? str_replace( '/', ' / ', $ratio ) : '',
				'--wrbc-mt-focal'    => '' !== $media_html ? round( $focal_x * 100, 2 ) . '% ' . round( $focal_y * 100, 2 ) . '%' : '',
			)
		)
	),
);
if ( $has_title ) {
	$wrapper_attrs['aria-labelledby'] = $uid . '-title';
}

$btn_class = 'wrbc-btn wrbc-media-text__btn wrbc-anim-host';
if ( 'outline' === $btn_type ) {
	$btn_class .= ' wrbc-btn--outline';
} elseif ( 'link' === $btn_type ) {
	$btn_class .= ' wrbc-btn--link';
}
$new_tab = ! empty( $a['buttonNewTab'] );

// The part printed second fades in a little later.
$delay = ' style="--wrbc-reveal-delay:.1s"';

// ── Media column: the media box and, under a video, its transcript.
ob_start();
if ( $has_media ) :
	// An image without alternative text is decorative: a plain box, not a figure.
	$media_tag = ( '' !== $media_html && '' === trim( $alt ) ) ? 'div' : 'figure';
	?>
	<div class="wrbc-media-text__media-col"<?php echo $reveal ? $reveal . ( 'text-first' === $order ? $delay : '' ) : ''; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>>
		<<?php echo $media_tag; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?> class="wrbc-media-text__media">
			<?php if ( '' !== $media_html ) : ?>
				<?php echo $media_html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
			<?php else : ?>
				<?php
				$config = array(
					'provider' => $video['provider'],
					'id'       => $video['id'],
					'src'      => $video['src'],
					'mode'     => 'inline',
					'start'    => 0,
					'title'    => '' !== $video_name ? $video_name : __( 'Video', 'werun-blocks-community' ),
				);
				if ( isset( $video['tracks'] ) ) {
					$config['tracks'] = $video['tracks'];
				}
				$poster_id  = is_numeric( $media['posterId'] ?? null ) ? (int) $media['posterId'] : 0;
				$poster_url = wrbc_text( $media['posterUrl'] ?? '' );
				$poster     = $poster_id > 0
					? wp_get_attachment_image(
						$poster_id,
						'large',
						false,
						array(
							'class' => 'wrbc-media-text__poster',
							'alt'   => '', // the button's text names the video
							'sizes' => '(min-width: 720px) 50vw, 100vw',
						)
					)
					: '';
				if ( '' === $poster && '' !== $poster_url ) {
					$poster = '<img class="wrbc-media-text__poster" src="' . esc_url( $poster_url ) . '" alt="" loading="lazy" decoding="async">';
				}
				// cmp consent mode: wrbc-video shows this placeholder on play until the banner allows "video".
				// No poster behind it: on the block's own surface its text and focus ring keep the
				// block's (known) contrast instead of depending on the picture.
				$consent_box = '';
				if ( 'file' !== $video['provider'] && function_exists( 'wrbc_consent_mode' ) && function_exists( 'wrbc_consent_placeholder' ) && 'cmp' === wrbc_consent_mode() ) {
					$consent_box = wrbc_consent_placeholder(
						'video',
						'youtube' === $video['provider'] ? 'youtube-nocookie.com' : 'player.vimeo.com',
						/* translators: %s: video title */
						'' !== $video_name ? sprintf( __( 'Load the video: %s', 'werun-blocks-community' ), $video_name ) : '',
						array(
							'hidden' => true,
							'mode'   => 'cmp',
						)
					);
				}
				?>
				<div class="wrbc-media-text__video" data-wrbc-video="<?php echo esc_attr( wp_json_encode( $config ) ); ?>">
					<?php // Found by wrbc-video through data-wrbc-video-play, not .wrbc-video__play: other facades' styles (module, video block) stay off it. ?>
					<button type="button" class="wrbc-media-text__play" data-wrbc-video-play>
						<?php echo $poster; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
						<span class="wrbc-media-text__play-icon" aria-hidden="true"><?php echo wrbc_icon( array( 'name' => 'play' ) ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?></span>
						<?php /* translators: %s: video title */ ?>
						<span class="wrbc-sr-only"><?php echo esc_html( '' !== $video_name ? sprintf( __( 'Play video: %s', 'werun-blocks-community' ), $video_name ) : __( 'Play video', 'werun-blocks-community' ) ); ?></span>
					</button>
					<?php echo $consent_box; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped by wrbc_consent_placeholder() ?>
				</div>
			<?php endif; ?>
		</<?php echo $media_tag; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>>
		<?php if ( '' !== $transcript ) : ?>
			<details class="wrbc-media-text__transcript">
				<?php if ( '' !== $video_name ) : ?>
					<?php // Read with the video's name (several videos on a page); "Transcript" stays the start of the name (WCAG 2.5.3). ?>
					<summary class="wrbc-media-text__transcript-toggle"><span aria-hidden="true"><?php esc_html_e( 'Transcript', 'werun-blocks-community' ); ?></span><span class="wrbc-sr-only"><?php /* translators: %s: video title */ echo esc_html( sprintf( __( 'Transcript: %s', 'werun-blocks-community' ), $video_name ) ); ?></span></summary>
				<?php else : ?>
					<summary class="wrbc-media-text__transcript-toggle"><?php esc_html_e( 'Transcript', 'werun-blocks-community' ); ?></summary>
				<?php endif; ?>
				<div class="wrbc-media-text__transcript-body"><?php echo wpautop( esc_html( $transcript ) ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?></div>
			</details>
		<?php endif; ?>
	</div>
	<?php
endif;
$media_part = ob_get_clean();

// ── Text column.
ob_start();
if ( $has_title || $show_text || $points || $show_btn ) :
	?>
	<div class="wrbc-media-text__content"<?php echo $reveal ? $reveal . ( 'text-first' === $order ? '' : $delay ) : ''; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>>
		<?php if ( $has_title ) : ?>
			<?php printf( '<h%1$d class="wrbc-media-text__title" id="%2$s-title">%3$s</h%1$d>', (int) $level, esc_attr( $uid ), $title ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>
		<?php endif; ?>
		<?php if ( $show_text ) : ?>
			<p class="wrbc-media-text__text"><?php echo wrbc_rich( $a['text'] ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?></p>
		<?php endif; ?>
		<?php if ( $points ) : ?>
			<?php // role="list": Safari drops the list semantics of a list-style: none list. ?>
			<ul class="wrbc-media-text__points" role="list">
				<?php foreach ( $points as $line ) : ?>
					<li class="wrbc-media-text__point"><?php echo wrbc_icon( $a['pointsIcon'] ?? array() ); // phpcs:ignore ?><span><?php echo wrbc_rich( $line ); // phpcs:ignore ?></span></li>
				<?php endforeach; ?>
			</ul>
		<?php endif; ?>
		<?php if ( $show_btn ) : ?>
			<p class="wrbc-media-text__actions">
				<?php if ( $has_url ) : ?>
					<?php // "Learn more" alone doesn't say where it goes: the title describes it (WCAG 2.4.4). ?>
					<a class="<?php echo esc_attr( $btn_class ); ?>" <?php echo wrbc_link_attrs( $btn_url, $new_tab ); // phpcs:ignore ?><?php echo $has_title ? ' aria-describedby="' . esc_attr( $uid . '-title' ) . '"' : ''; ?>>
						<span><?php echo wrbc_rich( $a['buttonLabel'] ); // phpcs:ignore ?></span><?php echo wrbc_icon( $a['buttonIcon'] ?? array() ); // phpcs:ignore ?><?php echo wrbc_new_tab_note( $new_tab ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped inside ?>
					</a>
				<?php else : ?>
					<span class="wrbc-media-text__btn-text"><?php echo wrbc_rich( $a['buttonLabel'] ); // phpcs:ignore ?></span>
				<?php endif; ?>
			</p>
		<?php endif; ?>
	</div>
	<?php
endif;
$content_part = ob_get_clean();
?>
<section <?php echo get_block_wrapper_attributes( $wrapper_attrs ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>>
	<div class="wrbc-media-text__inner">
		<?php echo 'text-first' === $order ? $content_part . $media_part : $media_part . $content_part; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- built above ?>
	</div>
</section>
<?php
} )( $attributes, $content, $block );
