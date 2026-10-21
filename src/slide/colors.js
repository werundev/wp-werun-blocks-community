/**
 * Slide colours in the editor, twin of src/slide/render.php: the overlay's
 * readable floor, the tone class, the text colour printed when the author
 * chose none, and the accent made readable on what the text sits on.
 * Contract: docs/accessibility.md.
 */
import {
	AA_TEXT,
	ACCENT,
	PAPER,
	blockColors,
	blockSurface,
	colorHex,
	colorOver,
	colorRgba,
	isDarkColor,
	onColor,
	overlayOpacity,
	pageColors,
	readableColor,
	toneClass,
} from '../shared/contrast';
import { safeCssValue } from '../shared/controls';

const plain = ( value ) =>
	String( value ?? '' )
		.replace( /<[^>]*>/g, '' )
		.replace( /&nbsp;|&#160;| /g, ' ' )
		.trim();

/* Attributes that hold a block's text, and blocks that print none of their own. */
const TEXT_KEYS = [ 'content', 'text', 'value', 'caption', 'citation' ];
const SILENT = [ 'core/heading', 'core/paragraph', 'core/list-item', 'core/button', 'core/image', 'core/spacer', 'core/separator', 'core/video', 'core/audio', 'core/embed', 'core/gallery', 'core/cover' ];

/**
 * Whether any text sits on the slide (render.php strips the tags of the
 * rendered slide): text attributes, captions, nested blocks; leaf blocks
 * this doesn't know are taken to print text.
 *
 * @param {Object[]} blocks The slide's inner blocks.
 */
export function hasText( blocks ) {
	return ( blocks || [] ).some( ( block ) => {
		const attrs = block.attributes || {};
		if ( TEXT_KEYS.some( ( key ) => plain( attrs[ key ] ) !== '' ) ) {
			return true;
		}
		if ( block.innerBlocks?.length ) {
			return hasText( block.innerBlocks );
		}
		return ! SILENT.includes( block.name );
	} );
}

/**
 * @param {Object}  a              Slide attributes.
 * @param {Object}  context        Block context (werun-community/carousel/…).
 * @param {Object}  options
 * @param {boolean} options.text   hasText() of the slide.
 * @param {string}  options.around The background around the slide (useContextBackground()).
 * @return {{ overlay: number, overlayColor: string, textFor: string, paint: string, tone: string, fg: string, accentText: string }} What render.php prints.
 */
export function slideColors( a, context, { text, around } ) {
	const ctx = context || {};
	const hasBg = !! a.bgUrl;
	const ownText = blockColors( a ).text;
	// The carousel's text colour (Color panel), which the slides inherit.
	const rootText = blockColors( { textColor: ctx[ 'werun-community/carousel/textColor' ], style: ctx[ 'werun-community/carousel/style' ] || {} } ).text;
	const under = colorRgba( around ) || [ 255, 255, 255, 1 ];
	const chosen = Number.isFinite( Number( a.overlayOpacity ) ) && a.overlayOpacity !== '' && a.overlayOpacity !== null && a.overlayOpacity !== undefined ? Math.max( 0, Math.min( 90, Number( a.overlayOpacity ) ) ) : 0;
	let overlayColor = typeof a.overlayColor === 'string' && safeCssValue( a.overlayColor ) && colorRgba( a.overlayColor ) ? a.overlayColor : '';
	let overlay = 0;
	let textFor = '';
	let paint = '';
	let tone = '';
	let fg = '';

	if ( hasBg ) {
		if ( text ) {
			overlayColor = overlayColor || '#000000';
			textFor = ownText || onColor( overlayColor );
			overlay = overlayOpacity( chosen, textFor, overlayColor, AA_TEXT, 90 );
			const c = colorRgba( overlayColor );
			const layer = [ c[ 0 ], c[ 1 ], c[ 2 ], overlay / 100 ];
			const onWhite = colorOver( layer, [ 255, 255, 255, 1 ] );
			const onBlack = colorOver( layer, [ 0, 0, 0, 1 ] );
			const dark = isDarkColor( onWhite ) === true || ( isDarkColor( onBlack ) === true && isDarkColor( textFor ) === false );
			paint = colorHex( dark ? onWhite : onBlack );
			tone = dark ? 'wrbc-is-dark' : 'wrbc-is-light';
			fg = ownText ? '' : textFor;
		} else if ( overlayColor ) {
			overlay = Math.round( chosen );
		}
	} else {
		const ownBg = blockSurface( a, 'werun-community/slide' );
		const style = [ 'plain', 'bordered', 'filled', 'shadow' ].includes( ctx[ 'werun-community/carousel/slideStyle' ] ) ? ctx[ 'werun-community/carousel/slideStyle' ] : 'filled';
		const pickedValue = style !== 'plain' ? ctx[ 'werun-community/carousel/slideBg' ] : '';
		const picked = typeof pickedValue === 'string' && safeCssValue( pickedValue ) ? colorRgba( pickedValue ) : null;
		if ( ownBg ) {
			paint = ownBg;
			tone = toneClass( paint, around );
		} else if ( picked && picked[ 3 ] > 0 ) {
			paint = colorHex( colorOver( picked, under ) );
			tone = toneClass( paint, around );
			if ( ! ownText ) {
				fg = rootText ? readableColor( rootText, paint, AA_TEXT ) : onColor( paint );
			}
		} else if ( style === 'shadow' ) {
			paint = PAPER;
			tone = toneClass( paint, around );
		} else if ( style === 'filled' ) {
			// The filled card's own tint (4 % of the text colour) over what's around it.
			const tint = colorRgba( ownText || rootText || ( isDarkColor( around ) === true ? PAPER : pageColors().text ) );
			if ( tint ) {
				paint = colorHex( colorOver( [ tint[ 0 ], tint[ 1 ], tint[ 2 ], 0.04 ], under ) );
				tone = toneClass( paint, around );
			}
		}
	}

	let accentText = '';
	if ( paint ) {
		const accent = typeof ctx[ 'werun-community/carousel/accentColor' ] === 'string' && colorRgba( ctx[ 'werun-community/carousel/accentColor' ] ) ? ctx[ 'werun-community/carousel/accentColor' ] : ACCENT;
		accentText = readableColor( accent, paint, AA_TEXT );
	}
	return { overlay, overlayColor, textFor, paint, tone, fg, accentText };
}
