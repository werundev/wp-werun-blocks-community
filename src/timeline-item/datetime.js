/**
 * The machine-readable form of a timeline date, for <time datetime>. Twin of
 * wrbc_timeline_datetime() in render.php: same patterns, same month names
 * (English plus the site's language, from @wordpress/date).
 *
 * "2019" → "2019", "2021-03" / "March 2021" / "marzo de 2021" → "2021-03",
 * "March 5, 2021" / "5 March 2021" → "2021-03-05". Anything else → ''.
 */
import { getSettings } from '@wordpress/date';

// YYYY, YYYY-MM or a real YYYY-MM-DD (no February 30th).
const isIso = ( value ) => {
	const p = value.match( /^(\d{4})(?:-(0[1-9]|1[0-2])(?:-(0[1-9]|[12]\d|3[01]))?)?$/ );
	if ( ! p ) {
		return false;
	}
	return ! p[ 3 ] || new Date( Date.UTC( Number( p[ 1 ] ), Number( p[ 2 ] ) - 1, Number( p[ 3 ] ) ) ).getUTCDate() === Number( p[ 3 ] );
};
const EN = [ 'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december' ];

function monthNumber( name ) {
	const l10n = getSettings()?.l10n || {};
	const key = String( name ).toLowerCase().replace( /\.$/, '' );
	const lists = [ EN, EN.map( ( m ) => m.slice( 0, 3 ) ), l10n.months || [], l10n.monthsShort || [] ];
	for ( const list of lists ) {
		const i = list.findIndex( ( m ) => String( m ).toLowerCase().replace( /\.$/, '' ) === key );
		if ( i !== -1 ) {
			return i + 1;
		}
	}
	return 0;
}

const pad = ( n ) => String( n ).padStart( 2, '0' );

function build( year, month, day ) {
	if ( ! month ) {
		return '';
	}
	if ( ! day ) {
		return `${ year }-${ pad( month ) }`;
	}
	const d = new Date( Date.UTC( Number( year ), month - 1, Number( day ) ) );
	return d.getUTCDate() === Number( day ) ? `${ year }-${ pad( month ) }-${ pad( day ) }` : '';
}

export function timelineDatetime( date, explicit ) {
	const own = String( explicit ?? '' ).trim();
	if ( isIso( own ) ) {
		return own;
	}
	const text = String( date ?? '' )
		.replace( /<[^>]*>/g, '' )
		.replace( /&nbsp;|\u00a0/g, ' ' )
		.replace( /\s+/g, ' ' )
		.trim();
	if ( isIso( text ) ) {
		return text;
	}
	let m = text.match( /^([^\d\s,]+)\.? (?:de )?(\d{4})$/u );
	if ( m ) {
		return build( m[ 2 ], monthNumber( m[ 1 ] ) );
	}
	m = text.match( /^([^\d\s,]+)\.? (\d{1,2}),? (\d{4})$/u );
	if ( m ) {
		return build( m[ 3 ], monthNumber( m[ 1 ] ), m[ 2 ] );
	}
	m = text.match( /^(\d{1,2})\.? (?:de )?([^\d\s,]+)\.? (?:de )?(\d{4})$/u );
	if ( m ) {
		return build( m[ 3 ], monthNumber( m[ 2 ] ), m[ 1 ] );
	}
	return '';
}
