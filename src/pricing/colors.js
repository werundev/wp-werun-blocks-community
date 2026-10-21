/**
 * Colours the pricing table works out from its settings and the background
 * it sits on, so every part stays readable (docs/accessibility.md). Twin of
 * src/pricing/colors.php: same rules, same results (src/shared/contrast.js
 * is the twin of includes/a11y/contrast.php).
 *
 * Picked colours are never stored changed, only what's printed is
 * (docs/accessibility.md, "Colours the author picks").
 */
import {
	AA_TEXT,
	AA_UI,
	ACCENT,
	INK,
	PAPER,
	blockColors,
	blockSurface,
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

/**
 * The table's accent: its own when it can be read, otherwise the default.
 *
 * @param {string} value The accentColor attribute.
 */
export const accentOf = ( value ) => ( typeof value === 'string' && colorRgba( value ) ? value : ACCENT );

/**
 * The text colour a part of the table has on `under` when nothing else sets
 * it: the table's own text colour, white on a dark background (the tone
 * class), or the page's.
 *
 * @param {string} tableText The table's Color panel text colour ('' = none).
 * @param {string} under     The background.
 */
export function inheritedText( tableText, under ) {
	if ( tableText ) {
		return tableText;
	}
	return isDarkColor( under ) === true ? PAPER : pageColors().text;
}

/**
 * The text on an accent fill (buttons, badge, the selected period), and the
 * fill's hover colour when that text is dark: `on` when it reaches 4.5:1 on
 * `fill`, otherwise white or black, whichever does (one of them always does;
 * ink and white can both miss on a mid-tone such as #6366f1). The shared
 * buttons darken the fill on hover and focus, which would take dark text
 * under 4.5:1: a dark text gets a lightened fill (PHP: wrbc_pricing_fill_text()).
 *
 * @param {string} fill The fill.
 * @param {string} on   The text on it (picked and corrected, or automatic).
 * @return {{ on: string, hover: string }} hover is '' for light text.
 */
export function fillText( fill, on ) {
	if ( contrastRatio( on, fill ) < AA_TEXT ) {
		on = contrastRatio( PAPER, fill ) >= AA_TEXT ? PAPER : '#000000';
	}
	const hover = isDarkColor( on ) === true ? colorHex( colorMix( colorRgba( fill ), WHITE, 0.14 ) ) : '';
	return { on, hover };
}

/**
 * What the table prints on top of accentVars(): the text on the accent fills
 * when the automatic or picked one doesn't reach 4.5:1 (with its hover
 * colour), and the "Save" note's colour: accent text on a 14 % accent tint
 * over the switch's 4 % track, at its darkest on a light background (4 %
 * black) and its lightest on a dark one (4 % white). PHP:
 * wrbc_pricing_table_colors().
 *
 * @param {Object} a       The table's attributes.
 * @param {string} surface The table's background (useSurface()).
 * @param {Object} accent  accentVars() for it.
 * @return {Object} Custom properties.
 */
export function tableColors( a, surface, accent ) {
	const vars = {};
	const fill = accentOf( a.accentColor );
	const on = accent[ '--wrbc-on-accent' ] || PAPER;
	const text = fillText( fill, on );
	if ( ! same( text.on, on ) ) {
		vars[ '--wrbc-on-accent' ] = text.on;
		vars[ '--wrbc-accent-hover' ] = text.hover || 'initial';
	}

	const found = colorRgba( surface );
	if ( a.showToggle && found ) {
		const back = colorOver( found, WHITE );
		const tint = isDarkColor( colorHex( back ) ) === true ? [ 255, 255, 255, 0.04 ] : [ 0, 0, 0, 0.04 ];
		const base = colorRgba( fill );
		const note = colorOver( [ base[ 0 ], base[ 1 ], base[ 2 ], 0.14 ], colorOver( tint, back ) );
		vars[ '--wrbc-save-text' ] = readableColor( fill, colorHex( note ), AA_TEXT );
	}
	return vars;
}

/**
 * What a plan paints behind its content, and what keeps the plan readable on
 * it. The background: its own Color panel background, the featured
 * background, the plan background, the white of the Shadow style, the 4 %
 * tint of the Filled style, or for the featured plan a 6 % accent tint over
 * whatever is under it (as style.scss paints them); a Border plan is
 * transparent and takes the table's tone. On it:
 * - the tone class (light or dark context for links, focus, muted text);
 * - its text: the table's chosen text colour made readable on it (the
 *   closest colour to it); without one, the tone class's, or on the style's
 *   own white or tints what it inherits when that reads, and on a background
 *   the author chose white, ink or black (whichever reads);
 * - muted text and the accent as text and focus ring for that background;
 * - on a featured plan whose chosen background hides the accent fills
 *   (button, badge: under 3:1), the accent made to stand out from it (the
 *   closest colour at 3:1), with its text and hover colour to match.
 * PHP: wrbc_pricing_plan_colors().
 *
 * @param {Object}  a        The plan's attributes.
 * @param {Object}  table    The table's values (context): cardStyle, cardBg, featuredBg, accentColor, onAccentColor, textColor, style.
 * @param {string}  under    The background around the plan (useContextBackground()).
 * @param {boolean} featured Whether it's the featured plan.
 * @return {{ className: string, vars: Object, background: string }} Classes, custom properties, and the background ('' = the table's).
 */
export function planColors( a, table, under, featured ) {
	const found = colorRgba( under );
	const back = found ? colorOver( found, WHITE ) : WHITE;
	const around = colorHex( back );
	const accent = accentOf( table.accentColor );
	const cardStyle = [ 'bordered', 'filled', 'shadow' ].includes( table.cardStyle ) ? table.cardStyle : 'bordered';
	const own = blockSurface( a, 'werun-community/pricing-plan' );
	const featuredBg = colorRgba( typeof table.featuredBg === 'string' ? table.featuredBg : '' );
	const cardBg = colorRgba( typeof table.cardBg === 'string' ? table.cardBg : '' );
	let bg = null;
	let chosen = true;
	if ( own ) {
		bg = colorRgba( own );
	} else if ( featured && featuredBg ) {
		bg = featuredBg;
	} else if ( cardBg ) {
		bg = colorOver( cardBg, back );
		if ( featured ) {
			bg = colorMix( bg, colorRgba( accent ), 0.06 );
		}
	} else {
		chosen = false;
		if ( featured ) {
			bg = colorMix( cardStyle === 'shadow' ? colorRgba( PAPER ) : back, colorRgba( accent ), 0.06 );
		} else if ( cardStyle === 'shadow' ) {
			bg = colorRgba( PAPER );
		} else if ( cardStyle === 'filled' ) {
			// --wrbc-surface is 4 % of the text colour: black on a light background, white on a dark one.
			bg = colorOver( isDarkColor( around ) === true ? [ 255, 255, 255, 0.04 ] : [ 0, 0, 0, 0.04 ], back );
		}
	}
	if ( ! bg ) {
		return { className: '', vars: {}, background: '' };
	}
	const hex = colorHex( colorOver( bg, back ) );
	const tone = toneClass( hex, around );
	const vars = {};

	// Text: its own colour (Color panel: never changed, the warning says when
	// it doesn't read), or the table's made readable here, or an automatic one.
	let text = blockColors( a ).text;
	const tableText = blockColors( { textColor: table.textColor, style: table.style } ).text;
	if ( ! text && tableText ) {
		// Printed when it changes, or a tone class would replace it.
		text = readableColor( tableText, hex, AA_TEXT );
		if ( tone || ! same( text, tableText ) ) {
			vars[ '--wrbc-plan-text' ] = text;
		}
	} else if ( ! text ) {
		// The tone class's, or on the style's own white or tints the theme's
		// (made for a page like that); a background the author chose gets
		// white, ink or black.
		const kept = { 'wrbc-is-dark': PAPER, 'wrbc-is-light': INK }[ tone ] || ( chosen ? '' : inheritedText( '', around ) );
		if ( kept && contrastRatio( kept, hex ) >= AA_TEXT ) {
			text = kept;
		} else {
			text = onColor( hex );
			vars[ '--wrbc-plan-text' ] = text;
		}
	}
	const ink = colorRgba( text );
	if ( ink ) {
		const muted = colorHex( colorOver( [ ink[ 0 ], ink[ 1 ], ink[ 2 ], tone === 'wrbc-is-dark' ? 0.85 : 0.76 ], colorRgba( hex ) ) );
		if ( contrastRatio( muted, hex ) < AA_TEXT ) {
			vars[ '--wrbc-muted' ] = readableColor( muted, hex, AA_TEXT );
		}
	}

	// The accent as text, links and focus ring: its own when the table's
	// (made for the table's background) doesn't fit, or a tone class would
	// reset it.
	const accentText = readableColor( accent, hex, AA_TEXT );
	if ( tone || ! same( accentText, readableColor( accent, around, AA_TEXT ) ) ) {
		vars[ '--wrbc-accent-text' ] = accentText;
		vars[ '--wrbc-focus' ] = accentText;
	}

	// A featured plan on a chosen background that hides the accent fills
	// (button, badge): the accent made to stand out from it, and the text on
	// the fills (picked, or automatic) and their hover colour to match.
	if ( featured && chosen && contrastRatio( accent, hex ) < AA_UI ) {
		const fill = readableColor( accent, hex, AA_UI );
		const picked = typeof table.onAccentColor === 'string' && colorRgba( table.onAccentColor ) ? table.onAccentColor : '';
		const on = fillText( fill, picked ? readableColor( picked, fill, AA_TEXT ) : onColor( fill ) );
		vars[ '--wrbc-accent' ] = fill;
		vars[ '--wrbc-on-accent' ] = on.on;
		vars[ '--wrbc-accent-hover' ] = on.hover || 'initial';
	}

	return {
		className: [ tone, vars[ '--wrbc-plan-text' ] && 'has-plan-text', chosen && 'has-plan-bg' ].filter( Boolean ).join( ' ' ),
		vars,
		background: hex,
	};
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
