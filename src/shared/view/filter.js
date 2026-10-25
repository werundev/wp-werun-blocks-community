/**
 * Shared front-end module wrbc-filter. Contract: docs/shared-modules.md.
 *
 * Two ways to use it:
 *   - bundled: `import { filterList, normalize } from '../shared/view/filter'`
 *     (the accordion's search). Importing has no side effects beyond
 *     registering window.wrbc.filter, and no root on the page means no work.
 *   - the wrbc-filter handle, for markup-driven lists:
 *
 *   <div data-wrbc-filter='{"live":"%d results","liveOne":"1 result"}'>
 *     <input data-wrbc-filter-search>
 *     <select data-wrbc-filter-select="dept">…</select>
 *     <button data-wrbc-filter-chip="dept" data-value="12">…</button>
 *     <ul> <li data-wrbc-filter-item data-dept="12 14" data-text="…">…</li> </ul>
 *     <p data-wrbc-filter-empty hidden>…</p>
 *     <p class="wrbc-sr-only" data-wrbc-filter-status aria-live="polite"></p>
 *   </div>
 *
 * Search: every word must appear (word-AND), case and accents ignored.
 * Selects and chips AND-ed with it and with each other; an item's data-<key>
 * may hold several values separated by spaces. Chips of one key act as one
 * choice (pressing the active chip, or a chip with data-value="", clears it).
 *
 * The live count ([data-wrbc-filter-status], a polite live region) follows
 * every change. Its text, in order of preference:
 *   "counts": [ "0 results", "1 result", "2 results", … ]  one string per
 *             number, from PHP's _n() (every language's plural forms);
 *   "live":   { "one": "%d result", "few": "…", "many": "…", "other": "%d results" }
 *             picked with Intl.PluralRules for the page's language;
 *   "live" / "liveOne": "%d results" / "1 result" (2.0).
 *
 * API: window.wrbc.filter.setup( root ), .apply( root ), .normalize, .filterList.
 */
import { format, ns, options as readOptions, ready, roots } from './lib';

/** Lower case, without accents or surrounding spaces. */
export const normalize = ( text ) =>
	String( text ?? '' )
		.toLowerCase()
		.normalize( 'NFD' )
		.replace( /[̀-ͯ]/g, '' )
		.trim();

/** The normalised words of a query. */
export const words = ( query ) => normalize( query ).split( /\s+/ ).filter( Boolean );

/** Whether a normalised text holds every word. */
export const matches = ( text, list ) => list.every( ( word ) => text.includes( word ) );

/**
 * Hides the items that don't match `query` (and `test`, when given) and
 * returns how many are shown.
 *
 * @param {Element[]} items           The items.
 * @param {string}    query           What the visitor typed.
 * @param {Object}    [args]
 * @param {string[]}  [args.texts]    Normalised text per item (cache it: items rarely change).
 * @param {Function}  [args.test]     ( item, index ) => boolean, AND-ed with the search.
 */
export function filterList( items, query, { texts, test } = {} ) {
	const list = words( query );
	let shown = 0;
	items.forEach( ( item, i ) => {
		const text = texts ? texts[ i ] : normalize( item.getAttribute( 'data-text' ) ?? item.textContent );
		const match = matches( text, list ) && ( ! test || test( item, i ) );
		item.hidden = ! match;
		if ( match ) {
			shown++;
		}
	} );
	return shown;
}

/* ── Markup-driven lists ─────────────────────────────────────────────── */

/*
 * Instances live on the element, not in a module-level map: this file is
 * bundled into the accordion too, and both copies may run on one page.
 */
const instanceOf = ( root ) => root.wrbcFilter || null;
const textCache = new WeakMap();

/** The count's text for `n`, in the page's language (see the header). */
function countText( o, n ) {
	if ( Array.isArray( o.counts ) && typeof o.counts[ n ] === 'string' ) {
		return o.counts[ n ];
	}
	if ( o.live && typeof o.live === 'object' ) {
		let form = 'other';
		try {
			form = new Intl.PluralRules( document.documentElement.lang || undefined ).select( n );
		} catch ( e ) {}
		const template = o.live[ form ] || o.live.other;
		return typeof template === 'string' ? format( template, n ) : '';
	}
	return format( n === 1 && o.liveOne ? o.liveOne : o.live, n );
}
const key = ( value ) => String( value || '' ).toLowerCase().replace( /[^a-z0-9_-]/g, '' );

function itemText( item ) {
	if ( ! textCache.has( item ) ) {
		textCache.set( item, normalize( item.getAttribute( 'data-text' ) ?? item.textContent ) );
	}
	return textCache.get( item );
}

function setup( root ) {
	if ( instanceOf( root ) ) {
		return instanceOf( root );
	}
	const o = readOptions( root, 'data-wrbc-filter' );
	const mine = ( selector ) => Array.from( root.querySelectorAll( selector ) ).filter( ( node ) => node.closest( '[data-wrbc-filter]' ) === root );
	const search = mine( '[data-wrbc-filter-search]' )[ 0 ];
	const selects = mine( 'select[data-wrbc-filter-select]' );
	const chips = mine( '[data-wrbc-filter-chip]' );
	const empty = mine( '[data-wrbc-filter-empty]' )[ 0 ];
	const status = mine( '[data-wrbc-filter-status]' )[ 0 ];
	const chosen = {}; // chip key -> value

	chips.forEach( ( chip ) => {
		const k = key( chip.getAttribute( 'data-wrbc-filter-chip' ) );
		if ( chip.tagName === 'BUTTON' && ! chip.type ) {
			chip.type = 'button';
		}
		const pressed = chip.getAttribute( 'aria-pressed' ) === 'true';
		chip.setAttribute( 'aria-pressed', pressed ? 'true' : 'false' );
		if ( pressed && chip.dataset.value ) {
			chosen[ k ] = chip.dataset.value;
		}
	} );

	const syncChips = () =>
		chips.forEach( ( chip ) => {
			const k = key( chip.getAttribute( 'data-wrbc-filter-chip' ) );
			const value = chip.dataset.value || '';
			chip.setAttribute( 'aria-pressed', ( chosen[ k ] || '' ) === value ? 'true' : 'false' );
		} );

	const wanted = () => {
		const list = {};
		selects.forEach( ( select ) => {
			if ( select.value ) {
				list[ key( select.getAttribute( 'data-wrbc-filter-select' ) ) ] = select.value;
			}
		} );
		Object.keys( chosen ).forEach( ( k ) => {
			if ( chosen[ k ] ) {
				list[ k ] = chosen[ k ];
			}
		} );
		return list;
	};

	const apply = ( announce ) => {
		// Items are looked up each time, so load-more items are filtered too.
		const items = mine( '[data-wrbc-filter-item]' );
		const want = wanted();
		const shown = filterList( items, search ? search.value : '', {
			texts: items.map( itemText ),
			test: ( item ) =>
				Object.keys( want ).every( ( k ) => ( item.getAttribute( 'data-' + k ) || '' ).split( /\s+/ ).includes( want[ k ] ) ),
		} );
		if ( empty ) {
			empty.hidden = shown > 0;
		}
		// The count follows every change the visitor makes, and also a value
		// the browser restored (back / forward) before this ran: a count that
		// says "8" over 3 visible items would be wrong, seen or heard.
		const filtered = !! ( search && words( search.value ).length ) || Object.keys( want ).length > 0;
		if ( status && ( o.live || o.counts ) && ( announce || filtered ) ) {
			status.textContent = countText( o, shown );
		}
		root.dispatchEvent( new CustomEvent( 'wrbc:filter', { detail: { shown } } ) );
		return shown;
	};

	let timer;
	search?.addEventListener( 'input', () => {
		window.clearTimeout( timer );
		timer = window.setTimeout( () => apply( true ), 150 );
	} );
	// Enter in the search field filters (it already did, as you type): it
	// must not submit a form the block happens to sit in.
	search?.addEventListener( 'keydown', ( event ) => {
		if ( event.key === 'Enter' && search.form ) {
			event.preventDefault();
		}
	} );
	selects.forEach( ( select ) => select.addEventListener( 'change', () => apply( true ) ) );
	chips.forEach( ( chip ) =>
		chip.addEventListener( 'click', () => {
			const k = key( chip.getAttribute( 'data-wrbc-filter-chip' ) );
			const value = chip.dataset.value || '';
			chosen[ k ] = chosen[ k ] === value ? '' : value;
			syncChips();
			apply( true );
		} )
	);

	syncChips();
	const instance = { apply: () => apply( false ) };
	root.wrbcFilter = instance;
	root.classList.add( 'is-ready' );
	apply( false ); // values the browser restored on back/forward
	return instance;
}

function setupAll( scope ) {
	roots( scope, '[data-wrbc-filter]' ).forEach( setup );
}

ns( 'filter', {
	setup: setupAll,
	apply: ( root ) => roots( root, '[data-wrbc-filter]' ).forEach( ( node ) => ( instanceOf( node ) || setup( node ) ).apply() ),
	normalize,
	filterList,
} );

ready( () => setupAll( document ) );
