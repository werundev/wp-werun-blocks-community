/**
 * The number of a stat, split for the counter: prefix, the numeric part and
 * suffix. Twin of wrbc_stat_parse() in render.php: same rules, same limits.
 *
 * "1,200+" → { to: 1200, decimals: 0, grouping: true, prefix: '', suffix: '+' }
 * "$4.5M"  → { to: 4.5, decimals: 1, grouping: false, prefix: '$', suffix: 'M' }
 * "98%"    → { to: 98, … suffix: '%' }. Nothing to count → null.
 *
 * One separator followed by exactly three digits ("1.500", "2,000") groups
 * thousands; any other single one is the decimal mark ("2.5", "4,75"). With
 * both, the last one is the decimal mark. Spaces always group.
 */
const SPACES = /[\u00a0\u202f ]/g;

/**
 * The number as the page shows it: tags stripped, trimmed, entities decoded.
 * Twin of render.php's html_entity_decode( trim( wp_strip_all_tags() ) ).
 */
export function statText( raw ) {
	return String( raw ?? '' )
		.replace( /<[^>]*>/g, '' )
		.replace( /^[ \t\n\r\0\x0B]+|[ \t\n\r\0\x0B]+$/g, '' )
		.replace( /&nbsp;/g, '\u00a0' )
		.replace( /&lt;/g, '<' ).replace( /&gt;/g, '>' ).replace( /&quot;/g, '"' ).replace( /&amp;/g, '&' );
}

/**
 * The length of a figure that stays on one line and shrinks to fit the stat
 * (12 characters at most), 0 for longer text, which wraps. Twin of
 * render.php ($len, .wrbc-stat__number--fit).
 */
export function fitLength( raw ) {
	const length = [ ...statText( raw ) ].length;
	return length > 0 && length <= 12 ? length : 0;
}

export function parseStat( raw ) {
	const text = String( raw ?? '' )
		.replace( /<[^>]*>/g, '' )
		.replace( /&nbsp;/g, '\u00a0' )
		.replace( /&lt;/g, '<' ).replace( /&gt;/g, '>' ).replace( /&quot;/g, '"' ).replace( /&amp;/g, '&' )
		.trim();
	if ( ! text || text.length > 80 ) {
		return null;
	}
	const m = text.match( /^(\D*?)(\d(?:[\d.,\u00a0\u202f ]*\d)?)([\s\S]*)$/ );
	if ( ! m ) {
		return null;
	}
	const [ , prefix, num, suffix ] = m;
	const plain = num.replace( SPACES, ' ' );
	const hasSpace = plain.includes( ' ' );
	const dots = ( num.match( /\./g ) || [] ).length;
	const commas = ( num.match( /,/g ) || [] ).length;
	let decimal = '';
	if ( dots && commas ) {
		decimal = num.lastIndexOf( '.' ) > num.lastIndexOf( ',' ) ? '.' : ',';
	} else if ( dots || commas ) {
		const sep = dots ? '.' : ',';
		const after = num.length - num.lastIndexOf( sep ) - 1;
		if ( ( dots || commas ) === 1 && ( after !== 3 || hasSpace ) ) {
			decimal = sep;
		}
	}
	let int = plain;
	let frac = '';
	if ( decimal ) {
		const pos = plain.lastIndexOf( decimal );
		int = plain.slice( 0, pos );
		frac = plain.slice( pos + 1 );
		if ( /\D/.test( frac ) || frac.length > 4 ) {
			return null;
		}
	}
	const groups = int.split( /[., ]/ );
	if ( groups.length > 1 && ( ! /^\d{1,3}$/.test( groups[ 0 ] ) || groups.slice( 1 ).some( ( g ) => ! /^\d{3}$/.test( g ) ) ) ) {
		return null;
	}
	const digits = groups.join( '' );
	if ( ! /^\d+$/.test( digits ) || digits.length > 15 ) {
		return null;
	}
	return {
		to: Number( frac ? `${ digits }.${ frac }` : digits ),
		decimals: frac.length,
		grouping: groups.length > 1,
		prefix,
		suffix,
	};
}
