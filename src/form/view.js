/**
 * Form block, front end.
 *
 * - Mounts third-party embeds after consent (wrbc-consent's `wrbc:consent`
 *   event, or the placeholder button): copies the inert <template> in and
 *   loads the provider's script from the https URL render.php built. When
 *   the placeholder's button had the focus, the focus stays where the form
 *   appears (the slot) and screen readers hear when it has loaded; while the
 *   script loads the slot says "Loading the form…", and a script that can't
 *   load says so in text, announced, with "Try again" (WCAG 2.4.3, 4.1.3).
 * - A frame a provider adds without a name (or with "Form 0") gets the
 *   block's title (WCAG 4.1.2).
 * - SaaS embeds: turns the provider's success signal into one event on the
 *   block, `wrbc:form-success` (bubbles; detail { provider }), then shows the
 *   success message (a live region printed empty; the focus goes there when
 *   the form that had it went away) or follows the redirect; a gated block
 *   asks wrbc-gate to unlock (wrbc.gate.unlock() is idempotent, so wrbc-gate
 *   hearing the same event itself does no harm) and offers "Try again" when
 *   unlocking fails. Form plugins are wrbc-gate's job only.
 * - Mailchimp: our own fields are checked here, not by the browser's
 *   bubbles: the error in text under each field, tied with aria-describedby
 *   and aria-invalid, focus on the first one (WCAG 3.3.1, 3.3.3). Then
 *   Mailchimp's JSONP endpoint when the forms consent allows it, so its
 *   answer is read (an address it rejects is marked on the field, "already
 *   subscribed" and other answers go to the form's alert), or else a post
 *   into a hidden frame; the page stays either way.
 */

const scripts = new Map();

/* English fallbacks for markup printed before the labels existed (cached pages). Twin: render.php "labels". */
const TEXT = {
	loading: 'Loading the form…',
	loaded: 'The form has loaded.',
	failed: 'The form could not be loaded. A content blocker or a network problem may be stopping it.',
	retry: 'Try again',
	sending: 'Sending…',
	frame: 'Form',
};

/* What a provider's form is made of: one of these appearing in the mount means it has loaded. */
const FIELDS = 'iframe, form, input, select, textarea, button';

function loadScript( src ) {
	if ( typeof src !== 'string' || ! /^https:\/\/[a-z0-9.-]+\//i.test( src ) ) {
		return Promise.reject( new Error( 'wrbc-form: bad script URL' ) );
	}
	if ( ! scripts.has( src ) ) {
		scripts.set(
			src,
			new Promise( ( resolve, reject ) => {
				const s = document.createElement( 'script' );
				s.src = src;
				s.async = true;
				s.onload = resolve;
				s.onerror = () => {
					// Forgotten, so "Try again" asks for it again.
					scripts.delete( src );
					s.remove();
					reject( new Error( 'wrbc-form: could not load the provider script' ) );
				};
				document.head.appendChild( s );
			} )
		);
	}
	return scripts.get( src );
}

function readJson( el, attr ) {
	try {
		return JSON.parse( el.getAttribute( attr ) || '{}' ) || {};
	} catch {
		return {};
	}
}

/** A translated text from the block's config (render.php), or its English fallback. */
function text( root, key ) {
	const labels = root.wrbcForm && root.wrbcForm.labels;
	return ( labels && typeof labels[ key ] === 'string' && labels[ key ] ) || TEXT[ key ] || '';
}

/** Words for screen readers only, through the block's polite live region. */
function announce( root, words ) {
	const live = root.querySelector( '[data-wrbc-form-live]' );
	if ( ! live || ! words ) {
		return;
	}
	// Emptied first, so the same words twice are announced twice.
	live.textContent = '';
	window.setTimeout( () => {
		live.textContent = words;
	}, 60 );
}

/** Whether the focus is nowhere useful: on <body>, or on something no longer shown (the form that just went away). */
function focusLost() {
	const active = document.activeElement;
	return ! active || active === document.body || active === document.documentElement || active.getClientRects().length === 0;
}

function focusOn( target ) {
	if ( ! target ) {
		return;
	}
	if ( ! target.hasAttribute( 'tabindex' ) ) {
		target.setAttribute( 'tabindex', '-1' );
	}
	target.focus();
}

/** Moves the focus to `target` if it got lost, now or once the provider has swapped its form for its own thanks. */
function keepFocus( target ) {
	if ( ! target ) {
		return;
	}
	if ( focusLost() ) {
		focusOn( target );
		return;
	}
	window.setTimeout( () => focusLost() && focusOn( target ), 400 );
}

/** Success: once per block. */
function succeed( root ) {
	if ( root.wrbcFormDone ) {
		return;
	}
	root.wrbcFormDone = true;
	const cfg = root.wrbcForm;
	root.dispatchEvent( new CustomEvent( 'wrbc:form-success', { bubbles: true, detail: { provider: cfg.provider } } ) );
	if ( cfg.gate ) {
		const gate = root.querySelector( '[data-wrbc-gate]' );
		if ( gate && window.wrbc && window.wrbc.gate && window.wrbc.gate.unlock ) {
			// Where the link appears: wrbc-gate focuses the link itself; until then the focus waits here if the form took it away.
			keepFocus( gate.querySelector( '[data-wrbc-gate-result]' ) );
			window.wrbc.gate.unlock( gate );
		}
		return;
	}
	if ( cfg.redirect ) {
		window.location.assign( cfg.redirect );
		return;
	}
	const msg = root.querySelector( '.wrbc-form__success' );
	if ( msg && cfg.success ) {
		msg.textContent = cfg.success;
		keepFocus( msg );
	}
}

/** Frames a provider adds without a real name ("", "Form 0") get the block's (WCAG 4.1.2). */
function nameFrames( root, scope ) {
	const name = text( root, 'frame' );
	const fix = () =>
		scope.querySelectorAll( 'iframe' ).forEach( ( frame ) => {
			const current = ( frame.getAttribute( 'title' ) || '' ).trim();
			if ( ! frame.hidden && ( ! current || /^(i?frame|form)?\s*\d*$/i.test( current ) ) ) {
				frame.setAttribute( 'title', name );
			}
		} );
	fix();
	if ( 'MutationObserver' in window ) {
		new window.MutationObserver( fix ).observe( scope, { childList: true, subtree: true } );
	}
}

/**
 * "Loading the form…" in the mount while the provider loads. It goes once
 * a field or a frame of the provider's appears (then, when the visitor asked
 * for the form, screen readers hear "The form has loaded."), or 10 s after
 * the provider's script ran.
 */
function showLoading( root, el, asked ) {
	const note = document.createElement( 'p' );
	note.className = 'wrbc-form__loading';
	note.textContent = text( root, 'loading' );
	el.prepend( note );
	const before = new Set( el.querySelectorAll( FIELDS ) );
	let observer = null;
	let timer = 0;
	const stop = () => {
		if ( observer ) {
			observer.disconnect();
		}
		window.clearTimeout( timer );
		note.remove();
	};
	if ( 'MutationObserver' in window ) {
		observer = new window.MutationObserver( () => {
			if ( Array.from( el.querySelectorAll( FIELDS ) ).some( ( node ) => ! before.has( node ) ) ) {
				stop();
				if ( asked ) {
					announce( root, text( root, 'loaded' ) );
				}
			}
		} );
		observer.observe( el, { childList: true, subtree: true } );
	}
	return {
		stop,
		ran: () => {
			timer = window.setTimeout( stop, 10000 );
		},
	};
}

/** The provider's script didn't load: why, in text, announced, and a button to try again. */
function showFailed( root, el ) {
	el.classList.add( 'is-failed' );
	if ( el.querySelector( '.wrbc-form__failed' ) ) {
		return;
	}
	const box = document.createElement( 'div' );
	box.className = 'wrbc-form__failed';
	const message = document.createElement( 'p' );
	message.setAttribute( 'role', 'alert' );
	message.textContent = text( root, 'failed' );
	const retry = document.createElement( 'button' );
	retry.type = 'button';
	retry.className = 'wrbc-btn wrbc-btn--outline wrbc-form__retry';
	retry.textContent = text( root, 'retry' );
	retry.addEventListener( 'click', () => {
		box.remove();
		el.classList.remove( 'is-failed' );
		mountOne( root, el, true );
		// The button went away: the focus waits on the slot (which now says "Loading…"), as after the consent button.
		focusOn( root.querySelector( '.wrbc-form__slot' ) );
	} );
	box.append( message, retry );
	el.prepend( box );
}

let typeformHooked = false;

function mountOne( root, el, asked ) {
	const cfg = readJson( el, 'data-wrbc-form-mount' );
	const loading = showLoading( root, el, asked );
	const fail = () => {
		loading.stop();
		showFailed( root, el );
	};
	switch ( cfg.type ) {
		case 'hubspot-v2': {
			const id = `${ root.id }-hs`;
			const old = document.getElementById( id );
			if ( old ) {
				old.remove(); // a previous attempt's
			}
			const target = document.createElement( 'div' );
			target.id = id;
			el.appendChild( target );
			loadScript( cfg.src )
				.then( () =>
					window.hbspt.forms.create( {
						region: cfg.region,
						portalId: cfg.portal,
						formId: cfg.form,
						target: `#${ target.id }`,
						onFormSubmitted: () => succeed( root ),
					} )
				)
				.then( loading.ran )
				.catch( fail );
			break;
		}
		case 'marketo':
			loadScript( cfg.src )
				.then( () =>
					window.MktoForms2.loadForm( cfg.base, cfg.munchkin, cfg.form, ( form ) => {
						form.onSuccess( () => {
							succeed( root );
							// Stay on the page when we handle what comes next.
							return ! ( root.wrbcForm.gate || root.wrbcForm.redirect || root.wrbcForm.success );
						} );
					} )
				)
				.then( loading.ran )
				.catch( fail );
			break;
		case 'typeform':
			if ( ! typeformHooked ) {
				typeformHooked = true;
				// data-tf-on-submit names a global function; it gets { formId }.
				window.wrbcFormTypeformSubmit = ( data ) => {
					document.querySelectorAll( '.wrbc-form [data-tf-widget]' ).forEach( ( w ) => {
						if ( ! data || w.getAttribute( 'data-tf-widget' ) === data.formId ) {
							succeed( w.closest( '.wrbc-form' ) );
						}
					} );
				};
			}
			loadScript( cfg.src )
				.then( () => window.tf && window.tf.load && window.tf.load() )
				.then( loading.ran )
				.catch( fail );
			break;
		case 'calendly':
			loadScript( cfg.src )
				.then( () =>
					window.Calendly.initInlineWidget( {
						url: cfg.url,
						parentElement: el.querySelector( '.wrbc-form__calendly' ),
					} )
				)
				.then( loading.ran )
				.catch( fail );
			break;
		case 'script':
			loadScript( cfg.src ).then( loading.ran ).catch( fail );
			break;
		default:
			loading.stop();
	}
}

function mount( root ) {
	if ( root.wrbcFormMounted ) {
		return;
	}
	root.wrbcFormMounted = true;
	const slot = root.querySelector( '.wrbc-form__slot' );
	const tpl = slot && slot.querySelector( 'template.wrbc-form__tpl' );
	// The placeholder's button was pressed and is about to go: the focus stays where the form appears.
	const asked = !! slot && slot.contains( document.activeElement );
	if ( tpl ) {
		slot.replaceChildren( tpl.content.cloneNode( true ) );
	}
	if ( slot ) {
		nameFrames( root, slot );
	}
	root.querySelectorAll( '[data-wrbc-form-mount]' ).forEach( ( el ) => mountOne( root, el, asked ) );
	root.classList.add( 'is-loaded' );
	if ( asked ) {
		// After the mounts: the slot read on focus already says "Loading the form…".
		focusOn( slot );
		// Frames (Pardot, Jotform, Zoho) have no mount: their own load says it.
		slot.querySelectorAll( ':scope > iframe' ).forEach( ( frame ) =>
			frame.addEventListener( 'load', () => announce( root, text( root, 'loaded' ) ), { once: true } )
		);
	}
}

/** postMessage from the provider's iframe, origin checked against the block's hosts. */
function onMessage( roots, e ) {
	roots.forEach( ( root ) => {
		const cfg = root.wrbcForm;
		if ( ! cfg.origins.includes( e.origin ) ) {
			return;
		}
		const frame = Array.from( root.querySelectorAll( 'iframe' ) ).find( ( f ) => f.contentWindow === e.source );
		if ( ! frame ) {
			return;
		}
		const data = e.data;
		if ( cfg.provider === 'jotform' && typeof data === 'string' ) {
			const h = data.match( /^setHeight:(\d+)/ );
			if ( h ) {
				frame.style.height = `${ Math.min( 4000, Number( h[ 1 ] ) ) }px`;
			}
		}
		const name = cfg.event.slice( 'message:'.length );
		const type = typeof data === 'string' ? data : data && ( data.event || data.action || data.type );
		if ( type === name ) {
			succeed( root );
		}
	} );
}

function listen( root ) {
	const cfg = root.wrbcForm;
	const [ channel, name ] = cfg.event.split( /:(.*)/s );
	if ( channel === 'dom' ) {
		// On the block (bubbling) or on document (Dynamics fires there).
		const handler = ( e ) => {
			if ( e.target === document || e.target === window || root.contains( e.target ) ) {
				succeed( root );
			}
		};
		document.addEventListener( name, handler );
	} else if ( cfg.provider === 'hubspot' ) {
		// The new hs-form-frame embed reports on window; the v2 embed uses its onFormSubmitted callback.
		window.addEventListener( 'hs-form-event:on-submission:success', ( e ) => {
			const id = e.detail && e.detail.formId;
			if ( root.querySelector( `.hs-form-frame[data-form-id="${ String( id ).replace( /[^0-9a-f-]/gi, '' ) }"]` ) ) {
				succeed( root );
			}
		} );
	}
}

/** Shows (or clears, with '') the error of one of our own fields: under its label, tied with aria-describedby, and aria-invalid. */
function setError( input, message ) {
	const box = input.id ? document.getElementById( `${ input.id }-error` ) : null;
	const ids = ( input.getAttribute( 'aria-describedby' ) || '' ).split( /\s+/ ).filter( ( id ) => id && ( ! box || id !== box.id ) );
	if ( message ) {
		input.setAttribute( 'aria-invalid', 'true' );
		if ( box ) {
			box.textContent = message;
			ids.push( box.id );
		}
	} else {
		input.removeAttribute( 'aria-invalid' );
		if ( box ) {
			box.textContent = '';
		}
	}
	if ( ids.length ) {
		input.setAttribute( 'aria-describedby', ids.join( ' ' ) );
	} else {
		input.removeAttribute( 'aria-describedby' );
	}
}

/**
 * One of our own fields checked in the browser: its error ('' when it's
 * fine), shown. The texts come from the field's data-wrbc-missing /
 * data-wrbc-invalid (class-mailchimp.php).
 */
function check( input ) {
	const v = input.validity;
	let message = '';
	if ( v && ! v.valid ) {
		message = ( v.valueMissing ? input.getAttribute( 'data-wrbc-missing' ) : input.getAttribute( 'data-wrbc-invalid' ) ) || input.validationMessage;
	}
	setError( input, message );
	return message;
}

/* The hosts class-mailchimp.php accepts; checked again before a script is loaded from one. */
const MC_HOST = /^[a-z0-9-]{1,63}(\.us\d{1,3})?\.list-manage\.com$/;
let mcCalls = 0;

/**
 * Whether Mailchimp's JSONP endpoint may answer: a script from
 * list-manage.com loads, so it follows the forms consent like an embed —
 * mode "none", the forms category already allowed (remembered, the site's
 * banner), or in "click" mode the visitor's own press on the form's button
 * (it sends the address to Mailchimp either way). Otherwise, and without
 * wrbc-consent, the hidden frame.
 */
function mcJsonpAllowed( root ) {
	const consent = window.wrbc && window.wrbc.consent;
	if ( ! consent || typeof consent.mode !== 'function' ) {
		return false;
	}
	const mode = consent.mode( root );
	return mode === 'none' || mode === 'click' || ( typeof consent.has === 'function' && consent.has( 'forms', root ) );
}

/**
 * Sends the form to Mailchimp's JSONP endpoint (post-json on the same
 * validated host) and hands its answer to `done` (null: no answer within
 * 15 s, or the script failed). False when the action isn't a Mailchimp URL.
 */
function mcJsonp( form, done ) {
	let url;
	try {
		url = new URL( form.getAttribute( 'action' ) || '' );
	} catch {
		return false;
	}
	if ( url.protocol !== 'https:' || url.username || url.password || url.port || ! MC_HOST.test( url.hostname ) || url.pathname !== '/subscribe/post' ) {
		return false;
	}
	url.pathname = '/subscribe/post-json';
	new window.FormData( form ).forEach( ( value, key ) => {
		if ( typeof value === 'string' ) {
			url.searchParams.set( key, value );
		}
	} );
	const name = `wrbcMailchimp${ ++mcCalls }x${ Date.now() }`;
	url.searchParams.set( 'c', name );
	const script = document.createElement( 'script' );
	let timer = 0;
	const finish = ( data ) => {
		window.clearTimeout( timer );
		window[ name ] = () => {}; // a late answer finds nothing to do
		script.remove();
		done( data );
	};
	window[ name ] = ( data ) => finish( data && typeof data === 'object' ? data : { result: 'error', msg: '' } );
	script.src = url.href;
	script.async = true;
	script.onerror = () => finish( null );
	timer = window.setTimeout( () => finish( null ), 15000 );
	document.head.appendChild( script );
	return true;
}

/** Mailchimp's message as plain text: tags stripped, entities decoded (an inert parsed document, read through textContent). */
function plainText( value ) {
	const html = typeof value === 'string' ? value : '';
	try {
		return ( new window.DOMParser().parseFromString( html, 'text/html' ).body.textContent || '' ).replace( /\s+/g, ' ' ).trim();
	} catch {
		return html.replace( /<[^>]*>/g, ' ' ).replace( /\s+/g, ' ' ).trim();
	}
}

/**
 * Mailchimp: our fields checked here; then Mailchimp's JSONP endpoint when
 * the consent allows it (its answer read: a rejected address is shown as
 * an error, WCAG 3.3.1), else a post into a hidden frame whose load only
 * says that Mailchimp answered.
 */
function mailchimp( root ) {
	root.querySelectorAll( 'form[data-wrbc-mc]' ).forEach( ( form ) => {
		const messages = readJson( form, 'data-wrbc-mc' );
		const say = form.querySelector( '.wrbc-form__mc-message' );
		const frame = document.createElement( 'iframe' );
		frame.name = `${ root.id }-mc`;
		frame.hidden = true;
		frame.title = 'Mailchimp';
		frame.setAttribute( 'aria-hidden', 'true' );
		frame.tabIndex = -1;
		form.after( frame );
		form.target = frame.name;
		// Our messages, not the browser's bubbles (they vanish, and zoom and screen readers handle them badly). Without JS the browser's stay.
		form.noValidate = true;
		const button = form.querySelector( '[type=submit]' );
		let sent = false;
		let timer = 0;
		const release = () => {
			sent = false;
			window.clearTimeout( timer );
			if ( button ) {
				button.removeAttribute( 'aria-disabled' );
			}
		};
		const sentOk = () => {
			window.clearTimeout( timer );
			form.hidden = true;
			form.dispatchEvent( new CustomEvent( 'wrbc:mailchimp-sent', { bubbles: true } ) );
		};
		// A message about the whole form, in its alert (the focus stays on the button).
		const show = ( message, error ) => {
			if ( say ) {
				say.textContent = message;
				say.classList.toggle( 'is-error', !! error );
			}
		};
		// Mailchimp's answer: "0 - …" is about the address, "1 - …" the first name (its numbering).
		const reply = ( data ) => {
			if ( data && data.result === 'success' ) {
				sentOk();
				return;
			}
			const msg = plainText( data && data.msg );
			const numbered = msg.match( /^(\d+)\s*-\s*(.*)$/ );
			const index = numbered ? Number( numbered[ 1 ] ) : -1;
			const words = numbered ? numbered[ 2 ] : msg;
			if ( /already subscribed/i.test( words ) ) {
				if ( root.wrbcForm && root.wrbcForm.gate ) {
					sentOk(); // a known subscriber still gets the file
					return;
				}
				release();
				show( messages.already || words, false );
				return;
			}
			release();
			if ( ! data ) {
				show( messages.failed || '', true );
				return;
			}
			if ( /too many/i.test( words ) ) {
				show( messages.limit || words, true );
				return;
			}
			const email = form.querySelector( 'input[name="EMAIL"]' );
			const fname = form.querySelector( 'input[name="FNAME"]' );
			let field = null;
			let error = '';
			if ( index === 1 && fname ) {
				field = fname;
				error = fname.getAttribute( 'data-wrbc-missing' ) || words;
			} else if ( email && ( index === 0 || /e-?mail|address|domain portion|username portion|single @|looks fake|invalid/i.test( words ) ) ) {
				field = email;
				error = /enter a value/i.test( words ) ? email.getAttribute( 'data-wrbc-missing' ) : email.getAttribute( 'data-wrbc-invalid' );
			}
			if ( field ) {
				setError( field, error || words );
				field.focus(); // its label and error are read
				return;
			}
			show( words || messages.failed || '', true );
		};
		// A field shown as wrong is checked again as it is corrected.
		form.addEventListener( 'input', ( e ) => {
			if ( e.target.getAttribute && e.target.getAttribute( 'aria-invalid' ) === 'true' ) {
				check( e.target );
			}
		} );
		form.addEventListener( 'submit', ( e ) => {
			if ( sent ) {
				e.preventDefault(); // once per submission
				return;
			}
			show( '', false );
			let first = null;
			let message = '';
			form.querySelectorAll( '.wrbc-form__input' ).forEach( ( input ) => {
				const error = check( input );
				if ( error && ! first ) {
					first = input;
					message = error;
				}
			} );
			if ( first ) {
				e.preventDefault();
				if ( document.activeElement === first ) {
					announce( root, message ); // focus can't move to it: say it
				} else {
					first.focus(); // its label and error are read
				}
				return;
			}
			sent = true;
			if ( button ) {
				button.setAttribute( 'aria-disabled', 'true' );
			}
			announce( root, text( root, 'sending' ) );
			if ( mcJsonpAllowed( root ) && mcJsonp( form, reply ) ) {
				e.preventDefault();
				return;
			}
			// The hidden frame. No answer within 20 s: the button works again.
			timer = window.setTimeout( release, 20000 );
		} );
		frame.addEventListener( 'load', () => {
			if ( sent ) {
				sentOk();
			}
		} );
	} );
}

/** wrbc-gate couldn't unlock (network, too many attempts): a button to ask again, under its message. */
function gateRetry( root ) {
	const gate = root.querySelector( '[data-wrbc-gate]' );
	if ( ! gate ) {
		return;
	}
	gate.addEventListener( 'wrbc:gate-error', () => {
		const box = gate.querySelector( '[data-wrbc-gate-result]' );
		if ( ! box || box.querySelector( '.wrbc-form__retry' ) || ! window.wrbc || ! window.wrbc.gate ) {
			return;
		}
		const retry = document.createElement( 'button' );
		retry.type = 'button';
		retry.className = 'wrbc-btn wrbc-btn--outline wrbc-form__retry';
		retry.textContent = text( root, 'retry' );
		retry.addEventListener( 'click', () => {
			focusOn( box ); // wrbc-gate empties the box (and this button) as it starts again
			window.wrbc.gate.unlock( gate );
		} );
		box.appendChild( retry );
	} );
}

function setup( root ) {
	if ( root.wrbcForm ) {
		return;
	}
	const cfg = readJson( root, 'data-wrbc-form' );
	cfg.origins = Array.isArray( cfg.origins ) ? cfg.origins : [];
	cfg.event = typeof cfg.event === 'string' ? cfg.event : '';
	cfg.labels = cfg.labels && typeof cfg.labels === 'object' ? cfg.labels : {};
	root.wrbcForm = cfg;

	if ( cfg.event ) {
		listen( root );
	}
	mailchimp( root );
	gateRetry( root );

	const consent = window.wrbc && window.wrbc.consent;
	const box = root.querySelector( '.wrbc-form__slot [data-wrbc-consent]' );
	if ( cfg.consent === 'none' || ! root.querySelector( 'template.wrbc-form__tpl' ) ) {
		mount( root );
	} else if ( consent && typeof consent.request === 'function' ) {
		// Resolves at once when allowed (remembered, CMP), or on the placeholder's button.
		consent.request( 'forms', box || root ).then( () => mount( root ) );
	} else {
		// wrbc-consent missing: the placeholder (printed hidden until a script takes it) shows, and its button loads this one form.
		if ( box ) {
			box.hidden = false;
		}
		root.querySelectorAll( '[data-wrbc-form-load], [data-wrbc-consent-accept]' ).forEach( ( button ) => button.addEventListener( 'click', () => mount( root ) ) );
	}
}

function init() {
	const roots = Array.from( document.querySelectorAll( '.wrbc-form[data-wrbc-form]' ) );
	roots.forEach( setup );
	if ( roots.some( ( r ) => r.wrbcForm.event.startsWith( 'message:' ) ) ) {
		window.addEventListener( 'message', ( e ) => onMessage( roots.filter( ( r ) => r.wrbcForm.event.startsWith( 'message:' ) ), e ) );
	}
}

window.wrbc = window.wrbc || {};
window.wrbc.form = { setup, mount };

if ( document.readyState === 'loading' ) {
	document.addEventListener( 'DOMContentLoaded', init );
} else {
	init();
}
