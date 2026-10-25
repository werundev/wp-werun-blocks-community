/**
 * Shared front-end module wrbc-video. Contract: docs/shared-modules.md.
 *
 *   <div data-wrbc-video='{"provider":"youtube|vimeo|file","id":"…","src":"…",
 *        "mode":"inline|modal|background","start":0,"title":"…",
 *        "labels":{"close":"Close","pause":"Pause the video","play":"Play the video"}}'>
 *     <button type="button" class="wrbc-video__play">poster + play</button>
 *     <!-- optional, for the cmp consent mode: wrbc_consent_placeholder( 'video', …, array( 'hidden' => true ) ) -->
 *   </div>
 *
 * Facade: nothing from YouTube or Vimeo loads until the visitor presses
 * play; then the player comes from youtube-nocookie.com or
 * player.vimeo.com?dnt=1. Pressing play is the visitor's choice for that one
 * video, so the click and none consent modes load straight away; in cmp mode
 * the banner must have allowed "video", otherwise the hidden placeholder
 * shows and the player loads once it is accepted (here or in the banner).
 *
 *   inline      the player replaces the poster.
 *   modal       a <dialog> (showModal: focus is trapped, Escape closes);
 *               closing removes the player (sound stops) and focus returns
 *               to the play button. Browsers without showModal get a fixed
 *               overlay with the same keys.
 *   background  a self-hosted <video muted loop playsinline> with a visible
 *               pause button (WCAG 2.2.2) whose name says what it does
 *               ("Pause…" / "Play…"); when the browser refuses to autoplay
 *               it offers "Play". Reduced motion, Save-Data or "mobile":
 *               false on a phone (max-width 767px) keep the poster and never
 *               download the video.
 *
 * Captions for the file player: "tracks": [{ src, srclang, label,
 * kind: captions | subtitles, default }].
 *
 * API: window.wrbc.video.setup( root ), .videoId( provider, value ).
 */
import { __ } from '@wordpress/i18n';
import { el, ns, options as readOptions, ready, reducedMotion, roots, safeUrl, saveData } from './lib';
import { videoId } from './video-id';

const label = ( o, key, fallback ) => ( o.labels && typeof o.labels[ key ] === 'string' && o.labels[ key ] ) || fallback;
const frameName = ( o ) => String( o.title || label( o, 'frame', __( 'Video', 'werun-blocks-community' ) ) );

/*
 * Keyboard or pointer: an iframe with focus inside it matches neither :focus
 * nor :focus-visible in the page, so the frame shows the player's focus ring
 * (.is-focus-visible, drawn inside it by wrbc-modules) when the player got
 * focus from the keyboard.
 */
let keyboard = false;
document.addEventListener( 'keydown', ( event ) => ( keyboard = ! event.metaKey && ! event.ctrlKey && ! event.altKey ), true );
document.addEventListener( 'pointerdown', () => ( keyboard = false ), true );

function ringOnFocus( frame, media ) {
	media.addEventListener( 'focus', () => frame.classList.toggle( 'is-focus-visible', keyboard ) );
	media.addEventListener( 'blur', () => frame.classList.remove( 'is-focus-visible' ) );
}
// Tabbing into an iframe only blurs this window (no focus event on the iframe).
window.addEventListener( 'blur', () =>
	window.setTimeout( () => {
		const active = document.activeElement;
		if ( active && active.matches && active.matches( '.wrbc-video__frame > iframe.wrbc-video__media' ) ) {
			active.parentElement.classList.toggle( 'is-focus-visible', keyboard );
		}
	} )
);
window.addEventListener( 'focus', () => document.querySelectorAll( '.wrbc-video__frame.is-focus-visible' ).forEach( ( frame ) => frame.contains( document.activeElement ) || frame.classList.remove( 'is-focus-visible' ) ) );

function playerUrl( o ) {
	const start = Math.max( 0, parseInt( o.start, 10 ) || 0 );
	if ( o.provider === 'youtube' ) {
		const id = videoId( 'youtube', o.id );
		return id ? `https://www.youtube-nocookie.com/embed/${ id }?autoplay=1&rel=0&playsinline=1${ start ? '&start=' + start : '' }` : '';
	}
	if ( o.provider === 'vimeo' ) {
		const id = videoId( 'vimeo', o.id );
		return id ? `https://player.vimeo.com/video/${ id }?autoplay=1&dnt=1${ start ? '#t=' + start + 's' : '' }` : '';
	}
	return '';
}

/** The player element: an iframe for YouTube / Vimeo, <video> for a file. */
function player( o ) {
	if ( o.provider === 'file' ) {
		const src = safeUrl( o.src );
		if ( ! src ) {
			return null;
		}
		const video = document.createElement( 'video' );
		video.className = 'wrbc-video__media';
		video.controls = true;
		video.autoplay = true;
		video.playsInline = true;
		video.src = src + ( parseInt( o.start, 10 ) > 0 ? '#t=' + parseInt( o.start, 10 ) : '' );
		if ( o.title ) {
			video.setAttribute( 'aria-label', String( o.title ) );
		}
		// Captions / subtitles (WCAG 1.2.2): URLs checked, only plain strings.
		( Array.isArray( o.tracks ) ? o.tracks : [] ).forEach( ( t ) => {
			const trackSrc = t && safeUrl( t.src );
			if ( ! trackSrc ) {
				return;
			}
			const track = document.createElement( 'track' );
			track.kind = t.kind === 'subtitles' ? 'subtitles' : 'captions';
			track.src = trackSrc;
			if ( typeof t.srclang === 'string' && /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test( t.srclang ) ) {
				track.srclang = t.srclang;
			}
			if ( typeof t.label === 'string' ) {
				track.label = t.label;
			}
			if ( t.default ) {
				track.default = true;
			}
			video.appendChild( track );
		} );
		return video;
	}
	const url = playerUrl( o );
	if ( ! url ) {
		return null;
	}
	const iframe = document.createElement( 'iframe' );
	iframe.className = 'wrbc-video__media';
	iframe.src = url;
	iframe.title = frameName( o );
	iframe.allow = 'autoplay; fullscreen; picture-in-picture; encrypted-media';
	iframe.allowFullscreen = true;
	// YouTube refuses to play without a referrer (error 153).
	iframe.referrerPolicy = 'strict-origin-when-cross-origin';
	return iframe;
}

/**
 * Waits for the "video" consent where the mode asks for it. Accepting it in
 * the placeholder counts for this video for the rest of the page view (a
 * window reopened doesn't ask again).
 */
function allowed( root, o ) {
	const consent = window.wrbc && window.wrbc.consent;
	if ( root.wrbcAllowed || o.provider === 'file' || ! consent || consent.mode( root ) !== 'cmp' || consent.has( 'video', root ) ) {
		return Promise.resolve();
	}
	const box = root.querySelector( '[data-wrbc-consent]' );
	if ( ! box ) {
		return Promise.resolve(); // no placeholder printed: the click is the consent
	}
	root.classList.add( 'is-asking' );
	const asked = consent.request( 'video', box );
	box.querySelector( '[data-wrbc-consent-accept]' )?.focus();
	return asked.then( () => {
		root.wrbcAllowed = true;
		// Back to its resting state (not "Loading…"); the player takes the focus itself.
		if ( consent.loaded ) {
			consent.loaded( box, null );
		}
		box.hidden = true;
		root.classList.remove( 'is-asking' );
	} );
}

/* ── Inline ──────────────────────────────────────────────────────────── */

function inline( root, o, button ) {
	const media = player( o );
	if ( ! media ) {
		return;
	}
	// The visitor's focus was on the play button (or the consent button that
	// just hid): it carries on inside the player. A consent given later in the
	// site's banner doesn't pull focus away from the banner.
	const active = document.activeElement;
	const follow = ! active || active === document.body || root.contains( active );
	const frame = el( 'div', 'wrbc-video__frame' );
	frame.appendChild( media );
	ringOnFocus( frame, media );
	button.replaceWith( frame );
	root.classList.add( 'is-playing' );
	if ( follow ) {
		media.focus();
	}
}

/* ── Modal ───────────────────────────────────────────────────────────── */

function modal( root, o, button ) {
	const media = player( o );
	if ( ! media ) {
		return;
	}
	const dialog = document.createElement( 'dialog' );
	dialog.className = 'wrbc-video__dialog';
	// The dialog lives in <body>: carry the block's ratio, so a 9:16 video isn't letterboxed.
	dialog.style.setProperty( '--wrbc-video-ratio', window.getComputedStyle( root ).getPropertyValue( '--wrbc-video-ratio' ).trim() || '16 / 9' );
	dialog.setAttribute( 'aria-label', frameName( o ) );
	const close = el( 'button', 'wrbc-video__close' );
	close.type = 'button';
	close.setAttribute( 'aria-label', label( o, 'close', __( 'Close', 'werun-blocks-community' ) ) );
	// The × is drawn by CSS: no markup from data.
	close.appendChild( el( 'span', 'wrbc-video__close-icon' ) ).setAttribute( 'aria-hidden', 'true' );
	const frame = el( 'div', 'wrbc-video__frame' );
	frame.appendChild( media );
	ringOnFocus( frame, media );
	dialog.append( close, frame );
	document.body.appendChild( dialog );

	const native = typeof dialog.showModal === 'function';
	let closed = false;
	const finish = () => {
		if ( closed ) {
			return;
		}
		closed = true;
		document.removeEventListener( 'keydown', onKey, true );
		media.remove(); // stops the sound and the player's network use
		dialog.remove();
		document.documentElement.classList.remove( 'wrbc-video-open' );
		if ( button.isConnected ) {
			button.focus();
		}
	};
	const shut = () => ( native && dialog.open ? dialog.close() : finish() );

	// Fallback overlay: Escape and a Tab loop between the close button and the player.
	function onKey( event ) {
		if ( event.key === 'Escape' ) {
			event.preventDefault();
			shut();
		} else if ( event.key === 'Tab' && ! native ) {
			const stops = [ close, media ];
			const i = stops.indexOf( document.activeElement );
			if ( i < 0 || ( event.shiftKey && i === 0 ) || ( ! event.shiftKey && i === stops.length - 1 ) ) {
				event.preventDefault();
				stops[ event.shiftKey ? stops.length - 1 : 0 ].focus();
			}
		}
	}

	close.addEventListener( 'click', shut );
	dialog.addEventListener( 'close', finish );
	// A click on the backdrop (the dialog box itself, outside the player) closes.
	dialog.addEventListener( 'click', ( event ) => {
		if ( event.target === dialog ) {
			shut();
		}
	} );
	document.documentElement.classList.add( 'wrbc-video-open' );
	if ( native ) {
		dialog.showModal();
	} else {
		dialog.setAttribute( 'open', '' );
		dialog.setAttribute( 'role', 'dialog' );
		dialog.setAttribute( 'aria-modal', 'true' );
		dialog.classList.add( 'wrbc-video__dialog--fallback' );
		document.addEventListener( 'keydown', onKey, true );
	}
	close.focus();
}

/* ── Background ──────────────────────────────────────────────────────── */

function background( root, o ) {
	let video = root.querySelector( 'video.wrbc-video__bg' );
	const src = safeUrl( o.src );
	// "mobile": false keeps phones on the poster (data and battery).
	const phone = o.mobile === false && window.matchMedia && window.matchMedia( '(max-width: 767px)' ).matches;
	if ( reducedMotion() || saveData() || phone || ! src ) {
		root.classList.add( 'is-poster' );
		root.querySelector( '[data-wrbc-video-toggle]' )?.setAttribute( 'hidden', '' );
		return; // the poster stays; the video is never downloaded
	}
	if ( ! video ) {
		video = document.createElement( 'video' );
		video.className = 'wrbc-video__bg';
		root.prepend( video );
	}
	video.muted = true;
	video.loop = true;
	video.playsInline = true;
	video.setAttribute( 'aria-hidden', 'true' );
	video.setAttribute( 'tabindex', '-1' );
	video.src = src;

	let toggle = root.querySelector( '[data-wrbc-video-toggle]' );
	if ( ! toggle ) {
		toggle = el( 'button', 'wrbc-video__toggle' );
		toggle.type = 'button';
		toggle.setAttribute( 'data-wrbc-video-toggle', '' );
		toggle.appendChild( el( 'span', 'wrbc-video__toggle-icon' ) ).setAttribute( 'aria-hidden', 'true' );
		root.appendChild( toggle );
	}
	toggle.hidden = false;

	let userPaused = false;
	let visible = true;
	const sync = () => {
		const play = ! userPaused && visible && ! document.hidden;
		if ( play ) {
			const p = video.play();
			if ( p && p.catch ) {
				p.catch( ( error ) => {
					// Autoplay refused: the poster stays and the button offers "Play"
					// (a press is a gesture the browser accepts). An AbortError only
					// means a pause() came first.
					if ( error && error.name === 'NotAllowedError' && ! userPaused ) {
						userPaused = true;
						sync();
					}
				} );
			}
		} else {
			video.pause();
		}
		// The name says what pressing it does (it changes; no aria-pressed with a changing name).
		toggle.setAttribute(
			'aria-label',
			userPaused ? label( o, 'play', __( 'Play the background video', 'werun-blocks-community' ) ) : label( o, 'pause', __( 'Pause the background video', 'werun-blocks-community' ) )
		);
		root.classList.toggle( 'is-paused', userPaused );
	};
	toggle.addEventListener( 'click', () => {
		userPaused = ! userPaused;
		sync();
	} );
	document.addEventListener( 'visibilitychange', sync );
	// Off screen it only costs battery.
	if ( 'IntersectionObserver' in window ) {
		new IntersectionObserver( ( entries ) => {
			visible = entries[ 0 ].isIntersecting;
			sync();
		} ).observe( root );
	}
	video.addEventListener( 'playing', () => root.classList.add( 'is-playing' ), { once: true } );
	sync();
}

/* ── Setup ───────────────────────────────────────────────────────────── */

function setup( root ) {
	if ( root.wrbcVideo ) {
		return;
	}
	root.wrbcVideo = true;
	const o = readOptions( root, 'data-wrbc-video' );
	o.provider = [ 'youtube', 'vimeo', 'file' ].includes( o.provider ) ? o.provider : 'youtube';
	const mode = [ 'inline', 'modal', 'background' ].includes( o.mode ) ? o.mode : 'inline';

	if ( mode === 'background' ) {
		background( root, o );
		return;
	}
	const button = root.querySelector( '.wrbc-video__play, [data-wrbc-video-play]' );
	if ( ! button ) {
		return;
	}
	if ( button.tagName === 'BUTTON' && ! button.getAttribute( 'type' ) ) {
		button.type = 'button';
	}
	if ( mode === 'modal' ) {
		button.setAttribute( 'aria-haspopup', 'dialog' );
	}
	button.addEventListener( 'click', ( event ) => {
		event.preventDefault(); // an <a> facade links to the video as a no-JS fallback
		allowed( root, o ).then( () => ( mode === 'modal' ? modal( root, o, button ) : inline( root, o, button ) ) );
	} );
	root.classList.add( 'is-ready' );
}

function setupAll( scope ) {
	roots( scope, '[data-wrbc-video]' ).forEach( setup );
}

ns( 'video', { setup: setupAll, videoId } );

ready( () => setupAll( document ) );
