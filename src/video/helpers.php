<?php
/**
 * Video block: sources and effective settings.
 * Twin: src/video/source.js (same rules, same names); ids: src/shared/view/video-id.js.
 *
 * Loaded with require_once from render.php; every function is guarded so a
 * second copy (or the shared helpers of the modules work) never redeclares it.
 *
 * @package werun-blocks-community
 */

defined( 'ABSPATH' ) || exit;

if ( ! function_exists( 'wrbc_video_block_id' ) ) {
	/**
	 * A validated YouTube / Vimeo id from an id or a URL, or ''.
	 *
	 * Uses the shared wrbc_video_id( $provider, $value ) (includes/modules/video.php)
	 * when it is loaded, and checks its answer against the contract's id
	 * patterns either way: the player URL is built only from a value that
	 * passes them. Without it, the same patterns as src/shared/view/video-id.js.
	 *
	 * @param string $provider youtube | vimeo.
	 * @param mixed  $value    Id or URL.
	 */
	function wrbc_video_block_id( $provider, $value ) {
		$ids = array(
			'youtube' => '/^[A-Za-z0-9_-]{11}$/',
			'vimeo'   => '/^\d{6,12}$/',
		);
		if ( ! isset( $ids[ $provider ] ) || ! is_scalar( $value ) ) {
			return '';
		}
		$value = trim( (string) $value );
		if ( '' === $value ) {
			return '';
		}
		if ( function_exists( 'wrbc_video_id' ) ) {
			try {
				$shared = wrbc_video_id( $provider, $value );
				return ( is_string( $shared ) && preg_match( $ids[ $provider ], $shared ) ) ? $shared : '';
			} catch ( \Throwable $e ) { // phpcs:ignore Generic.CodeAnalysis.EmptyStatement.DetectedCatch
				// Another signature: the local twin below decides.
			}
		}
		if ( preg_match( $ids[ $provider ], $value ) ) {
			return $value;
		}
		// Twin of YOUTUBE_URL / VIMEO_URL in src/shared/view/video-id.js.
		$urls = array(
			'youtube' => '~^(?:https?:)?//(?:(?:[a-z0-9-]+\.)?(?:youtube\.com|youtube-nocookie\.com)/(?:watch\?(?:[^#]*&)?v=|embed/|shorts/|live/|v/)|youtu\.be/)([A-Za-z0-9_-]{11})(?:[?&#/]|$)~i',
			'vimeo'   => '~^(?:https?:)?//(?:[a-z0-9-]+\.)?vimeo\.com/(?:.*/)?(\d{6,12})(?:[?&#/]|$)~i',
		);
		return preg_match( $urls[ $provider ], $value, $m ) ? $m[1] : '';
	}
}

if ( ! function_exists( 'wrbc_video_block_media_url' ) ) {
	/**
	 * A media library URL: the attachment's own URL when there is an id of the
	 * right type, otherwise the stored URL only when it lives in this site's
	 * uploads folder. Anything else (other hosts, javascript:, quotes) is ''.
	 *
	 * @param mixed  $id     Attachment id.
	 * @param mixed  $url    Stored URL.
	 * @param string $prefix MIME prefix: "video/", "image/", "text/vtt".
	 */
	function wrbc_video_block_media_url( $id, $url, $prefix ) {
		$id = is_numeric( $id ) ? (int) $id : 0;
		if ( $id > 0 ) {
			$mime = (string) get_post_mime_type( $id );
			$file = wp_get_attachment_url( $id );
			// WordPress stores .vtt as text/vtt; some setups say text/plain.
			$type_ok = 0 === strpos( $mime, $prefix ) || ( 'text/vtt' === $prefix && preg_match( '/\.vtt$/i', (string) $file ) );
			if ( $file && $type_ok ) {
				return esc_url_raw( $file, array( 'http', 'https' ) );
			}
			return '';
		}
		$url = is_scalar( $url ) ? trim( (string) $url ) : '';
		if ( '' === $url || preg_match( '/["\'<>\s\\\\]/', $url ) ) {
			return '';
		}
		$uploads = wp_get_upload_dir();
		$base    = set_url_scheme( trailingslashit( $uploads['baseurl'] ), 'https' );
		$check   = set_url_scheme( $url, 'https' );
		if ( 0 !== strpos( $check, $base ) || false !== strpos( substr( $check, strlen( $base ) ), '..' ) ) {
			return '';
		}
		return esc_url_raw( $url, array( 'http', 'https' ) );
	}
}

if ( ! function_exists( 'wrbc_video_block_em' ) ) {
	/** px → em at a 16px base, so the block's font size scales it. Twin: em() in source.js. */
	function wrbc_video_block_em( $px ) {
		return round( $px / 16, 3 ) . 'em';
	}
}

if ( ! function_exists( 'wrbc_video_block_clamp' ) ) {
	/**
	 * An integer in [min, max], or the fallback when it is not a number.
	 *
	 * @param mixed $value    Raw value.
	 * @param int   $min      Lower limit.
	 * @param int   $max      Upper limit.
	 * @param int   $fallback Default.
	 */
	function wrbc_video_block_clamp( $value, $min, $max, $fallback ) {
		return is_numeric( $value ) ? max( $min, min( $max, (int) round( (float) $value ) ) ) : $fallback;
	}
}

if ( ! function_exists( 'wrbc_video_block_consent' ) ) {
	/**
	 * The consent mode that applies: the block's override, or the site's
	 * Integrations setting (privacy.consent), "click" when neither is known.
	 *
	 * @param string $override inherit | click | cmp | none.
	 */
	function wrbc_video_block_consent( $override ) {
		if ( in_array( $override, array( 'click', 'cmp', 'none' ), true ) ) {
			return $override;
		}
		if ( class_exists( '\Werun\BlocksCommunity\Integrations\Integrations' ) ) {
			$site = \Werun\BlocksCommunity\Integrations\Integrations::get( 'privacy.consent', 'click' );
			if ( in_array( $site, array( 'click', 'cmp', 'none' ), true ) ) {
				return $site;
			}
		}
		return 'click';
	}
}

if ( ! function_exists( 'wrbc_video_block_effective' ) ) {
	/**
	 * What the block prints, from its attributes. Twin: effective() in source.js.
	 *
	 * @param array $a Block attributes.
	 */
	function wrbc_video_block_effective( array $a ) {
		$provider    = in_array( $a['provider'] ?? '', array( 'youtube', 'vimeo', 'file' ), true ) ? $a['provider'] : 'youtube';
		$third_party = 'file' !== $provider;
		$id          = '';
		if ( $third_party ) {
			$id = wrbc_video_block_id( $provider, $a['videoId'] ?? '' );
			if ( '' === $id ) {
				$id = wrbc_video_block_id( $provider, $a['url'] ?? '' );
			}
		}
		$src        = $third_party ? '' : wrbc_video_block_media_url( $a['fileId'] ?? 0, $a['fileUrl'] ?? '', 'video/' );
		$has_source = $third_party ? '' !== $id : '' !== $src;
		$own_poster = wrbc_video_block_media_url( $a['posterId'] ?? 0, $a['posterUrl'] ?? '', 'image/' );
		$thumb      = ( 'youtube' === $provider && wrbc_on( $a, 'useProviderThumb', false ) && '' !== $id ) ? 'https://i.ytimg.com/vi/' . $id . '/hqdefault.jpg' : '';
		$poster     = '' !== $own_poster ? $own_poster : $thumb;
		$mode       = in_array( $a['mode'] ?? '', array( 'inline', 'modal', 'background' ), true ) ? $a['mode'] : 'inline';
		// Background is self-hosted only; a window needs a poster to click.
		if ( 'background' === $mode && $third_party ) {
			$mode = 'inline';
		}
		if ( 'modal' === $mode && '' === $poster ) {
			$mode = 'inline';
		}
		$captions = ( ! $third_party && 'background' !== $mode ) ? wrbc_video_block_media_url( $a['captionsId'] ?? 0, $a['captionsUrl'] ?? '', 'text/vtt' ) : '';
		$ratios   = array( '16/9', '4/3', '1/1', '9/16', '21/9' );

		return array(
			'provider'    => $provider,
			'third_party' => $third_party,
			'id'          => $id,
			'src'         => $src,
			'has_source'  => $has_source,
			'poster'      => $poster,
			'own_poster'  => '' !== $own_poster,
			'mode'        => $mode,
			'start'       => 'background' === $mode ? 0 : wrbc_video_block_clamp( $a['start'] ?? 0, 0, 86400, 0 ),
			'captions'    => $captions,
			'consent'     => $third_party ? wrbc_video_block_consent( $a['consent'] ?? 'inherit' ) : 'none',
			'play_size'   => wrbc_video_block_clamp( $a['playSize'] ?? 72, 40, 160, 72 ),
			'radius'      => wrbc_video_block_clamp( $a['radius'] ?? 12, 0, 48, 12 ),
			'ratio'       => in_array( $a['ratio'] ?? '', $ratios, true ) ? $a['ratio'] : '16/9',
			'host'        => array(
				'youtube' => 'youtube-nocookie.com',
				'vimeo'   => 'player.vimeo.com',
				'file'    => '',
			)[ $provider ],
		);
	}
}

if ( ! function_exists( 'wrbc_video_block_play_colors' ) ) {
	/**
	 * The play badge's colours as the page paints them. Twin: playColors() in
	 * source.js. The chosen button colour, and an icon (and "Play video" text)
	 * colour that reads on it: the chosen one, moved only as far as it must to
	 * stand out — 3:1 for the icon, 4.5:1 when the badge carries text (WCAG
	 * 1.4.11, 1.4.3; the stored value stays as chosen) — or, when none is
	 * chosen, white or ink, whichever reads on the button. '' = the
	 * stylesheet's accent / on-accent.
	 *
	 * @param array  $a     Block attributes.
	 * @param string $style circle | square | pill.
	 * @return array{ bg: string, fg: string, chosen: string }
	 */
	function wrbc_video_block_play_colors( array $a, $style ) {
		$bg = wrbc_text( $a['playColor'] ?? '' );
		$fg = wrbc_text( $a['playIconColor'] ?? '' );
		if ( ! function_exists( 'wrbc_color_rgba' ) ) {
			return array(
				'bg'     => $bg,
				'fg'     => $fg,
				'chosen' => $fg,
			);
		}
		// Only colours the style attribute can carry (wrbc_css_value()) and the maths can read.
		$bg     = ( '' !== wrbc_css_value( $bg ) && null !== wrbc_color_rgba( $bg ) ) ? $bg : '';
		$chosen = ( '' !== wrbc_css_value( $fg ) && null !== wrbc_color_rgba( $fg ) ) ? $fg : '';
		$back = '' !== $bg ? $bg : WERUN_BLOCKS_COMMUNITY_ACCENT;
		if ( '' !== $chosen ) {
			$fg = wrbc_readable_color( $chosen, $back, 'pill' === $style ? WERUN_BLOCKS_COMMUNITY_AA_TEXT : WERUN_BLOCKS_COMMUNITY_AA_UI );
		} else {
			$fg = '' !== $bg ? wrbc_on_color( $back ) : '';
		}
		return array(
			'bg'     => $bg,
			'fg'     => $fg,
			'chosen' => $chosen,
		);
	}
}

if ( ! function_exists( 'wrbc_video_block_watch' ) ) {
	/**
	 * Where the video plays without JavaScript (the <noscript> link): the
	 * provider's own page, built from the validated id, or the file itself.
	 *
	 * @param array  $e     Effective settings (wrbc_video_block_effective()).
	 * @param string $title The video's title ('' when it has none).
	 * @return array{ url: string, label: string, name: string } name: the link's
	 *         accessible name with the title ('' = its visible label).
	 */
	function wrbc_video_block_watch( array $e, $title = '' ) {
		$start = (int) $e['start'];
		if ( 'youtube' === $e['provider'] ) {
			return array(
				'url'   => 'https://www.youtube.com/watch?v=' . rawurlencode( $e['id'] ) . ( $start ? '&t=' . $start . 's' : '' ),
				'label' => __( 'Watch the video on YouTube', 'werun-blocks-community' ),
				/* translators: %s: video title */
				'name'  => '' !== $title ? sprintf( __( 'Watch the video on YouTube: %s', 'werun-blocks-community' ), $title ) : '',
			);
		}
		if ( 'vimeo' === $e['provider'] ) {
			return array(
				'url'   => 'https://vimeo.com/' . rawurlencode( $e['id'] ) . ( $start ? '#t=' . $start . 's' : '' ),
				'label' => __( 'Watch the video on Vimeo', 'werun-blocks-community' ),
				/* translators: %s: video title */
				'name'  => '' !== $title ? sprintf( __( 'Watch the video on Vimeo: %s', 'werun-blocks-community' ), $title ) : '',
			);
		}
		return array(
			'url'   => $e['src'] . ( $start ? '#t=' . $start : '' ),
			'label' => __( 'Open the video', 'werun-blocks-community' ),
			/* translators: %s: video title */
			'name'  => '' !== $title ? sprintf( __( 'Open the video: %s', 'werun-blocks-community' ), $title ) : '',
		);
	}
}

if ( ! function_exists( 'wrbc_video_block_consent_box' ) ) {
	/**
	 * The hidden placeholder wrbc-video shows in cmp mode when the banner has
	 * not allowed "video" yet. The shared wrbc_consent_placeholder() when it is
	 * loaded; otherwise the same hooks wrbc-consent reads ([data-wrbc-consent],
	 * [data-wrbc-consent-accept]).
	 *
	 * @param string $host  Where the player comes from.
	 * @param string $title The video's title ('' when it has none).
	 */
	function wrbc_video_block_consent_box( $host, $title ) {
		// The button says what it does (WCAG 2.4.6): "Load the video: <title>", never just the title.
		$action = '' !== $title
			/* translators: %s: video title */
			? sprintf( __( 'Load the video: %s', 'werun-blocks-community' ), $title )
			: __( 'Load the video', 'werun-blocks-community' );
		if ( function_exists( 'wrbc_consent_placeholder' ) ) {
			try {
				// Only printed in cmp mode: say so, so the placeholder shows the banner's wording and no "always allow".
				$html = wrbc_consent_placeholder(
					'video',
					$host,
					$action,
					array(
						'hidden' => true,
						'mode'   => 'cmp',
					)
				);
				if ( is_string( $html ) && '' !== $html ) {
					return $html;
				}
			} catch ( \Throwable $e ) { // phpcs:ignore Generic.CodeAnalysis.EmptyStatement.DetectedCatch
				// Another signature: the local markup below.
			}
		}
		return sprintf(
			'<div class="wrbc-consent wrbc-video__consent" data-wrbc-consent="video" hidden><p class="wrbc-consent__text">%1$s</p><button type="button" class="wrbc-btn wrbc-consent__accept" data-wrbc-consent-accept>%2$s</button></div>',
			esc_html(
				sprintf(
					/* translators: %s: host name */
					__( 'This video is played from %s, which may set cookies. It loads once you allow it.', 'werun-blocks-community' ),
					$host
				)
			),
			esc_html( $action )
		);
	}
}
