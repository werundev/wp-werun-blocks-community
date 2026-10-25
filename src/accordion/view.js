/**
 * Accordion, front end. Opening and closing is the browser's own <details>;
 * this adds, per instance:
 *   - one open at a time where the browser does not support <details name>
 *   - the search field, which hides the questions that do not match
 *   - expand all / collapse all
 *   - what both did, in the status region, for screen readers
 *   - opening the item a link points to (#item-id), on load and on
 *     hashchange, and moving the focus to its question
 *
 * The search (accents ignored, every word must match) is wrbc-filter's,
 * bundled in, so lists across the blocks search the same way.
 */
import { filterList, normalize } from '../shared/view/filter';

const supportsName = 'name' in document.createElement( 'details' );

const reducedMotion = () => window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;

/** This accordion's own elements, not those of one nested in an answer. */
const own = ( root, selector ) => Array.from( root.querySelectorAll( selector ) ).filter( ( node ) => node.closest( '.wrbc-accordion' ) === root );

/** The translated messages render.php prints (data-wrbc-acc-labels). */
function labelsOf( root ) {
	try {
		const labels = JSON.parse( root.getAttribute( 'data-wrbc-acc-labels' ) || '{}' );
		return labels && typeof labels === 'object' ? labels : {};
	} catch ( e ) {
		return {};
	}
}

function setup( root ) {
	if ( root.dataset.wrbcReady ) {
		return;
	}
	root.dataset.wrbcReady = '1';
	const single = root.dataset.wrbcAccordion === 'single';
	const items = own( root, '.wrbc-acc-item' );
	const details = items.map( ( item ) => item.querySelector( '.wrbc-acc-item__details' ) );
	const labels = labelsOf( root );

	// Status messages. Emptied first, so the same message twice is read twice.
	const status = own( root, '[data-wrbc-acc-status]' )[ 0 ];
	let saying;
	const say = ( text ) => {
		if ( ! status || typeof text !== 'string' || ! text ) {
			return;
		}
		clearTimeout( saying );
		status.textContent = '';
		saying = setTimeout( () => {
			status.textContent = text;
		}, 60 );
	};

	// One open at a time, for browsers without <details name>.
	if ( single && ! supportsName ) {
		details.forEach( ( current ) => {
			current.addEventListener( 'toggle', () => {
				if ( current.open ) {
					details.forEach( ( other ) => other !== current && ( other.open = false ) );
				}
			} );
		} );
	}

	// Search. Hidden items are display: none, so they leave the accessibility
	// tree too; the count is announced once typing pauses, not at every key.
	const input = own( root, '[data-wrbc-acc-search]' )[ 0 ];
	const empty = own( root, '[data-wrbc-acc-empty]' )[ 0 ];
	if ( input ) {
		const texts = items.map( ( item ) => normalize( item.textContent ) );
		const found = Array.isArray( labels.found ) ? labels.found : [];
		let timer;
		let spoken;
		input.addEventListener( 'input', () => {
			clearTimeout( timer );
			clearTimeout( spoken );
			timer = setTimeout( () => {
				const shown = filterList( items, input.value, { texts } );
				if ( empty ) {
					empty.hidden = shown > 0;
				}
				spoken = setTimeout( () => {
					if ( ! normalize( input.value ) ) {
						say( labels.all );
					} else {
						say( shown ? found[ shown - 1 ] : labels.none );
					}
				}, 600 );
			}, 120 );
		} );
		// Enter in a lone search field would submit a surrounding form.
		input.addEventListener( 'keydown', ( event ) => {
			if ( event.key === 'Enter' && input.form ) {
				event.preventDefault();
			}
		} );
	}

	// Expand all / collapse all (the questions the search shows).
	own( root, '[data-wrbc-acc-all]' ).forEach( ( button ) => {
		button.addEventListener( 'click', () => {
			const open = button.dataset.wrbcAccAll === 'open';
			details.forEach( ( d, i ) => {
				if ( d && ! items[ i ].hidden ) {
					d.open = open;
				}
			} );
			say( open ? labels.opened : labels.closed );
		} );
	} );
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

/**
 * Opens every question around an element (its item's own, when it is a
 * question, and the ones whose answers hold it) at once. Also
 * window.wrbc.accordion.open(), for blocks that link into answers (table of
 * contents).
 *
 * @param {Element} target Element inside an accordion.
 * @return {Element|null} The item that holds it, or null.
 */
function openTo( target ) {
	const item = target && target.closest( '.wrbc-acc-item' );
	if ( ! item ) {
		return null;
	}
	// The item's own <details>, and every one around it: a question inside
	// another question's answer is only visible once that one is open too.
	// They open at once, without the height animation (also those the
	// browser already started to open for the link), so the question is
	// visible (and focusable) right away and the scroll lands where it ends
	// up. Where one opens at a time, the question that closes for it closes
	// at once too: still animating, it would move the target after the scroll.
	const itemDetails = item.querySelector( '.wrbc-acc-item__details' );
	const instant = [];
	const quick = ( details ) => {
		details.classList.add( 'is-instant' );
		instant.push( details );
	};
	for ( let details = itemDetails; details; details = details.parentElement?.closest( 'details' ) ) {
		quick( details );
		const group = details.classList.contains( 'wrbc-acc-item__details' ) && details.closest( '.wrbc-accordion' );
		if ( group && group.dataset.wrbcAccordion === 'single' ) {
			own( group, '.wrbc-acc-item__details' ).forEach( ( other ) => {
				if ( other !== details && other.open ) {
					quick( other );
					other.open = false;
				}
			} );
		}
		details.open = true;
	}
	window.requestAnimationFrame( () => window.requestAnimationFrame( () => instant.forEach( ( details ) => details.classList.remove( 'is-instant' ) ) ) );
	settle( item );
	const behavior = reducedMotion() ? 'auto' : 'smooth';
	const summary = itemDetails && itemDetails.querySelector( '.wrbc-acc-item__summary' );
	// A link to the question (the item, its summary): the focus moves to the
	// question too, so keyboard and screen-reader users land where it shows.
	// A link to something inside the answer scrolls to that, and the browser
	// keeps it as the starting point of the next Tab.
	if ( summary && ( target === item || summary.contains( target ) ) ) {
		const focus = () => {
			// Not when the visitor has already moved the focus somewhere.
			const active = document.activeElement;
			if ( active !== summary && ( ! active || active === document.body ) ) {
				summary.focus( { preventScroll: true } );
			}
		};
		focus();
		// A question the browser can't focus yet (still being laid out): again
		// once it shows.
		if ( document.activeElement !== summary ) {
			window.requestAnimationFrame( () => window.requestAnimationFrame( focus ) );
		}
		// While the page loads, the browser's own jump to the #target (not
		// focusable: a <div>) gives the focus back to the page: again after it.
		if ( document.readyState !== 'complete' ) {
			window.addEventListener( 'load', () => window.requestAnimationFrame( focus ), { once: true } );
		}
		item.scrollIntoView( { block: 'start', behavior } );
	} else {
		target.scrollIntoView( { block: 'start', behavior } );
	}
}

/**
 * Opens the item the address points to (#item-id, or anything inside an
 * answer), on load and on hashchange.
 */
function openFromHash() {
	const id = window.location.hash.slice( 1 );
	if ( ! id ) {
		return;
	}
	let target = null;
	try {
		target = document.getElementById( decodeURIComponent( id ) );
	} catch ( e ) {
		target = document.getElementById( id );
	}
	if ( target && target.closest( '.wrbc-accordion' ) ) {
		openTo( target );
	}
}

// For blocks that link into answers (table of contents).
window.wrbc = window.wrbc || {};
window.wrbc.accordion = { open: openTo };

function init() {
	document.querySelectorAll( '.wrbc-accordion' ).forEach( setup );
	openFromHash();
}

if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', init );
} else {
	init();
}
window.addEventListener( 'hashchange', openFromHash );
