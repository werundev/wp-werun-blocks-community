/**
 * Testimonials' colours in the editor. Twin of wrbc_testimonial_star() and
 * wrbc_testimonial_colors() in src/testimonial/card.php (same rules, same
 * maths through src/shared/contrast.js), so the preview gets the classes and
 * custom properties the page prints. Used by the testimonials block (its
 * accent, its stars and the cards of a post type) and by each testimonial card.
 */
import { AA_TEXT, AA_UI, ACCENT, PAPER, colorHex, colorOver, colorRgba, isDarkColor, onColor, pageColors, readableColor, toneClass } from '../shared/contrast';

/** Stars without a chosen colour: the dark gold reads on light cards (3:1), the bright one on dark cards. */
const STAR_ON_LIGHT = '#b77400';
const STAR_ON_DARK = '#f59e0b';

const STYLES = [ 'plain', 'bordered', 'filled', 'shadow' ];

/**
 * The stars' colour on `bg` (WCAG 1.4.11, 3:1): a chosen colour stays as it
 * is when it reaches 3:1 there, otherwise the closest one that does.
 *
 * @param {string} star Star colour attribute ('' = not chosen).
 * @param {string} bg   What the stars sit on.
 */
export function starColor( star, bg ) {
	const chosen = typeof star === 'string' ? star : '';
	if ( ! colorRgba( bg || '' ) ) {
		return chosen;
	}
	let base = isDarkColor( bg ) === true ? STAR_ON_DARK : STAR_ON_LIGHT;
	if ( chosen && colorRgba( chosen ) ) {
		base = chosen;
	}
	return readableColor( base, bg, AA_UI );
}

/**
 * A card's background and the colours that read on it.
 *
 * @param {Object} ctx             The testimonials block's settings.
 * @param {string} ctx.cardStyle   plain | bordered | filled | shadow.
 * @param {string} ctx.cardBg      Card background attribute.
 * @param {string} ctx.starColor   Star colour attribute.
 * @param {string} ctx.accentColor Accent attribute.
 * @param {string} ctx.surface     What the cards sit on (useSurface() of the testimonials block).
 * @param {string} own             The card's own background (its Color panel), '' for none.
 * @param {string} ownText         The card's own text colour, '' for none.
 * @return {{bg: string, under: string, tone: string, star: string, vars: Object}} See wrbc_testimonial_colors().
 */
export function cardColors( { cardStyle, cardBg, starColor: star, accentColor, surface } = {}, own = '', ownText = '' ) {
	let under = colorRgba( surface || '' );
	if ( ! under || under[ 3 ] < 1 ) {
		under = colorRgba( pageColors().background ) || [ 255, 255, 255, 1 ];
	}
	const surfaceHex = colorHex( under );
	const style = STYLES.includes( cardStyle ) ? cardStyle : 'bordered';
	let bg = typeof own === 'string' ? own : '';
	if ( ! bg && style !== 'plain' && typeof cardBg === 'string' ) {
		bg = cardBg;
	}
	if ( ! bg && style === 'shadow' ) {
		bg = PAPER;
	}
	// One opaque colour: a translucent background as it looks over the surface.
	const rgba = bg ? colorRgba( bg ) : null;
	bg = rgba ? colorHex( colorOver( rgba, under ) ) : '';
	let starsOn = surfaceHex;
	if ( bg ) {
		starsOn = bg;
	} else if ( style === 'filled' ) {
		// The filled card's 4 % tint of the text colour (--wrbc-surface).
		const text = colorRgba( onColor( under ) );
		starsOn = colorHex( colorOver( [ text[ 0 ], text[ 1 ], text[ 2 ], 0.04 ], under ) );
	}
	const out = { bg, under: starsOn, painted: false, tone: '', star: starColor( star, starsOn ), vars: {} };
	if ( bg && bg.toLowerCase() !== surfaceHex.toLowerCase() ) {
		const accent = typeof accentColor === 'string' && accentColor && colorRgba( accentColor ) ? accentColor : ACCENT;
		const link = readableColor( accent, bg, AA_TEXT );
		// Text: the card's own colour (kept as chosen), or the one that reads best on its background.
		const chosenText = typeof ownText === 'string' && ownText && colorRgba( ownText ) ? ownText : '';
		const text = chosenText || onColor( bg );
		out.painted = true;
		out.tone = toneClass( bg, surfaceHex );
		out.vars = { '--wrbc-card-text': chosenText ? undefined : text, '--wrbc-accent-text': link, '--wrbc-focus': link, '--wrbc-star': out.star };
		// The role line: that text at 76 % (85 % on dark), raised to 4.5:1 when needed.
		const color = colorRgba( text );
		if ( color ) {
			const mix = [ color[ 0 ], color[ 1 ], color[ 2 ], out.tone === 'wrbc-is-dark' ? 0.85 : 0.76 ];
			out.vars[ '--wrbc-muted' ] = readableColor( colorHex( colorOver( mix, colorRgba( bg ) ) ), bg, AA_TEXT );
		}
	}
	return out;
}

/**
 * Cards of a post type come from the server, which renders the block on its
 * own (/wp/v2/block-renderer: no section or group around it). They get the
 * colours the editor works out with the real surroundings.
 *
 * @param {string} html   The cards (<li> items).
 * @param {Object} colors cardColors() for cards without a background of their own.
 */
export function withCardColors( html, colors ) {
	if ( ! html || ! window.DOMParser ) {
		return html;
	}
	const doc = new window.DOMParser().parseFromString( `<ul>${ html }</ul>`, 'text/html' );
	const list = doc.querySelector( 'ul' );
	if ( ! list ) {
		return html;
	}
	list.querySelectorAll( '.wrbc-testi' ).forEach( ( card ) => {
		card.classList.remove( 'wrbc-is-dark', 'wrbc-is-light', 'wrbc-testi--painted' );
		[ '--wrbc-card-text', '--wrbc-accent-text', '--wrbc-focus', '--wrbc-star', '--wrbc-muted' ].forEach( ( name ) => card.style.removeProperty( name ) );
		[ colors.tone, colors.painted && 'wrbc-testi--painted' ].filter( Boolean ).forEach( ( name ) => card.classList.add( name ) );
		Object.entries( colors.vars ).forEach( ( [ name, value ] ) => value && card.style.setProperty( name, value ) );
		if ( ! card.getAttribute( 'style' ) ) {
			card.removeAttribute( 'style' );
		}
	} );
	return list.innerHTML;
}
