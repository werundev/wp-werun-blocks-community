/**
 * Colours the comparison table works out from its settings and the
 * background it sits on, so every part stays readable (docs/accessibility.md).
 * Twin of wrbc_comparison_colors() / wrbc_comparison_area() at the top of
 * render.php: same rules, same results (src/shared/contrast.js is the twin of
 * includes/a11y/contrast.php).
 *
 * The table paints the background it sits on (a dark section: a dark table),
 * or the Table background picked for it; the header row, the stripes and the
 * featured column paint their own. Each of those parts gets its tone class
 * and, only where it differs from the part around it, its text colour, muted
 * text and the accent as text, links, icons and focus ring. Colours the author
 * picked in the block's own colour panel are made readable where they're
 * printed (the stored value stays as chosen); the Color panel's text colour is
 * made readable on the table's own backgrounds, never on the block's.
 */
import {
	AA_TEXT,
	AA_UI,
	ACCENT,
	INK,
	PAPER,
	accentVars,
	blockColors,
	colorHex,
	colorMix,
	colorOver,
	colorRgba,
	contrastRatio,
	isDarkColor,
	onColor,
	pageColors,
	readableColor,
	toneClass,
} from '../shared/contrast';

const WHITE = [ 255, 255, 255, 1 ];
const same = ( x, y ) => String( x ).toLowerCase() === String( y ).toLowerCase();

/** Text: 4.5:1 (readableColor() re-checks the rounded hex). */
export const TEXT_MIN = AA_TEXT;

/** A picked colour that can be read, as rgba, or null. */
const picked = ( value ) => ( typeof value === 'string' && value ? colorRgba( value ) : null );

/**
 * One part of the table that paints its own background: its tone class and
 * what keeps it readable there, each printed only where it differs from what
 * the part inherits (PHP: wrbc_comparison_area()).
 *
 * @param {string}      bg     The part's background (opaque hex).
 * @param {Object}      parent The part around it: { bg, text, alpha, accentText, mutedAbs }.
 * @param {string}      chosen The block's Color panel text colour ('' = none).
 * @param {string}      accent The accent.
 * @param {Object|null} fills  For a background the author picked behind accent fills: { on } (picked on-accent or '').
 * @return {{ className: string, vars: Object, ctx: Object }} Classes, custom properties, and the part as a parent.
 */
export function areaColors( bg, parent, chosen, accent, fills = null ) {
	let tone = toneClass( bg, parent.bg );
	// The same tone as the part around it: nothing to turn around.
	if ( tone && ( isDarkColor( bg ) === true ) === ( isDarkColor( parent.bg ) === true ) ) {
		tone = '';
	}
	const vars = {};

	// Text: the Color panel's made readable here; without one the tone's, or
	// what the part inherits when that reads, else white, ink or black.
	let text;
	if ( chosen ) {
		text = readableColor( chosen, bg, TEXT_MIN );
		if ( tone || ! same( text, parent.text ) ) {
			vars[ '--wrbc-cmp-ink' ] = text;
		}
	} else {
		// What assets/shared.css paints on .wrbc-is-dark / .wrbc-is-light.
		const kept = { 'wrbc-is-dark': PAPER, 'wrbc-is-light': '#000000' }[ tone ] || parent.text;
		if ( contrastRatio( kept, bg ) >= TEXT_MIN ) {
			text = kept;
		} else {
			text = onColor( bg );
			vars[ '--wrbc-cmp-ink' ] = text;
		}
	}

	// Muted text: the shared token (76 %, 85 % on dark) of that text, unless it
	// falls short there; an absolute colour printed around is reset here.
	const alpha = { 'wrbc-is-dark': 0.85, 'wrbc-is-light': 0.76 }[ tone ] || parent.alpha;
	const ink = colorRgba( text );
	let mutedAbs = false;
	if ( ink ) {
		const muted = colorHex( colorOver( [ ink[ 0 ], ink[ 1 ], ink[ 2 ], alpha ], colorRgba( bg ) ) );
		if ( contrastRatio( muted, bg ) < TEXT_MIN ) {
			vars[ '--wrbc-muted' ] = readableColor( muted, bg, TEXT_MIN );
			mutedAbs = true;
		} else if ( parent.mutedAbs ) {
			vars[ '--wrbc-muted' ] = `color-mix(in srgb, currentColor ${ Math.round( alpha * 100 ) }%, transparent)`;
		}
	}

	// The accent as text, links, icons and focus ring on this background.
	const accentText = readableColor( accent, bg, TEXT_MIN );
	if ( tone || ! same( accentText, parent.accentText ) ) {
		vars[ '--wrbc-accent-text' ] = accentText;
		vars[ '--wrbc-focus' ] = accentText;
	}

	// A picked background that hides the accent fills (button, badge): the
	// accent made to stand out from it, the text on the fills readable on that.
	if ( fills && contrastRatio( accent, bg ) < AA_UI ) {
		const fill = readableColor( accent, bg, AA_UI );
		vars[ '--wrbc-accent' ] = fill;
		vars[ '--wrbc-on-accent' ] = fills.on ? readableColor( fills.on, fill, TEXT_MIN ) : onColor( fill );
		// Hover/focus fill away from the label (accentVars()): lighter under a
		// dark label, else the stylesheet's darker one.
		vars[ '--wrbc-accent-hover' ] =
			isDarkColor( vars[ '--wrbc-on-accent' ] ) === true ? colorHex( colorMix( colorRgba( fill ), WHITE, 0.14 ) ) : 'initial';
	}

	return {
		className: [ tone, vars[ '--wrbc-cmp-ink' ] && 'has-cmp-ink' ].filter( Boolean ).join( ' ' ),
		vars,
		ctx: { bg, text, alpha, accentText, mutedAbs },
	};
}

/**
 * Everything the table prints for its colours (PHP: wrbc_comparison_colors()).
 *
 * @param {Object}  a             Attributes.
 * @param {string}  surface       What the block sits on (useSurface()).
 * @param {string}  around        What's around the block (useContextBackground()).
 * @param {Object}  opts          Options in effect.
 * @param {boolean} opts.featured A featured column is shown.
 * @param {boolean} opts.zebra    Stripes are on.
 * @param {boolean} opts.toggle   The billing switch is shown.
 * @return {Object} { rootClass, rootVars, table, head, alt, feat, featHead, featAlt, featCard } (parts: null when they inherit).
 */
export function comparisonColors( a, surface, around, { featured = false, zebra = false, toggle = false } = {} ) {
	const found = colorRgba( surface );
	const back = found ? colorOver( found, WHITE ) : WHITE;
	const surfaceHex = colorHex( back );
	const accentPick = picked( a.accentColor );
	const accent = accentPick ? a.accentColor : ACCENT;
	const onPick = picked( a.onAccentColor ) ? a.onAccentColor : '';
	const rootTone = toneClass( surfaceHex, around );
	const chosen = blockColors( a ).text;

	// The root: its tone, the accent (an automatic on-colour on a custom one,
	// a picked one made readable on it), the accent as text on the surface.
	let rootText = chosen;
	if ( ! rootText ) {
		rootText = { 'wrbc-is-dark': PAPER, 'wrbc-is-light': '#000000' }[ rootTone ] || ( isDarkColor( surfaceHex ) === true ? PAPER : pageColors().text );
	}
	const rootAccentText = readableColor( accent, surfaceHex, TEXT_MIN );
	// Accent, its on-colour (a picked one made readable on it), the hover fill
	// under a dark label, the accent as text on the surface.
	const rootVars = { ...accentVars( a, surfaceHex ), '--wrbc-cmp-surface': surfaceHex };
	// The "Save" note: accent text on a 14 % accent tint over the switch's 4 %
	// track (4 % black on a light background, 4 % white on a dark one).
	if ( toggle ) {
		const base = colorRgba( accent );
		const tint = isDarkColor( surfaceHex ) === true ? [ 255, 255, 255, 0.04 ] : [ 0, 0, 0, 0.04 ];
		const note = colorHex( colorOver( [ base[ 0 ], base[ 1 ], base[ 2 ], 0.14 ], colorOver( tint, back ) ) );
		rootVars[ '--wrbc-cmp-save' ] = readableColor( accent, note, TEXT_MIN );
		// Painted as that exact colour, so the note's text is checked against what shows.
		rootVars[ '--wrbc-cmp-save-bg' ] = note;
	}

	// The table: the Table background picked, else what the block sits on.
	const tablePick = picked( a.tableBg );
	const tableBg = tablePick ? colorHex( colorOver( tablePick, back ) ) : surfaceHex;
	rootVars[ '--wrbc-table-bg' ] = tableBg;
	const rootCtx = { bg: surfaceHex, text: rootText, alpha: rootTone === 'wrbc-is-dark' ? 0.85 : 0.76, accentText: rootAccentText, mutedAbs: false };
	const table = tablePick ? areaColors( tableBg, rootCtx, chosen, accent ) : null;
	const tableCtx = table ? table.ctx : { ...rootCtx, bg: tableBg };
	const tableRgba = colorRgba( tableBg );

	// The header row: its own background, else the table's part (on <thead>
	// too). Against the root: <thead> sits in <table>, beside <tbody>.
	const headPick = picked( a.headBg );
	let head = null;
	if ( headPick ) {
		const headBg = colorHex( colorOver( headPick, tableRgba ) );
		head = areaColors( headBg, rootCtx, chosen, accent );
		rootVars[ '--wrbc-cmp-head-bg' ] = headBg;
	}
	const headCtx = head ? head.ctx : tableCtx;

	// Stripes: the colour picked, else 4 % of the text over the table.
	let alt = null;
	let altBg = '';
	if ( zebra ) {
		const zebraPick = picked( a.zebraColor );
		const ink = colorRgba( tableCtx.text ) || colorRgba( INK );
		altBg = zebraPick ? colorHex( colorOver( zebraPick, tableRgba ) ) : colorHex( colorMix( tableRgba, ink, 0.04 ) );
		alt = areaColors( altBg, tableCtx, chosen, accent );
		// Printed, so a cell whose text colour changes keeps the stripe its colours were worked out for.
		rootVars[ '--wrbc-cmp-alt-bg' ] = altBg;
	}

	// The featured column: the background picked, else a 7 % accent tint (5 %
	// over a stripe); a picked one is kept on the stripes too.
	let feat = null;
	let featHead = null;
	let featAlt = null;
	let featCard = null;
	if ( featured ) {
		const featPick = picked( a.featuredBg );
		const accentRgba = colorRgba( accent );
		const featBg = featPick ? colorHex( colorOver( featPick, tableRgba ) ) : colorHex( colorMix( tableRgba, accentRgba, 0.07 ) );
		const fills = featPick ? { on: onPick } : null;
		feat = areaColors( featBg, tableCtx, chosen, accent, fills );
		// The exact colour its colours were worked out for (a CSS mix isn't rounded the same way).
		rootVars[ '--wrbc-cmp-feat-bg' ] = featBg;
		featHead = areaColors( featBg, headCtx, chosen, accent, fills );
		// The featured phone card: its own surface beside the others, on what the block sits on.
		featCard = areaColors( featBg, rootCtx, chosen, accent, fills );
		if ( zebra ) {
			const featAltBg = featPick ? featBg : colorHex( colorMix( colorRgba( altBg ), accentRgba, 0.05 ) );
			featAlt = areaColors( featAltBg, alt.ctx, chosen, accent, fills );
			rootVars[ '--wrbc-cmp-feat-alt-bg' ] = featAltBg;
		}
	}

	return { rootClass: rootTone, rootVars, table, head, alt, feat, featHead, featAlt, featCard };
}

/**
 * A style attribute without its custom text colour (the "automatic text
 * colour" fix in the contrast warning).
 *
 * @param {Object} style The block's style attribute.
 */
export function withoutTextColor( style ) {
	const color = { ...( ( style && style.color ) || {} ) };
	delete color.text;
	const next = { ...( style || {} ), color };
	if ( ! Object.keys( color ).length ) {
		delete next.color;
	}
	return Object.keys( next ).length ? next : undefined;
}
