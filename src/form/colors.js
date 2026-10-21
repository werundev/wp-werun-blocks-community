/**
 * What the form's content sits on and what keeps it readable there. Twin of
 * wrbc_form_colors() in src/form/render.php: same rules, same results
 * (src/shared/contrast.js is the twin of includes/a11y/contrast.php).
 *
 * - card: the card's own colour (cardBg) or the default near-white card,
 *   which stays light in a dark section (its text turns ink). The card's
 *   tone class is dropped when the block's chosen text colour already reads
 *   on it. The accent as text and focus ring are set on the card itself.
 * - plain / inline: the block's surface.
 */
import { AA_TEXT, ACCENT, INK, blockColors, colorHex, colorMix, colorOver, colorRgba, contrastRatio, readableColor, toneClass } from '../shared/contrast';

const WHITE = [ 255, 255, 255, 1 ];

/**
 * @param {Object} a       Attributes.
 * @param {string} look    card | plain | inline.
 * @param {string} surface The block's surface (useSurface()).
 * @return {{ background: string, cardClass: string, cardVars: Object, error: string }} What the content sits on, the card's tone class and custom properties, and the readable error colour.
 */
export function formColors( a, look, surface ) {
	const found = colorRgba( surface );
	const under = found ? colorOver( found, WHITE ) : WHITE;
	let background = colorHex( under );
	let cardClass = '';
	let cardVars = {};
	if ( look === 'card' ) {
		// style.scss: white with 3 % of the card's text; ink is the darkest it gets.
		const card = colorHex( colorOver( colorRgba( typeof a.cardBg === 'string' ? a.cardBg : '' ) || colorMix( WHITE, colorRgba( INK ), 0.03 ), under ) );
		cardClass = toneClass( card, background );
		const kept = blockColors( a ).text;
		if ( kept && contrastRatio( kept, card ) >= AA_TEXT ) {
			cardClass = '';
		}
		background = card;
		const accent = typeof a.accentColor === 'string' ? a.accentColor : '';
		const text = readableColor( accent && colorRgba( accent ) ? accent : ACCENT, background, AA_TEXT );
		cardVars = { '--wrbc-accent-text': text, '--wrbc-focus': text };
	}
	return { background, cardClass, cardVars, error: readableColor( '#b42318', background, AA_TEXT ) };
}
