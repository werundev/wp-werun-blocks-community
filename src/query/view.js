/**
 * Query block, front end. Without JavaScript every page, chip, search and
 * sort is a real link or form (?wrbc_p_{key}=N…). With it, per instance:
 *   - those links and the form fetch GET wrbc/v1/query (signed config) and
 *     swap the results, or append them for "load more";
 *   - the address bar follows (replaceState), a live region says how many
 *     results there are, focus moves to the first new card on load more;
 *   - the "load more" link (the no-JS fallback) becomes a real <button>;
 *   - carousels, maps and gates in the new markup are set up again.
 * The HTML comes escaped from the server (Renderer) and is parsed with
 * createContextualFragment: no data is ever put in innerHTML here.
 */
const PARAMS = { page: 'p', term: 't', q: 'q', sort: 's' };

/** printf-style %d / %1$d, as the translated labels from PHP use them. */
const format = ( template, ...values ) => {
	let i = 0;
	return String( template || '' ).replace( /%(\d)?\$?d/g, ( match, position ) => String( values[ position ? Number( position ) - 1 : i++ ] ?? '' ) );
};

/**
 * The "load more" link appends with JS: a button, then (same text, classes
 * and page), so it's announced for what it does.
 */
function enhanceMore( scope ) {
	scope.querySelectorAll( 'a[data-wrbc-query-more]' ).forEach( ( link ) => {
		const button = document.createElement( 'button' );
		button.type = 'button';
		button.className = link.className;
		button.textContent = link.textContent;
		button.setAttribute( 'data-wrbc-query-page', link.getAttribute( 'data-wrbc-query-page' ) || '' );
		button.setAttribute( 'data-wrbc-query-more', '' );
		link.replaceWith( button );
	} );
}

/**
 * The list beside a map scrolls only where it's taller than the map (wide
 * blocks): a named group in the tab order while it overflows, a plain list
 * otherwise (docs/accessibility.md, scrollers). Printed focusable for no-JS.
 */
function syncScrollers( scope ) {
	scope.querySelectorAll( '[data-wrbc-query-scroller]' ).forEach( ( box ) => {
		if ( box.wrbcScroller ) {
			return;
		}
		box.wrbcScroller = true;
		const name = box.getAttribute( 'aria-label' ) || '';
		const sync = () => {
			if ( box.scrollHeight > box.clientHeight + 1 ) {
				box.setAttribute( 'tabindex', '0' );
				box.setAttribute( 'role', 'group' );
				box.setAttribute( 'aria-label', name );
			} else if ( box !== box.ownerDocument.activeElement ) {
				box.removeAttribute( 'tabindex' );
				box.removeAttribute( 'role' );
				box.removeAttribute( 'aria-label' );
			}
		};
		sync();
		if ( 'ResizeObserver' in window ) {
			const observer = new window.ResizeObserver( sync );
			observer.observe( box );
			if ( box.firstElementChild ) {
				observer.observe( box.firstElementChild );
			}
		}
	} );
}

/**
 * "Show on the map" buttons sit in the list next to the map, outside the
 * [data-wrbc-map] root wrbc-map wires: hand them the map once it is ready.
 */
function wireMapFocus( scope ) {
	scope.querySelectorAll( '.wrbc-query__map-layout' ).forEach( ( layout ) => {
		const mapRoot = layout.querySelector( '[data-wrbc-map]' );
		if ( ! mapRoot || layout.wrbcFocus ) {
			return;
		}
		layout.wrbcFocus = true;
		let map = null;
		mapRoot.addEventListener( 'wrbc:map-ready', ( event ) => {
			map = ( event.detail && event.detail.map ) || null;
		} );
		layout.addEventListener( 'click', ( event ) => {
			const button = event.target.closest( '[data-wrbc-map-focus]' );
			if ( ! button || ! map || mapRoot.contains( button ) ) {
				return;
			}
			map.focus( parseInt( button.getAttribute( 'data-wrbc-map-focus' ), 10 ) );
			mapRoot.scrollIntoView( { block: 'nearest' } );
		} );
	} );
}

function setupModules( scope ) {
	wireMapFocus( scope );
	syncScrollers( scope );
	const wrbc = window.wrbc || {};
	[
		[ '[data-wrbc-carousel]', wrbc.carousel ],
		[ '[data-wrbc-map]', wrbc.map ],
		[ '[data-wrbc-gate]', wrbc.gate ],
	].forEach( ( [ selector, module ] ) => {
		if ( module && typeof module.setup === 'function' ) {
			scope.querySelectorAll( selector ).forEach( ( el ) => module.setup( el ) );
		}
	} );
}

function setup( root ) {
	if ( root.dataset.wrbcQueryReady ) {
		return;
	}
	let options;
	try {
		options = JSON.parse( root.dataset.wrbcQuery || '{}' );
	} catch ( e ) {
		return;
	}
	const region = root.querySelector( '[data-wrbc-query-results]' );
	if ( ! options.c || ! options.key || ! options.endpoint || ! region ) {
		return;
	}
	root.dataset.wrbcQueryReady = '1';
	root.classList.add( 'is-js' );

	const key = options.key;
	const labels = options.labels || {};
	const status = root.querySelector( '[data-wrbc-query-status]' );
	const form = root.querySelector( '[data-wrbc-query-form]' );
	const search = root.querySelector( '[data-wrbc-query-search]' );
	const sort = root.querySelector( '[data-wrbc-query-sort]' );
	const current = new URL( window.location.href ).searchParams;
	const state = {};
	Object.entries( PARAMS ).forEach( ( [ name, short ] ) => {
		state[ name ] = current.get( `wrbc_${ short }_${ key }` ) || '';
	} );

	let controller = null;
	let searchTimer = 0;

	// The status is read by screen readers only, except an error: that one
	// shows next to the filters too, for everyone (WCAG 4.1.3 / 1.3.3).
	const say = ( text, error = false ) => {
		if ( status ) {
			status.classList.toggle( 'wrbc-sr-only', ! error );
			status.classList.toggle( 'is-error', error );
			status.textContent = text;
		}
	};
	const countText = ( total ) => {
		if ( ! total ) {
			return labels.none || '';
		}
		if ( total === 1 ) {
			return labels.one || '1';
		}
		return format( labels.results || '%d', total );
	};

	// "Load more" keeps the page out of the address bar: a reload with
	// ?wrbc_p_…=3 would show page 3 alone, without the items loaded before it.
	const syncUrl = () => {
		const url = new URL( window.location.href );
		Object.entries( PARAMS ).forEach( ( [ name, short ] ) => {
			const param = `wrbc_${ short }_${ key }`;
			const value = state[ name ];
			if ( value && ! ( name === 'page' && ( String( value ) === '1' || options.pagination === 'loadMore' ) ) ) {
				url.searchParams.set( param, value );
			} else {
				url.searchParams.delete( param );
			}
		} );
		window.history.replaceState( window.history.state, '', url );
	};

	// Links from the REST route are relative ("?wrbc_p_…=3"): make them this
	// page's URL with the other parameters kept (new tab, copy link).
	const absolutize = ( scope ) => {
		scope.querySelectorAll( 'a[data-wrbc-query-page]' ).forEach( ( link ) => {
			const raw = link.getAttribute( 'href' ) || '';
			if ( raw.charAt( 0 ) !== '?' ) {
				return;
			}
			const url = new URL( window.location.href );
			Object.values( PARAMS ).forEach( ( short ) => url.searchParams.delete( `wrbc_${ short }_${ key }` ) );
			new URLSearchParams( raw.slice( 1 ) ).forEach( ( value, name ) => url.searchParams.set( name, value ) );
			link.setAttribute( 'href', url.href );
		} );
	};

	const syncChips = () => {
		root.querySelectorAll( '[data-wrbc-query-term]' ).forEach( ( chip ) => {
			const on = ( chip.dataset.wrbcQueryTerm === '0' ? '' : chip.dataset.wrbcQueryTerm ) === String( state.term || '' );
			if ( on ) {
				chip.setAttribute( 'aria-current', 'true' );
			} else {
				chip.removeAttribute( 'aria-current' );
			}
		} );
	};

	const load = async ( mode ) => {
		if ( controller ) {
			controller.abort();
		}
		controller = new AbortController();
		const url = new URL( options.endpoint, window.location.href );
		url.searchParams.set( 'c', options.c );
		// The block's id: the ids in the new markup start with it (unique per block on the page).
		if ( /^[A-Za-z0-9_:.-]{1,64}$/.test( root.id ) ) {
			url.searchParams.set( 'uid', root.id );
		}
		Object.keys( PARAMS ).forEach( ( name ) => {
			if ( state[ name ] ) {
				url.searchParams.set( name, state[ name ] );
			}
		} );
		region.setAttribute( 'aria-busy', 'true' );
		say( labels.loading || '' );
		let data;
		try {
			const response = await window.fetch( url, {
				credentials: 'omit',
				headers: { Accept: 'application/json' },
				signal: controller.signal,
			} );
			if ( ! response.ok ) {
				throw new Error( String( response.status ) );
			}
			data = await response.json();
		} catch ( error ) {
			if ( error.name !== 'AbortError' ) {
				region.removeAttribute( 'aria-busy' );
				say( labels.error || '', true );
			}
			return;
		}
		const fragment = document.createRange().createContextualFragment( typeof data.html === 'string' ? data.html : '' );
		let added = -1;
		if ( mode === 'append' ) {
			const list = region.querySelector( '.wrbc-query__items' );
			const items = Array.from( fragment.querySelectorAll( '.wrbc-query__item' ) );
			items.forEach( ( item ) => {
				item.classList.add( 'is-new' );
				list.appendChild( item );
			} );
			added = items.length;
			const oldNav = region.querySelector( '.wrbc-query__pagination' );
			if ( oldNav ) {
				oldNav.remove();
			}
			const nav = fragment.querySelector( '.wrbc-query__pagination' );
			if ( nav ) {
				region.appendChild( nav );
			}
			// The "load more" link is gone (replaced, or the last page): focus the
			// first new card so keyboard users carry on from there.
			const first = items[ 0 ] && ( items[ 0 ].querySelector( 'a[href]' ) || items[ 0 ].querySelector( 'article' ) );
			if ( first ) {
				if ( ! first.matches( 'a' ) ) {
					first.setAttribute( 'tabindex', '-1' );
				}
				first.focus( { preventScroll: false } );
			}
			setupModules( list );
		} else {
			// The visitor already loaded this block's map: load the new one too.
			const hadMap = !! region.querySelector( '[data-wrbc-map].is-ready' );
			// A page link inside the region disappears with it: focus moves to the first card.
			const refocus = region.contains( document.activeElement );
			region.replaceChildren( fragment );
			setupModules( region );
			if ( hadMap ) {
				const accept = region.querySelector( '[data-wrbc-map] [data-wrbc-consent-accept]' );
				if ( accept ) {
					accept.click();
				}
			}
			if ( refocus ) {
				// The first card's link (as after "load more"), else the card, else the empty text.
				const item = region.querySelector( '.wrbc-query__item' );
				const target = item ? item.querySelector( 'a[href]' ) || item.querySelector( 'article' ) : region.querySelector( '.wrbc-query__empty' );
				if ( target ) {
					if ( ! target.matches( 'a' ) ) {
						target.setAttribute( 'tabindex', '-1' );
					}
					target.focus( { preventScroll: true } );
				}
			}
			const top = root.getBoundingClientRect().top;
			if ( top < 0 ) {
				root.scrollIntoView( { block: 'start', behavior: window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches ? 'auto' : 'smooth' } );
			}
		}
		region.removeAttribute( 'aria-busy' );
		state.page = String( data.page || 1 );
		syncUrl();
		absolutize( region );
		enhanceMore( region );
		const total = Number( data.total ) || 0;
		// "6 more loaded, 12 of 20 shown." after load more; "20 results" otherwise.
		say( added >= 0 && labels.more ? format( labels.more, added, region.querySelectorAll( '.wrbc-query__item' ).length, total ) : countText( total ) );
	};

	root.addEventListener( 'click', ( event ) => {
		if ( event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ) {
			return;
		}
		const chip = event.target.closest( 'a[data-wrbc-query-term]' );
		if ( chip && root.contains( chip ) ) {
			event.preventDefault();
			state.term = chip.dataset.wrbcQueryTerm === '0' ? '' : chip.dataset.wrbcQueryTerm;
			state.page = '';
			syncChips();
			load( 'replace' );
			return;
		}
		const link = event.target.closest( 'a[data-wrbc-query-page], button[data-wrbc-query-more]' );
		if ( link && region.contains( link ) ) {
			event.preventDefault();
			state.page = link.dataset.wrbcQueryPage;
			load( link.hasAttribute( 'data-wrbc-query-more' ) ? 'append' : 'replace' );
		}
	} );
	enhanceMore( region );

	const applyForm = () => {
		const q = search ? search.value.trim() : '';
		if ( q.length === 1 ) {
			return;
		}
		state.q = q;
		state.sort = sort ? sort.value : '';
		state.page = '';
		load( 'replace' );
	};
	if ( form ) {
		form.addEventListener( 'submit', ( event ) => {
			event.preventDefault();
			clearTimeout( searchTimer );
			applyForm();
		} );
	}
	if ( search ) {
		search.addEventListener( 'input', () => {
			clearTimeout( searchTimer );
			searchTimer = setTimeout( applyForm, 400 );
		} );
	}
	if ( sort ) {
		sort.addEventListener( 'change', applyForm );
	}
}

function init() {
	document.querySelectorAll( '.wrbc-query' ).forEach( wireMapFocus );
	syncScrollers( document );
	document.querySelectorAll( '.wrbc-query[data-wrbc-query]' ).forEach( setup );
}

window.wrbc = window.wrbc || {};
window.wrbc.query = { setup };

if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', init );
} else {
	init();
}
