<?php
/**
 * Video ids. Twin of src/shared/view/video-id.js (videoId()): the same
 * patterns, so the editor, render.php and the front end agree on what a
 * valid YouTube or Vimeo video is. Keep them in step.
 *
 * @package werun-blocks-community
 */

defined( 'ABSPATH' ) || exit;

if ( ! function_exists( 'wrbc_video_id' ) ) {
	/**
	 * A YouTube or Vimeo id from a URL or an id.
	 *
	 *   YouTube  ^[A-Za-z0-9_-]{11}$  from youtu.be/ID, youtube.com/watch?v=ID, /embed/ID,
	 *                                  /shorts/ID, /live/ID, /v/ID, youtube-nocookie.com/embed/ID
	 *   Vimeo    ^\d{6,12}$           from vimeo.com/ID, vimeo.com/…/ID, player.vimeo.com/video/ID
	 *
	 * @param string $provider youtube | vimeo.
	 * @param string $value    URL or id.
	 * @return string The id, or '' when it isn't a valid one.
	 */
	function wrbc_video_id( $provider, $value ) {
		$value = is_scalar( $value ) ? trim( (string) $value ) : '';
		if ( 'youtube' === $provider ) {
			if ( preg_match( '/^[A-Za-z0-9_-]{11}$/', $value ) ) {
				return $value;
			}
			if ( preg_match( '~^(?:https?:)?//(?:(?:[a-z0-9-]+\.)?(?:youtube\.com|youtube-nocookie\.com)/(?:watch\?(?:[^#]*&)?v=|embed/|shorts/|live/|v/)|youtu\.be/)([A-Za-z0-9_-]{11})(?:[?&#/]|$)~i', $value, $m ) ) {
				return $m[1];
			}
			return '';
		}
		if ( 'vimeo' === $provider ) {
			if ( preg_match( '/^\d{6,12}$/', $value ) ) {
				return $value;
			}
			if ( preg_match( '~^(?:https?:)?//(?:[a-z0-9-]+\.)?vimeo\.com/(?:.*/)?(\d{6,12})(?:[?&#/]|$)~i', $value, $m ) ) {
				return $m[1];
			}
		}
		return '';
	}
}
