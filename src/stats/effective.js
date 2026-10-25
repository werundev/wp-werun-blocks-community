/**
 * The values the stats block renders with, from its attributes. Twin of
 * wrbc_stats_effective() in render.php: same enums, same clamps.
 */
const clamp = ( value, min, max, fallback ) => {
	const n = Number( value );
	return Number.isFinite( n ) ? Math.max( min, Math.min( max, n ) ) : fallback;
};
const oneOf = ( value, options, fallback ) => ( options.includes( value ) ? value : fallback );

export function effective( a ) {
	const layout = oneOf( a.layout, [ 'row', 'cards', 'large' ], 'row' );
	const cards = layout === 'cards';
	const iconStyle = oneOf( a.iconStyle, [ 'none', 'circle', 'square', 'outline' ], 'none' );
	return {
		layout,
		cards,
		align: a.contentAlign === 'left' ? 'left' : 'center',
		cardStyle: oneOf( a.cardStyle, [ 'bordered', 'filled', 'shadow' ], 'filled' ),
		// Cards have their own box: separators are for the row and large layouts.
		separators: ! cards && a.separators !== false,
		iconStyle,
		iconHasBg: !! a.showIcon && ( iconStyle === 'circle' || iconStyle === 'square' ),
		colsD: Math.round( clamp( a.columnsDesktop, 1, 6, 4 ) ),
		colsT: Math.round( clamp( a.columnsTablet, 1, 4, 2 ) ),
		colsM: Math.round( clamp( a.columnsMobile, 1, 2, 1 ) ),
		numberSize: clamp( a.numberSize, 1.5, 8, 3 ),
		// At most 5 s: motion that starts by itself and lasts longer needs a
		// pause control (WCAG 2.2.2). Twin of the clamp in src/stat/render.php.
		duration: Math.round( clamp( a.counterDuration, 300, 5000, 1600 ) ),
		// The ranges of the editor controls.
		gap: clamp( a.gap, 0, 96, 32 ),
		cardRadius: clamp( a.cardRadius, 0, 40, 14 ),
		cardPadding: clamp( a.cardPadding, 0, 64, 28 ),
		iconSize: clamp( a.iconSize, 12, 64, 28 ),
		iconStroke: clamp( a.iconStroke, 1, 3, 2 ),
	};
}
