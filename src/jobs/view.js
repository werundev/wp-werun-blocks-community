/**
 * Jobs, front end: after wrbc-filter hides items, a department group with
 * nothing left is hidden too and each group's count follows what is shown;
 * with nothing shown at all, the list (or table) goes too, so only the "no
 * matches" text is left instead of an empty list or a table of headers.
 * Filtering itself is wrbc-filter (data-wrbc-filter on the block root).
 *
 * The table's scroll box is a tab stop (PHP prints tabindex="0" so it works
 * without JS) only while it really scrolls sideways, and it scrolls the
 * focused link fully into sight.
 */
const LISTS = ':scope > .wrbc-jobs__groups, :scope > .wrbc-jobs__list, :scope > .wrbc-jobs__cards, :scope > .wrbc-jobs__table-wrap';

function sync( root ) {
	root.querySelectorAll( '[data-wrbc-jobs-group]' ).forEach( ( group ) => {
		const shown = group.querySelectorAll( '[data-wrbc-filter-item]:not([hidden])' ).length;
		group.hidden = shown === 0;
		const count = group.querySelector( '[data-wrbc-jobs-group-count]' );
		if ( count ) {
			count.textContent = String( shown );
		}
	} );
	const any = root.querySelector( '[data-wrbc-filter-item]:not([hidden])' ) !== null;
	root.querySelectorAll( LISTS ).forEach( ( list ) => {
		list.hidden = ! any;
	} );
}

function scroller( wrap ) {
	// Tab from a row's Apply (far right) to the next row's title (far left):
	// the browser leaves a link that is only partly outside the box where it
	// is, so the focused link would stay out of sight (WCAG 2.4.11).
	wrap.addEventListener( 'focusin', ( event ) => {
		const target = event.target;
		if ( target === wrap || typeof target.scrollIntoView !== 'function' ) {
			return;
		}
		const box = wrap.getBoundingClientRect();
		const rect = target.getBoundingClientRect();
		if ( rect.left < box.left || rect.right > box.right ) {
			target.scrollIntoView( { block: 'nearest', inline: 'nearest' } );
		}
	} );
	const fit = () => {
		if ( wrap.scrollWidth > wrap.clientWidth + 1 ) {
			wrap.setAttribute( 'tabindex', '0' );
		} else if ( wrap.ownerDocument.activeElement !== wrap ) {
			wrap.removeAttribute( 'tabindex' );
		}
	};
	fit();
	if ( 'ResizeObserver' in window ) {
		// The box (window resized) and the table (rows filtered out or back).
		const observer = new window.ResizeObserver( fit );
		observer.observe( wrap );
		if ( wrap.firstElementChild ) {
			observer.observe( wrap.firstElementChild );
		}
	}
}

function init() {
	document.querySelectorAll( '.wrbc-jobs[data-wrbc-filter]' ).forEach( ( root ) => {
		root.addEventListener( 'wrbc:filter', () => sync( root ) );
		sync( root );
	} );
	document.querySelectorAll( '.wrbc-jobs__table-wrap' ).forEach( scroller );
}

if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', init );
} else {
	init();
}
