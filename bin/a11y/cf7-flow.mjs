#!/usr/bin/env node
/**
 * Submits the stand-in Contact Form 7 forms of fixtures/form.json (form-wp-contact,
 * form-wp-gated) the four ways a visitor can, and prints what happened:
 *   a) JS, valid: CF7's REST answer, the wpcf7 events, the response output;
 *   b) JS, invalid: tips, aria-invalid / aria-describedby, the screen-reader response;
 *   c) JS, gated (hard): the ticket in CF7's hidden fields, wrbc-gate's unlock, the
 *      focused download link, the file, the returning-visitor link;
 *   d) no JS, gated: the native POST and the page that comes back with the link.
 * Run `node audit.mjs --group form --only form-wp-contact,form-wp-gated --list` first (creates the pages).
 *
 *   node cf7-flow.mjs
 */
import { PLUGIN, SITE_URL, chromiumExecutable } from './lib/env.mjs';
if ( '/' === SITE_URL ) {
	console.error( 'Set WRB_SITE_URL to the home URL of the local test site.' );
	process.exit( 1 );
}
const { chromium } = await import( PLUGIN + '/node_modules/playwright/index.mjs' );
const browser = await chromium.launch( { executablePath: chromiumExecutable( chromium.executablePath() ) } );
const base = SITE_URL;
const contact = base + 'wrbc-a11y-form-form-wp-contact-light/';
const gated = base + 'wrbc-a11y-form-form-wp-gated-light/';
const fill = async ( page, name, email ) => {
	await page.fill( 'input[name="your-name"]', name );
	await page.fill( 'input[name="your-email"]', email );
	await page.check( 'input[name="acceptance-1"]' );
};
// a) JS contact: success.
let ctx = await browser.newContext( { ignoreHTTPSErrors: true } );
let page = await ctx.newPage();
await page.goto( contact, { waitUntil: 'networkidle' } );
console.log( 'a) submit disabled before ticking:', await page.$eval( '.wpcf7-submit', ( b ) => b.disabled ) );
await page.evaluate( () => { window.__events = []; [ 'wpcf7submit', 'wpcf7mailsent', 'wpcf7invalid' ].forEach( ( n ) => document.addEventListener( n, ( e ) => window.__events.push( n + ':' + ( e.detail && e.detail.status ) ) ) ); } );
await fill( page, 'Ana García', 'ana@example.com' );
const [ resp ] = await Promise.all( [ page.waitForResponse( ( r ) => r.url().includes( '/contact-form-7/v1/contact-forms/' ) ), page.click( '.wpcf7-submit' ) ] );
console.log( '   REST', resp.status(), JSON.stringify( await resp.json() ) );
await page.waitForSelector( '.wpcf7-form.sent' );
console.log( '   events', await page.evaluate( () => window.__events ), '| output:', await page.textContent( '.wpcf7-response-output' ) );
// b) JS contact: invalid.
await page.goto( contact, { waitUntil: 'networkidle' } );
await page.check( 'input[name="acceptance-1"]' );
await page.fill( 'input[name="your-email"]', 'nope' );
await page.click( '.wpcf7-submit' );
await page.waitForSelector( '.wpcf7-form.invalid' );
console.log( 'b) invalid:', JSON.stringify( await page.evaluate( () => ( {
	tips: Array.from( document.querySelectorAll( '.wpcf7-not-valid-tip' ) ).map( ( t ) => t.textContent ),
	invalid: Array.from( document.querySelectorAll( '[aria-invalid="true"]' ) ).map( ( c ) => c.name + '→' + c.getAttribute( 'aria-describedby' ) ),
	sr: document.querySelector( '.screen-reader-response p' ).textContent,
} ) ) ) );
await ctx.close();
// c) JS gated: unlock through wrbc-gate.
ctx = await browser.newContext( { ignoreHTTPSErrors: true } );
page = await ctx.newPage();
await page.goto( gated, { waitUntil: 'networkidle' } );
console.log( 'c) ticket in form:', await page.$eval( 'form.wpcf7-form', ( f ) => !! f.querySelector( 'input[name="wrbc_gate_ticket"]' ) ) );
await fill( page, 'Bruno Silva', 'bruno@example.com' );
await page.click( '.wpcf7-submit' );
const link = await page.waitForSelector( '.wrbc-gate__download', { timeout: 15000 } ).catch( () => null );
if ( link ) {
	const href = await link.getAttribute( 'href' );
	console.log( '   unlocked:', await page.evaluate( () => document.querySelector( '[data-wrbc-gate]' ).className ), '| link text:', await link.textContent(), '| focused:', await page.evaluate( () => document.activeElement.className ) );
	const dl = await ctx.request.get( href );
	console.log( '   download', dl.status(), dl.headers()[ 'content-type' ], ( await dl.body() ).slice( 0, 8 ).toString() );
	await page.goto( gated, { waitUntil: 'networkidle' } );
	console.log( '   returning visitor sees:', await page.$$eval( '.wrbc-form__download', ( a ) => a.map( ( x ) => x.textContent.trim() ) ) );
} else {
	console.log( '   NOT unlocked:', await page.evaluate( () => document.querySelector( '[data-wrbc-gate-result]' ).textContent ) );
}
await ctx.close();
// d) No-JS gated: native POST, the page comes back with the link.
ctx = await browser.newContext( { ignoreHTTPSErrors: true, javaScriptEnabled: false } );
page = await ctx.newPage();
await page.goto( gated, { waitUntil: 'load' } );
await fill( page, 'Chen Wei', 'chen@example.com' );
await Promise.all( [ page.waitForNavigation( { waitUntil: 'load' } ), page.click( '.wpcf7-submit' ) ] );
console.log( 'd) no-JS after POST:', JSON.stringify( await page.evaluate( () => ( {
	link: Array.from( document.querySelectorAll( '.wrbc-form__download' ) ).map( ( a ) => a.textContent.trim() + ' ' + a.getAttribute( 'href' ).slice( 0, 60 ) ),
	formStatus: ( document.querySelector( 'form.wpcf7-form' ) || {} ).className || 'no form',
} ) ) ) );
await browser.close();
