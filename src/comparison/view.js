/**
 * Comparison table, front end. Per table:
 * - the monthly / yearly switch (data-period on the table, CSS shows the
 *   prices). It's a native radio group, so the browser already handles the
 *   keyboard (Tab into the group, arrow keys to change) and screen readers
 *   announce "1 of 2, checked"; a polite live region says which period is
 *   now shown,
 * - the info buttons that open a feature's description (shown as plain text
 *   without JS), in the table and in the phone cards,
 * - the scroll box is a named, focusable group only while it really scrolls,
 * - the sticky header's height, so focused links aren't hidden under it, and
 *   the same for the sticky first column on phones.
 */

/** @param {HTMLElement} root A comparison table. */
function setupSwitch( root ) {
	const radios = root.querySelectorAll( '.wrbc-comparison__radio' );
	const status = root.querySelector( '[data-wrbc-comparison-status]' );
	const select = ( period, announce ) => {
		root.setAttribute( 'data-period', period );
		// The sentence is printed by render.php in the site's language.
		if ( announce && status ) {
			status.textContent = status.dataset[ period ] || '';
		}
	};
	radios.forEach( ( radio ) => {
		radio.addEventListener( 'change', () => {
			if ( radio.checked ) {
				select( radio.value, true );
			}
		} );
		// The browser can restore the choice made before a reload: follow it, quietly.
		if ( radio.checked ) {
			select( radio.value, false );
		}
	} );
}

function setupTips( root ) {
	root.querySelectorAll( '.wrbc-comparison__tip' ).forEach( ( button ) => {
		const desc = root.ownerDocument.getElementById(
			button.getAttribute( 'aria-controls' ) || ''
		);
		if ( ! desc ) {
			return;
		}
		desc.hidden = true;
		button.hidden = false;
		const set = ( open ) => {
			button.setAttribute( 'aria-expanded', open ? 'true' : 'false' );
			desc.hidden = ! open;
		};
		button.addEventListener( 'click', () =>
			set( button.getAttribute( 'aria-expanded' ) !== 'true' )
		);
		button.addEventListener( 'keydown', ( event ) => {
			if (
				event.key === 'Escape' &&
				button.getAttribute( 'aria-expanded' ) === 'true'
			) {
				event.preventDefault();
				set( false );
			}
		} );
	} );
}

function setupScroll( root ) {
	const box = root.querySelector( '[data-wrbc-scroll]' );
	const head = root.querySelector( '.wrbc-comparison__table thead' );
	const label = box && box.getAttribute( 'aria-labelledby' );
	const measure = () => {
		if ( box ) {
			// A named, focusable group (keyboard scrolling) only while there is
			// something to scroll; a plain box otherwise.
			const scrolls = box.scrollWidth > box.clientWidth + 1;
			const attrs = { tabindex: '0', role: 'group', 'aria-labelledby': label };
			Object.keys( attrs ).forEach( ( name ) => {
				if ( scrolls && attrs[ name ] ) {
					box.setAttribute( name, attrs[ name ] );
				} else {
					box.removeAttribute( name );
				}
			} );
		}
		if ( head && root.classList.contains( 'has-sticky-head' ) ) {
			root.style.setProperty(
				'--wrbc-cmp-head-h',
				`${ Math.round( head.getBoundingClientRect().height ) }px`
			);
		}
	};
	measure();
	if ( 'ResizeObserver' in window ) {
		new window.ResizeObserver( measure ).observe( root );
	}
	if ( box ) {
		// Focus scrolling leaves a link that is partly in view where it is,
		// even under the sticky first column or with its focus ring cut off at
		// the box's edge: scroll it clear, with room for the ring
		// (scroll-padding and scroll-margin in style.scss say how far),
		// WCAG 2.4.7 / 2.4.11.
		const RING = 6;
		box.addEventListener( 'focusin', ( event ) => {
			const el = event.target;
			if ( el === box || box.scrollWidth <= box.clientWidth + 1 ) {
				return;
			}
			const row = el.closest( 'tr' );
			const first =
				row && root.classList.contains( 'has-sticky-col' )
					? row.firstElementChild
					: null;
			if ( first && first.contains( el ) ) {
				return;
			}
			const rtl = window.getComputedStyle( box ).direction === 'rtl';
			const a = el.getBoundingClientRect();
			const view = box.getBoundingClientRect();
			const col = first && first.getBoundingClientRect();
			// The visible part of the box: from the sticky column (if any) to its far edge.
			const start = rtl ? ( col ? col.left : view.right ) : ( col ? col.right : view.left );
			const end = rtl ? view.left : view.right;
			const clipped = rtl
				? a.right + RING > start || a.left - RING < end
				: a.left - RING < start || a.right + RING > end;
			if ( clipped ) {
				el.scrollIntoView( { block: 'nearest', inline: 'nearest' } );
			}
		} );
	}
}

function setup( root ) {
	if ( root.dataset.wrbcReady ) {
		return;
	}
	root.dataset.wrbcReady = '1';
	setupSwitch( root );
	setupTips( root );
	setupScroll( root );
}

function init() {
	document.querySelectorAll( '.wrbc-comparison' ).forEach( setup );
}

if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', init );
} else {
	init();
}
