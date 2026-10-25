/**
 * Colours of an accordion item that paints a background, for the item's
 * editor script. Twin: wrbc_acc_item_colors() in src/accordion-item/render.php.
 */
import { AA_TEXT, ACCENT, colorHex, colorOver, colorRgba, readableColor, toneClass } from '../shared/contrast';

const WHITE = [ 255, 255, 255, 1 ];
export const NO_COLORS = { className: '', vars: {}, paint: '' };

/**
 * An item that paints a background (its own Color panel one, or the
 * accordion's Item background in Boxes): the tone class that turns its text
 * light or dark when no text colour was chosen, and the accent and focus ring
 * readable on it. Twin: wrbc_acc_item_colors() in src/accordion-item/render.php.
 *
 * @param {string} bg     The item's background (may be translucent).
 * @param {string} around What the accordion sits on.
 * @param {string} accent The accordion's accent ('' = the default one).
 */
export function itemColors( bg, around, accent ) {
	const rgba = colorRgba( bg );
	if ( ! rgba || rgba[ 3 ] <= 0 ) {
		return NO_COLORS;
	}
	const underRgba = colorRgba( around );
	const under = colorHex( underRgba ? colorOver( underRgba, WHITE ) : WHITE );
	const paint = colorHex( colorOver( rgba, colorRgba( under ) ) );
	const base = accent && colorRgba( accent ) ? accent : ACCENT;
	const text = readableColor( base, paint, AA_TEXT );
	const className = toneClass( paint, under );
	// Its own values when the accordion's (made for what it sits on) don't read
	// on this background, or a tone class would reset them to its mix.
	const vars =
		className || String( text ).toLowerCase() !== String( readableColor( base, under, AA_TEXT ) ).toLowerCase()
			? { '--wrbc-accent-text': text, '--wrbc-focus': text }
			: {};
	return { className, vars, paint };
}

