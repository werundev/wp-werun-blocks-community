/**
 * Shared front-end module wrbc-counter. Contract: docs/shared-modules.md.
 *
 *   <span data-wrbc-count='{"to":1200,"from":0,"decimals":0,"prefix":"","suffix":"+","duration":1600}'>1,200+</span>
 *
 * PHP prints the final value, so search engines, readers without JS and
 * reduced motion get it as is. Once the number scrolls into view it counts
 * from `from` to `to`: the moving digits are aria-hidden, next to a visually
 * hidden copy of the final text, so screen readers hear one value, once.
 * At the end the original text comes back exactly as PHP printed it.
 * It counts for 5 seconds at most (WCAG 2.2.2: moving content that stops by
 * itself within 5 s needs no pause button), with the thousands and decimal
 * marks the author typed ("1.200.000" counts as "1.199.999", never flips to
 * "1,200,000"), and keeps the final width while it counts (no jump).
 *
 * API: window.wrbc.counter.setup( root ).
 */
import { ns, options as readOptions, ready, reducedMotion, roots } from './lib';

const done = new WeakSet();
const easeOut = ( t ) => 1 - Math.pow( 1 - t, 3 );

function formatter( decimals, grouping ) {
	const lang = document.documentElement.lang || undefined;
	try {
		return new Intl.NumberFormat( lang, { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: grouping } );
	} catch ( e ) {
		return new Intl.NumberFormat( undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: grouping } );
	}
}

/**
 * A formatter that writes numbers the way the printed one is written: its
 * group mark ("." "," space, narrow space, apostrophe) every three digits
 * and its decimal mark. Null when the text doesn't show them plainly (then
 * Intl with the page language is used).
 */
function likePrinted( final, prefix, suffix, decimals, grouping ) {
	let core = String( final ).trim();
	if ( prefix && core.startsWith( prefix ) ) {
		core = core.slice( prefix.length );
	}
	if ( suffix && core.endsWith( suffix ) ) {
		core = core.slice( 0, core.length - suffix.length );
	}
	const match = core.match( /\d(?:[\d.,'\u2019\s\u00a0\u2009\u202f]*\d)?/ );
	if ( ! match ) {
		return null;
	}
	const num = match[ 0 ];
	let decimal = '';
	let int = num;
	if ( decimals > 0 ) {
		decimal = num.charAt( num.length - decimals - 1 );
		if ( ! decimal || /\d/.test( decimal ) || /\D/.test( num.slice( -decimals ) ) ) {
			return null;
		}
		int = num.slice( 0, num.length - decimals - 1 );
	}
	const marks = int.match( /\D/g ) || [];
	const group = marks.length ? marks[ 0 ] : '';
	// One mark, groups of three after the first (not 12,34,567).
	if ( marks.some( ( m ) => m !== group ) || ( group && int.split( group ).slice( 1 ).some( ( part ) => part.length !== 3 ) ) || ( group && group === decimal ) ) {
		return null;
	}
	const useGroup = grouping && group;
	return ( value ) => {
		const [ whole, fraction ] = Math.abs( value ).toFixed( decimals ).split( '.' );
		const digits = useGroup ? whole.replace( /\B(?=(\d{3})+(?!\d))/g, group ) : whole;
		return ( value < 0 ? '-' : '' ) + digits + ( fraction ? decimal + fraction : '' );
	};
}

function prepare( node ) {
	const o = readOptions( node, 'data-wrbc-count' );
	const to = Number( o.to );
	if ( ! Number.isFinite( to ) ) {
		return null;
	}
	const from = Number.isFinite( Number( o.from ) ) ? Number( o.from ) : 0;
	const decimals = Math.max( 0, Math.min( 6, parseInt( o.decimals, 10 ) || 0 ) );
	const duration = Math.max( 200, Math.min( 5000, Number( o.duration ) || 1600 ) );
	const prefix = typeof o.prefix === 'string' ? o.prefix : '';
	const suffix = typeof o.suffix === 'string' ? o.suffix : '';
	const final = node.textContent;
	// grouping: false keeps "9001" (ISO 9001, since 1998) from counting up as "9,001".
	const nf = formatter( decimals, o.grouping !== false );
	const own = likePrinted( final, prefix, suffix, decimals, o.grouping !== false );
	const number = own || ( ( value ) => nf.format( value ) );
	// The final width, kept while the shorter numbers count (no layout jump).
	const width = node.getBoundingClientRect().width;

	const shown = document.createElement( 'span' );
	shown.setAttribute( 'aria-hidden', 'true' );
	shown.className = 'wrbc-count__value';
	const spoken = document.createElement( 'span' );
	spoken.className = 'wrbc-sr-only';
	spoken.textContent = final;
	const text = ( value ) => prefix + number( value ) + suffix;

	shown.textContent = text( from );
	node.textContent = '';
	node.append( shown, spoken );
	node.classList.add( 'is-counting' );
	if ( width > 0 ) {
		node.style.display = 'inline-block';
		node.style.minWidth = Math.ceil( width ) + 'px';
	}

	return () => {
		const start = performance.now();
		const tick = ( now ) => {
			const t = Math.min( 1, ( now - start ) / duration );
			shown.textContent = text( from + ( to - from ) * easeOut( t ) );
			if ( t < 1 ) {
				window.requestAnimationFrame( tick );
			} else {
				node.textContent = final;
				node.classList.remove( 'is-counting' );
				node.style.minWidth = '';
				node.style.display = '';
			}
		};
		window.requestAnimationFrame( tick );
	};
}

let observer = null;
const runners = new WeakMap();

function setup( scope ) {
	const nodes = roots( scope, '[data-wrbc-count]' ).filter( ( node ) => ! done.has( node ) );
	nodes.forEach( ( node ) => done.add( node ) );
	if ( reducedMotion() || ! ( 'IntersectionObserver' in window ) ) {
		return; // the final value is already there
	}
	if ( ! observer ) {
		observer = new IntersectionObserver(
			( entries ) => {
				entries.forEach( ( entry ) => {
					if ( entry.isIntersecting ) {
						observer.unobserve( entry.target );
						const run = runners.get( entry.target );
						runners.delete( entry.target );
						if ( run ) {
							run();
						}
					}
				} );
			},
			{ threshold: 0.4 }
		);
	}
	nodes.forEach( ( node ) => {
		const run = prepare( node );
		if ( run ) {
			runners.set( node, run );
			observer.observe( node );
		}
	} );
}

ns( 'counter', { setup } );

ready( () => setup( document ) );
