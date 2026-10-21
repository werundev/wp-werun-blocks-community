/**
 * werun.Blocks.Community → Integrations: announces a successful save; show_if
 * conditions (data-werun-blocks-community-show-if='{"<input name>":["value",…]}', or
 * "__filled__" for "has any value"), shown or hidden as the form changes
 * (hidden fields still submit, so their values are kept; the twin is
 * werun.Toolkit's settings-page.js); show / hide of secret fields; and the
 * "Test" button of a saved secret (a manage_options REST route that answers
 * only ok / message).
 */
( function ( window, document, wp ) {
	'use strict';

	const app = document.querySelector( '.werun-blocks-community-integrations' );
	if ( ! app ) {
		return;
	}

	const { __ } = wp.i18n;
	const UI = window.werunBlocksUI;

	const notice = app.querySelector( '[data-saved-notice]' );
	if ( notice && app.getAttribute( 'data-saved' ) === '1' && wp.a11y && wp.a11y.speak ) {
		wp.a11y.speak( notice.textContent.trim() );
	}

	/* show_if ------------------------------------------------------------ */

	const HIDDEN = 'werun-blocks-community-is-condition-hidden';
	const FILLED = '__filled__';
	const form = app.querySelector( '.werun-blocks-community-settings-form' );
	const conditional = form ? Array.from( form.querySelectorAll( '[data-werun-blocks-community-show-if]' ) ) : [];

	function valueOf( name ) {
		const field = form.elements.namedItem( name );
		if ( ! field ) {
			return '';
		}
		if ( field.type === 'checkbox' ) {
			return field.checked ? '1' : '0';
		}
		return String( field.value || '' );
	}

	function apply() {
		conditional.forEach( ( el ) => {
			let rules = {};
			try {
				rules = JSON.parse( el.getAttribute( 'data-werun-blocks-community-show-if' ) ) || {};
			} catch ( error ) {
				return;
			}
			const met = Object.keys( rules ).every( ( name ) => {
				const allowed = ( rules[ name ] || [] ).map( String );
				const value = valueOf( name );
				return allowed.includes( value ) || ( allowed.includes( FILLED ) && value.trim() !== '' );
			} );
			el.classList.toggle( HIDDEN, ! met );
		} );
		// The vertical tabs re-render (and leave a tab that disappeared).
		document.dispatchEvent( new window.CustomEvent( 'werun-blocks-community:conditions' ) );
	}

	if ( conditional.length ) {
		form.addEventListener( 'change', apply );
		form.addEventListener( 'input', ( event ) => {
			if ( event.target.matches( 'input[type="text"], input[type="url"], input[type="number"]' ) ) {
				apply();
			}
		} );
		apply();
	}

	/* Secrets: show / hide ----------------------------------------------- */

	app.querySelectorAll( '[data-secret-toggle]' ).forEach( ( toggle ) => {
		const input = document.getElementById( toggle.getAttribute( 'aria-controls' ) );
		if ( ! input ) {
			return;
		}
		toggle.addEventListener( 'click', () => {
			const show = input.type === 'password';
			input.type = show ? 'text' : 'password';
			toggle.setAttribute( 'aria-pressed', show ? 'true' : 'false' );
			toggle.setAttribute(
				'aria-label',
				toggle.getAttribute( show ? 'data-label-hide' : 'data-label-show' ) || ''
			);
			const use = toggle.querySelector( 'use' );
			if ( use ) {
				use.setAttribute( 'href', show ? '#werun-blocks-community-icon-eye-slash' : '#werun-blocks-community-icon-eye' );
			}
		} );
	} );

	/* Secrets: test ------------------------------------------------------ */

	function report( ok, message ) {
		if ( UI && UI.toast ) {
			UI.toast( { message, tone: ok ? 'good' : 'error', timeout: 8000 } );
		} else if ( wp.a11y && wp.a11y.speak ) {
			wp.a11y.speak( message );
		}
	}

	app.querySelectorAll( '[data-secret-test]' ).forEach( ( button ) => {
		const path = button.getAttribute( 'data-secret-test' );
		if ( ! path || ! wp.apiFetch ) {
			return;
		}
		button.addEventListener( 'click', () => {
			if ( button.getAttribute( 'aria-busy' ) === 'true' ) {
				return;
			}
			button.setAttribute( 'aria-busy', 'true' );
			wp.apiFetch( { path, method: 'POST' } )
				.then( ( response ) => {
					report( !! ( response && response.ok ), ( response && response.message ) || '' );
				} )
				.catch( ( error ) => {
					report(
						false,
						( error && error.message ) || __( 'The test couldn’t run. Reload the page and try again.', 'werun-blocks-community' )
					);
				} )
				.finally( () => {
					button.removeAttribute( 'aria-busy' );
				} );
		} );
	} );
} )( window, document, window.wp );
