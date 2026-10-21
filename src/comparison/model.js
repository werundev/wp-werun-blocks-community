/**
 * Comparison table data rules, shared by the editor. Twin of the top of
 * render.php: same limits, same normalisation, same "effective" options.
 */

export const MAX_PLANS = 6;
export const MAX_ROWS = 80;
export const VALUE_TYPES = [ 'check', 'cross', 'partial', 'text' ];

/**
 * Whether rich text has any visible text (wp_strip_all_tags + trim).
 *
 * @param {*} value Raw value.
 */
export const filled = ( value ) =>
	typeof value === 'string' && value.replace( /<[^>]*>/g, '' ).trim() !== '';

/**
 * Strings only: block JSON can hold anything inside an array.
 *
 * @param {*} value Raw value.
 */
export const str = ( value ) =>
	typeof value === 'string' || typeof value === 'number'
		? String( value )
		: '';

/**
 * A number gets the currency and the period: same regex as render.php and the pricing table.
 *
 * @param {*} value Price text.
 */
export const isNumeric = ( value ) =>
	/^[\d.,\s]*\d[\d.,\s]*$/.test(
		str( value )
			.replace( /<[^>]*>/g, '' )
			.trim()
	);

/**
 * A fresh id that no other item uses.
 *
 * @param {string}   prefix First letter.
 * @param {string[]} taken  Ids in use.
 */
export function newId( prefix, taken ) {
	let id;
	do {
		id = prefix + Math.random().toString( 36 ).slice( 2, 8 );
	} while ( taken.includes( id ) );
	return id;
}

/**
 * Plans with a unique id each, at most MAX_PLANS (render.php: same loop).
 *
 * @param {Array} plans Raw attribute.
 */
export function normalizePlans( plans ) {
	const list = Array.isArray( plans ) ? plans.slice( 0, MAX_PLANS ) : [];
	const taken = [];
	return list.map( ( raw, index ) => {
		const plan = raw && typeof raw === 'object' ? raw : {};
		let id = str( plan.id ).replace( /[^A-Za-z0-9_-]/g, '' );
		if ( ! id || taken.includes( id ) ) {
			id = `p${ index }`;
		}
		taken.push( id );
		return { ...plan, id, index };
	} );
}

/**
 * The value of one cell: by plan id, or by position for a plain list.
 *
 * @param {Object} row  Row.
 * @param {Object} plan Normalised plan.
 */
export function cellValue( row, plan ) {
	const values =
		row?.values && typeof row.values === 'object' ? row.values : {};
	let value = values[ plan.id ];
	if ( value === undefined ) {
		value = values[ plan.index ];
	}
	value = value && typeof value === 'object' ? value : {};
	return {
		type: VALUE_TYPES.includes( value.type ) ? value.type : '',
		text: str( value.text ),
	};
}

/**
 * Options as render.php applies them.
 *
 * @param {Object} a     Attributes.
 * @param {Array}  plans Normalised plans.
 */
export function effective( a, plans ) {
	const count = plans.length;
	// A column number (1 to the number of plans); anything else is no featured plan.
	let featured = parseInt( a.featuredColumn, 10 ) || 0;
	featured = featured >= 1 && featured <= count ? featured : 0;
	const hasYearly = plans.some( ( plan ) =>
		filled( str( plan.priceYearly ) )
	);
	const anyCta = plans.some( ( plan ) => filled( str( plan.ctaLabel ) ) );
	const showPrices = a.showPrices !== false;
	const showCta = a.showCta !== false;
	return {
		count,
		featured,
		showBadge: !! featured && a.showBadge !== false,
		showPrices,
		showCta,
		onTop: !! a.pricesOnTop,
		hasYearly,
		// The switch only when there is a yearly price to switch to.
		toggle: showPrices && !! a.showToggle && hasYearly,
		// Without the switch only the (monthly) price is shown.
		period:
			showPrices &&
			!! a.showToggle &&
			hasYearly &&
			a.defaultPeriod === 'yearly'
				? 'yearly'
				: 'monthly',
		mobile: a.mobileLayout === 'stacked' ? 'stacked' : 'scroll',
		descToggle: a.descriptionDisplay !== 'below',
		details: showPrices || ( showCta && anyCta ),
		foot: ! a.pricesOnTop && ( showPrices || showCta ),
	};
}
