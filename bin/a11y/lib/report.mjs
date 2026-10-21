/**
 * summary.md and results.json for one group.
 */
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

export const COLUMNS = [
	[ 'axe', 'axe' ],
	[ 'axe-review', 'review' ],
	[ 'focus', 'focus' ],
	[ 'obscured', 'obscured' ],
	[ 'target', 'target' ],
	[ 'reflow', 'reflow' ],
	[ 'spacing', 'spacing' ],
	[ 'motion', 'motion' ],
	[ 'nontext', 'non-text' ],
	[ 'pseudo', 'pseudo text' ],
	[ 'headings', 'headings' ],
	[ 'editor', 'editor' ],
	[ 'error', 'errors' ],
];

/** fail / review / bp / info counts of a list. */
export function counts( issues ) {
	const c = { fail: 0, review: 0, bp: 0, info: 0 };
	issues.forEach( ( i ) => ( c[ i.level ] = ( c[ i.level ] || 0 ) + 1 ) );
	return c;
}

const esc = ( s ) => String( s ?? '' ).replace( /\|/g, '\\|' ).replace( /\n/g, ' ' );
const code = ( s ) => ( s ? '`' + String( s ).replace( /`/g, "'" ) + '`' : '' );

function line( i ) {
	const tag = i.level === 'fail' ? '**FAIL**' : i.level === 'review' ? 'review' : i.level === 'bp' ? 'bp' : 'info';
	const sc = i.sc ? ` (${ i.sc }${ i.impact ? ', ' + i.impact : '' })` : i.impact ? ` (${ i.impact })` : '';
	let s = `- ${ tag } **${ i.check }${ i.rule ? ' ' + i.rule : '' }**${ sc }`;
	if ( i.selector ) {
		s += ` ${ code( i.selector ) }`;
	}
	s += ` — ${ esc( i.message ) }`;
	if ( i.colors && i.check === 'axe' && i.colors.ratio ) {
		s += ` · fg ${ i.colors.fg } on ${ i.colors.bg } = ${ i.colors.ratio }:1 (needs ${ i.colors.need || '?' }${ i.colors.fontSize ? ', ' + i.colors.fontSize + ' ' + ( i.colors.fontWeight || '' ) : '' })`;
	}
	if ( i.snippet && ! /^- (info)/.test( s ) && i.check !== 'axe-review' ) {
		s += `\n  ${ code( i.snippet.slice( 0, 170 ) ) }`;
	}
	return s;
}

/** Collapses identical lines (same check, rule, selector, message). */
function dedupe( list ) {
	const seen = new Map();
	list.forEach( ( i ) => {
		const k = [ i.check, i.rule, i.selector, i.message, i.level ].join( '|' );
		if ( seen.has( k ) ) {
			seen.get( k ).times++;
		} else {
			seen.set( k, { ...i, times: 1 } );
		}
	} );
	return Array.from( seen.values() );
}

export function writeReports( dir, run ) {
	mkdirSync( dir, { recursive: true } );
	writeFileSync( join( dir, 'results.json' ), JSON.stringify( run, null, 1 ) );

	const out = [];
	const o = run.options;
	out.push( `# a11y audit — group \`${ run.group }\`${ run.options.themeCss ? ' — with Hello Elementor CSS ' + ( run.options.themeCss === 'hello' ? 'first (before the block styles)' : 'last (after the block styles)' ) : '' }` );
	out.push( '' );
	out.push( `${ run.generatedAt } · ${ run.fixtures.length } fixtures · contexts ${ o.contexts.join( ', ' ) } · widths ${ o.widths.join( ', ' ) }${ o.skip.includes( 'reflow' ) ? '' : ' (+320 reflow)' } · checks skipped: ${ o.skip.join( ', ' ) || 'none' } · ${ run.seconds } s` );
	out.push( '' );
	out.push( 'Levels: **FAIL** = WCAG 2.2 AA failure found by the check · review = needs a human look (over images, partial, heuristics) · bp = axe best practice (not WCAG) · info = context. Checks and their SC: see README.md.' );
	out.push( '' );

	// Totals table.
	out.push( '| Fixture | Context | Width | ' + COLUMNS.map( ( c ) => c[ 1 ] ).join( ' | ' ) + ' | bp | FAIL | review |' );
	out.push( '|---|---|---|' + COLUMNS.map( () => '---' ).join( '|' ) + '|---|---|---|' );
	run.fixtures.forEach( ( f ) => {
		Object.entries( f.contexts ).forEach( ( [ ctx, c ] ) => {
			Object.entries( c.runs ).forEach( ( [ w, r ] ) => {
				const all = r.issues;
				const cell = ( check ) => {
					const list = all.filter( ( i ) => i.check === check && i.level !== 'info' );
					const fails = list.filter( ( i ) => i.level === 'fail' ).length;
					return list.length ? ( fails ? '**' + fails + '**' + ( list.length > fails ? '+' + ( list.length - fails ) : '' ) : String( list.length ) ) : '·';
				};
				const k = counts( all );
				out.push( `| ${ f.id } | ${ ctx } | ${ w } | ` + COLUMNS.map( ( col ) => cell( col[ 0 ] ) ).join( ' | ' ) + ` | ${ k.bp || '·' } | ${ k.fail || '·' } | ${ k.review || '·' } |` );
			} );
		} );
	} );
	out.push( '' );
	out.push( 'Cells: **failures**+reviews. Width "320" = the reflow run; "motion" / "reduced" = the 2.2.2 runs; "editor" = the block editor run.' );
	out.push( '' );

	if ( run.warnings.length ) {
		out.push( '## Harness warnings' );
		run.warnings.forEach( ( w ) => out.push( '- ' + esc( w ) ) );
		out.push( '' );
	}

	run.fixtures.forEach( ( f ) => {
		out.push( `## ${ f.id } — ${ f.title }` );
		out.push( '' );
		Object.entries( f.contexts ).forEach( ( [ ctx, c ] ) => {
			out.push( `### ${ f.id } · ${ ctx }` );
			out.push( '' );
			out.push( `Page: ${ c.url }${ c.edit ? ' · [edit](' + c.edit + ')' : '' }` );
			out.push( '' );
			Object.entries( c.runs ).forEach( ( [ w, r ] ) => {
				const k = counts( r.issues );
				const label = /^\d+$/.test( w ) ? `${ w } px` : w;
				out.push( `#### ${ label } — ${ k.fail } fail · ${ k.review } review · ${ k.bp } bp${ r.ms ? ' · ' + ( r.ms / 1000 ).toFixed( 1 ) + ' s' : '' }` );
				const shown = dedupe( r.issues.filter( ( i ) => i.level !== 'info' || i.check === 'motion' || i.rule === 'scroller' ) );
				const order = { fail: 0, review: 1, bp: 2, info: 3 };
				shown.sort( ( a, b ) => order[ a.level ] - order[ b.level ] || a.check.localeCompare( b.check ) );
				if ( ! shown.length ) {
					out.push( '- no issues' );
				}
				shown.forEach( ( i ) => out.push( line( i ) + ( i.times > 1 ? ` (×${ i.times })` : '' ) ) );
				if ( r.focus && r.focus.stops && r.focus.stops.length ) {
					out.push( '' );
					out.push( `<details><summary>Tab order (${ r.focus.stops.length } stops in werun blocks, ${ r.focus.presses } Tab presses)</summary>` );
					out.push( '' );
					r.focus.stops.forEach( ( s ) => {
						const px = s.pixels ? `Δ${ s.pixels.changed }px, ≥3:1 ${ s.pixels.strong }px (${ s.pixels.area }× perimeter)${ s.pixels.around ? ', ring on ' + s.pixels.around : '' }` : '';
						const ring = s.ring ? ` · ${ s.ring.kind === 'box-shadow' ? 'shadow ring' : 'outline' } ${ s.ring.color } ${ s.ring.ratio }:1 vs ${ s.ring.against }` : '';
						out.push( `${ s.n }. ${ s.role } "${ esc( s.name ).slice( 0, 60 ) }" ${ code( s.selector ) }${ s.via ? ' (focus shown on ' + code( s.via ) + ')' : '' } — ${ s.indicator }${ ring } · ${ px }${ s.obscured && s.obscured.covered ? ' · covered ' + s.obscured.covered + '/' + s.obscured.inView : '' }` );
					} );
					out.push( '' );
					out.push( '</details>' );
				}
				if ( r.headings && r.headings.length ) {
					out.push( '' );
					out.push( '<details><summary>Headings</summary>' );
					out.push( '' );
					r.headings.forEach( ( h ) => out.push( `- ${ '  '.repeat( Math.max( 0, h.level - 1 ) ) }h${ h.level } ${ esc( h.text ) }${ h.werun ? '' : ' _(outside werun)_' }${ h.hidden ? ' _(visually hidden)_' : '' }` ) );
					out.push( '' );
					out.push( '</details>' );
				}
				if ( r.ariaFile ) {
					out.push( '' );
					out.push( `ARIA snapshot: \`${ r.ariaFile }\`${ r.shot ? ' · screenshot: `' + r.shot + '`' : '' }` );
				} else if ( r.shot ) {
					out.push( '' );
					out.push( `Screenshot: \`${ r.shot }\`` );
				}
				out.push( '' );
			} );
		} );
	} );

	if ( run.php && run.php.length ) {
		out.push( '## PHP log during the run' );
		out.push( '' );
		out.push( 'New lines in debug.log while the audit ran (other agents may write there too):' );
		out.push( '' );
		run.php.slice( 0, 40 ).forEach( ( l ) => out.push( '- ' + code( l.slice( 0, 300 ) ) ) );
		out.push( '' );
	}
	writeFileSync( join( dir, 'summary.md' ), out.join( '\n' ) + '\n' );
}
