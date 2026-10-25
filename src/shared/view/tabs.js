/**
 * Shared front-end module wrbc-tabs. Contract: docs/shared-modules.md.
 *
 *   <div data-wrbc-tabs='{"activation":"auto|manual","orientation":"horizontal|vertical","hash":true}'>
 *     <div role="tablist"> <button role="tab" id="t1" aria-controls="p1">…</button> … </div>
 *     <section role="tabpanel" id="p1" aria-labelledby="t1">…</section>
 *   </div>
 *
 * The ARIA tabs pattern (https://www.w3.org/WAI/ARIA/apg/patterns/tabs/):
 * one tab in the Tab order (roving tabindex), arrows by orientation
 * (reversed in RTL), Home / End; "auto" selects as focus moves, "manual"
 * waits for Enter / Space. Without JS every panel shows; with it the
 * inactive panels get hidden="until-found", so the browser's find-in-page
 * still reaches their text and opens them (beforematch).
 *
 * Deep links: #<tab id>, #<panel id> or #<anything inside a panel> opens
 * it, and every tab set around it when nested. With "hash": true choosing a
 * tab also puts its id in the URL (replaceState: no jump, no history spam).
 *
 * A tab that gets focus is scrolled fully into view (a row of tabs that
 * scrolls sideways would otherwise leave it half hidden: WCAG 2.4.11).
 *
 * API: window.wrbc.tabs.setup( root ), .select( tabOrId ), .open( element ).
 * Events: wrbc:tabs-change on the root, detail { tab, panel }.
 */
import { ns, options as readOptions, ready, roots } from './lib';

const owner = new WeakMap(); // tab or panel -> { instance, tab }

/** Focus a tab and show all of it (nearest: no jump when it's already in view). */
function focusTab( tab ) {
	tab.focus();
	if ( tab.scrollIntoView ) {
		tab.scrollIntoView( { block: 'nearest', inline: 'nearest' } );
	}
}

function setup( root ) {
	if ( root.wrbcTabs ) {
		return root.wrbcTabs;
	}
	const o = readOptions( root, 'data-wrbc-tabs' );
	const vertical = o.orientation === 'vertical';
	const manual = o.activation === 'manual';
	// Only this root's own tablist: a nested tab set has its own instance.
	const tablist = Array.from( root.querySelectorAll( '[role="tablist"]' ) ).find( ( node ) => node.closest( '[data-wrbc-tabs]' ) === root );
	if ( ! tablist ) {
		return null;
	}
	const tabs = Array.from( tablist.querySelectorAll( '[role="tab"]' ) ).filter( ( tab ) => tab.closest( '[role="tablist"]' ) === tablist );
	const pairs = tabs
		.map( ( tab ) => ( { tab, panel: document.getElementById( tab.getAttribute( 'aria-controls' ) || '' ) } ) )
		.filter( ( pair ) => pair.panel );
	if ( ! pairs.length ) {
		return null;
	}
	if ( vertical ) {
		tablist.setAttribute( 'aria-orientation', 'vertical' );
	}

	const rtl = () => getComputedStyle( tablist ).direction === 'rtl';

	function select( tab, { focus = false, user = false } = {} ) {
		const current = pairs.find( ( pair ) => pair.tab === tab );
		if ( ! current ) {
			return;
		}
		pairs.forEach( ( { tab: t, panel } ) => {
			const on = t === tab;
			t.setAttribute( 'aria-selected', on ? 'true' : 'false' );
			t.tabIndex = on ? 0 : -1;
			t.classList.toggle( 'is-active', on );
			if ( on ) {
				panel.removeAttribute( 'hidden' );
				panel.tabIndex = 0;
			} else {
				panel.setAttribute( 'hidden', 'until-found' );
				// Collapsed panels stay out of the Tab order.
				panel.tabIndex = -1;
			}
		} );
		if ( focus ) {
			focusTab( tab );
		}
		if ( user && o.hash && tab.id && window.history && window.history.replaceState ) {
			window.history.replaceState( null, '', '#' + encodeURIComponent( tab.id ) );
		}
		root.dispatchEvent( new CustomEvent( 'wrbc:tabs-change', { detail: { tab, panel: current.panel } } ) );
	}

	pairs.forEach( ( { tab, panel } ) => {
		if ( tab.tagName === 'BUTTON' && ! tab.getAttribute( 'type' ) ) {
			tab.type = 'button';
		}
		if ( ! panel.hasAttribute( 'aria-labelledby' ) && tab.id ) {
			panel.setAttribute( 'aria-labelledby', tab.id );
		}
		// A panel with nothing focusable in it is reachable with Tab (APG).
		if ( ! panel.hasAttribute( 'tabindex' ) ) {
			panel.tabIndex = 0;
		}
		tab.addEventListener( 'click', ( event ) => {
			event.preventDefault(); // an <a role="tab"> must not jump
			select( tab, { focus: true, user: true } );
		} );
		// Find-in-page matched text in a hidden panel: show that tab.
		panel.addEventListener( 'beforematch', () => select( tab ) );
	} );

	tablist.addEventListener( 'keydown', ( event ) => {
		const i = pairs.findIndex( ( pair ) => pair.tab === event.target );
		if ( i < 0 ) {
			return;
		}
		const forward = vertical ? 'ArrowDown' : rtl() ? 'ArrowLeft' : 'ArrowRight';
		const back = vertical ? 'ArrowUp' : rtl() ? 'ArrowRight' : 'ArrowLeft';
		// A block's accordion layout stacks the tabs (the tablist becomes display: contents): Up/Down move too.
		const cs = window.getComputedStyle( tablist );
		const stacked = cs.display === 'contents';
		// A vertical list shown as a row (narrow blocks): Left/Right move too.
		const row = vertical && ! stacked && cs.flexDirection.startsWith( 'row' );
		let target = -1;
		if ( event.key === forward || ( stacked && event.key === 'ArrowDown' ) || ( row && event.key === ( rtl() ? 'ArrowLeft' : 'ArrowRight' ) ) ) {
			target = ( i + 1 ) % pairs.length;
		} else if ( event.key === back || ( stacked && event.key === 'ArrowUp' ) || ( row && event.key === ( rtl() ? 'ArrowRight' : 'ArrowLeft' ) ) ) {
			target = ( i - 1 + pairs.length ) % pairs.length;
		} else if ( event.key === 'Home' ) {
			target = 0;
		} else if ( event.key === 'End' ) {
			target = pairs.length - 1;
		} else if ( manual && ( event.key === 'Enter' || event.key === ' ' ) && event.target.tagName !== 'BUTTON' ) {
			event.preventDefault(); // a <button> already clicks on Enter / Space
			select( pairs[ i ].tab, { focus: true, user: true } );
			return;
		}
		if ( target < 0 ) {
			return;
		}
		event.preventDefault();
		const tab = pairs[ target ].tab;
		if ( manual ) {
			// Focus moves, selection waits for Enter / Space.
			pairs.forEach( ( pair ) => ( pair.tab.tabIndex = pair.tab === tab || pair.tab.getAttribute( 'aria-selected' ) === 'true' ? 0 : -1 ) );
			focusTab( tab );
		} else {
			select( tab, { focus: true, user: true } );
		}
	} );

	// A tab reached with Tab from outside the list is shown whole too.
	tablist.addEventListener( 'focusin', ( event ) => {
		if ( pairs.some( ( pair ) => pair.tab === event.target ) && ! tablist.contains( event.relatedTarget ) && event.target.scrollIntoView ) {
			event.target.scrollIntoView( { block: 'nearest', inline: 'nearest' } );
		}
	} );

	// In manual mode, Tab out of the list goes back to the selected tab's place.
	tablist.addEventListener( 'focusout', ( event ) => {
		if ( manual && ! tablist.contains( event.relatedTarget ) ) {
			pairs.forEach( ( pair ) => ( pair.tab.tabIndex = pair.tab.getAttribute( 'aria-selected' ) === 'true' ? 0 : -1 ) );
		}
	} );

	const api = { root, select: ( tab ) => select( tab ), hash: !! o.hash, tabs: pairs.map( ( pair ) => pair.tab ) };
	pairs.forEach( ( { tab, panel } ) => {
		owner.set( tab, { instance: api, tab } );
		owner.set( panel, { instance: api, tab } );
	} );
	root.wrbcTabs = api;

	const initial = pairs.find( ( pair ) => pair.tab.getAttribute( 'aria-selected' ) === 'true' ) || pairs[ 0 ];
	select( initial.tab );
	root.classList.add( 'is-ready' );
	return api;
}

/** Selects every tab whose panel holds `element` (outer tab sets first). */
function open( element ) {
	const chain = [];
	for ( let node = element; node; node = node.parentElement ) {
		const hit = owner.get( node );
		if ( hit ) {
			chain.unshift( hit );
		}
	}
	chain.forEach( ( { instance, tab } ) => instance.select( tab ) );
	return chain.length > 0;
}

function fromHash() {
	const hash = window.location.hash;
	if ( ! hash || hash.length < 2 ) {
		return;
	}
	let target;
	try {
		target = document.getElementById( decodeURIComponent( hash.slice( 1 ) ) );
	} catch ( e ) {
		return;
	}
	if ( ! target || ! open( target ) ) {
		return;
	}
	// The target was hidden when the browser tried to scroll to it.
	const behavior = window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches ? 'auto' : 'smooth';
	window.requestAnimationFrame( () => target.scrollIntoView( { block: 'start', behavior } ) );
}

function setupAll( scope ) {
	// Outer sets first, so nested ones register inside visible panels too.
	roots( scope, '[data-wrbc-tabs]' ).forEach( setup );
}

ns( 'tabs', {
	setup: setupAll,
	open,
	select( tabOrId ) {
		const tab = typeof tabOrId === 'string' ? document.getElementById( tabOrId ) : tabOrId;
		const hit = tab && owner.get( tab );
		if ( hit ) {
			hit.instance.select( hit.tab );
		}
	},
} );

ready( () => {
	setupAll( document );
	fromHash();
} );
window.addEventListener( 'hashchange', fromHash );
