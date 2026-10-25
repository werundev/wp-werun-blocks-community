#!/usr/bin/env node
/**
 * werun.Blocks.Community WCAG 2.2 AA audit harness.
 *
 *   node audit.mjs --group cta [--only a,b] [--contexts light,dark] [--widths 1280,375]
 *                  [--screenshots] [--editor] [--concurrency 4] [--skip motion,focus,…]
 *                  [--motion-wait 6500] [--fresh] [--list]
 *
 * Reads fixtures/<group>.json, creates/updates one page per fixture × context
 * (WP-CLI, bridge.php), audits every page × width in headless Chromium and
 * writes reports/<group>/summary.md + results.json (+ aria/, shots/).
 * Exit code 0 even when issues are found (2 on a usage or setup error).
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, openSync, readSync, closeSync, unlinkSync } from 'fs';
import { join } from 'path';
import { execFileSync } from 'child_process';
import { HARNESS, WP_ROOT, PLUGIN, PHP_IGNORE, chromiumExecutable } from './lib/env.mjs';
import { openPage, consoleIssues, axeChecks, structure, targetSize, nonText, pseudoText, textSpacing, focusWalk, reflow, motion, editor } from './lib/checks.mjs';
import { writeReports, counts } from './lib/report.mjs';

const { chromium } = await import( PLUGIN + '/node_modules/playwright/index.mjs' );

/* ── Arguments ───────────────────────────────────────────────────────── */
const argv = process.argv.slice( 2 );
const opt = ( name, def ) => {
	const i = argv.indexOf( '--' + name );
	if ( i < 0 ) {
		const eq = argv.find( ( a ) => a.startsWith( '--' + name + '=' ) );
		return eq ? eq.slice( name.length + 3 ) : def;
	}
	const v = argv[ i + 1 ];
	return v === undefined || v.startsWith( '--' ) ? true : v;
};
const list = ( v ) => ( typeof v === 'string' ? v.split( ',' ).map( ( s ) => s.trim() ).filter( Boolean ) : [] );
const usage = ( msg ) => {
	if ( msg ) {
		console.error( 'error: ' + msg );
	}
	console.error( 'usage: node audit.mjs --group <name> [--only id,id] [--contexts light,dark] [--widths 1280,375] [--screenshots] [--editor] [--concurrency 4] [--skip axe,focus,target,nontext,pseudo,spacing,reflow,motion] [--motion-wait 6500] [--theme-css hello|hello-last] [--fresh] [--list]' );
	process.exit( 2 );
};
if ( argv.includes( '--help' ) || argv.includes( '-h' ) ) {
	usage();
}
const group = opt( 'group' );
if ( ! group || group === true || ! /^[a-z0-9_-]+$/i.test( group ) ) {
	usage( '--group is required (fixtures/<group>.json)' );
}
const options = {
	only: list( opt( 'only' ) ),
	contexts: list( opt( 'contexts', 'light,dark' ) ),
	widths: list( opt( 'widths', '1280,375' ) ).map( Number ).filter( ( n ) => n >= 200 && n <= 3000 ),
	widthsGiven: opt( 'widths', null ) !== null,
	screenshots: !! opt( 'screenshots', false ),
	editor: !! opt( 'editor', false ),
	concurrency: Math.max( 1, Math.min( 12, parseInt( opt( 'concurrency', '4' ), 10 ) || 4 ) ),
	skip: list( opt( 'skip', '' ) ),
	motionWait: Math.max( 5500, parseInt( opt( 'motion-wait', '6500' ), 10 ) || 6500 ),
	fresh: !! opt( 'fresh', false ),
	listOnly: !! opt( 'list', false ),
	// Stock Hello Elementor CSS on the pages: '' | 'hello' (theme first) | 'hello-last' (theme after the blocks).
	themeCss: opt( 'theme-css', '' ) === true ? 'hello' : opt( 'theme-css', '' ),
};
if ( options.themeCss && ! [ 'hello', 'hello-last' ].includes( options.themeCss ) ) {
	usage( '--theme-css takes hello or hello-last' );
}
const skip = new Set( options.skip );
if ( ! options.widths.length ) {
	usage( 'no valid --widths' );
}
if ( options.contexts.some( ( c ) => ! [ 'light', 'dark' ].includes( c ) ) ) {
	usage( '--contexts takes light and/or dark' );
}

/* ── Fixtures ────────────────────────────────────────────────────────── */
const fixtureFile = join( HARNESS, 'fixtures', group + '.json' );
if ( ! existsSync( fixtureFile ) ) {
	usage( 'missing ' + fixtureFile );
}
let fixtures;
try {
	fixtures = JSON.parse( readFileSync( fixtureFile, 'utf8' ) );
} catch ( e ) {
	usage( `${ fixtureFile } is not valid JSON: ${ e.message }` );
}
if ( ! Array.isArray( fixtures ) ) {
	usage( 'the fixtures file must hold an array' );
}
const warnings = [];
const ids = new Set();
fixtures = fixtures.filter( ( f, i ) => {
	if ( ! f || typeof f.id !== 'string' || ! /^[a-z0-9][a-z0-9_-]*$/i.test( f.id ) || typeof f.markup !== 'string' || ! f.markup.trim() ) {
		warnings.push( `fixture #${ i } skipped: needs "id" (letters, digits, - _) and "markup"` );
		return false;
	}
	if ( ids.has( f.id ) ) {
		warnings.push( `fixture ${ f.id } is duplicated: the second one is skipped` );
		return false;
	}
	ids.add( f.id );
	if ( ! /<!--\s+wp:werun\//.test( f.markup ) ) {
		warnings.push( `fixture ${ f.id }: the markup holds no werun block` );
	}
	return ! options.only.length || options.only.includes( f.id );
} );
if ( options.only.length ) {
	options.only.filter( ( id ) => ! ids.has( id ) ).forEach( ( id ) => warnings.push( `--only: no fixture "${ id }"` ) );
}
if ( ! fixtures.length ) {
	usage( 'no fixture to run' );
}

const DARK_OPEN =
	'<!-- wp:group {"align":"full","style":{"color":{"background":"#0f172a","text":"#f8fafc"}},"layout":{"type":"constrained"}} -->\n<div class="wp-block-group alignfull has-text-color has-background" style="color:#f8fafc;background-color:#0f172a">';
const DARK_CLOSE = '</div>\n<!-- /wp:group -->';
// A fixture may narrow the widths ("widths": [1280]); --widths on the command line wins.
const widthsOf = ( f ) => ( ! options.widthsGiven && Array.isArray( f.widths ) && f.widths.length ? f.widths.map( Number ).filter( ( n ) => n >= 200 && n <= 3000 ) : options.widths );
const contextsOf = ( f ) => ( Array.isArray( f.contexts ) && f.contexts.length ? f.contexts : [ 'light', 'dark' ] ).filter( ( c ) => options.contexts.includes( c ) );

const pages = [];
fixtures.forEach( ( f ) => {
	contextsOf( f ).forEach( ( ctx ) => {
		pages.push( {
			key: `${ f.id }--${ ctx }`,
			fixture: f,
			context: ctx,
			title: `WRB A11Y ${ group } ${ f.id } [${ ctx }]`,
			content: ctx === 'dark' ? DARK_OPEN + '\n' + f.markup.trim() + '\n' + DARK_CLOSE : f.markup.trim(),
		} );
	} );
} );

/* ── Sync pages through WP-CLI ───────────────────────────────────────── */
const tmp = join( HARNESS, 'tmp' );
mkdirSync( tmp, { recursive: true } );
const inFile = join( tmp, `${ group }-${ process.pid }-in.json` );
const outFile = join( tmp, `${ group }-${ process.pid }-out.json` );
writeFileSync( inFile, JSON.stringify( { pages: pages.map( ( p ) => ( { key: p.key, title: p.title, content: p.content } ) ), auth: options.editor } ) );
let bridge;
try {
	execFileSync( 'wp', [ 'eval-file', join( HARNESS, 'bridge.php' ), inFile, outFile ], { cwd: WP_ROOT, stdio: [ 'ignore', 'pipe', 'pipe' ], timeout: 120000 } );
	bridge = JSON.parse( readFileSync( outFile, 'utf8' ) );
} catch ( e ) {
	console.error( 'WP-CLI bridge failed: ' + ( e.stderr ? e.stderr.toString() : e.message ) );
	process.exit( 2 );
} finally {
	[ inFile, outFile ].forEach( ( f ) => existsSync( f ) && unlinkSync( f ) );
}
warnings.push( ...( bridge.warnings || [] ) );
pages.forEach( ( p ) => Object.assign( p, bridge.pages[ p.key ] || {} ) );
// Theme CSS switch (mu-plugin): the same pages with Hello's stylesheets printed first or last.
if ( options.themeCss ) {
	pages.forEach( ( p ) => {
		if ( p.url ) {
			p.url += ( p.url.includes( '?' ) ? '&' : '?' ) + 'wrbc_a11y_theme=' + options.themeCss;
		}
	} );
}
const missing = pages.filter( ( p ) => ! p.url );
missing.forEach( ( p ) => warnings.push( `${ p.key }: page not created` ) );

if ( options.listOnly ) {
	pages.forEach( ( p ) => console.log( `${ p.key.padEnd( 34 ) } ${ p.url || '-' }  (${ p.status || 'missing' }, id ${ p.id || '-' })` ) );
	warnings.forEach( ( w ) => console.log( 'warning: ' + w ) );
	process.exit( 0 );
}

/* ── Browser ─────────────────────────────────────────────────────────── */
const reportDir = join( HARNESS, 'reports', group + ( options.themeCss ? '--' + options.themeCss : '' ) );
mkdirSync( join( reportDir, 'aria' ), { recursive: true } );
if ( options.screenshots ) {
	mkdirSync( join( reportDir, 'shots' ), { recursive: true } );
}
const logFile = bridge.debugLog;
const logStart = logFile && existsSync( logFile ) ? statSync( logFile ).size : 0;

const started = Date.now();
const executablePath = chromiumExecutable( chromium.executablePath() );
const browser = await chromium.launch( { headless: true, executablePath } );
const pageLib = readFileSync( join( HARNESS, 'lib', 'page.js' ), 'utf8' );
const ctxOpts = { ignoreHTTPSErrors: true, deviceScaleFactor: 1, viewport: { width: 1280, height: 900 }, serviceWorkers: 'block' };
const ctxNormal = await browser.newContext( { ...ctxOpts, reducedMotion: 'no-preference' } );
const ctxReduced = await browser.newContext( { ...ctxOpts, reducedMotion: 'reduce' } );
await ctxNormal.addInitScript( { content: pageLib } );
await ctxReduced.addInitScript( { content: pageLib } );
let ctxEditor = null;
if ( options.editor ) {
	ctxEditor = await browser.newContext( { ...ctxOpts, viewport: { width: 1440, height: 1000 } } );
	if ( bridge.auth && bridge.auth.cookies ) {
		await ctxEditor.addCookies( bridge.auth.cookies );
	} else {
		warnings.push( 'editor: no auth cookies (no administrator?)' );
	}
}

/* ── Tasks ───────────────────────────────────────────────────────────── */
const results = new Map(); // fixture id → { id, title, contexts: { ctx: { url, edit, runs } }, start, end }
const resultOf = ( p ) => {
	if ( ! results.has( p.fixture.id ) ) {
		results.set( p.fixture.id, { id: p.fixture.id, title: p.fixture.title || p.fixture.id, contexts: {}, start: Infinity, end: 0, ranAt: new Date().toISOString(), options: { widths: options.widths, contexts: options.contexts, skip: options.skip } } );
	}
	const r = results.get( p.fixture.id );
	if ( ! r.contexts[ p.context ] ) {
		r.contexts[ p.context ] = { url: p.url, edit: p.edit, runs: {} };
	}
	return r;
};
const errorIssue = ( e, where ) => ( { check: 'error', level: 'fail', sc: '', rule: 'harness', message: `${ where }: ${ String( e && e.message ? e.message : e ).split( '\n' )[ 0 ] }` } );
const fileKey = ( p, w ) => `${ p.fixture.id }--${ p.context }--${ w }`;

const runTask = ( p, key, fn ) => async () => {
	const res = resultOf( p );
	const t = Date.now();
	res.start = Math.min( res.start, t );
	const run = { issues: [] };
	try {
		await fn( run );
	} catch ( e ) {
		run.issues.push( errorIssue( e, key ) );
	}
	run.ms = Date.now() - t;
	res.end = Math.max( res.end, Date.now() );
	res.contexts[ p.context ].runs[ key ] = run;
};

const mainTask = ( p, width ) =>
	runTask( p, String( width ), async ( run ) => {
		const { page, status, php, console: cons, failed } = await openPage( ctxNormal, p.url, { width } );
		try {
			if ( failed.length ) {
				run.issues.push( { check: 'error', level: 'fail', rule: 'resources', message: `site CSS/JS failed to load even after a reload (results unreliable, run again): ${ failed.slice( 0, 4 ).join( ', ' ) }` } );
			}
			if ( status !== 200 ) {
				run.issues.push( { check: 'error', level: 'fail', rule: 'http', message: `page answered ${ status }` } );
			}
			php.forEach( ( l ) => run.issues.push( { check: 'error', level: 'fail', rule: 'php', message: 'PHP in the page: ' + l } ) );
			const st = await structure( page );
			run.headings = st.headings;
			run.issues.push( ...st.issues );
			if ( ! st.roots.length ) {
				run.issues.push( { check: 'error', level: 'fail', rule: 'empty', message: 'no werun block rendered on the page (render.php returned nothing?)' } );
			}
			const aria = st.aria.map( ( a ) => `# ${ a.block }  ${ a.selector }\n${ a.snapshot }\n` ).join( '\n' );
			run.ariaFile = `aria/${ fileKey( p, width ) }.yml`;
			writeFileSync( join( reportDir, run.ariaFile ), aria );
			if ( options.screenshots ) {
				run.shot = `shots/${ fileKey( p, width ) }.png`;
				await page.screenshot( { path: join( reportDir, run.shot ), fullPage: true } );
			}
			if ( ! skip.has( 'axe' ) ) {
				const a = await axeChecks( page );
				run.issues.push( ...a.issues, ...a.bp );
				if ( a.error ) {
					run.issues.push( errorIssue( a.error, 'axe' ) );
				}
			}
			if ( ! skip.has( 'target' ) ) {
				const t = await targetSize( page );
				run.issues.push( ...t.issues );
				run.targets = t.data;
			}
			if ( ! skip.has( 'nontext' ) ) {
				const n = await nonText( page, p.fixture.nonText );
				run.issues.push( ...n.issues );
				run.nonText = n.data;
			}
			if ( ! skip.has( 'pseudo' ) ) {
				const ps = await pseudoText( page );
				run.issues.push( ...ps.issues );
				run.pseudo = ps.data;
			}
			if ( ! skip.has( 'spacing' ) ) {
				const s = await textSpacing( page );
				run.issues.push( ...s.issues );
			}
			if ( ! skip.has( 'focus' ) ) {
				const f = await focusWalk( page );
				run.focus = { stops: f.stops, presses: f.presses };
				run.issues.push( ...f.issues );
			}
			run.issues.push( ...consoleIssues( cons ) );
		} finally {
			await page.close().catch( () => {} );
		}
	} );

const reflowTask = ( p ) =>
	runTask( p, 'reflow 320', async ( run ) => {
		const { page, failed } = await openPage( ctxNormal, p.url, { width: 320, height: 800 } );
		try {
			if ( failed.length ) {
				run.issues.push( { check: 'error', level: 'fail', rule: 'resources', message: `site CSS/JS failed to load even after a reload (run again): ${ failed.slice( 0, 4 ).join( ', ' ) }` } );
			}
			const r = await reflow( page );
			run.issues.push( ...r.issues );
			run.reflow = r.data;
			if ( options.screenshots ) {
				run.shot = `shots/${ fileKey( p, 320 ) }.png`;
				await page.screenshot( { path: join( reportDir, run.shot ), fullPage: true } );
			}
		} finally {
			await page.close().catch( () => {} );
		}
	} );

const motionTask = ( p, reduced ) =>
	runTask( p, reduced ? 'reduced motion' : 'motion', async ( run ) => {
		const t0 = Date.now();
		const { page } = await openPage( reduced ? ctxReduced : ctxNormal, p.url, { width: options.widths[ 0 ], settle: false, collect: false } );
		try {
			const m = await motion( page, { waitMs: options.motionWait, reduced, t0 } );
			run.issues.push( ...m.issues );
			run.motion = m.data;
		} finally {
			await page.close().catch( () => {} );
		}
	} );

const editorTask = ( p ) =>
	runTask( p, 'editor', async ( run ) => {
		const e = await editor( ctxEditor, p.edit );
		run.issues.push( ...e.issues );
		run.editor = e.data;
	} );

const cpu = [];
const idle = [];
pages
	.filter( ( p ) => p.url )
	.forEach( ( p ) => {
		widthsOf( p.fixture ).forEach( ( w ) => cpu.push( mainTask( p, w ) ) );
		if ( ! skip.has( 'reflow' ) ) {
			cpu.push( reflowTask( p ) );
		}
		if ( ! skip.has( 'motion' ) ) {
			idle.push( motionTask( p, false ), motionTask( p, true ) );
		}
		if ( options.editor ) {
			cpu.push( editorTask( p ) );
		}
	} );

const pool = async ( tasks, n ) => {
	let i = 0;
	await Promise.all(
		Array.from( { length: Math.min( n, tasks.length ) }, async () => {
			while ( i < tasks.length ) {
				await tasks[ i++ ]();
			}
		} )
	);
};
await Promise.all( [ pool( cpu, options.concurrency ), pool( idle, Math.max( 2, options.concurrency * 2 ) ) ] );
await browser.close();

/* ── PHP log lines written during the run ────────────────────────────── */
let php = [];
if ( logFile && existsSync( logFile ) ) {
	const size = statSync( logFile ).size;
	if ( size > logStart ) {
		const len = Math.min( size - logStart, 2 * 1024 * 1024 );
		const buf = Buffer.alloc( len );
		const fd = openSync( logFile, 'r' );
		readSync( fd, buf, 0, len, size - len );
		closeSync( fd );
		const lines = buf
			.toString( 'utf8' )
			.split( '\n' )
			.filter( ( l ) => /PHP (Warning|Notice|Deprecated|Fatal|Parse)/.test( l ) && ! PHP_IGNORE.some( ( re ) => re.test( l ) ) )
			.map( ( l ) => l.replace( /^\[[^\]]+\]\s*/, '' ) );
		const uniq = Array.from( new Set( lines ) );
		php = uniq.filter( ( l ) => l.includes( 'werun-blocks-community' ) ).concat( uniq.filter( ( l ) => ! l.includes( 'werun-blocks-community' ) ) );
	}
}

/* ── Results (merged with earlier runs of other fixtures) ────────────── */
const order = new Map( JSON.parse( readFileSync( fixtureFile, 'utf8' ) ).map( ( f, i ) => [ f.id, i ] ) );
let previous = [];
const resultsFile = join( reportDir, 'results.json' );
if ( ! options.fresh && existsSync( resultsFile ) ) {
	try {
		previous = JSON.parse( readFileSync( resultsFile, 'utf8' ) ).fixtures || [];
	} catch ( e ) {
		previous = [];
	}
}
const fresh = Array.from( results.values() ).map( ( r ) => {
	r.seconds = Math.round( ( r.end - r.start ) / 100 ) / 10;
	delete r.start;
	delete r.end;
	// Runs in a stable order: widths, reflow, motion, reduced, editor.
	Object.values( r.contexts ).forEach( ( c ) => {
		const rank = ( k ) => ( /^\d+$/.test( k ) ? -10000 + options.widths.indexOf( Number( k ) ) : [ 'reflow 320', 'motion', 'reduced motion', 'editor' ].indexOf( k ) );
		c.runs = Object.fromEntries( Object.entries( c.runs ).sort( ( a, b ) => rank( a[ 0 ] ) - rank( b[ 0 ] ) ) );
	} );
	r.contexts = Object.fromEntries( Object.entries( r.contexts ).sort( ( a, b ) => ( a[ 0 ] === 'light' ? -1 : 1 ) - ( b[ 0 ] === 'light' ? -1 : 1 ) ) );
	return r;
} );
const merged = previous.filter( ( f ) => ! results.has( f.id ) && order.has( f.id ) ).concat( fresh );
merged.sort( ( a, b ) => ( order.get( a.id ) ?? 999 ) - ( order.get( b.id ) ?? 999 ) );
const run = {
	group,
	generatedAt: new Date().toISOString().replace( 'T', ' ' ).slice( 0, 19 ) + ' UTC',
	options,
	seconds: Math.round( ( Date.now() - started ) / 100 ) / 10,
	browser: executablePath || 'playwright default',
	warnings,
	php,
	fixtures: merged,
};
writeReports( reportDir, run );

/* ── Console: one line per fixture ───────────────────────────────────── */
// Fixtures may list what they must trigger ("expect": ["focus:focus-visible", …]): the harness self-test.
const expectOf = ( f ) => {
	const fx = fixtures.find( ( x ) => x.id === f.id );
	if ( ! fx || ( ! ( Array.isArray( fx.expect ) && fx.expect.length ) && ! ( Array.isArray( fx.expectNot ) && fx.expectNot.length ) ) ) {
		return '';
	}
	const got = new Set();
	Object.values( f.contexts ).forEach( ( c ) =>
		Object.values( c.runs ).forEach( ( r ) =>
			r.issues
				.filter( ( i ) => i.level !== 'info' && i.level !== 'bp' )
				.forEach( ( i ) => {
					got.add( i.check + ':' + i.rule );
					got.add( i.rule );
				} )
		)
	);
	const ran = ( e ) => ! ( e.startsWith( 'editor:' ) && ! options.editor ) && ! ( e.startsWith( 'motion:' ) && skip.has( 'motion' ) );
	const missing = ( fx.expect || [] ).filter( ( e ) => ! got.has( e ) && ran( e ) );
	// "expectNot": what the fixture must NOT trigger (false-positive guards).
	const unexpected = ( fx.expectNot || [] ).filter( ( e ) => got.has( e ) && ran( e ) );
	f.expect = { expected: fx.expect || [], expectNot: fx.expectNot || [], missing, unexpected };
	return missing.length || unexpected.length ? `   EXPECT ✗${ missing.length ? ' missing ' + missing.join( ', ' ) : '' }${ unexpected.length ? ' unexpected ' + unexpected.join( ', ' ) : '' }` : '   expect ✓';
};
fresh
	.sort( ( a, b ) => ( order.get( a.id ) ?? 999 ) - ( order.get( b.id ) ?? 999 ) )
	.forEach( ( f ) => {
		const all = Object.values( f.contexts ).flatMap( ( c ) => Object.values( c.runs ).flatMap( ( r ) => r.issues ) );
		const k = counts( all );
		const byCheck = {};
		all.filter( ( i ) => i.level === 'fail' ).forEach( ( i ) => ( byCheck[ i.check ] = ( byCheck[ i.check ] || 0 ) + 1 ) );
		const detail = Object.entries( byCheck )
			.map( ( [ c, n ] ) => `${ c } ${ n }` )
			.join( ', ' );
		console.log( `${ f.id.padEnd( 28 ) } FAIL ${ String( k.fail ).padStart( 3 ) } · review ${ String( k.review ).padStart( 3 ) } · bp ${ String( k.bp ).padStart( 2 ) }   ${ f.seconds }s${ detail ? '   [' + detail + ']' : '' }${ expectOf( f ) }` );
	} );
warnings.forEach( ( w ) => console.log( 'warning: ' + w ) );
if ( php.length ) {
	console.log( `PHP log: ${ php.length } new warning/notice lines (see summary.md)` );
}
console.log( `report: ${ join( reportDir, 'summary.md' ) }  (${ run.seconds }s total)` );
process.exit( 0 );
