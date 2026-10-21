/**
 * Query card colours in the editor: the same decisions as
 * Renderer::card_colors() (includes/query/class-renderer.php), so the
 * preview gets the classes and custom properties the page prints
 * (docs/accessibility.md).
 */
import { __ } from '@wordpress/i18n';
import { AA_TEXT, ACCENT, blockColors, colorHex, colorMix, colorOver, colorRgba, contrastRatio, isDarkColor, onColor, readableColor } from '../shared/contrast';

const WHITE = [ 255, 255, 255, 1 ];

/** Names of the block's parts in the editor's contrast warning (ContrastAudit). */
export function auditLabels() {
	return {
		'.wrbc-header__eyebrow': __( 'Eyebrow', 'werun-blocks-community' ),
		'.wrbc-header__title': __( 'Section title', 'werun-blocks-community' ),
		'.wrbc-header__intro': __( 'Intro', 'werun-blocks-community' ),
		'.wrbc-query__chip': __( 'Filter buttons', 'werun-blocks-community' ),
		'.wrbc-query__sort label': __( 'Sort label', 'werun-blocks-community' ),
		'.wrbc-query__title': __( 'Card title', 'werun-blocks-community' ),
		'.wrbc-query__date': __( 'Date', 'werun-blocks-community' ),
		'.wrbc-query__excerpt': __( 'Excerpt', 'werun-blocks-community' ),
		'.wrbc-query__term': __( 'Terms', 'werun-blocks-community' ),
		'.wrbc-query__meta': __( 'Custom field', 'werun-blocks-community' ),
		'.wrbc-query__event': __( 'Event date', 'werun-blocks-community' ),
		'.wrbc-query__page': __( 'Pagination', 'werun-blocks-community' ),
		'.wrbc-query__empty': __( 'Text when nothing matches', 'werun-blocks-community' ),
	};
}

/** The attributes that take the block back to the automatic text colour (no Color panel text). */
export function withoutTextColor( a ) {
	const style = { ...( a.style || {} ) };
	if ( style.color ) {
		const color = { ...style.color };
		delete color.text;
		if ( Object.keys( color ).length ) {
			style.color = color;
		} else {
			delete style.color;
		}
	}
	return { textColor: undefined, style: Object.keys( style ).length ? style : undefined };
}

/**
 * What the cards paint and the colours that keep them readable (twin of
 * Renderer::card_colors()): the cards' own text colour (the block's text
 * colour made readable on them, or white / ink on the author's card colour
 * or on a card of the other tone than the surface) with its tone class and
 * muted colour, the accent as text and focus ring on the card, and the term
 * chips' text.
 *
 * @param {Object} a       Block attributes.
 * @param {string} style   Card style: plain, bordered, filled, shadow.
 * @param {string} surface What the block sits on (useSurface()).
 * @return {{ className: string, vars: Object }} Root class and custom properties.
 */
export function cardColors( a, style, surface ) {
	let under = colorRgba( surface );
	under = under ? colorOver( under, WHITE ) : WHITE;
	let bg = null;
	if ( style !== 'plain' ) {
		bg = typeof a.cardBg === 'string' && a.cardBg ? colorRgba( a.cardBg ) : null;
		if ( ! bg && style === 'shadow' ) {
			bg = WHITE;
		} else if ( ! bg && style === 'filled' ) {
			// --wrbc-surface: 4 % of the text colour, light on a dark surface and dark on a light one.
			bg = isDarkColor( under ) === true ? [ 255, 255, 255, 0.04 ] : [ 0, 0, 0, 0.04 ];
		}
	}
	const underHex = colorHex( under );
	const bgHex = bg ? colorHex( colorOver( bg, under ) ) : underHex;
	const dark = isDarkColor( bgHex );

	let className = '';
	const vars = {};
	const kept = blockColors( a ).text;
	const picked = style !== 'plain' && typeof a.cardBg === 'string' && !! a.cardBg && !! colorRgba( a.cardBg );
	let cardText = '';
	if ( kept ) {
		// The block's text colour stays where it reads on the cards, else the closest one that does.
		cardText = contrastRatio( kept, bgHex ) < AA_TEXT ? readableColor( kept, bgHex, AA_TEXT ) : '';
	} else if ( picked || dark !== isDarkColor( underHex ) ) {
		cardText = onColor( bgHex );
	}
	if ( cardText ) {
		className = 'wrbc-query--cards-' + ( dark ? 'dark' : 'light' );
		const muted = colorMix( colorRgba( bgHex ), colorRgba( cardText ), dark ? 0.85 : 0.76 );
		vars[ '--wrbc-card-text' ] = cardText;
		if ( contrastRatio( muted, bgHex ) < AA_TEXT ) {
			vars[ '--wrbc-card-muted' ] = cardText;
		}
	}

	const base = typeof a.accentColor === 'string' && a.accentColor && colorRgba( a.accentColor ) ? a.accentColor : ACCENT;
	const text = readableColor( base, bgHex, AA_TEXT );
	if ( className || String( text ).toLowerCase() !== String( readableColor( base, underHex, AA_TEXT ) ).toLowerCase() ) {
		vars[ '--wrbc-card-accent-text' ] = text;
		className = className || 'wrbc-query--cards-accent';
	}
	const rgb = colorRgba( base );
	const term = readableColor( base, colorHex( colorOver( [ rgb[ 0 ], rgb[ 1 ], rgb[ 2 ], 0.12 ], colorRgba( bgHex ) ) ), AA_TEXT );
	if ( String( term ).toLowerCase() !== String( text ).toLowerCase() ) {
		vars[ '--wrbc-query-term' ] = term;
	}
	return { className, vars };
}

/** The light land colour of the default map tiles (OpenStreetMap): what a pin sits on (Renderer::MAP_LAND). */
export const MAP_LAND = '#f2efe9';

/** The marker colour the map draws: the author's, made 3:1 against the land colour when it isn't (Renderer::map_markup()). */
export const markerShown = ( color ) => ( color ? readableColor( color, MAP_LAND, 3 ) : '' );
