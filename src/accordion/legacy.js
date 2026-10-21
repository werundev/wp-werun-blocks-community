/**
 * Before 2.0 the accordion's look (separated / boxed / minimal) was stored in
 * the attribute `style`, the same name the colour, spacing and typography
 * supports use for their object. Setting a padding then spread the string
 * into that object ({ 0: 's', 1: 'e', …, spacing }) and the page dropped it.
 * The look is accordionStyle now; this reads what is left in `style`.
 * Twin: the fallback at the top of src/accordion/render.php.
 */
const STYLES = [ 'separated', 'boxed', 'minimal' ];

/**
 * @param {*} value The `style` attribute as stored.
 * @return {{accordionStyle: string, style: (Object|undefined)}|null} The look and the supports' own object, or null when there is nothing to migrate.
 */
export function legacyStyle( value ) {
	if ( typeof value === 'string' ) {
		return { accordionStyle: STYLES.includes( value ) ? value : 'separated', style: undefined };
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
	return { accordionStyle: STYLES.includes( text ) ? text : 'separated', style: Object.keys( rest ).length ? rest : undefined };
}
