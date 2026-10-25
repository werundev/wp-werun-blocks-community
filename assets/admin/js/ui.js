/**
 * werun.Blocks.Community admin UI kit (the same as werun.Toolkit's): toasts, accessible modal dialogs and helpers.
 * Exposes window.werunBlocksUI. No build step; depends on wp-i18n and wp-a11y.
 */
( function ( window, document, wp ) {
	'use strict';

	const { __ } = wp.i18n;

	const FOCUSABLE =
		'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

	/**
	 * Builds an icon from the inline sprite.
	 *
	 * @param {string} name Icon name, e.g. "circle-check".
	 * @return {SVGElement} Icon.
	 */
	function icon( name ) {
		const ns = 'http://www.w3.org/2000/svg';
		const svg = document.createElementNS( ns, 'svg' );
		svg.setAttribute( 'class', 'werun-blocks-community-ui-icon' );
		svg.setAttribute( 'aria-hidden', 'true' );
		svg.setAttribute( 'focusable', 'false' );
		const use = document.createElementNS( ns, 'use' );
		use.setAttribute( 'href', '#werun-blocks-community-icon-' + name );
		svg.appendChild( use );
		return svg;
	}

	/**
	 * Lowercase, accent-insensitive text for searching.
	 *
	 * @param {string} value Text.
	 * @return {string} Normalized text.
	 */
	function normalize( value ) {
		return String( value || '' )
			.normalize( 'NFD' )
			.replace( /[̀-ͯ]/g, '' )
			.toLowerCase()
			.trim();
	}

	/**
	 * Formats a number for the page language.
	 *
	 * @param {number} value Number.
	 * @return {string} Formatted number.
	 */
	function formatNumber( value ) {
		try {
			return new Intl.NumberFormat(
				document.documentElement.lang || undefined
			).format( value );
		} catch ( e ) {
			return String( value );
		}
	}

	/**
	 * Whether the user asked for reduced motion.
	 *
	 * @return {boolean} Reduced motion.
	 */
	function prefersReducedMotion() {
		return !! (
			window.matchMedia &&
			window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches
		);
	}

	/* Toast --------------------------------------------------------------- */

	let toastTimer = null;

	/**
	 * Shows one toast at a time inside the polite live region.
	 *
	 * @param {Object}   options               Options.
	 * @param {string}   options.message       Text.
	 * @param {string}   [options.tone]        good | error.
	 * @param {Object}   [options.action]      {label, onClick}.
	 * @param {number}   [options.timeout]     Milliseconds, default 5000.
	 */
	function toast( options ) {
		const region = document.querySelector( '[data-toasts]' );
		if ( ! region ) {
			return;
		}
		const tone = options.tone === 'error' ? 'error' : 'good';
		const timeout = options.timeout || 5000;

		window.clearTimeout( toastTimer );
		region.textContent = '';

		const el = document.createElement( 'div' );
		el.className = 'werun-blocks-community-ui-toast werun-blocks-community-ui-toast-' + tone;
		el.appendChild(
			icon( tone === 'error' ? 'circle-exclamation' : 'circle-check' )
		);

		const body = document.createElement( 'div' );
		body.className = 'werun-blocks-community-ui-toast-body';
		const text = document.createElement( 'span' );
		text.textContent = options.message;
		body.appendChild( text );

		if ( options.action ) {
			const action = document.createElement( 'button' );
			action.type = 'button';
			action.className = 'werun-blocks-community-ui-toast-action';
			action.textContent = options.action.label;
			action.addEventListener( 'click', () => {
				dismiss();
				options.action.onClick();
			} );
			body.appendChild( action );
		}
		el.appendChild( body );

		const close = document.createElement( 'button' );
		close.type = 'button';
		close.className = 'werun-blocks-community-ui-toast-close';
		close.setAttribute( 'aria-label', __( 'Dismiss', 'werun-blocks-community' ) );
		close.appendChild( icon( 'xmark' ) );
		close.addEventListener( 'click', dismiss );
		el.appendChild( close );

		function dismiss() {
			window.clearTimeout( toastTimer );
			if ( el.parentNode ) {
				el.parentNode.removeChild( el );
			}
		}

		function schedule() {
			window.clearTimeout( toastTimer );
			toastTimer = window.setTimeout( dismiss, timeout );
		}

		// Pause while hovered or focused so there is time to press Undo.
		el.addEventListener( 'mouseenter', () =>
			window.clearTimeout( toastTimer )
		);
		el.addEventListener( 'mouseleave', schedule );
		el.addEventListener( 'focusin', () =>
			window.clearTimeout( toastTimer )
		);
		el.addEventListener( 'focusout', schedule );

		region.appendChild( el );
		schedule();
	}

	/* Modal --------------------------------------------------------------- */

	/**
	 * Accessible modal dialog: focus trap, Esc, click outside, focus return.
	 *
	 * @param {HTMLElement} root            Overlay element ([hidden] when closed).
	 * @param {Object}      [options]       Options.
	 * @param {Function}    [options.canClose] Returns false to keep it open (e.g. while busy).
	 * @param {Function}    [options.onClose]  Called after closing.
	 * @return {Object} {open, close, isOpen}.
	 */
	function modal( root, options ) {
		const settings = options || {};
		const panel = root.querySelector( '[role="dialog"]' ) || root;
		let opener = null;

		function focusables() {
			return Array.from( panel.querySelectorAll( FOCUSABLE ) ).filter(
				( el ) => el.offsetParent !== null
			);
		}

		function onKeydown( event ) {
			if ( event.key === 'Escape' ) {
				event.preventDefault();
				close();
				return;
			}
			if ( event.key !== 'Tab' ) {
				return;
			}
			const items = focusables();
			if ( ! items.length ) {
				event.preventDefault();
				return;
			}
			const first = items[ 0 ];
			const last = items[ items.length - 1 ];
			if ( event.shiftKey && document.activeElement === first ) {
				event.preventDefault();
				last.focus();
			} else if ( ! event.shiftKey && document.activeElement === last ) {
				event.preventDefault();
				first.focus();
			}
		}

		function onPointerDown( event ) {
			if ( event.target === root ) {
				close();
			}
		}

		function open( trigger, initialFocus ) {
			opener = trigger || document.activeElement;
			root.hidden = false;
			document.body.classList.add( 'werun-blocks-community-modal-open' );
			document.addEventListener( 'keydown', onKeydown, true );
			root.addEventListener( 'mousedown', onPointerDown );
			const target = initialFocus || focusables()[ 0 ];
			if ( target ) {
				target.focus();
			}
		}

		function close( force ) {
			if ( root.hidden ) {
				return;
			}
			if (
				! force &&
				settings.canClose &&
				settings.canClose() === false
			) {
				return;
			}
			root.hidden = true;
			document.body.classList.remove( 'werun-blocks-community-modal-open' );
			document.removeEventListener( 'keydown', onKeydown, true );
			root.removeEventListener( 'mousedown', onPointerDown );
			if ( settings.onClose ) {
				settings.onClose();
			}
			if ( opener && document.body.contains( opener ) ) {
				opener.focus();
			}
			opener = null;
		}

		return {
			open,
			close,
			isOpen: () => ! root.hidden,
			setOpener: ( el ) => {
				opener = el;
			},
		};
	}

	window.werunBlocksUI = {
		icon,
		normalize,
		formatNumber,
		prefersReducedMotion,
		toast,
		modal,
	};
} )( window, document, window.wp );
