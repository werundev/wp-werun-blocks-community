/**
 * Table of contents, front end, per instance ([data-wrbc-toc] options):
 *   - clicks: open the tab / <details> that hides the heading, scroll to it
 *     (smoothly unless reduced motion is asked for), below the sticky offset
 *     and the admin bar, update the URL and move focus to the heading
 *   - highlight: aria-current="location" on the link of the section being
 *     read (IntersectionObserver tells when a heading crosses the top line)
 *   - dropdown: the <details> is open from 782 px, folded under it
 *   - sticky over the text: what gets keyboard focus under it is scrolled
 *     clear of it
 * Without this script the links still jump and the <details> still works.
 */
const wide = window.matchMedia( '(min-width: 782px)' );
const reduce = () => window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;

function adminBar() {
	const bar = document.getElementById( 'wpadminbar' );
	return bar && window.getComputedStyle( bar ).position === 'fixed' ? bar.offsetHeight : 0;
}

function targetOf( link ) {
	const hash = link.hash || '';
	if ( hash.length < 2 ) {
		return null;
	}
	try {
		return document.getElementById( decodeURIComponent( hash.slice( 1 ) ) );
	} catch {
		return null;
	}
}

/** Opens what hides the heading: tabs (wrbc-tabs) and <details> around it. */
function reveal( target ) {
	if ( window.wrbc && window.wrbc.tabs && typeof window.wrbc.tabs.open === 'function' ) {
		window.wrbc.tabs.open( target );
	}
	for ( let details = target.closest( 'details' ); details; details = details.parentElement && details.parentElement.closest( 'details' ) ) {
		if ( ! details.open ) {
			details.open = true;
		}
	}
}

/**
 * Finishes the entrance reveal (shared [data-wrbc-reveal]: 18px translate)
 * of the blocks around an element, at once, so a scroll to it lands where it
 * ends up rather than where the animation has it now.
 */
function settle( element ) {
	for ( let node = element.closest( '[data-wrbc-reveal]' ); node; node = node.parentElement && node.parentElement.closest( '[data-wrbc-reveal]' ) ) {
		if ( ! node.classList.contains( 'is-inview' ) ) {
			node.style.transition = 'none';
			node.classList.add( 'is-inview' );
			void node.offsetWidth; // apply before the transition comes back
			node.style.transition = '';
		}
	}
}

/** Whether the heading is laid out (not in a hidden panel or a closed <details>). */
function shown( target ) {
	if ( target.closest( '[hidden]' ) ) {
		return false;
	}
	const closed = target.closest( 'details:not([open])' );
	return ! closed || !! target.closest( 'summary' );
}

function setup( root ) {
	if ( root.dataset.wrbcReady ) {
		return;
	}
	root.dataset.wrbcReady = '1';
	let o = {};
	try {
		o = JSON.parse( root.dataset.wrbcToc || '{}' );
	} catch {}
	const offset = Math.max( 0, Number( o.offset ) || 0 );
	const pairs = Array.from( root.querySelectorAll( '.wrbc-toc__link' ) )
		.map( ( link ) => ( { link, target: targetOf( link ) } ) )
		.filter( ( pair ) => pair.target );

	// Dropdown on phones: open (and not foldable) on wide screens. There the
	// summary is only the title: out of the Tab order, and announced as a
	// control that can't be used rather than one that does nothing (4.1.2).
	const details = root.querySelector( '[data-wrbc-toc-details]' );
	const summary = details && details.querySelector( 'summary' );
	if ( o.collapsible && details && summary ) {
		const sync = () => {
			details.open = wide.matches;
			summary.tabIndex = wide.matches ? -1 : 0;
			if ( wide.matches ) {
				summary.setAttribute( 'aria-disabled', 'true' );
			} else {
				summary.removeAttribute( 'aria-disabled' );
			}
		};
		sync();
		wide.addEventListener( 'change', sync );
		summary.addEventListener( 'click', ( event ) => {
			if ( wide.matches ) {
				event.preventDefault();
			}
		} );
	}

	// Sticky over the text rather than in a column of its own, the list would
	// cover what's under it: the heading a link lands on, and anything that
	// gets keyboard focus there (WCAG 2.4.11).
	const stuck = () => root.classList.contains( 'wrbc-toc--sticky' ) && window.getComputedStyle( root ).position === 'sticky';
	const across = ( element ) => {
		const r = root.getBoundingClientRect();
		const e = element.getBoundingClientRect();
		return e.left < r.right && e.right > r.left;
	};
	let landing = null; // the heading a link of this list focused: its scroll margin already clears the list
	if ( root.classList.contains( 'wrbc-toc--sticky' ) ) {
		document.addEventListener( 'focusin', ( event ) => {
			const element = event.target;
			if ( ! ( element instanceof window.Element ) || root.contains( element ) || element === landing ) {
				return;
			}
			// Once the browser has scrolled it into view.
			window.requestAnimationFrame( () => {
				if ( ! stuck() || ! across( element ) ) {
					return;
				}
				const r = root.getBoundingClientRect();
				const e = element.getBoundingClientRect();
				if ( e.top < r.bottom && e.bottom > r.top ) {
					window.scrollBy( 0, e.top - r.bottom - 8 );
				}
			} );
		} );
	}

	root.addEventListener( 'click', ( event ) => {
		const link = event.target.closest( '.wrbc-toc__link' );
		const pair = link && pairs.find( ( p ) => p.link === link );
		if ( ! pair || event.defaultPrevented || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ) {
			return;
		}
		event.preventDefault();
		const target = pair.target;
		// Fold the dropdown first: closing it after the scroll starts would shift the page.
		if ( o.collapsible && details && ! wide.matches ) {
			details.open = false;
		}
		reveal( target );
		settle( target );
		const cover = stuck() && across( target ) ? root.offsetHeight : 0;
		target.style.scrollMarginTop = `${ offset + adminBar() + cover + 8 }px`;
		target.scrollIntoView( { block: 'start', behavior: o.smooth && ! reduce() ? 'smooth' : 'auto' } );
		if ( window.history && window.history.pushState ) {
			window.history.pushState( null, '', link.hash );
		}
		// Keyboard and screen-reader users continue from the heading.
		if ( ! target.hasAttribute( 'tabindex' ) && ! target.matches( 'a[href], button, input, select, textarea, summary' ) ) {
			target.setAttribute( 'tabindex', '-1' );
		}
		landing = target;
		target.focus( { preventScroll: true } );
	} );

	if ( ! o.highlight || ! pairs.length || ! ( 'IntersectionObserver' in window ) ) {
		return;
	}
	let current = null;
	const line = () => offset + adminBar() + 12;
	const compute = () => {
		let active = null;
		for ( const pair of pairs ) {
			if ( ! shown( pair.target ) ) {
				continue;
			}
			if ( pair.target.getBoundingClientRect().top - line() > 1 ) {
				break;
			}
			active = pair;
		}
		// At the very bottom the last heading may never reach the line.
		const doc = document.documentElement;
		if ( active && window.innerHeight + window.scrollY >= doc.scrollHeight - 2 ) {
			active = pairs.filter( ( p ) => shown( p.target ) ).pop() || active;
		}
		if ( active === current ) {
			return;
		}
		if ( current ) {
			current.link.removeAttribute( 'aria-current' );
		}
		if ( active ) {
			active.link.setAttribute( 'aria-current', 'location' );
			// Keep it in view inside a sticky list that scrolls, without moving the page.
			if ( root.scrollHeight > root.clientHeight + 1 ) {
				const lr = active.link.getBoundingClientRect();
				const rr = root.getBoundingClientRect();
				if ( lr.top < rr.top || lr.bottom > rr.bottom ) {
					root.scrollTop += lr.top - rr.top - rr.height / 3;
				}
			}
		}
		current = active;
	};
	let frame = 0;
	const schedule = () => {
		if ( ! frame ) {
			frame = window.requestAnimationFrame( () => {
				frame = 0;
				compute();
			} );
		}
	};
	const observer = new window.IntersectionObserver( schedule, { rootMargin: `-${ line() }px 0px 0px 0px`, threshold: [ 0, 1 ] } );
	pairs.forEach( ( pair ) => observer.observe( pair.target ) );
	// Tabs and accordions change what is laid out.
	document.addEventListener( 'wrbc:tabs-change', schedule, true ); // capture: the event doesn't bubble
	document.addEventListener( 'toggle', schedule, true );
	window.addEventListener( 'resize', schedule, { passive: true } );
	schedule();
}

function init() {
	document.querySelectorAll( '[data-wrbc-toc]' ).forEach( setup );
}

if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', init );
} else {
	init();
}
