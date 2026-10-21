/**
 * In 2.0.0 the form's look (card / plain / inline) was stored in the
 * attribute `style`, the same name the colour, spacing and typography
 * supports use for their object: a custom colour or a padding replaced the
 * look (or spread the string into the object: { 0: 'c', 1: 'a', …, color })
 * and the page dropped the colour. The look is formStyle now; this reads
 * what is left in `style`. Same fix as src/accordion/legacy.js.
 * Twin: the fallback at the top of src/form/render.php.
 */
const STYLES = [ 'card', 'plain', 'inline' ];

/**
 * @param {*} value The `style` attribute as stored.
 * @return {{formStyle: string, style: (Object|undefined)}|null} The look and the supports' own object, or null when there is nothing to migrate.
 */
export function legacyStyle( value ) {
	if ( typeof value === 'string' ) {
		return { formStyle: STYLES.includes( value ) ? value : 'card', style: undefined };
	}
	if ( ! value || typeof value !== 'object' || ! ( '0' in value ) ) {
		return null;
	}
	// A string spread into the object: its characters under "0", "1", ….
	const digits = Object.keys( value ).filter( ( key ) => /^\d+$/.test( key ) );
	const text = digits
		.sort( ( x, y ) => x - y )
		.map( ( key ) => String( value[ key ] ) )
		.join( '' );
	const rest = {};
	Object.keys( value ).forEach( ( key ) => {
		if ( ! digits.includes( key ) ) {
			rest[ key ] = value[ key ];
		}
	} );
	return { formStyle: STYLES.includes( text ) ? text : 'card', style: Object.keys( rest ).length ? rest : undefined };
}
