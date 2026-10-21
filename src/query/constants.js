/**
 * Enums, limits and "effective value" rules shared by the editor panels.
 * Twins: includes/query/class-config.php, class-view.php, class-builder.php.
 */
import { __ } from '@wordpress/i18n';

export const META_KEY_RE = /^[A-Za-z0-9_:.\-]{1,64}$/;

export const TAX_OPERATORS = [
	[ 'IN', __( 'is any of', 'werun-blocks-community' ) ],
	[ 'AND', __( 'is all of', 'werun-blocks-community' ) ],
	[ 'NOT IN', __( 'is none of', 'werun-blocks-community' ) ],
	[ 'EXISTS', __( 'has any term', 'werun-blocks-community' ) ],
	[ 'NOT EXISTS', __( 'has no term', 'werun-blocks-community' ) ],
];

export const COMPARES = [
	[ '=', __( 'is', 'werun-blocks-community' ) ],
	[ '!=', __( 'is not', 'werun-blocks-community' ) ],
	[ '>', __( 'greater than', 'werun-blocks-community' ) ],
	[ '>=', __( 'greater or equal', 'werun-blocks-community' ) ],
	[ '<', __( 'less than', 'werun-blocks-community' ) ],
	[ '<=', __( 'less or equal', 'werun-blocks-community' ) ],
	[ 'LIKE', __( 'contains', 'werun-blocks-community' ) ],
	[ 'NOT LIKE', __( 'does not contain', 'werun-blocks-community' ) ],
	[ 'IN', __( 'is one of', 'werun-blocks-community' ) ],
	[ 'NOT IN', __( 'is none of', 'werun-blocks-community' ) ],
	[ 'BETWEEN', __( 'is between', 'werun-blocks-community' ) ],
	[ 'NOT BETWEEN', __( 'is not between', 'werun-blocks-community' ) ],
	[ 'EXISTS', __( 'is set', 'werun-blocks-community' ) ],
	[ 'NOT EXISTS', __( 'is not set', 'werun-blocks-community' ) ],
];
export const NO_VALUE = [ 'EXISTS', 'NOT EXISTS' ];
export const LIST_VALUE = [ 'IN', 'NOT IN' ];
export const RANGE_VALUE = [ 'BETWEEN', 'NOT BETWEEN' ];

export const META_TYPES = [
	[ 'CHAR', __( 'Text', 'werun-blocks-community' ) ],
	[ 'NUMERIC', __( 'Whole number', 'werun-blocks-community' ) ],
	[ 'DECIMAL', __( 'Decimal', 'werun-blocks-community' ) ],
	[ 'DATE', __( 'Date', 'werun-blocks-community' ) ],
	[ 'DATETIME', __( 'Date and time', 'werun-blocks-community' ) ],
	[ 'TIME', __( 'Time', 'werun-blocks-community' ) ],
];
/** Value modes exist only for these types (Config::normalize). */
export const NOW_TYPES = [ 'DATE', 'DATETIME', 'NUMERIC' ];

export const ORDER_BY = [
	[ 'date', __( 'Publish date', 'werun-blocks-community' ) ],
	[ 'modified', __( 'Last updated', 'werun-blocks-community' ) ],
	[ 'title', __( 'Title', 'werun-blocks-community' ) ],
	[ 'menu_order', __( 'Manual order (menu order)', 'werun-blocks-community' ) ],
	[ 'comment_count', __( 'Most comments', 'werun-blocks-community' ) ],
	[ 'rand', __( 'Random', 'werun-blocks-community' ) ],
	[ 'meta', __( 'A custom field', 'werun-blocks-community' ) ],
	[ 'upcoming', __( 'Event date (upcoming / past)', 'werun-blocks-community' ) ],
];

export const DATE_FORMATS = [
	[ 'Ymd', __( '20261231 (ACF date picker)', 'werun-blocks-community' ) ],
	[ 'Y-m-d', '2026-12-31' ],
	[ 'Y-m-d H:i:s', '2026-12-31 18:30:00' ],
	[ 'timestamp', __( 'Unix timestamp', 'werun-blocks-community' ) ],
];

export const SORTS = [
	[ 'newest', __( 'Newest first', 'werun-blocks-community' ) ],
	[ 'oldest', __( 'Oldest first', 'werun-blocks-community' ) ],
	[ 'az', __( 'Title, A to Z', 'werun-blocks-community' ) ],
	[ 'za', __( 'Title, Z to A', 'werun-blocks-community' ) ],
	[ 'updated', __( 'Recently updated', 'werun-blocks-community' ) ],
];

export const FIELD_TYPES = [
	[ 'title', __( 'Title', 'werun-blocks-community' ) ],
	[ 'image', __( 'Featured image', 'werun-blocks-community' ) ],
	[ 'date', __( 'Date', 'werun-blocks-community' ) ],
	[ 'excerpt', __( 'Excerpt', 'werun-blocks-community' ) ],
	[ 'terms', __( 'Terms (categories, tags…)', 'werun-blocks-community' ) ],
	[ 'author', __( 'Author', 'werun-blocks-community' ) ],
	[ 'meta', __( 'Custom field', 'werun-blocks-community' ) ],
	[ 'button', __( 'Button', 'werun-blocks-community' ) ],
	[ 'readingTime', __( 'Reading time', 'werun-blocks-community' ) ],
];
export const MAX_FIELDS = 12;

export const FORMATS = [
	[ 'text', __( 'Text', 'werun-blocks-community' ) ],
	[ 'number', __( 'Number', 'werun-blocks-community' ) ],
	[ 'currency', __( 'Price', 'werun-blocks-community' ) ],
	[ 'date', __( 'Date', 'werun-blocks-community' ) ],
	[ 'url', __( 'Link (URL)', 'werun-blocks-community' ) ],
	[ 'email', __( 'Email (protected from bots)', 'werun-blocks-community' ) ],
	[ 'phone', __( 'Phone', 'werun-blocks-community' ) ],
	[ 'image', __( 'Image (attachment)', 'werun-blocks-community' ) ],
	[ 'file', __( 'File link (attachment)', 'werun-blocks-community' ) ],
	[ 'download', __( 'Download (attachment, can be gated)', 'werun-blocks-community' ) ],
];

export const RATIOS = [ 'auto', '1/1', '4/3', '3/2', '16/9', '3/4', '2/3' ];

/** Name fragments that suggest a post type per variant (Config::SUGGEST). */
export const SUGGEST = {
	team: [ 'team', 'staff', 'people', 'member' ],
	events: [ 'event' ],
	locations: [ 'location', 'office', 'store' ],
	resources: [ 'resource', 'download', 'whitepaper' ],
	cases: [ 'case', 'case-study', 'case_study', 'project', 'portfolio' ],
};

/** A type whose name or label fits the variant (Config::suggest_type()). */
export function suggestType( variant, types = [] ) {
	for ( const needle of SUGGEST[ variant ] || [] ) {
		const label = needle.replace( /[-_]/g, ' ' );
		const found = types.find( ( t ) => t.name.includes( needle ) || ( t.label || '' ).toLowerCase().includes( label ) );
		if ( found ) {
			return found.name;
		}
	}
	return '';
}

/** The type the server will use (Config::normalize()). */
export function effectiveType( query, variant, types ) {
	if ( query?.postType ) {
		return query.postType;
	}
	const suggested = suggestType( variant, types );
	if ( suggested ) {
		return suggested;
	}
	return [ 'posts', 'related', 'custom' ].includes( variant ) ? 'post' : '';
}

/** Twin of View::from_attributes(): carousel and handpicked never paginate, a map can't append. */
export function effectivePagination( attributes ) {
	const { layout, pagination, query } = attributes;
	if ( layout === 'carousel' || query?.mode === 'handpicked' ) {
		return 'none';
	}
	if ( layout === 'map' && pagination === 'loadMore' ) {
		return 'numbers';
	}
	return pagination || 'none';
}

/** Defaults of the query object (Config::defaults()). */
export const QUERY_DEFAULTS = {
	postType: '',
	mode: 'query',
	include: [],
	taxQuery: { relation: 'AND', rules: [] },
	metaQuery: { relation: 'AND', rules: [] },
	orderBy: 'date',
	order: 'DESC',
	orderMeta: { key: '', type: 'CHAR' },
	upcoming: { startKey: '', endKey: '', format: 'Ymd', when: 'upcoming', includeOngoing: true },
	perPage: 6,
	offset: 0,
	maxPages: 10,
	excludeCurrent: true,
	exclude: [],
	related: { taxonomies: [] },
	author: { mode: 'any', ids: [] },
	sticky: 'include',
	hasImage: false,
	parent: 0,
	search: '',
	passwordPosts: 'exclude',
};

/** The query with every default filled in, for reading. */
export const withDefaults = ( query ) => ( { ...QUERY_DEFAULTS, ...( query || {} ) } );

/** Guess → meta compare type. */
export const guessType = ( guess ) => ( { numeric: 'NUMERIC', date: 'DATE', attachment: 'NUMERIC' }[ guess ] || 'CHAR' );

/** Guess → card field format. */
export const guessFormat = ( guess ) => ( { numeric: 'number', date: 'date', url: 'url', email: 'email', attachment: 'file' }[ guess ] || 'text' );
