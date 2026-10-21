/**
 * Shared front-end module wrbc-consent. Contract: docs/shared-modules.md.
 *
 * Decides whether a third-party embed (a map's tiles, a YouTube player, a
 * HubSpot form) may load, per category: maps, video, forms.
 *
 *   none   load right away.
 *   click  each embed shows wrbc_consent_placeholder() first; its button loads
 *          that one embed, and "always allow" remembers the category for
 *          privacy.remember_days (localStorage).
 *   cmp    follow the site's consent banner: WP Consent API, Complianz,
 *          CookieYes, Cookiebot, or a custom one calling
 *          window.wrbcConsent.grant( category ). The placeholder's button still
 *          loads that one embed (an explicit choice), but nothing is
 *          remembered here: the banner stays the source of truth.
 *
 * The site default comes from window.wrbcModules.integrations.privacy; a
 * block overrides it with data-wrbc-consent-mode on the placeholder or on any
 * element around the embed.
 *
 * API (window.wrbc.consent):
 *   has( category, element? )      boolean
 *   request( category, element? )  Promise, resolves once the embed may load
 *                                  (call it again after failed() to retry)
 *   grant( category, remember? )   grants the category (event wrbc:consent)
 *   mode( element? )               'click' | 'cmp' | 'none'
 *   loaded( placeholder, target )  the embed is in: when the visitor's focus
 *                                  was in the placeholder (its button), it
 *                                  moves to `target`, never to <body>
 *   failed( placeholder, message ) the embed could not load: the message in
 *                                  the placeholder's live region, the button
 *                                  usable again
 *   setup( root )                  placeholders that wrap a
 *                                  <template data-wrbc-consent-template>: the
 *                                  template's markup is put in their place
 *                                  once allowed (forms, generic embeds)
 *
 * While it loads, the button is aria-disabled and the placeholder's status
 * ([data-wrbc-consent-status], role="status", printed by
 * wrbc_consent_placeholder() or added here) says "Loading…".
 */
import { __ } from '@wordpress/i18n';
import { ns, options as readOptions, ready, roots } from './lib';

const CATEGORIES = [ 'maps', 'video', 'forms' ];
const STORE = 'wrbc-consent';
const MODES = [ 'click', 'cmp', 'none' ];

/*
 * What each of our categories is called by the consent tools. Embeds that
 * set third-party cookies are "marketing" for all of them (that's how
 * Complianz and Cookiebot classify YouTube, Google Maps or HubSpot).
 */
const CMP_CATEGORY = { maps: 'marketing', video: 'marketing', forms: 'marketing' };
const COOKIEYES_CATEGORY = { marketing: 'advertisement', statistics: 'analytics', preferences: 'functional' };

const privacy = () => ( window.wrbcModules && window.wrbcModules.integrations && window.wrbcModules.integrations.privacy ) || {};
const session = new Set(); // granted by a click, this page view only
const waiting = {}; // category -> [ resolve ]

function cookie( name ) {
	const match = document.cookie.match( new RegExp( '(?:^|;\\s*)' + name.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' ) + '=([^;]*)' ) );
	if ( ! match ) {
		return '';
	}
	try {
		return decodeURIComponent( match[ 1 ] );
	} catch ( e ) {
		return match[ 1 ];
	}
}

/* ── Remembered choices (click mode) ─────────────────────────────────── */

function readStore() {
	try {
		const data = JSON.parse( window.localStorage.getItem( STORE ) || '{}' );
		return data && typeof data === 'object' ? data : {};
	} catch ( e ) {
		return {}; // storage blocked (private mode, sandboxed iframe)
	}
}

function remembered( category ) {
	const until = readStore()[ category ];
	return typeof until === 'number' && until > Date.now();
}

function remember( category ) {
	const days = Math.max( 0, Math.min( 730, Number( privacy().remember_days ?? 180 ) || 0 ) );
	if ( ! days ) {
		return;
	}
	try {
		const data = readStore();
		data[ category ] = Date.now() + days * 86400000;
		window.localStorage.setItem( STORE, JSON.stringify( data ) );
	} catch ( e ) {}
}

/* ── Consent tools (cmp mode) ────────────────────────────────────────── */

function fromCmp( category ) {
	const cat = CMP_CATEGORY[ category ] || 'marketing';

	// WP Consent API: the common interface most banners on WordPress feed.
	if ( typeof window.wp_has_consent === 'function' ) {
		try {
			if ( window.wp_has_consent( cat ) ) {
				return true;
			}
		} catch ( e ) {}
	}
	// Complianz: its own function, or the per-category cookie it sets.
	if ( typeof window.cmplz_has_consent === 'function' ) {
		try {
			if ( window.cmplz_has_consent( cat ) ) {
				return true;
			}
		} catch ( e ) {}
	}
	if ( cookie( 'cmplz_' + cat ) === 'allow' ) {
		return true;
	}
	// CookieYes: "consent:yes,…,advertisement:yes" in one cookie.
	const yes = cookie( 'cookieyes-consent' );
	if ( yes ) {
		const key = COOKIEYES_CATEGORY[ cat ] || cat;
		if ( new RegExp( '(?:^|,)' + key + ':yes(?:,|$)' ).test( yes ) ) {
			return true;
		}
	}
	// Cookiebot
	if ( window.Cookiebot && window.Cookiebot.consent && window.Cookiebot.consent[ cat ] ) {
		return true;
	}
	return false;
}

/* ── API ─────────────────────────────────────────────────────────────── */

function mode( element ) {
	// The override sits on the placeholder, which may be around the element
	// or, for a module root (video, map), inside it.
	const holder =
		element &&
		element.closest &&
		( element.closest( '[data-wrbc-consent-mode]' ) || element.querySelector( '[data-wrbc-consent][data-wrbc-consent-mode]' ) );
	const own = holder && holder.getAttribute( 'data-wrbc-consent-mode' );
	if ( MODES.includes( own ) ) {
		return own;
	}
	return MODES.includes( privacy().consent ) ? privacy().consent : 'click';
}

function has( category, element ) {
	const m = mode( element );
	if ( m === 'none' || session.has( category ) ) {
		return true;
	}
	if ( m === 'cmp' ) {
		return fromCmp( category );
	}
	return remembered( category );
}

function flush( category ) {
	const list = waiting[ category ] || [];
	waiting[ category ] = [];
	list.forEach( ( entry ) => {
		if ( has( category, entry.element ) ) {
			entry.resolve();
		} else {
			waiting[ category ].push( entry ); // e.g. a cmp embed while the site default is click
		}
	} );
}

function grant( category, persist = false ) {
	if ( ! CATEGORIES.includes( category ) ) {
		return;
	}
	session.add( category );
	if ( persist ) {
		remember( category );
	}
	flush( category );
	document.dispatchEvent( new CustomEvent( 'wrbc:consent', { detail: { category, granted: true } } ) );
}

/* ── Placeholder state ───────────────────────────────────────────────── */

const placeholderOf = ( element ) => ( element && element.matches ? ( element.matches( '[data-wrbc-consent]' ) ? element : element.querySelector( '[data-wrbc-consent]' ) ) : null );
const text = ( box, key, fallback ) => {
	const value = readOptions( box, 'data-wrbc-consent-labels' )[ key ];
	return typeof value === 'string' && value ? value : fallback;
};

/** The placeholder's live region, created (empty) before anything is said in it. */
function statusOf( box ) {
	let status = box.querySelector( '[data-wrbc-consent-status]' );
	if ( ! status ) {
		status = document.createElement( 'p' );
		status.className = 'wrbc-consent__status';
		status.setAttribute( 'role', 'status' );
		status.setAttribute( 'data-wrbc-consent-status', '' );
		( box.querySelector( '.wrbc-consent__box' ) || box ).appendChild( status );
	}
	return status;
}

function busy( box, on ) {
	const button = box.querySelector( '[data-wrbc-consent-accept]' );
	box.classList.toggle( 'is-loading', on );
	if ( button ) {
		if ( on ) {
			button.setAttribute( 'aria-disabled', 'true' );
		} else {
			button.removeAttribute( 'aria-disabled' );
		}
	}
}

/** The embed is in place: focus follows the visitor from the placeholder to it. */
function loaded( box, target ) {
	if ( ! box ) {
		return;
	}
	const active = document.activeElement;
	const had = box.contains( active ) || ( box.wrbcHadFocus && ( ! active || active === document.body || ! active.isConnected ) );
	box.wrbcHadFocus = false;
	busy( box, false );
	statusOf( box ).textContent = '';
	if ( had && target && target.isConnected ) {
		if ( ! target.matches( 'a[href], button, input, select, textarea, iframe, [tabindex]' ) ) {
			target.setAttribute( 'tabindex', '-1' );
		}
		target.focus();
	}
}

/** The embed failed: say so in the placeholder, and let the button try again. */
function failed( box, message ) {
	if ( ! box ) {
		return;
	}
	busy( box, false );
	box.wrbcHadFocus = false;
	statusOf( box ).textContent = message || text( box, 'error', __( 'This content could not be loaded. Please try again.', 'werun-blocks-community' ) );
}

function bind( box, category ) {
	const button = box.querySelector( '[data-wrbc-consent-accept]' );
	if ( ! button || button.dataset.wrbcBound ) {
		return;
	}
	button.dataset.wrbcBound = '1';
	statusOf( box );
	button.addEventListener( 'click', () => {
		if ( button.getAttribute( 'aria-disabled' ) === 'true' ) {
			return; // already loading
		}
		box.wrbcHadFocus = box.contains( document.activeElement );
		busy( box, true );
		statusOf( box ).textContent = text( box, 'loading', __( 'Loading…', 'werun-blocks-community' ) );
		const always = box.querySelector( '[data-wrbc-consent-remember]' );
		if ( always && always.checked ) {
			// The cmp mode never prints the checkbox: "always" belongs to the banner there.
			grant( category, true );
		}
		// This click loads what waits on this placeholder (one embed).
		const list = box.wrbcWaiting || [];
		box.wrbcWaiting = [];
		waiting[ category ] = ( waiting[ category ] || [] ).filter( ( item ) => ! list.includes( item ) );
		list.forEach( ( item ) => item.resolve() );
	} );
}

/**
 * Resolves when the embed in `element` may load. When `element` is (or
 * holds) a placeholder, its button resolves this one request; with "always
 * allow" ticked it grants the whole category.
 */
function request( category, element ) {
	return new Promise( ( resolve ) => {
		if ( has( category, element ) ) {
			resolve();
			return;
		}
		const entry = { element, resolve };
		( waiting[ category ] = waiting[ category ] || [] ).push( entry );

		const box = placeholderOf( element );
		if ( ! box || ! box.querySelector( '[data-wrbc-consent-accept]' ) ) {
			return;
		}
		( box.wrbcWaiting = box.wrbcWaiting || [] ).push( entry );
		box.hidden = false;
		bind( box, category );
	} );
}

/** A <template> inside a placeholder becomes the real embed once allowed. */
function setupTemplate( box ) {
	if ( box.dataset.wrbcReady ) {
		return;
	}
	const template = box.querySelector( 'template[data-wrbc-consent-template]' );
	if ( ! template ) {
		return; // another module (map, video, gate) drives this placeholder
	}
	box.dataset.wrbcReady = '1';
	const category = box.getAttribute( 'data-wrbc-consent' );
	request( category, box ).then( () => {
		const fragment = document.importNode( template.content, true );
		// Scripts copied out of a template stay inert; fresh ones run.
		fragment.querySelectorAll( 'script' ).forEach( ( old ) => {
			const script = document.createElement( 'script' );
			Array.from( old.attributes ).forEach( ( attr ) => script.setAttribute( attr.name, attr.value ) );
			script.textContent = old.textContent;
			old.replaceWith( script );
		} );
		const holder = document.createElement( 'div' );
		holder.className = 'wrbc-consent-loaded';
		holder.appendChild( fragment );
		box.replaceWith( holder );
		// The first field or link of the embed, else the embed itself.
		loaded( box, holder.querySelector( 'a[href], button, input:not([type="hidden"]), select, textarea, iframe' ) || holder );
	} );
}

function setup( root ) {
	roots( root, '[data-wrbc-consent]' ).forEach( setupTemplate );
}

/* Re-check waiting embeds whenever a consent tool reports a change. */
function onCmpChange() {
	CATEGORIES.forEach( ( category ) => {
		if ( ( waiting[ category ] || [] ).length ) {
			flush( category );
			if ( fromCmp( category ) ) {
				document.dispatchEvent( new CustomEvent( 'wrbc:consent', { detail: { category, granted: true, source: 'cmp' } } ) );
			}
		}
	} );
}
document.addEventListener( 'wp_listen_for_consent_change', onCmpChange );
[ 'cmplz_status_change', 'cmplz_fire_categories', 'cmplz_enable_category' ].forEach( ( name ) => document.addEventListener( name, onCmpChange ) );
document.addEventListener( 'cookieyes_consent_update', onCmpChange );
[ 'CookiebotOnAccept', 'CookiebotOnConsentReady' ].forEach( ( name ) => window.addEventListener( name, onCmpChange ) );

ns( 'consent', { has, request, grant, mode, loaded, failed, setup, categories: CATEGORIES } );

/*
 * window.wrbcConsent.grant( category ) for a custom banner. A banner that
 * ran before this script can leave window.wrbcConsent = { granted: [ … ] }.
 */
const early = window.wrbcConsent && Array.isArray( window.wrbcConsent.granted ) ? window.wrbcConsent.granted : [];
window.wrbcConsent = {
	grant: ( category ) => grant( category ),
	has: ( category ) => has( category ),
};
early.forEach( ( category ) => grant( category ) );

ready( () => setup( document ) );
