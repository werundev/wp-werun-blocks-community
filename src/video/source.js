/**
 * Video sources and the effective settings, shared by the editor.
 * Twin: src/video/helpers.php (same rules, same names).
 */

import { videoId as sharedVideoId } from '../shared/view/video-id';
import {
	AA_TEXT,
	AA_UI,
	ACCENT,
	colorRgba,
	onColor,
	readableColor,
} from '../shared/contrast';
import { safeCssValue } from '../shared/controls';

/**
 * The validated id from an id or a pasted URL, or '': the contract's
 * videoId() (src/shared/view/video-id.js, twin of wrbc_video_id()).
 * @param provider
 * @param value
 */
export const videoId = ( provider, value ) => sharedVideoId( provider, value );
export const parseVideoUrl = videoId;

const MODES = [ 'click', 'cmp', 'none' ];
export function consentMode( override ) {
	if ( MODES.includes( override ) ) {
		return override;
	}
	const site = window.wrbcSettings?.integrations?.privacy?.consent;
	return MODES.includes( site ) ? site : 'click';
}

export const clamp = ( value, min, max, fallback ) => {
	const n = Number( value );
	return Number.isFinite( n )
		? Math.max( min, Math.min( max, Math.round( n ) ) )
		: fallback;
};

/**
 * YouTube's own still, only when the editor asked for it (it loads from Google).
 * @param id
 */
export const providerThumb = ( id ) =>
	`https://i.ytimg.com/vi/${ id }/hqdefault.jpg`;

/**
 * What render.php will print, from the attributes.
 * Twin: wrbc_video_block_effective() in helpers.php.
 * @param a
 */
export function effective( a ) {
	const provider = [ 'youtube', 'vimeo', 'file' ].includes( a.provider )
		? a.provider
		: 'youtube';
	const thirdParty = provider !== 'file';
	const id = thirdParty
		? videoId( provider, a.videoId ) || parseVideoUrl( provider, a.url )
		: '';
	const src = provider === 'file' ? a.fileUrl || '' : '';
	const hasSource = thirdParty ? !! id : !! src;
	const thumb =
		provider === 'youtube' && a.useProviderThumb && id
			? providerThumb( id )
			: '';
	const poster = a.posterUrl || thumb;
	let mode = [ 'inline', 'modal', 'background' ].includes( a.mode )
		? a.mode
		: 'inline';
	// Background is self-hosted only; a window needs a poster to click.
	if ( mode === 'background' && thirdParty ) {
		mode = 'inline';
	}
	if ( mode === 'modal' && ! poster ) {
		mode = 'inline';
	}
	return {
		provider,
		thirdParty,
		id,
		src,
		hasSource,
		poster,
		mode,
		start: mode === 'background' ? 0 : clamp( a.start, 0, 86400, 0 ),
		hasCaptions:
			provider === 'file' && mode !== 'background' && !! a.captionsUrl,
		// The block's override, else the site's Integrations → Privacy (twin: wrbc_video_block_consent()).
		consent: thirdParty ? consentMode( a.consent ) : 'none',
		playSize: clamp( a.playSize, 40, 160, 72 ),
		radius: clamp( a.radius, 0, 48, 12 ),
		ratio: [ '16/9', '4/3', '1/1', '9/16', '21/9' ].includes( a.ratio )
			? a.ratio
			: '16/9',
	};
}

/**
 * The play badge's colours as the page paints them. Twin:
 * wrbc_video_block_play_colors() in helpers.php. bg: the chosen button
 * colour; fg: the chosen icon/text colour moved only as far as it must to
 * stand out (3:1, or 4.5:1 with the "Play video" text), or white / ink when
 * none is chosen; chosen: the valid chosen icon colour (stored as is). '' =
 * the stylesheet's accent / on-accent.
 * @param {Object} a     Attributes.
 * @param {string} style circle | square | pill.
 */
export function playColors( a, style ) {
	const valid = ( value ) =>
		typeof value === 'string' &&
		safeCssValue( value ) &&
		!! colorRgba( value );
	const bg = valid( a.playColor ) ? a.playColor : '';
	const chosen = valid( a.playIconColor ) ? a.playIconColor : '';
	const back = bg || ACCENT;
	let fg = '';
	if ( chosen ) {
		fg = readableColor( chosen, back, style === 'pill' ? AA_TEXT : AA_UI );
	} else if ( bg ) {
		fg = onColor( back );
	}
	return { bg, fg, chosen };
}

/** The host a third-party video plays from (iframe origin in wrbc-video). */
export const HOST = {
	youtube: 'youtube-nocookie.com',
	vimeo: 'player.vimeo.com',
};

/**
 * px → em at a 16px base, so the block's font size scales it.
 * @param value
 */
export const em = ( value ) =>
	`${ Math.round( ( value / 16 ) * 1000 ) / 1000 }em`;
