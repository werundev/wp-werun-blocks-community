/**
 * werun.Blocks.Community: front-end helper every block shares.
 *
 * Adds .is-inview, once, to icons whose animation runs "in view" or loops
 * (a loop plays its few rounds once it's on screen) and to any element
 * marked data-wrbc-reveal, when a fifth of it is on screen. Without
 * IntersectionObserver, or with reduced motion, everything is shown at once.
 */
( function () {
	'use strict';

	// Tells the head script (wrbc_reveal_guard()) that the reveal will run, so it keeps .wrbc-js.
	window.wrbcReveal = true;

	var SELECTOR = '.wrbc-anim-t--inview, .wrbc-anim-t--loop, [data-wrbc-reveal]';

	function showAll( nodes ) {
		for ( var i = 0; i < nodes.length; i++ ) {
			nodes[ i ].classList.add( 'is-inview' );
		}
	}

	function init() {
		var nodes = document.querySelectorAll( SELECTOR );
		if ( ! nodes.length ) {
			return;
		}
		var reduce = window.matchMedia && window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;
		if ( reduce || ! ( 'IntersectionObserver' in window ) ) {
			showAll( nodes );
			return;
		}
		var observer = new IntersectionObserver(
			function ( entries ) {
				entries.forEach( function ( entry ) {
					// A fifth of it, or — for something taller than the screen,
					// whose fifth may never fit — a fifth of the screen.
					var tall = entry.intersectionRect.height >= window.innerHeight * 0.2;
					if ( entry.isIntersecting && ( entry.intersectionRatio >= 0.2 || tall ) ) {
						entry.target.classList.add( 'is-inview' );
						observer.unobserve( entry.target );
					}
				} );
			},
			{ threshold: [ 0, 0.05, 0.1, 0.2 ], rootMargin: '0px 0px -5% 0px' }
		);
		for ( var i = 0; i < nodes.length; i++ ) {
			observer.observe( nodes[ i ] );
		}
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', init );
	} else {
		init();
	}
} )();
