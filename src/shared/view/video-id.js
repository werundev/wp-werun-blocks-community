/**
 * A YouTube or Vimeo id from a URL or an id. Twin of wrbc_video_id() in
 * includes/modules/video.php: same patterns, keep them in step.
 *
 *   YouTube  ^[A-Za-z0-9_-]{11}$   from youtu.be/ID, youtube.com/watch?v=ID,
 *                                   /embed/ID, /shorts/ID, /live/ID, /v/ID,
 *                                   youtube-nocookie.com/embed/ID
 *   Vimeo    ^\d{6,12}$            from vimeo.com/ID, vimeo.com/…/ID,
 *                                   player.vimeo.com/video/ID
 *
 * @param {string} provider 'youtube' | 'vimeo'.
 * @param {string} value    URL or id.
 * @return {string} The id, or '' when it isn't a valid one.
 */
export const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
export const VIMEO_ID = /^\d{6,12}$/;

const YOUTUBE_URL = /^(?:https?:)?\/\/(?:(?:[a-z0-9-]+\.)?(?:youtube\.com|youtube-nocookie\.com)\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([A-Za-z0-9_-]{11})(?:[?&#/]|$)/i;
const VIMEO_URL = /^(?:https?:)?\/\/(?:[a-z0-9-]+\.)?vimeo\.com\/(?:.*\/)?(\d{6,12})(?:[?&#/]|$)/i;

export function videoId( provider, value ) {
	const v = typeof value === 'string' ? value.trim() : '';
	if ( provider === 'youtube' ) {
		if ( YOUTUBE_ID.test( v ) ) {
			return v;
		}
		const m = v.match( YOUTUBE_URL );
		return m ? m[ 1 ] : '';
	}
	if ( provider === 'vimeo' ) {
		if ( VIMEO_ID.test( v ) ) {
			return v;
		}
		const m = v.match( VIMEO_URL );
		return m ? m[ 1 ] : '';
	}
	return '';
}

/** The provider a URL belongs to, or ''. */
export function videoProvider( value ) {
	const v = typeof value === 'string' ? value.trim() : '';
	if ( YOUTUBE_URL.test( v ) ) {
		return 'youtube';
	}
	if ( VIMEO_URL.test( v ) ) {
		return 'vimeo';
	}
	return '';
}
