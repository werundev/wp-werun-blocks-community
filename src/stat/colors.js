/**
 * The background a stat paints — its own (Color panel) or its card's — and
 * what keeps its text readable on it: the tone class and the accent as text
 * and focus ring for that background. Twin of wrbc_stat_colors() in
 * src/stat/render.php: same rules, same results (src/shared/contrast.js is
 * the twin of includes/a11y/contrast.php).
 *
 * A text colour chosen on the stats block is kept when it already reads on
 * the card (4.5:1); otherwise the card's tone sets the text.
 */
import { AA_TEXT, AA_UI, ACCENT, PAPER, blockColors, blockSurface, colorHex, colorOver, colorRgba, isDarkColor, readableColor, toneClass } from '../shared/contrast';
import { cssVars } from '../shared/controls';

const WHITE = [ 255, 255, 255, 1 ];

/**
 * A custom property value as it reaches the page: wrbc_css_vars() prints a
 * colour function it can read as hex, and WordPress's safecss_filter_attr()
 * (get_block_wrapper_attributes()) keeps only var(), calc(), min(), max(),
 * minmax(), clamp() and repeat() among the rest ('' = dropped).
 *
 * @param {string} value Value printed by cssVars().
 */
export function pageValue( value ) {
	if ( typeof value !== 'string' ) {
		return '';
	}
	// wrbc_css_vars() prints a colour function it can read as hex (with alpha).
	if ( /^(rgba?|hsla?|color-mix)\s*\(/i.test( value ) ) {
		return colorHex( colorRgba( value ) );
	}
	const other = ( value.match( /[a-z-]+(?=\()/gi ) || [] ).filter( ( fn ) => ! /^(var|calc|min|max|minmax|clamp|repeat)$/i.test( fn ) );
	return other.length ? '' : value;
}

/**
 * readableColor() for a colour on a layer over another background. A
 * translucent layer is read twice: as painted, and with its alpha the way
 * browsers print it in computed styles (two decimals: 20/255 → 0.08), which
 * is what axe and other checkers blend with. Twin of wrbc_stat_readable_on().
 *
 * @param {string} fg    Colour.
 * @param {Array}  layer The layer, [ r, g, b, a ].
 * @param {Array}  under What's under it, opaque.
 * @param {number} min   Ratio to reach.
 */
function readableOn( fg, layer, under, min ) {
	let out = readableColor( fg, colorHex( colorOver( layer, under ) ), min );
	if ( layer[ 3 ] < 1 ) {
		out = readableColor( out, colorHex( colorOver( [ layer[ 0 ], layer[ 1 ], layer[ 2 ], Math.round( layer[ 3 ] * 100 ) / 100 ], under ) ), min );
	}
	return out;
}

/** A colour attribute as it reaches the page ('' when it doesn't). Twin of wrbc_stat_page_color(). */
function pageColor( value ) {
	return pageValue( cssVars( { '--x': value } )[ '--x' ] );
}

/**
 * What keeps a stat readable on what it paints — its own background (Color
 * panel) or its card's — and on what it sits on. Twin of wrbc_stat_colors()
 * in src/stat/render.php (docs/accessibility.md):
 * - the tone class (light or dark text) for its background, unless a text
 *   colour was chosen on the stats block: the Color panel is never
 *   overridden (ContrastAudit says when it fails);
 * - the accent as text and focus ring, readable on that background;
 * - the icon colour (the stats block's own picker, or the accent) made
 *   readable (3:1) on the icon's holder or the stat's background.
 *
 * @param {Object} a      The stat's attributes.
 * @param {Object} stats  The stats block's values (context): layout, cardStyle, cardBg, accentColor, textColor, style, showIcon, iconStyle, iconColor, iconBg.
 * @param {string} around The background around the stat (useContextBackground()).
 * @return {{ className: string, vars: Object, background: string }} Tone class, custom
 *         properties, and the background it worked out ('' = the one around it).
 */
export function statColors( a, stats, around ) {
	const found = colorRgba( around );
	const under = found ? colorOver( found, WHITE ) : WHITE;
	const accent = typeof stats.accentColor === 'string' ? stats.accentColor : '';
	const base = accent && colorRgba( accent ) ? accent : ACCENT;
	// What the stats block prints for its surface (accentVars()).
	let text = readableColor( base, colorHex( under ), AA_TEXT );
	let paint = colorHex( under );
	let className = '';
	const vars = {};

	let bg = null;
	const own = blockSurface( a, 'werun-community/stat' );
	if ( own ) {
		bg = colorRgba( own );
	} else if ( stats.layout === 'cards' ) {
		const style = [ 'bordered', 'filled', 'shadow' ].includes( stats.cardStyle ) ? stats.cardStyle : 'filled';
		bg = colorRgba( pageColor( stats.cardBg ) );
		if ( ! bg && style === 'shadow' ) {
			bg = colorRgba( PAPER );
		} else if ( ! bg && style === 'filled' ) {
			// --wrbc-surface is 4 % of the text colour: at its darkest on a
			// light background, its lightest on a dark one.
			bg = isDarkColor( under ) === true ? [ 255, 255, 255, 0.04 ] : [ 0, 0, 0, 0.04 ];
		}
	}
	if ( bg ) {
		paint = colorHex( colorOver( bg, under ) );
		if ( ! blockColors( { textColor: stats.textColor, style: stats.style } ).text ) {
			className = toneClass( paint, colorHex( under ) );
		}
		const card = readableOn( base, bg, under, AA_TEXT );
		// Its own values when the stats block's don't fit this background, or
		// the tone class would reset them.
		if ( className || String( card ).toLowerCase() !== String( text ).toLowerCase() ) {
			text = card;
			vars[ '--wrbc-accent-text' ] = card;
			vars[ '--wrbc-focus' ] = card;
		}
	}

	if ( stats.showIcon ) {
		// The holder: the icon background picked, or the accent at 12 %
		// (assets/shared.css); none for a plain icon or a ring.
		let fill = [ 0, 0, 0, 0 ];
		if ( [ 'circle', 'square' ].includes( stats.iconStyle ) ) {
			fill = colorRgba( pageColor( stats.iconBg ) );
			if ( ! fill ) {
				fill = colorRgba( pageColor( accent ) ) || colorRgba( ACCENT );
				fill = [ fill[ 0 ], fill[ 1 ], fill[ 2 ], 0.12 * fill[ 3 ] ];
			}
		}
		const picked = pageColor( stats.iconColor );
		const icon = picked && colorRgba( picked ) ? picked : text;
		const fixed = readableOn( icon, fill, colorRgba( paint ), AA_UI );
		if ( String( fixed ).toLowerCase() !== String( icon ).toLowerCase() ) {
			vars[ '--wrbc-icon-color' ] = fixed;
		}
	}

	return { className, vars, background: bg ? paint : '' };
}

/**
 * A block's style attribute without its custom text colour, for the
 * "automatic text colour" fix in the contrast warning.
 *
 * @param {Object} style The style attribute.
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
