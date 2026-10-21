<?php
/**
 * Video: front-end markup. Behaviour comes from the shared wrbc-video module
 * (docs/shared-modules.md): it builds the iframe / <video> on click, the
 * <dialog> for the window mode, and plays the background video.
 *
 * @var array    $attributes Block attributes.
 * @var string   $content    Unused (no inner blocks).
 * @var WP_Block $block      Block instance.
 *
 * @package werun-blocks-community
 */

defined( 'ABSPATH' ) || exit;

require_once __DIR__ . '/helpers.php';

$a = $attributes;
$e = wrbc_video_block_effective( $a );
if ( ! $e['has_source'] ) {
	return; // Nothing to play: no empty frame on the page.
}

$uid    = wrbc_uid( $a, 'wrbc-video' );
$mode   = $e['mode'];
$style  = in_array( $a['playStyle'] ?? '', array( 'circle', 'square', 'pill' ), true ) ? $a['playStyle'] : 'circle';
$title  = trim( wp_strip_all_tags( wrbc_text( $a['title'] ?? '' ) ) );
$name   = '' !== $title ? $title : __( 'Video', 'werun-blocks-community' );
// The play button's name: "Play video: <title>", or just "Play video" (never "Play video: Video").
$play   = '' !== $title
	/* translators: %s: video title */
	? sprintf( __( 'Play video: %s', 'werun-blocks-community' ), $title )
	: __( 'Play video', 'werun-blocks-community' );
$cap    = wrbc_on( $a, 'showCaption', false ) ? wrbc_rich( $a['caption'] ?? '' ) : '';
$cap    = '' !== trim( wp_strip_all_tags( $cap ) ) ? $cap : '';
$trans  = wrbc_on( $a, 'showTranscript', false ) ? wrbc_rich( $a['transcript'] ?? '' ) : '';
$trans  = '' !== trim( wp_strip_all_tags( $trans ) ) ? $trans : '';
$note   = $e['third_party'] && 'none' !== $e['consent'];
$ratio  = str_replace( '/', ' / ', $e['ratio'] );
// The audio-described version (WCAG 1.2.5): an http(s) or site-relative URL, or nothing.
$ad_url = esc_url( trim( wrbc_text( $a['describedUrl'] ?? '' ) ), array( 'http', 'https' ) );
$ad_tab = wrbc_on( $a, 'describedNewTab', false );

// What the block's text and focus ring sit on: its own background or the one around it.
$surface = wrbc_surface( $a, $block );
// The badge's icon reads on its button (twin: playColors() in source.js).
$colors = 'background' !== $mode ? wrbc_video_block_play_colors( $a, $style ) : array(
	'bg' => '',
	'fg' => '',
);

$classes = array(
	'wrbc-root',
	'wrbc-video',
	'wrbc-video--' . $mode,
	'wrbc-video--' . $e['provider'],
	$uid,
	wrbc_tone_class( $surface, wrbc_context_background( $block ) ),
);
if ( 'background' !== $mode ) {
	$classes[] = 'wrbc-video--play-' . $style;
}
if ( '' !== $e['poster'] ) {
	$classes[] = 'has-poster';
}

$wrapper = get_block_wrapper_attributes(
	array(
		'id'    => $uid,
		'class' => implode( ' ', array_filter( $classes ) ),
		'style' => wrbc_css_vars(
			array_merge(
				wrbc_accent_vars( $a, $surface ),
				array(
					'--wrbc-video-ratio'   => $ratio,
					'--wrbc-video-radius'  => wrbc_video_block_em( $e['radius'] ),
					'--wrbc-video-play'    => 'background' !== $mode ? wrbc_video_block_em( $e['play_size'] ) : '',
					'--wrbc-video-play-bg' => $colors['bg'],
					'--wrbc-video-play-fg' => $colors['fg'],
				)
			)
		),
	)
);

// Options for wrbc-video. The iframe src is built by the module from the
// validated id and its fixed host; the file URL is a media library URL.
$data = array(
	'provider' => $e['provider'],
	'mode'     => $mode,
	'title'    => $name,
	'start'    => $e['start'],
	'labels'   => 'background' === $mode
		? array(
			'play'  => __( 'Play background video', 'werun-blocks-community' ),
			'pause' => __( 'Pause background video', 'werun-blocks-community' ),
		)
		: array(
			'close' => __( 'Close video', 'werun-blocks-community' ),
			'frame' => $name,
		),
);
if ( $e['third_party'] ) {
	$data['id'] = $e['id'];
} else {
	$data['src'] = $e['src'];
}
if ( '' !== $e['captions'] ) {
	// A BCP 47 tag (en, es, pt-BR), else the site language.
	$lang           = trim( wrbc_text( $a['captionsLang'] ?? '' ) );
	$lang           = preg_match( '/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8}){0,2}$/', $lang ) ? $lang : '';
	$data['tracks'] = array(
		array(
			'kind'    => 'captions',
			'src'     => $e['captions'],
			'srclang' => '' !== $lang ? $lang : substr( get_bloginfo( 'language' ), 0, 2 ),
			'label'   => '' !== trim( wrbc_text( $a['captionsLabel'] ?? '' ) ) ? wp_strip_all_tags( wrbc_text( $a['captionsLabel'] ) ) : __( 'Captions', 'werun-blocks-community' ),
			'default' => true,
		),
	);
}
$json = wp_json_encode( $data, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE );

// The poster: the media library image (srcset, lazy) or YouTube's still. A
// child of the stage, under the play button (which stays transparent), and
// marked as a backdrop: the editor's contrast check and the audit read what
// sits on it (the note, the badge) against its lightest and darkest pixels.
$poster_html = '';
if ( '' !== $e['poster'] ) {
	$poster_html = ( $e['own_poster'] && ! empty( $a['posterId'] ) )
		? wp_get_attachment_image(
			(int) $a['posterId'],
			'large',
			false,
			array(
				'class'             => 'wrbc-video__poster',
				'alt'               => '',
				'loading'           => 'lazy',
				'decoding'          => 'async',
				'sizes'             => '(min-width: 1200px) 1200px, 100vw',
				'data-wrbc-backdrop' => 'image',
			)
		)
		: '<img class="wrbc-video__poster" src="' . esc_url( $e['poster'] ) . '" alt="" loading="lazy" decoding="async" data-wrbc-backdrop="image">';
}

$play_icon = '<svg class="wrbc-video__play-svg" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14z"/></svg>';
?>
<div <?php echo $wrapper; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>>
	<figure class="wrbc-video__figure">
		<?php
		// A per-block consent override travels as data-wrbc-consent-mode (read by wrbc-consent).
		$consent_attr = ( $e['third_party'] && 'inherit' !== ( $a['consent'] ?? 'inherit' ) ) ? ' data-wrbc-consent-mode="' . esc_attr( $e['consent'] ) . '"' : '';
		?>
		<?php // The stage is always dark (#0b0b0f): its focus rings and links take the light tokens. ?>
		<div class="wrbc-video__stage wrbc-is-dark" data-wrbc-video="<?php echo esc_attr( $json ); ?>"<?php echo $consent_attr; // phpcs:ignore ?>>
			<?php echo $poster_html; // phpcs:ignore ?>
			<?php if ( 'background' === $mode ) : ?>
				<?php // No src: wrbc-video sets it unless reduced motion / Save-Data, so nothing downloads without JS. ?>
				<video class="wrbc-video__bg" muted loop playsinline preload="none" disablepictureinpicture disableremoteplayback aria-hidden="true" tabindex="-1" data-wrbc-backdrop="image"></video>
				<button type="button" class="wrbc-video__toggle" data-wrbc-video-toggle aria-label="<?php echo esc_attr__( 'Pause background video', 'werun-blocks-community' ); ?>" hidden>
					<svg class="wrbc-video__toggle-pause" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
					<svg class="wrbc-video__toggle-play" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false"><path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14z"/></svg>
				</button>
			<?php else : ?>
				<button
					type="button"
					class="wrbc-video__play"
					aria-label="<?php echo esc_attr( $play ); ?>"
					<?php echo 'modal' === $mode ? 'aria-haspopup="dialog"' : ''; ?>
					<?php echo $note ? 'aria-describedby="' . esc_attr( $uid . '-note' ) . '"' : ''; ?>
				>
					<span class="wrbc-video__play-btn" aria-hidden="true">
						<?php echo $play_icon; // phpcs:ignore -- fixed markup ?>
						<?php if ( 'pill' === $style ) : ?>
							<span class="wrbc-video__play-text"><?php esc_html_e( 'Play video', 'werun-blocks-community' ); ?></span>
						<?php endif; ?>
					</span>
				</button>
				<?php if ( $note ) : ?>
					<?php // Outside the button: its visible text isn't part of the button's name (WCAG 2.5.3), it describes it. ?>
					<span class="wrbc-video__note" id="<?php echo esc_attr( $uid . '-note' ); ?>">
						<?php
						/* translators: %s: host name, e.g. youtube-nocookie.com */
						echo esc_html( sprintf( __( 'Plays from %s', 'werun-blocks-community' ), $e['host'] ) );
						?>
					</span>
				<?php endif; ?>
				<?php
				// Without JavaScript the button can't build the player: a link to the
				// provider's page (or the file) takes its place; the CSS hides the button.
				$watch = wrbc_video_block_watch( $e, $title );
				?>
				<noscript>
					<a class="wrbc-video__nojs" href="<?php echo esc_url( $watch['url'] ); ?>"<?php echo '' !== $watch['name'] ? ' aria-label="' . esc_attr( $watch['name'] ) . '"' : ''; ?>>
						<span class="wrbc-video__play-btn">
							<?php echo $play_icon; // phpcs:ignore -- fixed markup ?>
							<span class="wrbc-video__play-text"><?php echo esc_html( $watch['label'] ); ?></span>
						</span>
					</a>
				</noscript>
				<?php
				if ( $e['third_party'] && 'cmp' === $e['consent'] ) {
					echo wrbc_video_block_consent_box( $e['host'], $title ); // phpcs:ignore -- escaped inside
				}
				?>
			<?php endif; ?>
		</div>
		<?php if ( '' !== $cap ) : ?>
			<figcaption class="wrbc-video__caption"><?php echo $cap; // phpcs:ignore ?></figcaption>
		<?php endif; ?>
	</figure>

	<?php if ( '' !== $ad_url ) : ?>
		<?php // The same video with a narrator describing what's on screen (WCAG 1.2.5), named after it. ?>
		<p class="wrbc-video__described">
			<a <?php echo wrbc_link_attrs( $ad_url, $ad_tab ); // phpcs:ignore -- escaped inside ?>>
				<?php if ( '' !== $title ) : ?>
					<span aria-hidden="true"><?php esc_html_e( 'Watch the audio-described version', 'werun-blocks-community' ); ?></span>
					<span class="wrbc-sr-only">
						<?php
						/* translators: %s: video title */
						echo esc_html( sprintf( __( 'Watch the audio-described version: %s', 'werun-blocks-community' ), $title ) );
						?>
					</span>
				<?php else : ?>
					<?php esc_html_e( 'Watch the audio-described version', 'werun-blocks-community' ); ?>
				<?php endif; ?>
				<?php echo wrbc_new_tab_note( $ad_tab ); // phpcs:ignore -- escaped inside ?>
			</a>
		</p>
	<?php endif; ?>

	<?php if ( '' !== $trans ) : ?>
		<?php // A disclosure the visitor opens on purpose: the whole text, no scroll box inside the page. ?>
		<details class="wrbc-video__transcript">
			<?php // Named after the video ("Transcript: <title>"), so two transcripts on a page are told apart. ?>
			<summary class="wrbc-video__transcript-toggle">
				<?php if ( '' !== $title ) : ?>
					<span aria-hidden="true"><?php esc_html_e( 'Transcript', 'werun-blocks-community' ); ?></span>
					<span class="wrbc-sr-only">
						<?php
						/* translators: %s: video title */
						echo esc_html( sprintf( __( 'Transcript: %s', 'werun-blocks-community' ), $title ) );
						?>
					</span>
				<?php else : ?>
					<?php esc_html_e( 'Transcript', 'werun-blocks-community' ); ?>
				<?php endif; ?>
			</summary>
			<div class="wrbc-video__transcript-body"><?php echo wpautop( $trans ); // phpcs:ignore ?></div>
		</details>
	<?php endif; ?>

	<?php
	// VideoObject: name and thumbnailUrl are required, so it is left out without a poster.
	if ( wrbc_on( $a, 'schema', false ) && '' !== $title && '' !== $e['poster'] ) {
		$description = trim( wp_strip_all_tags( wrbc_text( $a['schemaDescription'] ?? '' ) ) );
		if ( '' === $description ) {
			$description = '' !== $cap ? trim( wp_strip_all_tags( $cap ) ) : $title;
		}
		$schema = array(
			'@context'     => 'https://schema.org',
			'@type'        => 'VideoObject',
			'name'         => $title,
			'description'  => $description,
			'thumbnailUrl' => array( $e['poster'] ),
		);
		$date = wrbc_text( $a['schemaDate'] ?? '' );
		if ( preg_match( '/^(\d{4})-(\d{2})-(\d{2})$/', $date, $d ) && checkdate( (int) $d[2], (int) $d[3], (int) $d[1] ) ) {
			$schema['uploadDate'] = $date;
		} elseif ( ! $e['third_party'] && ! empty( $a['fileId'] ) ) {
			$uploaded = get_post_time( 'c', true, (int) $a['fileId'] );
			if ( $uploaded ) {
				$schema['uploadDate'] = $uploaded;
			}
		}
		if ( $e['third_party'] ) {
			$schema['embedUrl'] = 'youtube' === $e['provider']
				? 'https://www.youtube-nocookie.com/embed/' . $e['id']
				: 'https://player.vimeo.com/video/' . $e['id'];
		} else {
			$schema['contentUrl'] = $e['src'];
		}
		if ( '' !== $trans ) {
			$schema['transcript'] = trim( wp_strip_all_tags( preg_replace( '#<br\s*/?>|</p>#i', "\n", $trans ) ) );
		}
		printf(
			'<script type="application/ld+json">%s</script>',
			wp_json_encode( $schema, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES ) // phpcs:ignore
		);
	}
	?>
</div>
