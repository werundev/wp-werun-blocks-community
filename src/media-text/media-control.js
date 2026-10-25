/**
 * Whether a media value has something render.php can show: the same test as
 * render.php ($has_media). The control that edits the value is the shared
 * MediaOrVideoControl (src/shared/controls-extra.js), value shape:
 *
 *   { type, id, url, provider, videoId, posterId, posterUrl, alt, captionsId, captionsUrl, transcript }
 *
 * Video ids use the patterns of the wrbc-video contract (YouTube
 * ^[A-Za-z0-9_-]{11}$, Vimeo ^\d{6,12}$); an uploaded file is only an
 * attachment from the media library.
 */
import { VIMEO_ID, YOUTUBE_ID } from '../shared/view/video-id';

export function hasMedia( value ) {
	const v = value || {};
	if ( v.type === 'video' ) {
		if ( v.provider === 'youtube' ) {
			return YOUTUBE_ID.test( v.videoId || '' );
		}
		if ( v.provider === 'vimeo' ) {
			return VIMEO_ID.test( v.videoId || '' );
		}
		return v.provider === 'file' && !! v.id;
	}
	return !! ( v.id || v.url );
}
