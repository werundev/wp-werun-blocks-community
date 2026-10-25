/**
 * Colour contrast (WCAG 2.2, 1.4.3 and 1.4.11) for the editor: read a CSS
 * colour, measure the contrast of two colours, pick a readable one, tell
 * dark from light, and know the background a block sits on.
 *
 * Twin of includes/a11y/contrast.php and context.php: same names in
 * camelCase, same maths, and the same palette (wrbcSettings.colors), so the
 * preview and the page pick the same colours. Contract: docs/accessibility.md.
 */
import { useSelect } from '@wordpress/data';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { getBlockType } from '@wordpress/blocks';

/** Text on light backgrounds (slate 900) and on dark ones. */
export const INK = '#0f172a';
export const PAPER = '#ffffff';
/** The accent every block starts with (--wrbc-accent in assets/shared.css). */
export const ACCENT = '#4f46e5';
/** Minimum ratios: text, large text, non-text (controls, focus, meaningful icons). */
export const AA_TEXT = 4.5;
export const AA_LARGE = 3;
export const AA_UI = 3;

const WHITE = [ 255, 255, 255, 1 ];
const BLACK = [ 0, 0, 0, 1 ];

const colorSettings = () => ( window.wrbcSettings && window.wrbcSettings.colors ) || {};

/** The page's background and text colours, as PHP's wrbc_page_colors() sees them. */
export function pageColors() {
	return { background: PAPER, text: '#1e1e1e', ...( colorSettings().page || {} ) };
}

/** A palette colour (or gradient) by slug, '' when there's none. */
export function presetColor( slug, kind = 'palette' ) {
	const map = colorSettings()[ kind === 'gradients' ? 'gradients' : 'palette' ] || {};
	return typeof slug === 'string' && map[ slug ] ? map[ slug ] : '';
}

function cssNumber( value, max ) {
	const m = String( value ).trim().match( /^[+-]?(\d+\.?\d*|\.\d+)(%|deg)?$/ );
	if ( ! m ) {
		return null;
	}
	const n = parseFloat( value );
	return m[ 2 ] === '%' ? ( n / 100 ) * max : n;
}

function splitArgs( args ) {
	const parts = [];
	let depth = 0;
	let part = '';
	for ( const char of args ) {
		if ( char === '(' ) {
			depth++;
		} else if ( char === ')' ) {
			depth--;
		}
		if ( char === ',' && depth === 0 ) {
			parts.push( part.trim() );
			part = '';
			continue;
		}
		part += char;
	}
	parts.push( part.trim() );
	return parts;
}

function hslToRgb( h, s, l ) {
	h = ( ( ( h % 360 ) + 360 ) % 360 ) / 360;
	s = Math.max( 0, Math.min( 1, s ) );
	l = Math.max( 0, Math.min( 1, l ) );
	if ( s === 0 ) {
		return [ l * 255, l * 255, l * 255 ];
	}
	const q = l < 0.5 ? l * ( 1 + s ) : l + s - l * s;
	const p = 2 * l - q;
	const hue = ( t ) => {
		t = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
		if ( t < 1 / 6 ) {
			return p + ( q - p ) * 6 * t;
		}
		if ( t < 1 / 2 ) {
			return q;
		}
		if ( t < 2 / 3 ) {
			return p + ( q - p ) * ( 2 / 3 - t ) * 6;
		}
		return p;
	};
	return [ hue( h + 1 / 3 ) * 255, hue( h ) * 255, hue( h - 1 / 3 ) * 255 ];
}

let canvasCtx = null;
/** Any other colour the browser understands (oklch(), lab(), named colours…), through a canvas. */
function canvasColor( value ) {
	if ( typeof document === 'undefined' ) {
		return null;
	}
	if ( ! canvasCtx ) {
		const canvas = document.createElement( 'canvas' );
		canvas.width = canvas.height = 1;
		canvasCtx = canvas.getContext( '2d', { willReadFrequently: true } );
	}
	if ( ! canvasCtx ) {
		return null;
	}
	// Two sentinels: a value the canvas rejects leaves the previous one.
	canvasCtx.fillStyle = '#010203';
	canvasCtx.fillStyle = value;
	const first = canvasCtx.fillStyle;
	canvasCtx.fillStyle = '#030201';
	canvasCtx.fillStyle = value;
	if ( first !== canvasCtx.fillStyle ) {
		return null;
	}
	canvasCtx.clearRect( 0, 0, 1, 1 );
	canvasCtx.fillRect( 0, 0, 1, 1 );
	const d = canvasCtx.getImageData( 0, 0, 1, 1 ).data;
	return [ d[ 0 ], d[ 1 ], d[ 2 ], d[ 3 ] / 255 ];
}

/**
 * A CSS colour as [ r, g, b, a ] (channels 0–255, alpha 0–1), or null when it
 * can't be known (currentColor, a theme variable). Same formats as PHP's
 * wrbc_color_rgba(), plus anything the browser can paint when `browser` is on
 * (computed styles: color(srgb …), oklch(), lab()…).
 *
 * @param {*}       color   CSS colour, or an [ r, g, b, a ] array.
 * @param {boolean} browser Fall back to the browser for other syntaxes.
 * @param {number}  depth   Internal: presets that point at presets.
 */
export function colorRgba( color, browser = false, depth = 0 ) {
	if ( Array.isArray( color ) ) {
		return color.length === 4 ? color.map( Number ) : null;
	}
	if ( ( typeof color !== 'string' && typeof color !== 'number' ) || depth > 4 ) {
		return null;
	}
	const c = String( color ).trim().toLowerCase();
	if ( ! c ) {
		return null;
	}
	if ( c === 'transparent' ) {
		return [ 0, 0, 0, 0 ];
	}
	if ( c === 'white' ) {
		return [ ...WHITE ];
	}
	if ( c === 'black' ) {
		return [ ...BLACK ];
	}
	let m = c.match( /^var:preset\|color\|([a-z0-9_-]+)$/ ) || c.match( /^var\(\s*--wp--preset--color--([a-z0-9_-]+)\s*(?:,[^()]*)?\)$/ );
	if ( m ) {
		return colorRgba( presetColor( m[ 1 ] ), browser, depth + 1 );
	}
	m = c.match( /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/ );
	if ( m ) {
		let hex = m[ 1 ];
		if ( hex.length <= 4 ) {
			hex = hex.replace( /(.)/g, '$1$1' );
		}
		const n = ( i ) => parseInt( hex.slice( i, i + 2 ), 16 );
		return [ n( 0 ), n( 2 ), n( 4 ), hex.length === 8 ? n( 6 ) / 255 : 1 ];
	}
	m = c.match( /^(rgba?|hsla?)\(\s*([^()]*)\)$/ );
	if ( m ) {
		const parts = m[ 2 ].trim().split( /[\s,/]+/ ).filter( Boolean );
		if ( parts.length < 3 || parts.length > 4 ) {
			return null;
		}
		const alpha = parts[ 3 ] !== undefined ? cssNumber( parts[ 3 ], 1 ) : 1;
		let rgb;
		if ( m[ 1 ].startsWith( 'rgb' ) ) {
			rgb = parts.slice( 0, 3 ).map( ( p ) => cssNumber( p, 255 ) );
		} else {
			const h = cssNumber( parts[ 0 ], 360 );
			let s = cssNumber( parts[ 1 ], 1 );
			let l = cssNumber( parts[ 2 ], 1 );
			if ( h === null || s === null || l === null ) {
				return null;
			}
			s = s > 1 ? s / 100 : s;
			l = l > 1 ? l / 100 : l;
			rgb = hslToRgb( h, s, l );
		}
		if ( rgb.includes( null ) || alpha === null ) {
			return null;
		}
		return [ ...rgb.map( ( v ) => Math.max( 0, Math.min( 255, v ) ) ), Math.max( 0, Math.min( 1, alpha ) ) ];
	}
	// Computed styles of color-mix() and modern colours: color(srgb r g b / a), 0–1 channels.
	m = c.match( /^color\(\s*srgb\s+([\d.e+-]+)\s+([\d.e+-]+)\s+([\d.e+-]+)(?:\s*\/\s*([\d.e+-]+%?))?\s*\)$/ );
	if ( m ) {
		const a = m[ 4 ] === undefined ? 1 : cssNumber( m[ 4 ], 1 );
		return [ parseFloat( m[ 1 ] ) * 255, parseFloat( m[ 2 ] ) * 255, parseFloat( m[ 3 ] ) * 255, a === null ? 1 : a ].map( ( v, i ) => ( i < 3 ? Math.max( 0, Math.min( 255, v ) ) : Math.max( 0, Math.min( 1, v ) ) ) );
	}
	if ( c.startsWith( 'color-mix(' ) && c.endsWith( ')' ) ) {
		const args = splitArgs( c.slice( 10, -1 ) );
		if ( args.length === 3 && /^in\s+srgb$/.test( args[ 0 ] ) ) {
			const colors = [];
			const pcts = [];
			for ( let arg of [ args[ 1 ], args[ 2 ] ] ) {
				let pct = null;
				let p = arg.match( /^(.*?)\s+([\d.]+)%$/ );
				if ( p ) {
					arg = p[ 1 ];
					pct = parseFloat( p[ 2 ] );
				} else if ( ( p = arg.match( /^([\d.]+)%\s+(.*)$/ ) ) ) {
					arg = p[ 2 ];
					pct = parseFloat( p[ 1 ] );
				}
				const rgba = colorRgba( arg, browser, depth + 1 );
				if ( ! rgba ) {
					return null;
				}
				colors.push( rgba );
				pcts.push( pct );
			}
			if ( pcts[ 0 ] === null && pcts[ 1 ] === null ) {
				pcts[ 0 ] = pcts[ 1 ] = 50;
			} else if ( pcts[ 0 ] === null ) {
				pcts[ 0 ] = 100 - pcts[ 1 ];
			} else if ( pcts[ 1 ] === null ) {
				pcts[ 1 ] = 100 - pcts[ 0 ];
			}
			const sum = pcts[ 0 ] + pcts[ 1 ];
			if ( sum <= 0 ) {
				return null;
			}
			const scale = Math.min( 1, sum / 100 );
			const p = pcts[ 0 ] / sum;
			const alpha = colors[ 0 ][ 3 ] * p + colors[ 1 ][ 3 ] * ( 1 - p );
			if ( alpha <= 0 ) {
				return [ 0, 0, 0, 0 ];
			}
			const out = [ 0, 1, 2 ].map( ( i ) => ( colors[ 0 ][ i ] * colors[ 0 ][ 3 ] * p + colors[ 1 ][ i ] * colors[ 1 ][ 3 ] * ( 1 - p ) ) / alpha );
			return [ ...out, alpha * scale ];
		}
	}
	return browser ? canvasColor( c ) : null;
}

/** [ r, g, b, a ] → "#rrggbb" ("#rrggbbaa" when translucent), '' for null. */
export function colorHex( rgba ) {
	rgba = colorRgba( rgba );
	if ( ! rgba ) {
		return '';
	}
	const hex = ( v ) => Math.round( v ).toString( 16 ).padStart( 2, '0' );
	return '#' + rgba.slice( 0, 3 ).map( hex ).join( '' ) + ( rgba[ 3 ] < 1 ? hex( rgba[ 3 ] * 255 ) : '' );
}

/** A translucent colour painted over another: the opaque result. */
export function colorOver( top, under ) {
	if ( under[ 3 ] < 1 ) {
		under = colorOver( under, WHITE );
	}
	const a = top[ 3 ];
	return [ 0, 1, 2 ].map( ( i ) => top[ i ] * a + under[ i ] * ( 1 - a ) ).concat( 1 );
}

/** Mixes two colours in sRGB (`amount` of `to`, 0–1), opaque. */
export function colorMix( from, to, amount ) {
	return [ 0, 1, 2 ].map( ( i ) => from[ i ] + ( to[ i ] - from[ i ] ) * amount ).concat( 1 );
}

/** WCAG relative luminance of an opaque colour. */
export function luminance( rgba ) {
	const ch = ( v ) => {
		v /= 255;
		return v <= 0.04045 ? v / 12.92 : Math.pow( ( v + 0.055 ) / 1.055, 2.4 );
	};
	return 0.2126 * ch( rgba[ 0 ] ) + 0.7152 * ch( rgba[ 1 ] ) + 0.0722 * ch( rgba[ 2 ] );
}

/**
 * Contrast ratio of a text/icon colour on a background, 1–21, or 0 when either
 * can't be read. A translucent background goes over the page background
 * first, a translucent foreground over the result.
 */
export function contrastRatio( fg, bg ) {
	fg = colorRgba( fg );
	bg = colorRgba( bg );
	if ( ! fg || ! bg ) {
		return 0;
	}
	if ( bg[ 3 ] < 1 ) {
		bg = colorOver( bg, colorRgba( pageColors().background ) || WHITE );
	}
	if ( fg[ 3 ] < 1 ) {
		fg = colorOver( fg, bg );
	}
	const l1 = luminance( fg );
	const l2 = luminance( bg );
	return ( Math.max( l1, l2 ) + 0.05 ) / ( Math.min( l1, l2 ) + 0.05 );
}

/**
 * The text colour for a background (PHP: wrbc_on_color()): white when it
 * reaches 4.5:1, else ink when that does, else pure black (a few mid-tones
 * such as #6366f1); '' when it can't be read.
 */
export function onColor( bg ) {
	if ( ! colorRgba( bg ) ) {
		return '';
	}
	const paper = contrastRatio( PAPER, bg );
	if ( paper >= AA_TEXT ) {
		return PAPER;
	}
	if ( contrastRatio( INK, bg ) >= AA_TEXT ) {
		return INK;
	}
	return contrastRatio( '#000000', bg ) >= paper ? '#000000' : PAPER;
}

/**
 * `fg` as it is when it reaches `min` on `bg` (or either can't be read),
 * otherwise the closest colour to it that does (mixed towards white or ink).
 */
export function readableColor( fg, bg, min = AA_TEXT ) {
	let from = colorRgba( fg );
	let back = colorRgba( bg );
	if ( ! from || ! back || contrastRatio( from, back ) >= min ) {
		return Array.isArray( fg ) ? colorHex( fg ) : fg || '';
	}
	if ( back[ 3 ] < 1 ) {
		back = colorOver( back, colorRgba( pageColors().background ) || WHITE );
	}
	if ( from[ 3 ] < 1 ) {
		from = colorOver( from, back );
	}
	const to = colorRgba( onColor( back ) );
	// Aim a hair above the target: the result is rounded to a hex colour, and
	// checkers (axe) must see it pass too (PHP twin: same steps).
	const goal = min + 0.02;
	let miss = 0;
	for ( let step = 1; step <= 20; step++ ) {
		let hit = step / 20;
		if ( contrastRatio( colorMix( from, to, hit ), back ) >= goal ) {
			for ( let i = 0; i < 6; i++ ) {
				const mid = ( miss + hit ) / 2;
				if ( contrastRatio( colorMix( from, to, mid ), back ) >= goal ) {
					hit = mid;
				} else {
					miss = mid;
				}
			}
			// Check the rounded colour itself, nudging on until it passes.
			for ( ; hit < 1; hit = Math.min( 1, hit + 0.01 ) ) {
				const hex = colorHex( colorMix( from, to, hit ) );
				if ( contrastRatio( hex, back ) >= min ) {
					return hex;
				}
			}
			break;
		}
		miss = hit;
	}
	return colorHex( to );
}

/** Whether a background is dark (white reads better than ink), null when unknown or mostly transparent. */
export function isDarkColor( bg ) {
	const rgba = colorRgba( bg );
	if ( ! rgba || rgba[ 3 ] < 0.5 ) {
		return null;
	}
	return onColor( rgba ) === PAPER;
}

/**
 * "wrbc-is-dark" for an element that paints a dark background, "wrbc-is-light"
 * for a light one inside a dark context, '' otherwise (PHP: wrbc_tone_class()).
 *
 * @param {string} bg      The element's own background.
 * @param {string} context What's around it (useSurface()).
 */
export function toneClass( bg, context = '' ) {
	const dark = isDarkColor( bg );
	if ( dark === true ) {
		return 'wrbc-is-dark';
	}
	if ( dark === false && isDarkColor( context || pageColors().background ) === true ) {
		return 'wrbc-is-light';
	}
	return '';
}

/**
 * Smallest overlay opacity (0–100) that keeps `text` readable over any image
 * (a white and a black pixel), optionally with a translucent `tint` on top.
 */
export function minOverlayOpacity( text, overlay, min = AA_TEXT, tint = null ) {
	const fg = colorRgba( text );
	const ov = colorRgba( overlay );
	const top = tint ? colorRgba( tint ) : null;
	if ( ! fg || ! ov ) {
		return 0;
	}
	for ( let pct = 0; pct <= 100; pct++ ) {
		const layer = [ ov[ 0 ], ov[ 1 ], ov[ 2 ], pct / 100 ];
		let light = colorOver( layer, WHITE );
		let dark = colorOver( layer, BLACK );
		if ( top ) {
			light = colorOver( top, light );
			dark = colorOver( top, dark );
		}
		if ( contrastRatio( fg, light ) >= min && contrastRatio( fg, dark ) >= min ) {
			return pct;
		}
	}
	return 100;
}

/**
 * The overlay opacity a block renders with: the chosen one, never under the
 * readable floor for its text nor over `max` (PHP: wrbc_overlay_opacity()).
 */
export function overlayOpacity( value, text = '', overlay = '', min = AA_TEXT, max = 95 ) {
	overlay = overlay || '#000000';
	// No text colour chosen: the text the block draws on its overlay, which reads on it.
	const floor = minOverlayOpacity( text || onColor( overlay ), overlay, min );
	const v = Number.isFinite( Number( value ) ) && value !== '' && value !== null && value !== undefined ? Number( value ) : 0;
	return Math.round( Math.max( 0, Math.min( max, Math.max( v, floor ) ) ) );
}

/** The Color panel colours of a block, resolved to hex: background, text, gradient stops. */
export function blockColors( attributes = {} ) {
	const style = ( attributes.style && attributes.style.color ) || {};
	const pick = ( slug, custom ) => colorHex( colorRgba( slug ? presetColor( slug ) : custom ) );
	const gradient = attributes.gradient ? presetColor( attributes.gradient, 'gradients' ) : style.gradient || '';
	const stops = ( String( gradient ).match( /#[0-9a-f]{3,8}\b|(?:rgba?|hsla?)\([^()]*\)|var\(--wp--preset--color--[a-z0-9_-]+\)/gi ) || [] )
		.map( ( stop ) => colorHex( colorRgba( stop ) ) )
		.filter( Boolean );
	return {
		background: pick( attributes.backgroundColor, style.background ),
		text: pick( attributes.textColor, style.text ),
		gradient: stops,
	};
}

/**
 * Whether a block really shows a background image or video (PHP:
 * wrbc_has_background_media()): an attachment id, or else an http(s) URL.
 */
export function hasBackgroundMedia( attributes = {} ) {
	return [ [ 'bgImageId', 'bgImageUrl' ], [ 'bgId', 'bgUrl' ], [ 'bgVideoId', 'bgVideoUrl' ] ].some( ( [ idKey, urlKey ] ) => {
		const id = parseInt( attributes[ idKey ], 10 );
		const url = typeof attributes[ urlKey ] === 'string' ? attributes[ urlKey ].trim() : '';
		return id > 0 || /^https?:\/\//i.test( url );
	} );
}

/** Attribute defaults of a registered block (block.json). */
export function blockDefaults( name ) {
	const type = name ? getBlockType( name ) : null;
	const out = {};
	Object.entries( ( type && type.attributes ) || {} ).forEach( ( [ key, schema ] ) => {
		if ( schema && 'default' in schema ) {
			out[ key ] = schema.default;
		}
	} );
	return out;
}

/**
 * The background a block paints behind its content, one colour for contrast
 * decisions, or '' (PHP: wrbc_block_surface(), same rules).
 */
export function blockSurface( attributes = {}, name = '' ) {
	const colors = blockColors( attributes );
	if ( colors.background && colorRgba( colors.background )[ 3 ] >= 0.5 ) {
		return colors.background;
	}
	if ( colors.gradient.length ) {
		const tones = colors.gradient.map( isDarkColor );
		const dark = ! tones.includes( false ) && ! tones.includes( null );
		const light = ! tones.includes( true ) && ! tones.includes( null );
		if ( ! dark && ! light ) {
			return '';
		}
		const byLum = [ ...colors.gradient ].sort( ( x, y ) => luminance( colorOver( colorRgba( x ), WHITE ) ) - luminance( colorOver( colorRgba( y ), WHITE ) ) );
		return dark ? byLum[ byLum.length - 1 ] : byLum[ 0 ];
	}
	if ( name === 'core/cover' ) {
		const overlay = attributes.overlayColor ? presetColor( attributes.overlayColor ) : attributes.customOverlayColor || '';
		if ( attributes.isDark === undefined || attributes.isDark ) {
			return isDarkColor( overlay ) === true ? colorHex( colorRgba( overlay ) ) : INK;
		}
		return PAPER;
	}
	if ( String( name ).startsWith( 'werun-community/' ) ) {
		let hasImage = hasBackgroundMedia( attributes );
		if ( name === 'werun-community/section' && ( attributes.bgType || 'none' ) !== 'image' ) {
			hasImage = false;
		}
		if ( hasImage ) {
			const defaults = blockDefaults( name );
			const overlay = colorRgba( attributes.overlayColor ?? defaults.overlayColor ?? '' );
			const opacity = Number.isFinite( Number( attributes.overlayOpacity ) ) && attributes.overlayOpacity !== '' && attributes.overlayOpacity !== undefined ? Number( attributes.overlayOpacity ) : Number( defaults.overlayOpacity || 0 );
			if ( overlay ) {
				// The opacity the block renders with: the readable floor for its text applies (overlayOpacity()).
				const layer = [ overlay[ 0 ], overlay[ 1 ], overlay[ 2 ], overlayOpacity( opacity, blockColors( attributes ).text, colorHex( [ overlay[ 0 ], overlay[ 1 ], overlay[ 2 ], 1 ] ) ) / 100 ];
				const onWhite = colorOver( layer, WHITE );
				const onBlack = colorOver( layer, BLACK );
				const darkWhite = isDarkColor( onWhite );
				if ( darkWhite === isDarkColor( onBlack ) ) {
					// The worst case for the text, rounded towards it too (PHP twin: same).
					const worst = darkWhite ? onWhite : onBlack;
					const round = darkWhite ? Math.ceil : Math.floor;
					return colorHex( [ round( worst[ 0 ] ), round( worst[ 1 ] ), round( worst[ 2 ] ), 1 ] );
				}
			}
			return '';
		}
		// A chosen text colour wins over the stored tone (as section's render.php does).
		if ( name === 'werun-community/section' && ! blockColors( attributes ).text ) {
			if ( attributes.textTone === 'light' ) {
				return INK;
			}
			if ( attributes.textTone === 'dark' ) {
				return PAPER;
			}
		}
	}
	return '';
}

/** The background around a block (its nearest painted ancestor, or the page), without its own. */
export function useContextBackground( clientId ) {
	return useSelect(
		( select ) => {
			const { getBlockParents, getBlockName, getBlockAttributes } = select( blockEditorStore );
			for ( const id of getBlockParents( clientId, true ) ) {
				const surface = blockSurface( getBlockAttributes( id ) || {}, getBlockName( id ) );
				if ( surface ) {
					return surface;
				}
			}
			return pageColors().background;
		},
		[ clientId ]
	);
}

/**
 * The background behind a block in the editor: its own, the nearest painted
 * ancestor's, or the page's (PHP: wrbc_surface() with the render context).
 *
 * @param {string} clientId   The block's client id.
 * @param {Object} attributes Its attributes.
 * @param {string} name       Its name.
 */
export function useSurface( clientId, attributes, name ) {
	const context = useContextBackground( clientId );
	return blockSurface( attributes, name ) || context;
}

/**
 * Custom properties for a block's accent (PHP: wrbc_accent_vars()):
 * --wrbc-on-accent automatic on a custom accent when none was chosen, and
 * --wrbc-accent-text when the accent needs adjusting to read on `surface`.
 *
 * @param {Object} a       Attributes.
 * @param {string} surface Background the accent text sits on (useSurface()).
 * @param {Array}  keys    Attribute names: accent and on-accent.
 */
export function accentVars( a, surface, keys = [ 'accentColor', 'onAccentColor' ] ) {
	// A value that isn't a colour would void every fill that uses it: nothing,
	// so the stylesheet's default applies; a var() is kept (PHP twin: same).
	const valid = ( value ) => ! value || !! colorRgba( value ) || /^var\(/i.test( value.trim() );
	const accentRaw = typeof a[ keys[ 0 ] ] === 'string' ? a[ keys[ 0 ] ] : '';
	const onRaw = typeof a[ keys[ 1 ] ] === 'string' ? a[ keys[ 1 ] ] : '';
	const accent = valid( accentRaw ) ? accentRaw : '';
	const on = valid( onRaw ) ? onRaw : '';
	const vars = { '--wrbc-accent': accent || undefined, '--wrbc-on-accent': undefined };
	const base = accent && colorRgba( accent ) ? accent : ACCENT;
	if ( on ) {
		// A chosen label colour, as close to it as 4.5:1 on the accent allows.
		vars[ '--wrbc-on-accent' ] = readableColor( on, base, AA_TEXT ) || undefined;
	} else if ( accent ) {
		vars[ '--wrbc-on-accent' ] = onColor( accent ) || undefined;
	}
	// Hover/focus fill: away from the label colour (the stylesheet darkens, which suits a white label).
	if ( vars[ '--wrbc-on-accent' ] && isDarkColor( vars[ '--wrbc-on-accent' ] ) !== false ) {
		vars[ '--wrbc-accent-hover' ] = colorHex( colorMix( colorRgba( base ), WHITE, 0.14 ) );
	}
	if ( surface ) {
		const text = readableColor( base, surface, AA_TEXT );
		// On a dark surface always set it: otherwise .wrbc-is-dark's fallback mix
		// would replace an accent that already reads there (PHP twin: same).
		if ( String( text ).toLowerCase() !== String( base ).toLowerCase() || isDarkColor( surface ) === true ) {
			vars[ '--wrbc-accent-text' ] = text;
		}
	}
	return vars;
}
