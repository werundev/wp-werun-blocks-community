/**
 * The checks, Node side: each takes a Playwright page (or context), drives
 * it and turns what lib/page.js measured into issues:
 *   { check, level: 'fail'|'review'|'info', sc, rule, selector, block, snippet, message, data }
 */
import { readFileSync } from 'fs';
import { AXE, WCAG_TAGS } from './env.mjs';
import { diffPng } from './pixels.mjs';

const AXE_SOURCE = readFileSync( AXE, 'utf8' );
const PHP_ERROR = /<b>(Warning|Notice|Deprecated|Fatal error|Parse error)<\/b>:\s*([^<]{0,240})/g;

const r2 = ( n ) => ( typeof n === 'number' ? Math.round( n * 100 ) / 100 : n );
const issue = ( o ) => ( { level: 'fail', ...o } );

/** WCAG SC from axe tags (wcag143 → 1.4.3). */
function scOf( tags ) {
	const t = ( tags || [] ).find( ( x ) => /^wcag\d{3,4}$/.test( x ) );
	if ( ! t ) {
		return '';
	}
	const d = t.slice( 4 );
	return d.length === 3 ? d.split( '' ).join( '.' ) : d[ 0 ] + '.' + d[ 1 ] + '.' + d.slice( 2 );
}

/* ── Load ────────────────────────────────────────────────────────────── */

export async function openPage( ctx, url, { width, height = 900, settle = true, collect = true } = {} ) {
	const page = await ctx.newPage();
	await page.setViewportSize( { width, height } );
	const console = [];
	if ( collect ) {
		page.on( 'pageerror', ( e ) => console.push( { type: 'pageerror', text: String( e && e.message ? e.message : e ).slice( 0, 300 ) } ) );
		page.on( 'console', ( m ) => {
			if ( m.type() === 'error' ) {
				console.push( { type: 'console', text: m.text().slice( 0, 300 ) } );
			}
		} );
	}
	// A busy local server sometimes drops a stylesheet or script: the page would be
	// audited without it. Reload once; report what still failed.
	const origin = new URL( url ).origin;
	const failed = [];
	page.on( 'requestfailed', ( r ) => {
		const u = r.url();
		if ( u.startsWith( origin ) && /\.(css|js)(\?|$)|load-(scripts|styles)\.php/.test( u ) ) {
			failed.push( u.replace( origin, '' ).slice( 0, 160 ) );
		}
	} );
	let response = await page.goto( url, { waitUntil: 'load', timeout: 45000 } );
	await page.waitForLoadState( 'networkidle', { timeout: 4000 } ).catch( () => {} );
	if ( failed.length ) {
		failed.length = 0;
		console.length = 0;
		response = await page.reload( { waitUntil: 'load', timeout: 45000 } );
		await page.waitForLoadState( 'networkidle', { timeout: 4000 } ).catch( () => {} );
	}
	const status = response ? response.status() : 0;
	let php = [];
	if ( response ) {
		const html = await response.text().catch( () => '' );
		php = Array.from( html.matchAll( PHP_ERROR ) ).map( ( m ) => m[ 1 ] + ': ' + m[ 2 ].trim() );
	}
	if ( settle ) {
		await page.evaluate( () => window.__wrbcA11y.scrollThrough() );
		await page.evaluate( () => window.__wrbcA11y.settle() );
	}
	return { page, status, php, console, failed: failed.slice() };
}

/** Identical console lines once, with a count (at most 10). */
export function consoleIssues( list, rule = 'console' ) {
	const seen = new Map();
	list.forEach( ( c ) => {
		const text = typeof c === 'string' ? c : `${ c.type }: ${ c.text }`;
		seen.set( text, ( seen.get( text ) || 0 ) + 1 );
	} );
	return Array.from( seen.entries() )
		.slice( 0, 10 )
		.map( ( [ text, n ] ) => ( { check: 'error', level: 'review', sc: '', rule, message: text + ( n > 1 ? ` (×${ n })` : '' ) } ) )
		.concat( seen.size > 10 ? [ { check: 'error', level: 'review', sc: '', rule, message: `… and ${ seen.size - 10 } more distinct console messages` } ] : [] );
}

/* ── axe ─────────────────────────────────────────────────────────────── */

export async function axeChecks( page ) {
	await page.addScriptTag( { content: AXE_SOURCE } );
	const wcag = await page.evaluate( ( tags ) => window.__wrbcA11y.axe( tags ), WCAG_TAGS );
	const bp = await page.evaluate( () => window.__wrbcA11y.axe( [ 'best-practice' ] ) );
	const issues = [];
	for ( const r of wcag.violations || [] ) {
		for ( const n of r.nodes ) {
			const d = n.data || {};
			const colors = r.id === 'color-contrast' ? { fg: d.fgColor, bg: d.bgColor, ratio: d.contrastRatio, need: d.expectedContrastRatio && parseFloat( d.expectedContrastRatio ), fontSize: d.fontSize, fontWeight: d.fontWeight } : undefined;
			issues.push( issue( { check: 'axe', rule: r.id, sc: scOf( r.tags ), impact: n.impact || r.impact, selector: n.selector, block: n.block, snippet: n.snippet, message: r.help + ( n.message ? ' — ' + n.message : '' ), colors, data: n.computed ? { computed: n.computed } : undefined, helpUrl: r.helpUrl } ) );
		}
	}
	for ( const r of wcag.incomplete || [] ) {
		for ( const n of r.nodes ) {
			const d = n.data || {};
			const it = { check: 'axe-review', level: 'review', rule: r.id, sc: scOf( r.tags ), impact: n.impact || r.impact, selector: n.selector, block: n.block, snippet: n.snippet, message: r.help + ( n.message ? ' — ' + n.message : '' ), helpUrl: r.helpUrl };
			if ( r.id === 'color-contrast' && n.computed && n.computed.hidden ) {
				it.message += ' — not visible even after scrolling it into view (scrolled-out slide, clipped): check it where it shows';
			} else if ( r.id === 'color-contrast' && n.computed && ! n.computed.error ) {
				const c = n.computed;
				it.reason = d.messageKey || '';
				it.colors = { fg: c.fg, bg: c.bgs.join( ' / ' ), ratio: c.min, max: c.max, worstBg: c.worstBg, need: c.need, bgKind: c.bgKind };
				const axeSaw = d.fgColor || d.bgColor ? `; axe saw fg ${ d.fgColor || '?' } bg ${ d.bgColor || '?' }${ d.contrastRatio ? ' = ' + d.contrastRatio + ':1' : '' }` : '';
				it.message = `Text over ${ c.bgKind === 'image' ? 'an image/video (worst case: white and black under the overlays)' : c.bgKind === 'gradient' ? 'a gradient (each stop)' : 'a background axe could not resolve' } — fg ${ c.fg }, worst ${ c.min }:1 against ${ c.worstBg } (needs ${ c.need }), best ${ c.max }:1` + ( d.messageKey ? ` [axe: ${ d.messageKey }${ axeSaw }]` : axeSaw ? ` [${ axeSaw.slice( 2 ) }]` : '' );
				// The harness resolved it: passes in the worst case → info; fails in the best case → fail.
				if ( c.min >= c.need ) {
					it.level = 'info';
					it.message = `resolved by the harness: ${ c.min }:1 or better on ${ c.bgKind === 'solid' ? 'a solid ' + c.worstBg : c.bgKind + ' (worst case ' + c.worstBg + ')' } (needs ${ c.need })` + ( d.messageKey ? ` [axe: ${ d.messageKey }]` : '' );
				} else if ( c.max < c.need ) {
					it.level = 'fail';
				}
				it.data = { layers: c.layers };
			}
			issues.push( it );
		}
	}
	const bpIssues = [];
	for ( const r of bp.violations || [] ) {
		for ( const n of r.nodes ) {
			bpIssues.push( { check: 'bp', level: 'bp', rule: r.id, sc: '', impact: n.impact || r.impact, selector: n.selector, block: n.block, snippet: n.snippet, message: r.help + ( n.message ? ' — ' + n.message : '' ), helpUrl: r.helpUrl } );
		}
	}
	return { issues, bp: bpIssues, error: wcag.error || bp.error };
}

/* ── Structure ───────────────────────────────────────────────────────── */

export async function structure( page ) {
	const roots = await page.evaluate( () => window.__wrbcA11y.markRoots() );
	const headings = await page.evaluate( () => window.__wrbcA11y.headings() );
	const aria = [];
	for ( const r of roots ) {
		const snap = await page
			.locator( `[data-wrbc-a11y-root="${ r.i }"]` )
			.ariaSnapshot( { timeout: 5000 } )
			.catch( ( e ) => '# error: ' + e.message.split( '\n' )[ 0 ] );
		aria.push( { block: r.block, selector: r.selector, snapshot: snap } );
	}
	const issues = [];
	// Skipped heading levels inside werun blocks (the page's previous heading counts).
	let prev = 0;
	headings.forEach( ( h ) => {
		if ( h.werun && prev && h.level > prev + 1 ) {
			issues.push( { check: 'headings', level: 'review', sc: '1.3.1', rule: 'heading-skip', selector: h.selector, block: h.block, message: `h${ h.level } "${ h.text }" follows h${ prev } (skipped level)` } );
		}
		prev = h.level;
	} );
	const positive = await page.evaluate( () => window.__wrbcA11y.positiveTabindex() );
	positive.forEach( ( p ) => issues.push( issue( { check: 'focus', sc: '2.4.3', rule: 'positive-tabindex', selector: p.selector, message: `tabindex="${ p.tabindex }" changes the focus order` } ) ) );
	return { roots, headings, aria, issues };
}

/* ── Target size 2.5.8 ───────────────────────────────────────────────── */

export async function targetSize( page ) {
	const t = await page.evaluate( () => window.__wrbcA11y.targets() );
	const issues = t.undersized.map( ( u ) =>
		u.spacingOk
			? { check: 'target', level: 'info', sc: '2.5.8', rule: 'target-size-spacing', selector: u.selector, block: u.block, snippet: u.snippet, message: `${ u.width }×${ u.height } px, passes by the spacing exception` }
			: issue( { check: 'target', sc: '2.5.8', rule: 'target-size', selector: u.selector, block: u.block, snippet: u.snippet, message: `${ u.width }×${ u.height } px (< 24×24) and the 24 px circle overlaps ${ u.clashes.join( ', ' ) }`, data: u } )
	);
	return { issues, data: { targets: t.count, inline: t.inline } };
}

/* ── Non-text contrast 1.4.11 ────────────────────────────────────────── */

export async function nonText( page, rules ) {
	const controls = await page.evaluate( () => window.__wrbcA11y.controls() );
	const custom = rules && rules.length ? await page.evaluate( ( r ) => window.__wrbcA11y.nonText( r ), rules ) : [];
	await page.evaluate( () => window.scrollTo( 0, 0 ) );
	const issues = [];
	controls.forEach( ( c ) => {
		if ( ! c.ok ) {
			issues.push(
				issue( {
					check: 'nontext',
					sc: '1.4.11',
					rule: 'control-boundary',
					selector: c.selector,
					block: c.block,
					snippet: c.snippet,
					message: `${ c.type } boundary ${ c.ratio }:1 (border ${ c.border } → ${ c.borderRatio ?? '–' }:1, fill ${ c.fill } → ${ c.fillRatio }:1) against ${ c.outside }${ c.outsideKind !== 'solid' ? ' (' + c.outsideKind + ')' : '' }; needs 3:1`,
					colors: { fg: c.border, bg: c.outside, ratio: c.ratio, need: 3 },
				} )
			);
		}
		if ( c.placeholder && ! c.placeholder.ok ) {
			issues.push( issue( { check: 'nontext', sc: '1.4.3', rule: 'placeholder-contrast', selector: c.selector, block: c.block, snippet: c.snippet, message: `placeholder ${ c.placeholder.color } is ${ c.placeholder.ratio }:1 on the field (needs 4.5)`, colors: { fg: c.placeholder.color, bg: c.fill, ratio: c.placeholder.ratio, need: 4.5 } } ) );
		}
	} );
	custom.forEach( ( c ) => {
		if ( c.error ) {
			issues.push( { check: 'nontext', level: 'review', sc: '1.4.11', rule: 'fixture-rule', selector: c.selector || ( c.rule && c.rule.selector ), message: `nonText rule: ${ c.error }` } );
		} else if ( ! c.ok ) {
			// Over an image the numbers are a worst / best case: a human decides.
			const overImage = c.againstKind === 'image';
			issues.push( {
				check: 'nontext',
				level: overImage && c.max >= c.min ? 'review' : 'fail',
				sc: '1.4.11',
				rule: 'fixture-rule',
				selector: c.selector,
				block: c.block,
				message: `${ c.label ? c.label + ': ' : '' }${ c.property } ${ c.color } is ${ c.ratio }:1 against ${ c.against }${ c.againstKind !== 'solid' ? ' (' + c.againstKind + ( overImage ? ', worst case; best ' + c.max + ':1' : '' ) + ')' : '' } (needs ${ c.min })`,
				colors: { fg: c.color, bg: c.against, ratio: c.ratio, max: c.max, need: c.min },
			} );
		}
	} );
	return { issues, data: { controls, custom } };
}

/* ── Text drawn by pseudo-elements 1.4.3 ─────────────────────────────── */

export async function pseudoText( page ) {
	const list = await page.evaluate( () => window.__wrbcA11y.pseudoText() );
	const issues = [];
	list.forEach( ( p ) => {
		if ( p.ok ) {
			return;
		}
		const overImage = p.kind === 'image' || p.kind === 'gradient';
		issues.push( {
			check: 'pseudo',
			level: overImage && p.best >= p.need ? 'review' : 'fail',
			sc: '1.4.3',
			rule: 'pseudo-text-contrast',
			selector: p.selector,
			block: p.block,
			message: `text drawn by CSS (content: ${ p.content }) ${ p.fg } on ${ p.bg } = ${ p.ratio }:1${ overImage ? ' worst / ' + p.best + ':1 best (' + p.kind + ')' : '' } (needs ${ p.need }${ p.large ? ', large text' : '' }, ${ p.fontSize })${ p.approx ? ' · position of the pseudo-element approximated' : '' }`,
			colors: { fg: p.fg, bg: p.bg, ratio: p.ratio, need: p.need },
		} );
	} );
	return { issues, data: list };
}

/* ── Text spacing 1.4.12 ─────────────────────────────────────────────── */

export async function textSpacing( page ) {
	const list = await page.evaluate( () => window.__wrbcA11y.textSpacing() );
	return {
		issues: list.map( ( s ) =>
			issue( { check: 'spacing', sc: '1.4.12', rule: 'text-spacing-clip', selector: s.selector, block: s.block, snippet: s.snippet, message: `text clipped (${ s.axis }) with WCAG text spacing: overflow ${ s.overflowAfter.x }/${ s.overflowAfter.y } px (x/y), was ${ s.overflowBefore.x }/${ s.overflowBefore.y }; height ${ s.height }`, data: s } )
		),
	};
}

/* ── Focus walk 2.4.7 / 1.4.11 / 2.4.11 ──────────────────────────────── */

const clipOf = ( rect, vp, m ) => {
	const x = Math.max( 0, Math.floor( rect.x - m ) );
	const y = Math.max( 0, Math.floor( rect.y - m ) );
	const r = Math.min( vp.w, Math.ceil( rect.x + rect.w + m ) );
	const b = Math.min( vp.h, Math.ceil( rect.y + rect.h + m ) );
	return r - x >= 2 && b - y >= 2 ? { x, y, width: r - x, height: b - y } : null;
};

async function axName( cdp ) {
	try {
		const ev = await cdp.send( 'Runtime.evaluate', { expression: 'document.activeElement', objectGroup: 'wrbc-focus' } );
		const ax = await cdp.send( 'Accessibility.getPartialAXTree', { objectId: ev.result.objectId, fetchRelatives: false } );
		await cdp.send( 'Runtime.releaseObjectGroup', { objectGroup: 'wrbc-focus' } );
		const n = ax.nodes.find( ( x ) => ! x.ignored ) || ax.nodes[ 0 ] || {};
		return { role: ( n.role && n.role.value ) || '', name: ( n.name && n.name.value ) || '' };
	} catch ( e ) {
		return { role: '?', name: '' };
	}
}

export async function focusWalk( page, { max = 150 } = {} ) {
	const cdp = await page.context().newCDPSession( page );
	await page.evaluate( () => {
		window.__wrbcA11y.walkStart();
		document.querySelectorAll( 'video' ).forEach( ( v ) => v.pause() );
	} );
	const stops = [];
	const issues = [];
	let presses = 0;
	let repeats = 0;
	let started = false;
	while ( presses < max ) {
		await page.keyboard.press( 'Tab' );
		presses++;
		// Two frames, then until any scroll the focus started (page, carousel track) has stopped:
		// obscured / clipped / ring are measured on the settled page.
		await page.evaluate( () => window.__wrbcA11y.afterTab( 2, 500 ) );
		const info = await page.evaluate( () => window.__wrbcA11y.focusInfo() );
		if ( info.none ) {
			if ( started ) {
				break; // focus left the document: end of the page
			}
			continue;
		}
		started = true;
		if ( info.repeat ) {
			if ( info.iframe && repeats < 25 ) {
				repeats++;
				continue; // tabbing inside an embedded frame
			}
			if ( ++repeats > 3 ) {
				issues.push( issue( { check: 'focus', sc: '2.1.2', rule: 'keyboard-trap', selector: info.selector || info.tag, message: 'Tab keeps focus on the same element (possible keyboard trap)' } ) );
				break;
			}
			continue;
		}
		repeats = 0;
		if ( info.seen ) {
			break; // cycled back to the start
		}
		if ( ! info.werun ) {
			continue;
		}
		const ax = await axName( cdp );
		const stop = { n: stops.length + 1, role: ax.role, name: ax.name, selector: info.selector, via: info.via || '', inactive: !! info.inactive, opacity: info.opacity, block: info.block, tag: info.tag, rect: info.rect, focusVisible: info.focusVisible, style: ( info.via ? 'on ' + info.via + ': ' : '' ) + ( info.style.outline !== 'none' ? 'outline ' + info.style.outline : info.style.boxShadow !== 'none' ? 'box-shadow ' + info.style.boxShadow : 'no outline/shadow' ), ring: info.ring || null, obscured: info.obscured };
		// Pixel diff: focused vs not focused, the box + 6 px.
		const clip = clipOf( info.rect, info.viewport, 6 );
		if ( clip ) {
			const focused = await page.screenshot( { clip } );
			const before = await page.evaluate( () => window.__wrbcA11y.styleNow() );
			await page.evaluate( async () => {
				window.__wrbcA11y.blurFocused();
				await window.__wrbcA11y.afterTab( 1, 500 );
			} );
			const plain = await page.screenshot( { clip } );
			let d = diffPng( focused, plain );
			// Nothing changed around the element: maybe the ring is on a card around it.
			if ( d.changed <= 3 ) {
				const big = await page.evaluate( () => {
					const W = window.__wrbcA11y;
					const el = W.focusTarget || W.focused;
					let box = el.closest( 'article, li, label, [class*="__card"], [class*="__item"], [class*="__option"], figure' ) || el.closest( W.WERUN );
					const r = box.getBoundingClientRect();
					return { x: r.left, y: r.top, w: r.width, h: r.height, sel: W.selector( box ) };
				} );
				const bigClip = clipOf( big, info.viewport, 8 );
				if ( bigClip && ( bigClip.width > clip.width || bigClip.height > clip.height ) ) {
					const plainBig = await page.screenshot( { clip: bigClip } );
					await page.evaluate( async () => {
						window.__wrbcA11y.refocus();
						await window.__wrbcA11y.afterTab( 1, 500 );
					} );
					const focusedBig = await page.screenshot( { clip: bigClip } );
					const d2 = diffPng( focusedBig, plainBig );
					if ( d2.changed > 3 ) {
						d = { ...d2, around: big.sel };
					}
					await page.evaluate( async () => {
						window.__wrbcA11y.blurFocused();
						await window.__wrbcA11y.afterTab( 1, 500 );
					} );
				}
			}
			const visible = await page.evaluate( async () => {
				const v = window.__wrbcA11y.refocus();
				await window.__wrbcA11y.afterTab( 1, 500 );
				return v;
			} );
			const per = 2 * ( Math.min( info.rect.w, info.viewport.w ) + Math.min( info.rect.h, info.viewport.h ) );
			stop.pixels = { changed: d.changed, strong: d.strong, maxRatio: d.maxRatio, medianRatio: d.medianRatio, area: per ? r2( d.strong / per ) : 0, around: d.around || '', bbox: d.bbox };
			stop.refocusVisible = visible;
			stop.styleFocused = before;
			// Verdicts. "strong" = pixels whose focused and plain colours differ by >= 3:1;
			// about one perimeter of them is a 1 px ring.
			const strongOk = d.strong >= 0.75 * per || ( d.strong >= 8 && d.strong >= 0.25 * d.changed );
			const ringLow = info.ring && info.ring.ratio < 3;
			const ringTxt = info.ring ? `${ info.via ? 'on ' + info.via + ', ' : '' }${ info.ring.kind === 'box-shadow' ? 'box-shadow ring' : 'outline' } ${ info.ring.color } is ${ info.ring.ratio }:1 against ${ info.ring.against }${ info.opacity < 0.99 ? ' (element opacity ' + info.opacity + ')' : '' }` : stop.style;
			// Inactive (aria-disabled) controls are exempt from 1.4.11, not from 2.4.7: their low contrast is a review.
			const inactiveTxt = info.inactive ? ' · inactive (aria-disabled/disabled): 1.4.11 exempts its contrast, the focus must still be visible (2.4.7)' : '';
			const pxTxt = `${ d.changed } px changed, ${ d.strong } with ≥3:1 (perimeter ${ Math.round( per ) } px)`;
			const base = { check: 'focus', sc: '1.4.11', rule: 'focus-contrast', selector: info.selector, block: info.block, snippet: info.snippet };
			if ( info.obscured && info.obscured.hidden ) {
				stop.indicator = 'obscured'; // reported once below (2.4.11)
			} else if ( d.changed <= 3 ) {
				stop.indicator = 'none';
				issues.push( issue( { ...base, sc: '2.4.7', rule: 'focus-visible', message: `no visible focus change (${ ax.role } "${ ax.name }"; ${ stop.style })` } ) );
			} else if ( ringLow ) {
				stop.indicator = strongOk ? 'low-outline' : 'low';
				issues.push( {
					...base,
					level: strongOk || info.inactive ? 'review' : 'fail',
					message: ( strongOk ? `${ ringTxt } (needs 3:1), but another part of the focus style changes by ≥3:1: ${ pxTxt }` : `${ ringTxt } (needs 3:1); ${ pxTxt }` ) + inactiveTxt,
					colors: { fg: info.ring.color, bg: info.ring.bgs.join( ' / ' ), ratio: info.ring.ratio, need: 3 },
				} );
			} else if ( info.ring && ! strongOk ) {
				stop.indicator = 'not-painted';
				issues.push( { ...base, level: d.strong < 8 && ! info.inactive ? 'fail' : 'review', rule: 'focus-clipped', message: `${ ringTxt }, yet only ${ pxTxt }: outline clipped by an overflow:hidden ancestor, covered, or off-screen?${ inactiveTxt }` } );
			} else if ( ! info.ring && ! strongOk ) {
				stop.indicator = 'low';
				issues.push( { ...base, level: info.inactive ? 'review' : 'fail', message: `focus change is low contrast (no outline; ${ stop.style }): ${ pxTxt }, median ${ d.medianRatio }:1, max ${ d.maxRatio }:1${ inactiveTxt }` } );
			} else {
				stop.indicator = 'ok';
			}
		} else {
			stop.indicator = 'offscreen';
		}
		// 2.4.11 not obscured.
		const ob = info.obscured;
		if ( ob && ob.hidden ) {
			issues.push( issue( { check: 'obscured', sc: '2.4.11', rule: 'focus-not-obscured', selector: info.selector, block: info.block, snippet: info.snippet, message: ob.inView === 0 ? 'focused element is outside the viewport after Tab' : `focused element entirely covered by ${ ob.by.join( ', ' ) }` } ) );
		} else if ( ob && ob.partial ) {
			issues.push( { check: 'obscured', level: 'review', sc: '2.4.12', rule: 'focus-partly-obscured', selector: info.selector, block: info.block, snippet: info.snippet, message: `focused element partly covered (${ ob.covered }/${ ob.inView } points) by ${ ob.by.join( ', ' ) }` } );
		}
		if ( ! ax.name && /^(link|button|tab|checkbox|radio|switch|menuitem|textbox|combobox|searchbox|slider)$/.test( ax.role ) ) {
			issues.push( issue( { check: 'focus', sc: '4.1.2', rule: 'focus-no-name', selector: info.selector, block: info.block, snippet: info.snippet, message: `focusable ${ ax.role } has no accessible name` } ) );
		}
		stops.push( stop );
	}
	await page.evaluate( () => window.__wrbcA11y.walkEnd() );
	await cdp.detach().catch( () => {} );
	return { stops, issues, presses };
}

/* ── Reflow 1.4.10 (320 px) ──────────────────────────────────────────── */

export async function reflow( page ) {
	const r = await page.evaluate( () => window.__wrbcA11y.reflow() );
	const issues = [];
	r.offenders.forEach( ( o ) =>
		issues.push( issue( { check: 'reflow', sc: '1.4.10', rule: 'reflow-overflow', selector: o.selector, block: o.block, snippet: o.snippet, message: `overflows the 320 px viewport: x ${ o.left }…${ o.right } (width ${ o.width }px, min-width ${ o.minWidth }, white-space ${ o.whiteSpace })` } ) )
	);
	if ( r.pageOverflow && ! r.offenders.length ) {
		issues.push( { check: 'reflow', level: 'review', sc: '1.4.10', rule: 'reflow-page', message: `page scrolls horizontally (${ r.scrollWidth } > ${ r.viewport }) but no werun element overflows (theme or a non-werun block?)` } );
	}
	r.clipped.forEach( ( c ) =>
		issues.push( { check: 'reflow', level: 'review', sc: '1.4.10', rule: 'reflow-clipped', selector: c.selector, block: c.block, snippet: c.snippet, message: `content cut by overflow:hidden of ${ c.clipBy } at 320 px (x ${ c.left }…${ c.right }, visible ${ c.clipLeft }…${ c.clipRight })` } )
	);
	r.scrollers.forEach( ( s ) => {
		if ( ! s.keyboardReachable ) {
			issues.push( issue( { check: 'reflow', sc: '2.1.1', rule: 'scroller-keyboard', selector: s.selector, block: s.block, message: `horizontal scroller (${ s.scrollWidth } in ${ s.clientWidth } px) is not keyboard reachable: not focusable and holds nothing focusable` } ) );
		} else {
			issues.push( { check: 'reflow', level: 'info', sc: '1.4.10', rule: 'scroller', selector: s.selector, block: s.block, message: `horizontal scroller ${ s.scrollWidth }/${ s.clientWidth } px, ${ s.focusable ? 'focusable' : 'holds focusable items' }${ s.role ? ', role ' + s.role : '' }${ s.label ? ', labelled' : '' }` } );
		}
	} );
	return { issues, data: r };
}

/* ── Motion 2.2.2 / 2.3.3 ────────────────────────────────────────────── */

export async function motion( page, { waitMs, reduced, t0 } ) {
	// Every block "in view" (autoplay pauses off screen): a viewport as tall as the page.
	const h = await page.evaluate( () => document.documentElement.scrollHeight );
	await page.setViewportSize( { width: page.viewportSize().width, height: Math.max( 900, Math.min( h + 20, 4000 ) ) } );
	await page.waitForTimeout( 300 );
	const snap = () => page.evaluate( () => window.__wrbcA11y.motion() );
	const early = await snap();
	const earlyNode = Date.now();
	// CSS animations are judged by their own timing (iterations × duration + delay > 5 s,
	// or infinite), so three looks are enough. Carousel tracks are watched for waitMs from
	// the moment each was first on screen (a busy machine starts them late), at most 8 s more.
	const trackWait = early.tracks.reduce( ( max, t ) => Math.max( max, waitMs - ( t.visibleAt === null ? 0 : early.at - t.visibleAt ) ), 0 );
	const lateIn = Math.min( Math.max( waitMs - ( earlyNode - t0 ), trackWait, 0 ), waitMs + 8000 );
	await page.waitForTimeout( Math.round( lateIn / 2 ) );
	const mid = await snap();
	await page.waitForTimeout( lateIn - Math.round( lateIn / 2 ) );
	const late = await snap();

	const issues = [];
	const sc = reduced ? '2.3.3' : '2.2.2';
	const pauseFor = ( block ) => late.pauses.filter( ( p ) => p.visible && ( ! block || p.block === block ) );

	// Animations.
	const seen = new Set();
	early.anims.concat( mid.anims, late.anims ).forEach( ( a ) => {
		const key = a.selector + a.pseudo + a.name;
		// An animation nobody can see (a hidden spinner) moves nothing on screen.
		if ( seen.has( key ) || ! a.visible ) {
			return;
		}
		const long = a.total === 'infinite' || a.total > 5000;
		if ( ! reduced && ! long ) {
			return; // short: it stops by itself within 5 s, whenever it started
		}
		seen.add( key );
		const length = a.total === 'infinite' ? 'loops forever' : `runs ${ ( a.total / 1000 ).toFixed( 1 ) } s`;
		const p = pauseFor( a.block );
		issues.push( {
			check: 'motion',
			level: reduced ? 'fail' : p.length ? 'review' : 'fail',
			sc,
			rule: reduced ? 'reduced-motion-animation' : 'animation-over-5s',
			selector: a.selector + ( a.pseudo || '' ),
			block: a.block,
			message: `${ reduced ? 'with prefers-reduced-motion: reduce, ' : '' }${ a.type } "${ a.name }" ${ length } (${ a.iterations } × ${ a.duration } ms${ a.delay ? ' + ' + a.delay + ' ms delay' : '' })${ p.length ? '; pause control: ' + p.map( ( x ) => x.selector ).join( ', ' ) : '; no pause control in the block' }`,
		} );
	} );

	// Carousel tracks that moved by themselves after they were first on screen.
	const moved = new Map();
	late.tracks.forEach( ( t ) => {
		if ( t.visibleAt === null || t.leftAtVisible === null ) {
			return;
		}
		// Re-snapping after a resize moves a track a few px: count real moves only.
		const thr = Math.max( 16, 0.1 * ( t.width || 0 ) );
		const dx = Math.abs( t.left - t.leftAtVisible );
		const dy = Math.abs( t.top - t.topAtVisible );
		const far = late.scrollLog.find( ( e ) => e.id === t.id && e.t > t.visibleAt + 300 && ( Math.abs( e.left - t.leftAtVisible ) >= thr || Math.abs( e.top - t.topAtVisible ) >= thr ) );
		if ( dx >= thr || dy >= thr || far ) {
			const secs = Math.round( ( late.at - t.visibleAt ) / 100 ) / 10;
			moved.set( 't' + t.id, {
				sel: t.selector,
				carousel: t.carousel,
				how: dx >= thr || dy >= thr ? `scrollLeft ${ t.leftAtVisible } → ${ t.left } in the ${ secs } s since it came on screen` : `scrolled to ${ far.left } and back within ${ secs } s`,
			} );
		}
	} );
	// Other scrollers inside werun blocks that scrolled by themselves.
	const others = new Map();
	late.scrollLog
		.filter( ( e ) => ! e.track && e.t > early.at )
		.forEach( ( e ) => {
			const o = others.get( e.id ) || { sel: e.sel, min: e.left, max: e.left };
			o.min = Math.min( o.min, e.left );
			o.max = Math.max( o.max, e.left );
			others.set( e.id, o );
		} );
	others.forEach( ( o, id ) => {
		if ( o.max - o.min >= 24 ) {
			moved.set( 's' + id, { sel: o.sel, carousel: null, how: `scrollLeft ${ o.min } … ${ o.max } without any input` } );
		}
	} );
	moved.forEach( ( m ) => {
		const car = m.carousel;
		const pb = car && car.pauseButton && car.pauseButton.visible;
		issues.push( {
			check: 'motion',
			level: reduced ? 'fail' : pb ? 'review' : 'fail',
			sc,
			rule: reduced ? 'reduced-motion-autoplay' : 'auto-advance',
			selector: m.sel,
			block: car ? car.block : '',
			message: `${ reduced ? 'with reduced motion, ' : '' }content moves by itself (${ m.how })${ car ? ' — carousel ' + car.selector : '' }${ pb ? '; pause button ' + car.pauseButton.selector + ' "' + car.pauseButton.label + '"' : car && car.pauseButton ? '; its pause button ' + car.pauseButton.selector + ' is hidden' : '; no pause button' }`,
		} );
	} );
	const movedCarousels = new Set( Array.from( moved.values() ).map( ( m ) => m.carousel && m.carousel.id ) );
	if ( ! reduced ) {
		late.carousels
			.filter( ( c ) => c.autoplay && ! ( c.pauseButton && c.pauseButton.visible ) && ! movedCarousels.has( c.id ) )
			.forEach( ( c ) => issues.push( issue( { check: 'motion', sc: '2.2.2', rule: 'autoplay-no-pause', selector: c.selector, block: c.block, message: `autoplay carousel (interval ${ c.interval }) without a visible pause button${ c.pauseButton ? ' (' + c.pauseButton.selector + ' is hidden)' : '' }` } ) ) );
	}

	// Videos.
	late.videos
		.filter( ( v ) => ! v.paused && v.visible )
		.forEach( ( v ) => {
			const p = pauseFor( v.block );
			issues.push( {
				check: 'motion',
				level: reduced ? 'fail' : p.length ? 'info' : 'fail',
				sc,
				rule: reduced ? 'reduced-motion-video' : 'video-playing',
				selector: v.selector,
				block: v.block,
				message: `${ reduced ? 'with reduced motion, ' : '' }video playing at ${ Math.round( ( Date.now() - t0 ) / 1000 ) } s (muted ${ v.muted }, loop ${ v.loop })${ p.length ? '; pause control ' + p.map( ( x ) => x.selector + ' "' + x.label + '"' ).join( ', ' ) : '; no pause control' }`,
			} );
		} );
	return { issues, data: { early: summarizeMotion( early ), mid: summarizeMotion( mid ), late: summarizeMotion( late ), watchedMs: Date.now() - t0 } };
}
const summarizeMotion = ( m ) => ( { at: m.at, anims: m.anims.length, videos: m.videos, carousels: m.carousels, tracks: m.tracks, scrollEvents: m.scrollLog.length } );

/* ── Editor ──────────────────────────────────────────────────────────── */

export async function editor( ctx, editUrl ) {
	const page = await ctx.newPage();
	await page.setViewportSize( { width: 1440, height: 1000 } );
	const errors = [];
	page.on( 'pageerror', ( e ) => errors.push( 'pageerror: ' + String( e && e.message ? e.message : e ).slice( 0, 300 ) ) );
	page.on( 'console', ( m ) => {
		if ( m.type() === 'error' ) {
			errors.push( m.text().slice( 0, 300 ) );
		}
	} );
	const issues = [];
	const data = {};
	try {
		// The editor loads ~100 scripts: on a busy local server one may fail and the editor never starts. Retry once.
		for ( let attempt = 1; ; attempt++ ) {
			await page.goto( editUrl, { waitUntil: 'domcontentloaded', timeout: 60000 } );
			if ( /wp-login\.php/.test( page.url() ) ) {
				throw new Error( 'redirected to wp-login.php: the auth cookies were refused' );
			}
			const ok = await page
				.waitForFunction( () => window.wp && wp.data && wp.data.select( 'core/block-editor' ) && wp.data.select( 'core/block-editor' ).getBlocks().length > 0, null, { timeout: 45000 } )
				.then( () => true, ( e ) => ( attempt >= 2 ? Promise.reject( e ) : false ) );
			if ( ok ) {
				break;
			}
			errors.length = 0;
		}
		await page.evaluate( () => {
			try {
				wp.data.dispatch( 'core/preferences' ).set( 'core/edit-post', 'welcomeGuide', false );
				wp.data.dispatch( 'core/preferences' ).set( 'core', 'welcomeGuide', false );
			} catch ( e ) {}
		} );
		const frameEl = await page.waitForSelector( 'iframe[name="editor-canvas"]', { timeout: 30000 } ).catch( () => null );
		const frame = frameEl ? await frameEl.contentFrame() : page.mainFrame();
		await frame.waitForSelector( '[data-type^="werun-community/"]', { timeout: 30000 } );
		await page.waitForLoadState( 'networkidle', { timeout: 8000 } ).catch( () => {} );
		await page.waitForTimeout( 600 );
		data.invalid = await page.evaluate( () => {
			const out = [];
			const walk = ( bs ) =>
				bs.forEach( ( b ) => {
					if ( b.isValid === false ) {
						// Each issue is a printf-style log call: fill the %s / %o with its arguments.
						const fmt = ( args ) => {
							const rest = ( args || [] ).slice( 1 );
							return String( ( args || [] )[ 0 ] || '' )
								.replace( /%[sod]/g, () => {
									const v = rest.shift();
									return v && typeof v === 'object' ? ( v.name || '[object]' ) : String( v ).replace( /\s+/g, ' ' ).slice( 0, 160 );
								} )
								.replace( /\s+/g, ' ' );
						};
						out.push( { name: b.name, issues: ( b.validationIssues || [] ).map( ( i ) => fmt( i.args ).slice( 0, 400 ) ) } );
					}
					walk( b.innerBlocks || [] );
				} );
			walk( wp.data.select( 'core/block-editor' ).getBlocks() );
			return out;
		} );
		data.warnings = await frame.evaluate( () => {
			const seen = new Set();
			return Array.from( document.querySelectorAll( '.block-editor-warning, .has-warning' ) )
				.map( ( w ) => ( { text: ( ( w.querySelector( '.block-editor-warning__message' ) || w ).textContent || '' ).replace( /\s+/g, ' ' ).trim().slice( 0, 200 ), block: ( w.closest( '[data-type]' ) || w ).getAttribute( 'data-type' ) || '' } ) )
				.filter( ( w ) => {
					const k = w.block + '|' + w.text;
					return seen.has( k ) ? false : seen.add( k );
				} );
		} );
		const blocks = await page.evaluate( () => {
			const out = [];
			const walk = ( bs ) =>
				bs.forEach( ( b ) => {
					if ( b.name.indexOf( 'werun-community/' ) === 0 ) {
						out.push( { clientId: b.clientId, name: b.name } );
					}
					walk( b.innerBlocks || [] );
				} );
			walk( wp.data.select( 'core/block-editor' ).getBlocks() );
			return out;
		} );
		for ( const b of blocks ) {
			await page.evaluate( ( id ) => {
				wp.data.dispatch( 'core/block-editor' ).selectBlock( id );
				const tries = [
					() => wp.data.dispatch( 'core/edit-post' ).openGeneralSidebar( 'edit-post/block' ),
					() => wp.data.dispatch( 'core/interface' ).enableComplementaryArea( 'core', 'edit-post/block' ),
					() => wp.data.dispatch( 'core/interface' ).enableComplementaryArea( 'core/edit-post', 'edit-post/block' ),
				];
				for ( const t of tries ) {
					try {
						t();
						break;
					} catch ( e ) {}
				}
			}, b.clientId );
			await page.waitForTimeout( 450 );
			b.audit = await page.evaluate( () => Array.from( document.querySelectorAll( '.wrbc-contrast-audit' ) ).map( ( n ) => ( n.innerText || '' ).replace( /\s+\n/g, '\n' ).trim().slice( 0, 800 ) ) );
			b.inspector = await page.evaluate( () => !! document.querySelector( '.block-editor-block-inspector' ) );
		}
		data.blocks = blocks;
		data.invalid.forEach( ( b ) => issues.push( issue( { check: 'editor', sc: '', rule: 'block-invalid', block: b.name, message: `block validation failed: ${ b.issues.join( ' | ' ).slice( 0, 400 ) }` } ) ) );
		data.warnings.forEach( ( w ) => issues.push( issue( { check: 'editor', sc: '', rule: 'block-warning', block: w.block, message: `editor warning: ${ w.text }` } ) ) );
		blocks.forEach( ( b ) => {
			( b.audit || [] ).forEach( ( text ) => {
				if ( text ) {
					issues.push( { check: 'editor', level: 'review', sc: '1.4.3', rule: 'contrast-audit', block: b.name, message: 'ContrastAudit: ' + text.replace( /\n+/g, ' · ' ).slice( 0, 500 ) } );
				}
			} );
		} );
		if ( blocks.length && ! blocks.some( ( b ) => ( b.audit || [] ).length ) ) {
			issues.push( { check: 'editor', level: 'info', sc: '', rule: 'contrast-audit-missing', message: 'no .wrbc-contrast-audit notice in the sidebar for any werun block' } );
		}
	} catch ( e ) {
		issues.push( issue( { check: 'error', sc: '', rule: 'editor-load', message: 'editor: ' + e.message.split( '\n' )[ 0 ] } ) );
	}
	data.consoleErrors = Array.from( new Set( errors ) );
	consoleIssues( errors, 'console-error' ).forEach( ( i ) => issues.push( { ...i, check: 'editor' } ) );
	await page.close().catch( () => {} );
	return { issues, data };
}
