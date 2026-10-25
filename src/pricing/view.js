/**
 * Pricing table, front end: the monthly / yearly switch.
 *
 * The switch is a native radio group, so the browser already handles the
 * keyboard (Tab into the group, arrow keys to change) and screen readers
 * announce "1 of 2, checked". Every table on the page is handled on its own:
 * a change sets data-period on that table only, the CSS shows the matching
 * prices, and a polite live region says which period is now shown.
 *
 * @param {Element} root A pricing table (.wrbc-pricing).
 */
function setup( root ) {
	if ( root.dataset.wrbcReady ) {
		return;
	}
	root.dataset.wrbcReady = '1';
	const radios = root.querySelectorAll( '.wrbc-pricing__radio' );
	const status = root.querySelector( '[data-wrbc-pricing-status]' );

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

function init() {
	document.querySelectorAll( '.wrbc-pricing' ).forEach( setup );
}

if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', init );
} else {
	init();
}
