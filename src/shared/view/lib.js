/**
 * Small pieces the shared front-end modules use. Not an entry of its own:
 * webpack copies what each module imports into that module's bundle, so a
 * page that only loads wrbc-counter doesn't pay for the others.
 */

/** The wrbc namespace every module hangs its API from. */
export function ns( name, api ) {
	window.wrbc = window.wrbc || {};
	window.wrbc[ name ] = Object.assign( window.wrbc[ name ] || {}, api );
	return window.wrbc[ name ];
}

/** Runs `fn` once the DOM is parsed (deferred scripts may run after that). */
export function ready( fn ) {
	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', fn );
	} else {
		fn();
	}
}

/** JSON from a data attribute, or `{}` when it is missing or broken. */
export function options( el, attribute ) {
	try {
		const value = JSON.parse( el.getAttribute( attribute ) || '{}' );
		return value && typeof value === 'object' ? value : {};
	} catch ( e ) {
		return {};
	}
}

/**
 * printf-style %d / %1$d / %s / %1$s, as the translated labels from PHP use
 * them (sprintf placeholders, so translators see the usual syntax).
 */
export function format( template, ...values ) {
	let i = 0;
	return String( template || '' ).replace( /%(\d\$)?[ds]/g, ( match, position ) => {
		const index = position ? parseInt( position, 10 ) - 1 : i++;
		return values[ index ] === undefined ? '' : String( values[ index ] );
	} );
}

export const reducedMotion = () => !! window.matchMedia && window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;

/** Visitors on a metered connection asked for less data (Save-Data). */
export const saveData = () => !! ( navigator.connection && navigator.connection.saveData );

/** Roots matching `selector` inside `scope`, the scope itself included. */
export function roots( scope, selector ) {
	const base = scope && scope.querySelectorAll ? scope : document;
	const found = Array.from( base.querySelectorAll( selector ) );
	if ( base.matches && base.matches( selector ) ) {
		found.unshift( base );
	}
	return found;
}

/** An http(s) URL, absolute, or '' (no javascript:, data:, …). */
export function safeUrl( value ) {
	if ( typeof value !== 'string' || ! value ) {
		return '';
	}
	try {
		const url = new URL( value, window.location.href );
		return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
	} catch ( e ) {
		return '';
	}
}

/** Creates an element with a class and, optionally, its text. */
export function el( tag, className, text ) {
	const node = document.createElement( tag );
	if ( className ) {
		node.className = className;
	}
	if ( text !== undefined && text !== null ) {
		node.textContent = String( text );
	}
	return node;
}

/** Loads a script or stylesheet once per page; resolves when it has loaded. */
const loading = {};
export function load( url, type = 'script', attrs = {} ) {
	if ( ! url ) {
		return Promise.reject( new Error( 'No URL' ) );
	}
	if ( ! loading[ url ] ) {
		loading[ url ] = new Promise( ( resolve, reject ) => {
			const node = type === 'style' ? document.createElement( 'link' ) : document.createElement( 'script' );
			if ( type === 'style' ) {
				node.rel = 'stylesheet';
				node.href = url;
			} else {
				node.src = url;
				node.async = false; // keep the order of the scripts we inject
			}
			Object.keys( attrs ).forEach( ( key ) => node.setAttribute( key, attrs[ key ] ) );
			node.addEventListener( 'load', () => resolve( node ) );
			node.addEventListener( 'error', () => {
				delete loading[ url ];
				node.remove();
				reject( new Error( 'Could not load ' + url ) );
			} );
			document.head.appendChild( node );
		} );
	}
	return loading[ url ];
}
