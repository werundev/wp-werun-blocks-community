/**
 * Shared front-end module wrbc-gate. Contract: docs/shared-modules.md.
 *
 *   <div data-wrbc-gate='{"ticket":"<signed>","mode":"hard|soft","provider":"hubspot|…","formId":"…",
 *        "labels":{"download":"Download","unlocking":"Preparing your download…","error":"…","ready":"Your download is ready."}}'>
 *     <!-- the form: a native WordPress form, or a provider's embed -->
 *     <div data-wrbc-gate-result></div>   (optional: where the link goes)
 *     <button data-wrbc-gate-skip>…</button> (optional, soft mode)
 *   </div>
 *
 * 1. Native WordPress forms inside the root (Gravity Forms, WPForms,
 *    Contact Form 7, Fluent Forms, Formidable, any plain <form>) get a hidden
 *    wrbc_gate_ticket field, re-added when the plugin re-renders the form;
 *    Ninja Forms gets it in the submission's "extra" data. The server side
 *    (includes/gate/) ties the submission to the ticket.
 * 2. On the form's success event, POST wrbc/v1/gate/unlock { ticket }:
 *      Gravity gform_confirmation_loaded · WPForms wpformsAjaxSubmitSuccess ·
 *      CF7 wpcf7mailsent · Fluent fluentform_submission_success ·
 *      Ninja submit:response · Formidable frmFormComplete ·
 *      HubSpot hsFormCallback / hs-form-event:on-submission:success ·
 *      Marketo MktoForms2 onSuccess · Typeform form-submit ·
 *      Jotform submission-completed · Calendly calendly.event_scheduled ·
 *      Dynamics 365 d365mkt-afterformsubmit.
 *    postMessage events count only from the provider's origin and, when
 *    the root holds iframes, only from one of them.
 * 3. The answer { url } becomes a download link (textContent, http(s) only),
 *    focused and announced; an error shows its message. The result box is a
 *    polite live region from setup on (role="status" before anything is
 *    said in it, so screen readers announce "Preparing…", "ready", errors);
 *    once the link is there, the skip button ("Get the file") goes away.
 *
 * API: window.wrbc.gate.setup( root ), .unlock( root ).
 * Events on the root: wrbc:gate-unlocked { url }, wrbc:gate-error { message }.
 */
import { __ } from '@wordpress/i18n';
import { el, ns, options as readOptions, ready, roots, safeUrl } from './lib';

const FIELD = 'wrbc_gate_ticket';
const gates = new Set();
const ORIGINS = {
	hubspot: /^https:\/\/([a-z0-9-]+\.)*(hubspot\.com|hsforms\.com|hsforms\.net|hs-sites\.com)$/,
	typeform: /^https:\/\/([a-z0-9-]+\.)*typeform\.com$/,
	jotform: /^https:\/\/([a-z0-9-]+\.)*jotform\.(com|eu)$/,
	calendly: /^https:\/\/([a-z0-9-]+\.)*calendly\.com$/,
};

const label = ( o, key, fallback ) => ( o.labels && typeof o.labels[ key ] === 'string' && o.labels[ key ] ) || fallback;
const jq = () => window.jQuery || null;

/* ── 1. The ticket in native forms ───────────────────────────────────── */

/** Whether a form posts to this site: the ticket never goes to a third party (Mailchimp, …). */
function isLocal( form ) {
	try {
		// The attribute, not form.action: an <input name="action"> would shadow the property (DOM clobbering).
		return new URL( form.getAttribute( 'action' ) || window.location.href, window.location.href ).origin === window.location.origin;
	} catch ( e ) {
		return false;
	}
}

function addTicket( form, ticket ) {
	let input = form.querySelector( `input[name="${ FIELD }"]` );
	if ( ! input ) {
		input = document.createElement( 'input' );
		input.type = 'hidden';
		input.name = FIELD;
		form.appendChild( input );
	}
	input.value = ticket;
}

function watchForms( gate ) {
	const { root, o } = gate;
	const apply = () => root.querySelectorAll( 'form' ).forEach( ( form ) => isLocal( form ) && addTicket( form, o.ticket ) );
	apply();
	// Gravity / Fluent / Formidable re-render the form after a failed AJAX
	// validation, and consent placeholders insert forms later.
	if ( 'MutationObserver' in window ) {
		new MutationObserver( apply ).observe( root, { childList: true, subtree: true } );
	}
	// Last chance, before any plugin serialises the form.
	root.addEventListener( 'submit', ( event ) => event.target.tagName === 'FORM' && isLocal( event.target ) && addTicket( event.target, o.ticket ), true );
}

/* ── 2. Success events ───────────────────────────────────────────────── */

/** The gates a provider event may belong to. */
function candidates( provider, formId, test ) {
	return Array.from( gates ).filter( ( gate ) => {
		// A provider's event only counts for gates of that provider; the
		// native form events (provider '') for any gate holding the form.
		if ( gate.done || ( provider && gate.o.provider !== provider ) ) {
			return false;
		}
		if ( formId && gate.o.formId && String( gate.o.formId ) !== String( formId ) ) {
			return false;
		}
		return ! test || test( gate );
	} );
}

const holds = ( gate, node ) => !! node && gate.root.contains( node );

function listenNative() {
	// Contact Form 7: a DOM event that bubbles from the form's wrapper.
	document.addEventListener( 'wpcf7mailsent', ( event ) => candidates( '', '', ( g ) => holds( g, event.target ) ).forEach( unlockGate ) );

	// Dynamics 365 Marketing: on document, detail.successful.
	document.addEventListener( 'd365mkt-afterformsubmit', ( event ) => {
		if ( event.detail && event.detail.successful === false ) {
			return;
		}
		const form = event.target && event.target.nodeType === 1 ? event.target : null;
		candidates( 'dynamics', '', ( g ) => ! form || form === document.documentElement || holds( g, form ) ).forEach( unlockGate );
	} );

	// HubSpot, new embed (v4): a window event.
	window.addEventListener( 'hs-form-event:on-submission:success', ( event ) => {
		const id = event.detail && event.detail.formId;
		candidates( 'hubspot', id ).forEach( unlockGate );
	} );

	// The plugins that trigger jQuery events (not seen by addEventListener).
	const $ = jq();
	if ( $ ) {
		$( document ).on( 'gform_confirmation_loaded', ( event, formId ) =>
			candidates( '', '', ( g ) => holds( g, document.getElementById( 'gform_confirmation_wrapper_' + formId ) ) || g.gravity.has( String( formId ) ) ).forEach( unlockGate )
		);
		$( document ).on( 'wpformsAjaxSubmitSuccess', ( event ) => candidates( '', '', ( g ) => holds( g, event.target ) ).forEach( unlockGate ) );
		$( document ).on( 'fluentform_submission_success', ( event ) => candidates( '', '', ( g ) => holds( g, event.target ) ).forEach( unlockGate ) );
		$( document ).on( 'frmFormComplete', ( event, form ) => candidates( '', '', ( g ) => holds( g, form && ( form.jquery ? form[ 0 ] : form ) ) ).forEach( unlockGate ) );
	}

	// Ninja Forms: Backbone.Radio, once its front end has started.
	const ninja = () => {
		if ( ! window.nfRadio || ninja.done ) {
			return;
		}
		ninja.done = true;
		const channel = window.nfRadio.channel( 'forms' );
		channel.on( 'before:submit', ( model ) => {
			const gate = candidates( '', '', ( g ) => holds( g, document.getElementById( 'nf-form-' + model.get( 'id' ) + '-cont' ) ) )[ 0 ];
			if ( gate ) {
				model.set( 'extra', Object.assign( {}, model.get( 'extra' ) || {}, { [ FIELD ]: gate.o.ticket } ) );
			}
		} );
		channel.on( 'submit:response', ( response, status, xhr, formId ) => {
			if ( response && response.errors && Object.keys( response.errors ).length ) {
				return;
			}
			candidates( '', '', ( g ) => holds( g, document.getElementById( 'nf-form-' + formId + '-cont' ) ) ).forEach( unlockGate );
		} );
	};
	ninja();
	document.addEventListener( 'nfFormReady', ninja );
	if ( $ ) {
		$( document ).on( 'nfFormReady', ninja );
	}

	// Marketo: whenReady fires for every form already loaded and later ones.
	const marketo = () => {
		if ( ! window.MktoForms2 || marketo.done ) {
			return;
		}
		marketo.done = true;
		window.MktoForms2.whenReady( ( form ) => {
			const id = form.getId();
			form.onSuccess( () => {
				const list = candidates( 'marketo', id, ( g ) => holds( g, document.getElementById( 'mktoForm_' + id ) ) || !! g.o.formId );
				list.forEach( unlockGate );
				// Stay on the page to show the download, unless no gate claimed the form.
				return list.length ? false : undefined;
			} );
		} );
	};
	marketo();
	window.addEventListener( 'load', marketo );

	// postMessage: HubSpot (classic embed), Typeform, Jotform, Calendly.
	window.addEventListener( 'message', ( event ) => {
		const data = event.data;
		if ( ! data ) {
			return;
		}
		// Classic HubSpot embeds post from the page itself (or their iframe).
		if ( data.type === 'hsFormCallback' && data.eventName === 'onFormSubmitted' ) {
			if ( event.origin === window.location.origin || ORIGINS.hubspot.test( event.origin ) ) {
				candidates( 'hubspot', data.id ).forEach( unlockGate );
			}
			return;
		}
		let provider = '';
		if ( ORIGINS.typeform.test( event.origin ) && data.type === 'form-submit' ) {
			provider = 'typeform';
		} else if ( ORIGINS.jotform.test( event.origin ) && ( data.action === 'submission-completed' || ( typeof data === 'string' && data.indexOf( 'submission-completed' ) === 0 ) ) ) {
			provider = 'jotform';
		} else if ( ORIGINS.calendly.test( event.origin ) && data.event === 'calendly.event_scheduled' ) {
			provider = 'calendly';
		}
		if ( ! provider ) {
			return;
		}
		// Only the gate whose iframe sent it (when the gate has iframes).
		candidates( provider, '', ( g ) => {
			const frames = Array.from( g.root.querySelectorAll( 'iframe' ) );
			return ! frames.length || frames.some( ( frame ) => frame.contentWindow === event.source );
		} ).forEach( unlockGate );
	} );
}

/* ── 3. Unlock ───────────────────────────────────────────────────────── */

/* An inline root (a <span> in a card) gets inline parts: no <div> or <p> inside a span. */
const inline = ( root ) => root.tagName === 'SPAN';

function result( gate ) {
	let box = gate.root.querySelector( '[data-wrbc-gate-result]' );
	if ( ! box ) {
		box = el( inline( gate.root ) ? 'span' : 'div', 'wrbc-gate__result' );
		box.setAttribute( 'data-wrbc-gate-result', '' );
		gate.root.appendChild( box );
	}
	if ( ! box.hasAttribute( 'role' ) ) {
		box.setAttribute( 'role', 'status' );
	}
	return box;
}

function unlockGate( gate ) {
	if ( gate.done || gate.busy ) {
		return;
	}
	gate.busy = true;
	const { root, o } = gate;
	const box = result( gate );
	box.textContent = label( o, 'unlocking', __( 'Preparing your download…', 'werun-blocks-community' ) );
	root.classList.add( 'is-unlocking' );
	const rest = ( window.wrbcModules && window.wrbcModules.rest ) || '/wp-json/wrbc/v1/';

	window
		.fetch( rest + 'gate/unlock', {
			method: 'POST',
			credentials: 'same-origin',
			headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
			body: JSON.stringify( { ticket: o.ticket } ),
		} )
		.then( ( response ) => response.json().then( ( data ) => ( { ok: response.ok, data } ), () => ( { ok: false, data: {} } ) ) )
		.then( ( { ok, data } ) => {
			const url = ok && data && safeUrl( data.url );
			if ( ! url ) {
				throw new Error( ( data && typeof data.message === 'string' && data.message ) || '' );
			}
			gate.done = true;
			box.textContent = '';
			if ( o.labels && o.labels.ready ) {
				box.appendChild( el( inline( root ) ? 'span' : 'p', 'wrbc-gate__ready', o.labels.ready ) );
			}
			const link = el( 'a', 'wrbc-btn wrbc-gate__download', typeof data.label === 'string' && data.label ? data.label : label( o, 'download', __( 'Download', 'werun-blocks-community' ) ) );
			link.href = url;
			box.appendChild( link );
			root.classList.remove( 'is-error' );
			root.classList.add( 'is-unlocked' );
			link.focus();
			// The link replaces "Get the file" (focus is already on the link).
			root.querySelectorAll( '[data-wrbc-gate-skip]' ).forEach( ( button ) => ( button.hidden = true ) );
			root.dispatchEvent( new CustomEvent( 'wrbc:gate-unlocked', { detail: { url } } ) );
		} )
		.catch( ( error ) => {
			const message = ( error && error.message ) || label( o, 'error', __( 'The download could not be unlocked. Please try again.', 'werun-blocks-community' ) );
			box.textContent = '';
			box.appendChild( el( inline( root ) ? 'span' : 'p', 'wrbc-gate__error', message ) );
			root.classList.add( 'is-error' );
			root.dispatchEvent( new CustomEvent( 'wrbc:gate-error', { detail: { message } } ) );
		} )
		.finally( () => {
			gate.busy = false;
			root.classList.remove( 'is-unlocking' );
		} );
}

/* ── Setup ───────────────────────────────────────────────────────────── */

let listening = false;

function setup( root ) {
	if ( root.wrbcGate ) {
		return root.wrbcGate;
	}
	const o = readOptions( root, 'data-wrbc-gate' );
	if ( typeof o.ticket !== 'string' || ! o.ticket ) {
		return null;
	}
	o.provider = typeof o.provider === 'string' ? o.provider.toLowerCase() : '';
	// The native WordPress form plugins are all "native" here: the event tells them apart.
	if ( [ 'native', 'gravity', 'gravityforms', 'wpforms', 'cf7', 'contact-form-7', 'fluent', 'fluentforms', 'ninja', 'ninjaforms', 'formidable' ].includes( o.provider ) ) {
		o.provider = '';
	}
	const gate = { root, o, done: false, busy: false, gravity: new Set() };
	root.querySelectorAll( 'form[id^="gform_"]' ).forEach( ( form ) => gate.gravity.add( form.id.replace( 'gform_', '' ) ) );
	root.wrbcGate = gate;
	gates.add( gate );
	// The live region exists before anything is said in it.
	result( gate );
	watchForms( gate );
	root.querySelectorAll( '[data-wrbc-gate-skip]' ).forEach( ( button ) => {
		if ( o.mode === 'soft' ) {
			button.hidden = false;
			button.addEventListener( 'click', () => unlockGate( gate ) );
		} else {
			button.hidden = true;
		}
	} );
	if ( ! listening ) {
		listening = true;
		listenNative();
	}
	root.classList.add( 'is-ready' );
	return gate;
}

function setupAll( scope ) {
	roots( scope, '[data-wrbc-gate]' ).forEach( setup );
}

ns( 'gate', {
	setup: setupAll,
	unlock: ( root ) => {
		const gate = root && ( root.wrbcGate || setup( root ) );
		if ( gate ) {
			unlockGate( gate );
		}
	},
} );

ready( () => setupAll( document ) );
