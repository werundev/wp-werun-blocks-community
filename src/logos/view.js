/**
 * Logos, front end.
 *   - Marquee: the pause button (WCAG 2.2.2). The row is CSS only; hover and
 *     focus pause it, the button toggles .is-paused (its name and icon too).
 *     Keyboard focus on a logo stops the row (style.scss) and this scrolls
 *     the rail to the focused logo, so it is never left outside the visible
 *     part (2.4.11); leaving the rail puts the loop back at its start.
 *   - Carousel: the wrbc-carousel module does all the work (it also brings a
 *     focused logo's slide into view).
 */

/** Keyboard focus, not a click (browsers without :focus-visible count as keyboard). */
function keyboardFocus( el ) {
	try {
		return el.matches( ':focus-visible' );
	} catch ( e ) {
		return true;
	}
}

function setupMarquee( root ) {
	const button = root.querySelector( '[data-wrbc-marquee-pause]' );
	const rail = root.querySelector( '.wrbc-logos__rail' );
	if ( ! button || ! rail || root.dataset.wrbcReady ) {
		return;
	}
	root.dataset.wrbcReady = '1';
	// The button's name and icon follow .is-paused (style.scss): "Pause the
	// moving logos" while it moves, "Play the moving logos" once paused, when
	// the row stands still with every logo in view (wrapped, from its start).
	button.addEventListener( 'click', () => {
		root.classList.toggle( 'is-paused' );
		rail.scrollLeft = 0;
	} );
	rail.addEventListener( 'focusin', ( event ) => {
		const target = event.target;
		// After the style change, so the row has already stopped at its start.
		window.requestAnimationFrame( () => {
			if ( target === document.activeElement && keyboardFocus( target ) ) {
				target.scrollIntoView( { block: 'nearest', inline: 'nearest' } );
			}
		} );
	} );
	rail.addEventListener( 'focusout', ( event ) => {
		if ( ! rail.contains( event.relatedTarget ) ) {
			rail.scrollLeft = 0;
		}
	} );
	root.classList.add( 'is-ready' );
}

function init() {
	document.querySelectorAll( '.wrbc-logos--marquee' ).forEach( setupMarquee );
}

if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', init );
} else {
	init();
}
