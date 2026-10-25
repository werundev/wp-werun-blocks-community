/**
 * Shared front-end module wrbc-carousel. Contract: docs/shared-modules.md.
 *
 * The track is a scroll-snap row the browser already scrolls (swipe,
 * trackpad, keyboard on focus) and slides per view come from --wrbc-pv-d/t/m
 * through container queries in assets/modules.css, so it works without JS.
 * This adds, per [data-wrbc-carousel] root:
 *   - previous / next ([data-wrbc-prev] / [data-wrbc-next]), looping or
 *     stopping at the ends (aria-disabled there, so a focused arrow keeps
 *     its focus)
 *   - one dot per position in [data-wrbc-dots], rebuilt when the slides per
 *     view change
 *   - "n of N" labels on the slides ([data-wrbc-slide], or every child of
 *     [data-wrbc-track]), aria-roledescription "slide"
 *   - arrows, Home and End on the focused track, reversed in RTL; the track
 *     is a Tab stop (role="group", named) only while it scrolls and some
 *     slide has nothing focusable in it
 *   - a polite "Slide n of N" after a move the visitor made (never while
 *     autoplay moves it)
 *   - focus that stays in view: a link or button focused in a slide that is
 *     only partly on screen (a peek; the browser's minimal scroll pulled back
 *     by snapping) brings its slide fully in (WCAG 2.4.11)
 *   - a name for an unnamed carousel: "n slides" (the printed fallback is
 *     replaced, options.autoName)
 *   - autoplay, paused on hover, on focus, when off screen, when the tab is
 *     hidden and by [data-wrbc-play], whose name says what it does ("Pause
 *     the slides" / "Play the slides", no aria-pressed; .is-paused swaps
 *     the icon); never with reduced motion
 *
 * API: window.wrbc.carousel.setup( root ), .refresh( root ) after slides were
 * added or removed (query load-more).
 */
import { __, _n, sprintf } from '@wordpress/i18n';
import { format, ns, options as readOptions, ready, reducedMotion, roots } from './lib';

const instances = new WeakMap();

/* What a keyboard reaches inside a slide. */
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), summary, iframe, video[controls], audio[controls], [contenteditable="true"], [tabindex]:not([tabindex="-1"])';

/* Elements whose own role a slide keeps (a list item stays in its list). */
const GENERIC = [ 'DIV', 'SECTION', 'SPAN' ];

/* Labels travel in options.labels; 1.x testimonials printed them flat. */
function label( options, key, fallback ) {
	const labels = options.labels && typeof options.labels === 'object' ? options.labels : {};
	const value = labels[ key ] ?? options[ key ];
	return typeof value === 'string' && value ? value : fallback;
}

/* Seconds per slide (contract); values above 100 are milliseconds (1.x). */
function intervalMs( value ) {
	const n = Number( value ) || 6;
	const ms = n > 100 ? n : n * 1000;
	return Math.max( 2000, Math.min( 20000, ms ) );
}

/* Only the root's own parts: a carousel inside a slide keeps its own. */
function own( root, selector ) {
	return Array.from( root.querySelectorAll( selector ) ).filter( ( node ) => node.closest( '[data-wrbc-carousel]' ) === root );
}

const named = ( node ) => node.hasAttribute( 'aria-label' ) || node.hasAttribute( 'aria-labelledby' );

function setup( root ) {
	if ( instances.has( root ) ) {
		return instances.get( root );
	}
	const options = readOptions( root, 'data-wrbc-carousel' );
	const track = own( root, '[data-wrbc-track]' )[ 0 ];
	if ( ! track ) {
		return null;
	}
	const prev = own( root, '[data-wrbc-prev]' )[ 0 ];
	const next = own( root, '[data-wrbc-next]' )[ 0 ];
	const dotsBox = own( root, '[data-wrbc-dots]' )[ 0 ];
	const playBtn = own( root, '[data-wrbc-play]' )[ 0 ];
	const reduce = reducedMotion();
	const loop = options.loop !== false;

	// The container is a named region described as a carousel (WAI-ARIA APG;
	// docs/accessibility.md). wrbc_carousel_attrs() prints this; markup built
	// another way gets it here.
	if ( ! root.hasAttribute( 'role' ) && ! ( root.tagName === 'SECTION' && named( root ) ) ) {
		root.setAttribute( 'role', 'region' );
	}
	// Without a name of its own, the carousel is named by what it holds:
	// "4 slides" (with aria-roledescription: "4 slides, carousel"), kept up
	// to date in collect().
	// A block that names it itself (aria-labelledby, or its own aria-label printed
	// over the helper's fallback) keeps its name.
	const fallback = options.labels && typeof options.labels.carousel === 'string' ? options.labels.carousel : '';
	const autoName = ! named( root ) || ( !! options.autoName && ! root.hasAttribute( 'aria-labelledby' ) && root.getAttribute( 'aria-label' ) === fallback );
	if ( ! root.hasAttribute( 'aria-roledescription' ) ) {
		root.setAttribute( 'aria-roledescription', __( 'carousel', 'werun-blocks-community' ) );
	}

	// Where a move the visitor made is announced: present (empty) from the
	// start, so screen readers pick up its changes.
	const status = document.createElement( 'span' );
	status.className = 'wrbc-sr-only wrbc-carousel__status';
	status.setAttribute( 'aria-live', 'polite' );
	status.setAttribute( 'aria-atomic', 'true' );
	root.appendChild( status );

	// The track's role and name as printed (put back whenever it becomes a
	// Tab stop again).
	const trackName = track.getAttribute( 'aria-label' );
	const trackRole = track.getAttribute( 'role' );

	let slides = [];
	let perView = 1;
	let positions = 1;
	let index = 0;
	let dots = [];

	const rtl = () => getComputedStyle( track ).direction === 'rtl';

	// Distance between two slides: slide width plus the gap, whatever the units.
	const step = () => ( slides[ 1 ] ? Math.abs( slides[ 1 ].offsetLeft - slides[ 0 ].offsetLeft ) : track.clientWidth ) || 1;

	const collect = () => {
		const marked = Array.from( track.children ).filter( ( child ) => child.hasAttribute( 'data-wrbc-slide' ) );
		slides = marked.length ? marked : Array.from( track.children ).filter( ( child ) => ! child.hidden && child.tagName !== 'TEMPLATE' );
		slides.forEach( ( slide, i ) => {
			// role="group" only on generic containers: an <li>, <figure> or
			// <article> keeps its own role (a list keeps its items).
			if ( GENERIC.includes( slide.tagName ) && ( ! slide.hasAttribute( 'role' ) || slide.getAttribute( 'role' ) === 'group' ) ) {
				slide.setAttribute( 'role', 'group' );
			}
			slide.setAttribute( 'aria-roledescription', label( options, 'slide', __( 'slide', 'werun-blocks-community' ) ) );
			slide.setAttribute( 'aria-label', format( label( options, 'slideLabel', __( '%1$d of %2$d', 'werun-blocks-community' ) ), i + 1, slides.length ) );
		} );
		if ( autoName ) {
			/* translators: %d: number of slides */
			root.setAttribute( 'aria-label', sprintf( _n( '%d slide', '%d slides', slides.length, 'werun-blocks-community' ), slides.length ) );
		}
	};

	// The track is a Tab stop only while it scrolls (more slides than fit)
	// and some slide has nothing focusable: then the keyboard scrolls it
	// (arrows, Home, End). When every slide has a link or a button, Tab
	// reaches each slide (the browser scrolls it in); when every slide fits,
	// there is nothing to scroll. A focusable track is a named group (a
	// named region would be a landmark per carousel); a list stays a list.
	const syncTrack = () => {
		const reachable = slides.length > 0 && slides.every( ( slide ) => slide.querySelector( FOCUSABLE ) );
		if ( positions > 1 && ! reachable ) {
			track.setAttribute( 'tabindex', '0' );
			if ( ! trackRole || trackRole === 'region' ) {
				track.setAttribute( 'role', 'group' );
			}
			if ( ! track.hasAttribute( 'aria-label' ) && ! track.hasAttribute( 'aria-labelledby' ) ) {
				track.setAttribute( 'aria-label', trackName || label( options, 'track', __( 'Slides, use the arrow keys to move', 'werun-blocks-community' ) ) );
			}
		} else {
			if ( track === document.activeElement ) {
				return; // never pull the Tab stop from under the focus; the next change settles it
			}
			track.removeAttribute( 'tabindex' );
			if ( ! trackRole || trackRole === 'group' || trackRole === 'region' ) {
				// No name on a plain container (a name needs a role, a role here means nothing).
				track.removeAttribute( 'role' );
				track.removeAttribute( 'aria-label' );
			}
		}
	};

	const setDisabled = ( button, off ) => {
		if ( ! button ) {
			return;
		}
		// aria-disabled, not disabled: a focused arrow at the end keeps focus.
		button.disabled = false;
		if ( off ) {
			button.setAttribute( 'aria-disabled', 'true' );
		} else {
			button.removeAttribute( 'aria-disabled' );
		}
	};

	const update = () => {
		// scrollLeft is negative in RTL in every current engine, hence abs().
		index = Math.min( positions - 1, Math.max( 0, Math.round( Math.abs( track.scrollLeft ) / step() ) ) );
		dots.forEach( ( dot, i ) => dot.setAttribute( 'aria-current', i === index ? 'true' : 'false' ) );
		setDisabled( prev, ! loop && index === 0 );
		setDisabled( next, ! loop && index >= positions - 1 );
	};

	const announce = ( i ) => {
		status.textContent = format( label( options, 'current', __( 'Slide %1$d of %2$d', 'werun-blocks-community' ) ), i + 1, slides.length );
	};

	// Moves the track to position `target`. Arrows, dots and autoplay glide
	// (never under reduced motion); a move driven by focus or by the keys on
	// the track (`instant`) jumps, so what has focus is in view at once and
	// never mid-scroll (WCAG 2.4.11).
	const scrollToX = ( left, smooth ) => {
		try {
			track.scrollTo( { left, behavior: smooth ? 'smooth' : 'instant' } );
		} catch ( e ) {
			track.scrollTo( { left, behavior: smooth ? 'smooth' : 'auto' } ); // no "instant" (older engines)
		}
	};
	const goTo = ( target, user, instant = false ) => {
		let i = target;
		if ( i < 0 ) {
			i = loop ? positions - 1 : 0;
		}
		if ( i > positions - 1 ) {
			i = loop ? 0 : positions - 1;
		}
		scrollToX( ( rtl() ? -1 : 1 ) * i * step(), ! reduce && ! instant );
		if ( user ) {
			announce( i );
			restart();
		}
	};

	const measure = () => {
		perView = Math.max( 1, parseInt( getComputedStyle( track ).getPropertyValue( '--wrbc-pv' ), 10 ) || 1 );
		positions = Math.max( 1, slides.length - perView + 1 );
		root.classList.toggle( 'is-static', positions === 1 );
		syncTrack();
		if ( dotsBox && dots.length !== positions ) {
			// A dot with focus gets its place back in the new row.
			const focused = dots.indexOf( document.activeElement );
			dotsBox.textContent = '';
			dots = Array.from( { length: positions }, ( _, i ) => {
				const dot = document.createElement( 'button' );
				dot.type = 'button';
				dot.className = 'wrbc-carousel__dot' + ( options.dotClass ? ' ' + String( options.dotClass ).replace( /[^\w -]/g, '' ) : '' );
				dot.setAttribute( 'aria-label', format( label( options, 'dotLabel', __( 'Go to slide %d', 'werun-blocks-community' ) ), i + 1 ) );
				dot.addEventListener( 'click', () => goTo( i, true ) );
				dotsBox.appendChild( dot );
				return dot;
			} );
			if ( focused >= 0 && dots.length ) {
				dots[ Math.min( focused, dots.length - 1 ) ].focus();
			}
		}
		update();
		restart();
	};

	const arrow = ( button, by ) =>
		button?.addEventListener( 'click', () => {
			if ( button.getAttribute( 'aria-disabled' ) !== 'true' ) {
				goTo( index + by, true );
			}
		} );
	arrow( prev, -1 );
	arrow( next, 1 );
	// Focus that stays in view: after the browser's own focus scroll (and its
	// snap) settled, the element that has focus *then* (focus may have moved
	// again within the frame: fast Tab) brings its whole slide in when the
	// track's edges still cut it, at once and without the "visitor moved it"
	// announcement. The slide's position is clamped (the last slides of a view
	// share the last position): never a loop wrap back to the first slide.
	let revealing = false;
	track.addEventListener( 'focusin', () => {
		if ( revealing ) {
			return; // one check per frame, for whatever has focus by then
		}
		revealing = true;
		window.requestAnimationFrame( () => {
			revealing = false;
			const focused = document.activeElement;
			if ( ! focused || focused === track || ! track.contains( focused ) ) {
				return;
			}
			const slide = slides.find( ( item ) => item.contains( focused ) );
			if ( ! slide ) {
				return;
			}
			const r = focused.getBoundingClientRect();
			const t = track.getBoundingClientRect();
			if ( r.left < t.left - 1 || r.right > t.right + 1 ) {
				goTo( Math.min( slides.indexOf( slide ), positions - 1 ), false, true );
			}
		} );
	} );
	track.addEventListener( 'keydown', ( event ) => {
		if ( event.target !== track ) {
			return; // a link or a button inside a slide keeps its keys
		}
		if ( event.key === 'ArrowRight' || event.key === 'ArrowLeft' ) {
			event.preventDefault();
			goTo( index + ( ( event.key === 'ArrowRight' ) !== rtl() ? 1 : -1 ), true, true );
		} else if ( event.key === 'Home' || event.key === 'End' ) {
			event.preventDefault();
			goTo( event.key === 'Home' ? 0 : positions - 1, true, true );
		}
	} );

	let ticking = false;
	track.addEventListener(
		'scroll',
		() => {
			if ( ! ticking ) {
				ticking = true;
				window.requestAnimationFrame( () => {
					update();
					ticking = false;
				} );
			}
		},
		{ passive: true }
	);

	/* ── Autoplay ─────────────────────────────────────────────────────── */
	let timer = null;
	let hovered = false;
	let focused = false;
	let visible = true;
	let userPaused = false;
	const canPlay = !! options.autoplay && ! reduce;
	const playing = () => canPlay && ! userPaused && ! hovered && ! focused && visible && ! document.hidden;

	function restart() {
		window.clearInterval( timer );
		timer = null;
		if ( playing() && positions > 1 ) {
			timer = window.setInterval( () => {
				// Without loop, autoplay ends on the last slide instead of ticking in place.
				// It counts as paused, so the button shows "pressed" (pressing it starts over).
				if ( ! loop && index >= positions - 1 ) {
					userPaused = true;
					restart();
					return;
				}
				goTo( index + 1, false );
			}, intervalMs( options.interval ) );
		}
		root.classList.toggle( 'is-playing', !! timer );
		if ( playBtn ) {
			// The name says what pressing it does, like its icon; no aria-pressed
			// (a toggle whose name changes must not also report a state).
			playBtn.setAttribute( 'aria-label', userPaused ? label( options, 'play', __( 'Play the slides', 'werun-blocks-community' ) ) : label( options, 'pause', __( 'Pause the slides', 'werun-blocks-community' ) ) );
			playBtn.removeAttribute( 'aria-pressed' );
			playBtn.classList.toggle( 'is-paused', userPaused );
		}
	}

	playBtn?.removeAttribute( 'aria-pressed' ); // 2.0 markup printed it
	if ( options.autoplay ) {
		if ( reduce && playBtn ) {
			playBtn.hidden = true; // nothing plays, so nothing to pause
		}
		if ( options.pauseOnHover !== false ) {
			root.addEventListener( 'mouseenter', () => {
				hovered = true;
				restart();
			} );
			root.addEventListener( 'mouseleave', () => {
				hovered = false;
				restart();
			} );
		}
		// Focus inside pauses (WCAG 2.2.2), except on the play button itself:
		// pressing "play" there has to play.
		root.addEventListener( 'focusin', ( event ) => {
			focused = ! ( playBtn && playBtn.contains( event.target ) );
			restart();
		} );
		root.addEventListener( 'focusout', ( event ) => {
			if ( ! root.contains( event.relatedTarget ) ) {
				focused = false;
				restart();
			}
		} );
		playBtn?.addEventListener( 'click', () => {
			userPaused = ! userPaused;
			// Playing again after autoplay stopped on the last slide starts from the first.
			if ( ! userPaused && ! loop && index >= positions - 1 ) {
				goTo( 0, false );
			}
			restart();
		} );
		document.addEventListener( 'visibilitychange', restart );
		if ( 'IntersectionObserver' in window ) {
			new IntersectionObserver( ( entries ) => {
				visible = entries[ 0 ].isIntersecting;
				restart();
			} ).observe( root );
		}
	} else if ( playBtn ) {
		playBtn.hidden = true;
	}

	const refresh = () => {
		collect();
		measure();
	};

	if ( 'ResizeObserver' in window ) {
		new ResizeObserver( measure ).observe( track );
	} else {
		window.addEventListener( 'resize', measure );
	}

	// A position from outside (thumbnails): clamped, never wrapped (wrapping is for ±1 moves).
	const instance = { refresh, goTo: ( i ) => goTo( Math.min( Math.max( 0, parseInt( i, 10 ) || 0 ), positions - 1 ), true ), root };
	instances.set( root, instance );
	refresh();
	root.classList.add( 'is-ready' );
	return instance;
}

function setupAll( scope ) {
	roots( scope, '[data-wrbc-carousel]' ).forEach( setup );
}

ns( 'carousel', {
	setup: setupAll,
	/** Re-reads the slides of `root` (or of every carousel inside it). */
	refresh( root ) {
		roots( root, '[data-wrbc-carousel]' ).forEach( ( node ) => ( instances.get( node ) || setup( node ) )?.refresh() );
	},
	/** Moves `root` to position `i` as a user action (restarts autoplay), e.g. from thumbnails. */
	goTo( root, i ) {
		( instances.get( root ) || setup( root ) )?.goTo( i );
	},
} );

ready( () => setupAll( document ) );
