/**
 * Notice, front end.
 * - Close button: shown only here (without JS it could not close anything).
 *   Closing hides the notice, moves focus to what comes after it, says
 *   "Notice dismissed" in a polite live region (made when the page loads:
 *   one that appears together with its text is not read out reliably), and
 *   remembers it for N days in localStorage under a key made of the block's
 *   id and its text's hash (printed by render.php). Storage can be blocked:
 *   every access is in a try/catch and the notice then simply shows again.
 * - Urgent notices (warning / danger marked urgent): their text is said once,
 *   a moment after the page loads, in an assertive live region. The notice
 *   itself is no live region: it is printed with the page.
 * - Sticky / fixed bars: the page keeps focused elements out from under the
 *   bar (scroll-padding, WCAG 2.4.11) and a fixed bottom bar never covers the
 *   end of the page (body padding). Bars that would cover too much of the
 *   window (a phone on its side, 200–400 % zoom) stop sticking and scroll
 *   with the page (WCAG 1.4.10). A soft bar's tint gets an opaque backdrop in
 *   the colour of what it sits on, so a dark section keeps its light text.
 */
const DAY = 24 * 60 * 60 * 1000;
/* Share of the window the bars on one edge may cover; they stick again below
   the lower share, so a bar never flips between the two on its own. */
const UNSTICK = 0.3;
const RESTICK = 0.22;

function read( key ) {
	try {
		const until = parseInt( window.localStorage.getItem( key ) || '', 10 );
		if ( until && until > Date.now() ) {
			return true;
		}
		if ( until ) {
			window.localStorage.removeItem( key );
		}
	} catch {}
	return false;
}

function write( key, days ) {
	if ( ! days ) {
		return;
	}
	try {
		window.localStorage.setItem( key, String( Date.now() + days * DAY ) );
	} catch {}
}

/**
 * The page's live region for notices, made once and before anything is said
 * in it: polite for a dismissal, assertive for an urgent notice.
 * @param {boolean} assertive Whether it interrupts the screen reader.
 */
function liveRegion( assertive ) {
	const id = assertive ? 'wrbc-notice-alert' : 'wrbc-notice-live';
	let region = document.getElementById( id );
	if ( ! region ) {
		region = document.createElement( 'div' );
		region.id = id;
		region.className = 'wrbc-sr-only';
		region.setAttribute( 'role', assertive ? 'alert' : 'status' );
		region.setAttribute( 'aria-live', assertive ? 'assertive' : 'polite' );
		document.body.appendChild( region );
	}
	return region;
}

/**
 * Says a sentence in a live region, then empties it again (so reading the
 * page later doesn't find a stray copy at the end).
 * @param {HTMLElement} region Live region.
 * @param {string}      text   Sentence to say.
 * @param {number}      delay  Milliseconds to wait first.
 */
function say( region, text, delay ) {
	region.textContent = '';
	window.setTimeout( () => {
		region.textContent = text;
		window.setTimeout( () => {
			if ( region.textContent === text ) {
				region.textContent = '';
			}
		}, 10000 );
	}, delay );
}

/**
 * The colour behind an element: the first ancestor with an opaque background
 * colour, or '' when an image or a gradient comes first (the CSS default
 * stays then).
 * @param {HTMLElement} el Element.
 */
function backdrop( el ) {
	for ( let node = el.parentElement; node; node = node.parentElement ) {
		const style = window.getComputedStyle( node );
		if ( style.backgroundImage !== 'none' ) {
			return '';
		}
		const colour = style.backgroundColor;
		const alpha =
			colour.match( /rgba\((?:[^,]+,){3}\s*([\d.]+)\s*\)/ ) ||
			colour.match( /\/\s*([\d.]+)(%?)\s*\)$/ );
		const opacity = alpha
			? parseFloat( alpha[ 1 ] ) / ( alpha[ 2 ] === '%' ? 100 : 1 )
			: 1;
		if ( colour && colour !== 'transparent' && opacity >= 0.99 ) {
			return colour;
		}
	}
	return '';
}

/* Space the sticky / fixed bars take, per edge, applied to the page. */
const bars = { top: new Set(), bottom: new Set() };
const original = {};
function layoutBars() {
	const html = document.documentElement;
	const room = window.innerHeight || html.clientHeight || 1;
	const space = {};
	[ 'top', 'bottom' ].forEach( ( edge ) => {
		let height = 0;
		let offset = 0;
		let wasUnstuck = false;
		bars[ edge ].forEach( ( bar ) => {
			if ( bar.hidden ) {
				return;
			}
			height += bar.getBoundingClientRect().height;
			wasUnstuck = wasUnstuck || bar.classList.contains( 'is-unstuck' );
			// A bar's own offset (space above / below it) counts too.
			offset = Math.max(
				offset,
				parseFloat(
					window
						.getComputedStyle( bar )
						.getPropertyValue( '--wrbc-notice-offset' )
				) || 0
			);
		} );
		const unstuck =
			height > 0 &&
			( height + offset ) / room > ( wasUnstuck ? RESTICK : UNSTICK );
		bars[ edge ].forEach( ( bar ) =>
			bar.classList.toggle( 'is-unstuck', unstuck )
		);
		space[ edge ] = height && ! unstuck ? Math.round( height + offset ) : 0;
	} );
	if ( original.html === undefined ) {
		original.html = html.style.scrollPaddingTop;
		original.htmlBottom = html.style.scrollPaddingBottom;
		original.body = document.body.style.paddingBottom;
	}
	// A sticky top bar sits under the admin bar (its CSS adds the height).
	html.style.scrollPaddingTop = space.top
		? `calc(${ space.top }px + var(--wp-admin--admin-bar--height, 0px))`
		: original.html;
	html.style.scrollPaddingBottom = space.bottom
		? `${ space.bottom }px`
		: original.htmlBottom;
	document.body.style.paddingBottom = space.bottom
		? `${ space.bottom }px`
		: original.body;
	// Other sticky things (the comparison table's header row) sit below a top bar.
	// The value is where the bars end, under the admin bar (offset included).
	html.style.setProperty( '--wrbc-notice-top-h', `${ space.top }px` );
}

/* One layout per frame, outside ResizeObserver callbacks (switching a bar
   between sticky and not resizes it again). */
let queued = false;
function scheduleBars() {
	if ( queued ) {
		return;
	}
	queued = true;
	window.requestAnimationFrame( () => {
		queued = false;
		layoutBars();
	} );
}

/**
 * Where focus goes once the notice is gone: the next thing in the page.
 * @param {HTMLElement} notice The notice that closed.
 */
function focusAfter( notice ) {
	let target = notice.nextElementSibling;
	while (
		target &&
		( target.hidden || target.getClientRects().length === 0 )
	) {
		target = target.nextElementSibling;
	}
	// Nothing after it (a bar at the end of the page): what comes before.
	if ( ! target ) {
		target = notice.previousElementSibling;
		while (
			target &&
			( target.hidden || target.getClientRects().length === 0 )
		) {
			target = target.previousElementSibling;
		}
	}
	target = target || notice.parentElement || notice.ownerDocument.body;
	if (
		! target.hasAttribute( 'tabindex' ) &&
		! target.matches( 'a[href], button, input, select, textarea' )
	) {
		target.setAttribute( 'tabindex', '-1' );
		target.addEventListener(
			'blur',
			() => target.removeAttribute( 'tabindex' ),
			{ once: true }
		);
	}
	target.focus( { preventScroll: true } );
}

/* Texts of the urgent notices on this page, said together once. */
const urgent = [];

function setup( notice ) {
	if ( notice.dataset.wrbcReady ) {
		return;
	}
	notice.dataset.wrbcReady = '1';
	let options = {};
	try {
		options = JSON.parse( notice.dataset.wrbcNotice || '{}' );
	} catch {}
	const key = typeof options.key === 'string' ? options.key : '';
	const days = Math.max(
		0,
		Math.min( 365, parseInt( options.days, 10 ) || 0 )
	);

	if ( key && read( key ) ) {
		notice.hidden = true;
		return;
	}

	if (
		notice.hasAttribute( 'data-wrbc-urgent' ) &&
		notice.getClientRects().length
	) {
		const text = (
			notice.querySelector( '.wrbc-notice__content' )?.textContent || ''
		)
			.replace( /\s+/g, ' ' )
			.trim();
		if ( text ) {
			urgent.push( text );
		}
	}

	let edge = '';
	if ( notice.classList.contains( 'wrbc-notice--pos-sticky-top' ) ) {
		edge = 'top';
	} else if ( notice.classList.contains( 'wrbc-notice--pos-sticky-bottom' ) ) {
		edge = 'bottom';
	}
	if ( edge ) {
		if (
			notice.classList.contains( 'wrbc-notice--soft' ) &&
			! notice.classList.contains( 'has-background' )
		) {
			const colour = backdrop( notice );
			if ( colour ) {
				notice.style.setProperty( '--wrbc-notice-underlay', colour );
			}
		}
		if ( ! bars.top.size && ! bars.bottom.size ) {
			window.addEventListener( 'resize', scheduleBars, {
				passive: true,
			} );
		}
		bars[ edge ].add( notice );
		layoutBars();
		if ( 'ResizeObserver' in window ) {
			new window.ResizeObserver( scheduleBars ).observe( notice );
		}
	}

	const button = notice.querySelector( '[data-wrbc-notice-close]' );
	if ( ! button ) {
		return;
	}
	const region = liveRegion( false );
	button.hidden = false;
	button.addEventListener( 'click', () => {
		// Safari does not focus a clicked button: the body has focus then.
		const active = notice.ownerDocument.activeElement;
		const hadFocus =
			notice.contains( active ) || active === notice.ownerDocument.body;
		notice.hidden = true;
		if ( key ) {
			write( key, days );
		}
		if ( edge ) {
			layoutBars();
		}
		if ( hadFocus ) {
			focusAfter( notice );
		}
		say( region, notice.dataset.dismissed || '', 50 );
	} );
}

function init() {
	document
		.querySelectorAll(
			'.wrbc-notice.is-dismissible, .wrbc-notice--pos-sticky-top, .wrbc-notice--pos-sticky-bottom, .wrbc-notice[data-wrbc-urgent]'
		)
		.forEach( setup );
	if ( urgent.length ) {
		// A moment after the page loads, so it's heard as news, not lost in it.
		say( liveRegion( true ), urgent.join( ' ' ), 1000 );
		urgent.length = 0;
	}
}

if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', init );
} else {
	init();
}
