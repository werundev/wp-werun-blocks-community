/**
 * Editor-side twin of the providers' validation (includes/forms/providers/):
 * the same patterns, so the sidebar says "not valid" exactly when the page
 * would print nothing. Keep both in step.
 */

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NATIVE_ID = /^[1-9]\d{0,9}$/;

/** Height (px) the iframe / widget providers default to (PHP: Provider::height() fallbacks). */
export const HEIGHTS = { pardot: 600, typeform: 560, jotform: 640, zoho: 640, calendly: 700 };

function urlParts( value, hosts, suffixes = [] ) {
	const v = String( value || '' ).trim();
	if ( ! v || v.length > 500 || /[\s"'<>\\]/.test( v ) ) {
		return null;
	}
	let u;
	try {
		u = new URL( v );
	} catch ( e ) {
		return null;
	}
	if ( u.protocol !== 'https:' || u.username || u.password || u.port ) {
		return null;
	}
	const host = u.hostname.toLowerCase();
	const ok = hosts.includes( host ) || suffixes.some( ( s ) => host.length > s.length && host.endsWith( s ) && /^[a-z0-9.-]+$/.test( host ) );
	return ok ? { host, path: u.pathname, params: u.searchParams } : null;
}

/** Normalises what the editor typed: a pasted URL becomes the id the block stores, where PHP accepts the id alone. */
export function normaliseFormId( provider, value ) {
	const v = String( value || '' ).trim();
	if ( provider === 'typeform' ) {
		const m = v.match( /^https:\/\/[a-z0-9-]+\.typeform\.com\/to\/([A-Za-z0-9]{4,16})(?:[?#].*)?$/ );
		return m ? m[ 1 ] : v;
	}
	if ( provider === 'hubspot' ) {
		const m = v.match( /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i );
		return m ? m[ 0 ].toLowerCase() : v;
	}
	return v;
}

/**
 * Whether a form id is valid for a provider (the part the block controls;
 * Integrations defaults are reported separately).
 *
 * @param {string} provider Provider id.
 * @param {string} value    formId attribute.
 * @param {Object} settings { pardotDomain }.
 */
export function isValidFormId( provider, value, settings = {} ) {
	const v = String( value || '' ).trim();
	switch ( provider ) {
		case 'hubspot':
		case 'dynamics':
			return GUID.test( v );
		case 'marketo':
		case 'activecampaign':
			return /^[1-9]\d{0,8}$/.test( v );
		case 'pardot': {
			const hosts = [ settings.pardotDomain, 'go.pardot.com', 'pi.pardot.com' ].filter( Boolean );
			const p = urlParts( v, hosts );
			return !! p && /^\/l\/\d{1,10}\/\d{4}-\d{2}-\d{2}\/[A-Za-z0-9]{1,20}$/.test( p.path );
		}
		case 'typeform':
			return /^[A-Za-z0-9]{4,16}$/.test( normaliseFormId( 'typeform', v ) );
		case 'jotform':
			return /^\d{8,20}$/.test( v );
		case 'mailchimp': {
			const p = urlParts( v.replace( /&amp;/g, '&' ), [], [ '.list-manage.com' ] );
			return (
				!! p &&
				[ '/subscribe/post', '/subscribe/post-json' ].includes( p.path ) &&
				/^[a-z0-9-]{1,63}(\.us\d{1,3})?\.list-manage\.com$/.test( p.host ) &&
				/^[0-9a-f]{10,40}$/.test( p.params.get( 'u' ) || '' ) &&
				/^[0-9a-f]{6,16}$/.test( p.params.get( 'id' ) || '' )
			);
		}
		case 'zoho': {
			const dcs = [ 'zohopublic.com', 'zohopublic.eu', 'zohopublic.in', 'zohopublic.com.au', 'zohopublic.jp' ];
			const p = urlParts( v, dcs.map( ( d ) => `forms.${ d }` ) );
			const path = p ? p.path : v;
			return /^\/[A-Za-z0-9_.-]{1,64}\/form\/[A-Za-z0-9_-]{1,100}\/formperma\/[A-Za-z0-9_-]{10,100}$/.test( path );
		}
		case 'calendly': {
			const p = urlParts( v, [ 'calendly.com' ] );
			const path = ( p ? p.path.replace( /^\//, '' ) : v ).replace( /\/$/, '' );
			return /^[A-Za-z0-9_-]{1,64}(\/[A-Za-z0-9_-]{1,64})?$/.test( path );
		}
		default:
			return NATIVE_ID.test( v );
	}
}

/** Providers whose embed takes a height (PHP: the providers that call self::height()). */
export const hasHeight = ( provider ) => provider in HEIGHTS;
