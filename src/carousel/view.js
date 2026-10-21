/**
 * Carousel, front end. The wrbc-carousel module (docs/shared-modules.md)
 * drives the track, arrows, dots, autoplay, slide labels and keeps a focused
 * element's slide fully in view. This adds the thumbnails: a click goes to
 * that slide; the current slide's thumbnail gets aria-current, the ones in
 * view .is-visible.
 */
function perView( track ) {
	return Math.max( 1, parseInt( getComputedStyle( track ).getPropertyValue( '--wrbc-pv' ), 10 ) || 1 );
}

function slidesOf( track ) {
	return Array.from( track.children ).filter( ( el ) => el.hasAttribute( 'data-wrbc-slide' ) );
}

// Distance between two slides. abs(): in RTL the second slide is left of the first.
function step( track, slides ) {
	return ( slides[ 1 ] ? Math.abs( slides[ 1 ].offsetLeft - slides[ 0 ].offsetLeft ) : 0 ) || track.clientWidth || 1;
}

function positions( track, slides ) {
	return Math.max( 1, slides.length - perView( track ) + 1 );
}

const reduce = () => window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;

/** Scrolls the track so position `i` (clamped) comes first (fallback when the module isn't there). */
function scrollToPosition( track, slides, i ) {
	const target = Math.min( positions( track, slides ) - 1, Math.max( 0, i ) );
	const dir = getComputedStyle( track ).direction === 'rtl' ? -1 : 1;
	track.scrollTo( { left: dir * target * step( track, slides ), behavior: reduce() ? 'auto' : 'smooth' } );
}

function setupThumbs( root, track ) {
	const box = root.querySelector( '[data-wrbc-thumbs]' );
	if ( ! box ) {
		return;
	}
	const slides = slidesOf( track );
	const thumbs = Array.from( box.querySelectorAll( '.wrbc-carousel__thumb' ) );
	if ( slides.length < 2 || ! thumbs.length ) {
		return;
	}

	const update = () => {
		const index = Math.min( positions( track, slides ) - 1, Math.max( 0, Math.round( Math.abs( track.scrollLeft ) / step( track, slides ) ) ) );
		const pv = perView( track );
		thumbs.forEach( ( thumb, i ) => {
			if ( i === index ) {
				thumb.setAttribute( 'aria-current', 'true' );
			} else {
				thumb.removeAttribute( 'aria-current' );
			}
			thumb.classList.toggle( 'is-visible', i >= index && i < index + pv );
		} );
	};

	const goTo = ( i ) => {
		const target = Math.min( positions( track, slides ) - 1, Math.max( 0, i ) );
		// Prefer the module's own navigation when it offers one (restarts autoplay, announces the move).
		if ( typeof window.wrbc?.carousel?.goTo === 'function' ) {
			window.wrbc.carousel.goTo( root, target );
			return;
		}
		scrollToPosition( track, slides, target );
	};

	thumbs.forEach( ( thumb, i ) => thumb.addEventListener( 'click', () => goTo( i ) ) );

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
	if ( 'ResizeObserver' in window ) {
		new ResizeObserver( update ).observe( track );
	}
	update();
	root.classList.add( 'has-thumbs-ready' );
}

function setup( root ) {
	if ( root.dataset.wrbcCarouselBlock ) {
		return;
	}
	root.dataset.wrbcCarouselBlock = '1';
	const track = root.querySelector( '[data-wrbc-track]' );
	if ( track ) {
		setupThumbs( root, track );
	}
}

function init() {
	document.querySelectorAll( '.wrbc-carousel.wp-block-werun-community-carousel.has-thumbs' ).forEach( setup );
}

if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', init );
} else {
	init();
}
