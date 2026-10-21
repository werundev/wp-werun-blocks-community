/**
 * Timeline, horizontal: back/forward arrows for the scroll-snap track. The
 * track already scrolls without this (scrollbar, touch, arrow keys once
 * focused); the arrows stay hidden until this runs and while nothing
 * overflows. Home/End jump to the first/last item. The track is a Tab stop
 * (a named group) only while it scrolls and an item has nothing focusable
 * that would bring it into view (docs/accessibility.md: scrollers). Instant
 * scrolling under reduced motion; RTL aware.
 */
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function setup( root ) {
	if ( ! root || root.dataset.wrbcTlReady ) {
		return;
	}
	const track = root.querySelector( '[data-wrbc-tl-track]' );
	if ( ! track ) {
		return;
	}
	// The arrows are optional (showArrows): without them the track still
	// gets its keys and its Tab stop.
	const nav = root.querySelector( '[data-wrbc-tl-nav]' );
	const prev = nav && nav.querySelector( '[data-wrbc-tl-prev]' );
	const next = nav && nav.querySelector( '[data-wrbc-tl-next]' );
	const arrows = !! ( prev && next );
	// The name render.php gave the track, and whether Tab already reaches
	// every item through a link or button inside it.
	const name = track.getAttribute( 'aria-label' );
	const items = Array.from( track.querySelectorAll( '.wrbc-timeline-item' ) );
	const reachable = items.length > 0 && items.every( ( item ) => item.querySelector( FOCUSABLE ) );
	root.dataset.wrbcTlReady = '1';
	const reduce = window.matchMedia ? window.matchMedia( '(prefers-reduced-motion: reduce)' ) : { matches: false };
	const rtl = () => window.getComputedStyle( track ).direction === 'rtl';
	const behavior = () => ( reduce.matches ? 'auto' : 'smooth' );

	// One item and the gap after it.
	const step = () => {
		const item = track.querySelector( '.wrbc-timeline-item' );
		const list = track.firstElementChild;
		if ( ! item || ! list ) {
			return track.clientWidth;
		}
		const gap = parseFloat( window.getComputedStyle( list ).columnGap ) || 0;
		return item.getBoundingClientRect().width + gap;
	};

	const update = () => {
		const max = track.scrollWidth - track.clientWidth;
		const pos = Math.abs( track.scrollLeft );
		// A Tab stop with a role and a name only while there is something to
		// scroll that Tab wouldn't reach (render.php prints all three, so it
		// scrolls by keyboard without JS too).
		if ( max > 1 && ! reachable ) {
			track.setAttribute( 'tabindex', '0' );
			track.setAttribute( 'role', 'group' );
			if ( name ) {
				track.setAttribute( 'aria-label', name );
			}
		} else {
			track.removeAttribute( 'tabindex' );
			track.removeAttribute( 'role' );
			track.removeAttribute( 'aria-label' );
		}
		// aria-disabled, not disabled: a focused button keeps its focus at the end.
		if ( arrows ) {
			nav.hidden = max <= 1;
			prev.setAttribute( 'aria-disabled', pos <= 1 ? 'true' : 'false' );
			next.setAttribute( 'aria-disabled', pos >= max - 1 ? 'true' : 'false' );
		}
	};

	const go = ( dir ) => {
		track.scrollBy( { left: dir * step() * ( rtl() ? -1 : 1 ), behavior: behavior() } );
	};
	if ( arrows ) {
		prev.addEventListener( 'click', () => prev.getAttribute( 'aria-disabled' ) !== 'true' && go( -1 ) );
		next.addEventListener( 'click', () => next.getAttribute( 'aria-disabled' ) !== 'true' && go( 1 ) );
	}

	// Home/End on the track itself (not on a link inside an item): the first
	// or last item. The arrow keys scroll it natively.
	track.addEventListener( 'keydown', ( event ) => {
		if ( event.target !== track || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey ) {
			return;
		}
		if ( event.key !== 'Home' && event.key !== 'End' ) {
			return;
		}
		const max = track.scrollWidth - track.clientWidth;
		if ( max <= 1 ) {
			return;
		}
		event.preventDefault();
		const end = event.key === 'End' ? max : 0;
		track.scrollTo( { left: rtl() ? -end : end, behavior: behavior() } );
	} );

	let frame = 0;
	track.addEventListener(
		'scroll',
		() => {
			window.cancelAnimationFrame( frame );
			frame = window.requestAnimationFrame( update );
		},
		{ passive: true }
	);
	if ( 'ResizeObserver' in window ) {
		new window.ResizeObserver( update ).observe( track );
	} else {
		window.addEventListener( 'resize', update );
	}
	update();
}

function init() {
	document.querySelectorAll( '.wrbc-timeline--horizontal' ).forEach( setup );
}

window.wrbc = window.wrbc || {};
window.wrbc.timeline = { setup };

if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', init );
} else {
	init();
}
