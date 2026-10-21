/**
 * The values the timeline renders with, from its attributes. Twin of
 * wrbc_timeline_effective() in render.php: same enums, same clamps.
 */
import {
	AA_TEXT,
	accentVars,
	ACCENT,
	blockColors,
	colorHex,
	colorOver,
	colorRgba,
	contrastRatio,
	isDarkColor,
	onColor,
	PAPER,
	pageColors,
	readableColor,
	toneClass,
} from '../shared/contrast';

const clamp = ( value, min, max, fallback ) => {
	const n = Number( value );
	return Number.isFinite( n ) ? Math.max( min, Math.min( max, n ) ) : fallback;
};
const oneOf = ( value, options, fallback ) => ( options.includes( value ) ? value : fallback );

/**
 * The level of the item titles. Under a printed section title they are one
 * level below it, so no level is skipped or inverted; otherwise the level
 * chosen in the sidebar. Twin of the $level rule in timeline-item/render.php.
 *
 * @param {Object} a showHeader, title, titleLevel and itemTitleLevel of the timeline.
 * @return {number} 2 to 6.
 */
export function itemTitleLevel( a ) {
	const headerTitle = !! a.showHeader && String( a.title ?? '' ).replace( /<[^>]*>/g, '' ).trim() !== '';
	return headerTitle
		? Math.max( 2, Math.min( 4, Number( a.titleLevel ) || 2 ) ) + 1
		: Math.max( 2, Math.min( 6, Number( a.itemTitleLevel ) || 3 ) );
}

export function effective( a ) {
	const orientation = oneOf( a.orientation, [ 'vertical', 'alternating', 'horizontal' ], 'vertical' );
	const lineStyle = oneOf( a.lineStyle, [ 'solid', 'dashed', 'dotted', 'none' ], 'solid' );
	const marker = oneOf( a.markerStyle, [ 'dot', 'icon', 'number', 'year' ], 'dot' );
	const cardStyle = oneOf( a.cardStyle, [ 'plain', 'bordered', 'filled', 'shadow' ], 'bordered' );
	return {
		orientation,
		horizontal: orientation === 'horizontal',
		alternating: orientation === 'alternating',
		start: a.alternateStart === 'start' ? 'start' : 'end',
		itemWidth: Math.round( clamp( a.itemWidth, 200, 520, 300 ) ),
		arrows: orientation === 'horizontal' && a.showArrows !== false,
		lineStyle,
		hasLine: lineStyle !== 'none',
		lineWidth: clamp( a.lineWidth, 1, 6, 2 ),
		marker,
		// With year markers the date is the marker itself.
		dateAt: marker === 'year' ? 'marker' : oneOf( a.datePosition, [ 'card', 'opposite' ], 'card' ),
		cardStyle,
		boxed: cardStyle !== 'plain',
		iconSize: clamp( a.iconSize, 12, 40, 18 ),
		// The ranges of the editor controls.
		iconStroke: clamp( a.iconStroke, 1, 3, 2 ),
		gap: clamp( a.gap, 0, 96, 32 ),
		cardRadius: clamp( a.cardRadius, 0, 40, 14 ),
		cardPadding: clamp( a.cardPadding, 0, 64, 24 ),
	};
}

const text = ( value ) => ( typeof value === 'string' ? value : '' );

/**
 * The timeline's colours (docs/accessibility.md): its tone class, the accent
 * vars (on-accent, accent as text) and the text on the markers. Twin of
 * wrbc_timeline_colors() in render.php.
 *
 * @param {Object} a       Attributes.
 * @param {Object} e       effective( a ).
 * @param {string} surface What the content sits on (useSurface()).
 * @param {string} around  What's around the block (useContextBackground()).
 * @return {{ className: string, vars: Object }} Tone class and custom properties.
 */
export function timelineColors( a, e, surface, around ) {
	const tone = toneClass( surface, around );
	// The dates sit in the cards: on filled cards without a colour of their
	// own that's the surface tinted with 4 % of the text colour (--wrbc-surface).
	let accentBg = surface;
	if ( e.cardStyle === 'filled' && ! text( a.cardBg ) ) {
		let ink = blockColors( a ).text;
		if ( ! ink ) {
			if ( tone === 'wrbc-is-dark' ) {
				ink = PAPER;
			} else {
				// The tones' text: white on dark (above), black on light.
				ink = tone === 'wrbc-is-light' ? '#000000' : pageColors().text;
			}
		}
		const fg = colorRgba( ink );
		const bg = colorRgba( surface );
		if ( fg && bg ) {
			accentBg = colorHex( colorOver( [ fg[ 0 ], fg[ 1 ], fg[ 2 ], 0.04 ], bg ) );
		}
	}
	const vars = accentVars( a, accentBg );
	// Text and icons on the markers: a chosen colour made readable on the
	// marker, or the automatic on-colour of a chosen marker colour (the
	// highlight ring uses it on dots too); otherwise --wrbc-on-accent.
	const fill = text( a.markerColor );
	let on = e.marker !== 'dot' ? text( a.markerTextColor ) : '';
	if ( on ) {
		on = readableColor( on, fill || text( a.accentColor ) || ACCENT, AA_TEXT );
	} else if ( fill ) {
		on = onColor( fill );
	}
	vars[ '--wrbc-tl-marker-text' ] = on || undefined;
	return { className: tone, vars };
}

/**
 * An item's card with a background of its own (a chosen card colour, or the
 * white of shadow cards), a pair the block controls: its tone class, so its
 * text, links and focus ring follow; the accent as text made readable on it;
 * and the block's own text colour, when one was chosen, as the closest colour
 * to it that reads on the card. Twin of wrbc_timeline_card_colors() in
 * timeline-item/render.php.
 *
 * @param {string} style      Card style (plain, bordered, filled, shadow).
 * @param {string} cardBg     Chosen card background ('' = none).
 * @param {string} accent     Chosen accent ('' = the default).
 * @param {string} surface    What the timeline sits on (useContextBackground() of the item).
 * @param {string} chosenText The timeline's chosen text colour ('' = none).
 * @return {{ className: string, vars: Object }} Tone class and custom properties.
 */
export function cardColors( style, cardBg, accent, surface, chosenText = '' ) {
	const kind = oneOf( style, [ 'plain', 'bordered', 'filled', 'shadow' ], 'bordered' );
	let own = text( cardBg );
	if ( kind === 'plain' ) {
		own = '';
	} else if ( ! own && kind === 'shadow' ) {
		own = PAPER;
	}
	const rgba = own ? colorRgba( own ) : null;
	if ( ! rgba ) {
		// Filled cards without a colour of their own are a 4 % tint of the
		// text colour, a background the block controls too: their links take
		// the accent, which timelineColors() made readable on it.
		return { className: kind === 'filled' ? 'wrbc-timeline-item__card--colored' : '', vars: {} };
	}
	// A translucent card colour shows the surface through; kept exact (not
	// rounded to hex), as a contrast checker composites it.
	const bg = colorOver( rgba, colorRgba( surface ) || [ 255, 255, 255, 1 ] );
	let className = toneClass( bg, surface );
	const color = readableColor( text( accent ) && colorRgba( accent ) ? accent : ACCENT, bg, AA_TEXT );
	const vars = { '--wrbc-accent-text': color, '--wrbc-focus': color };
	if ( text( chosenText ) && colorRgba( chosenText ) ) {
		vars.color = readableColor( chosenText, bg, AA_TEXT );
	} else if ( ! className ) {
		// A mid-tone card on a light page: the page's text, or its secondary
		// shade (76 %), may not read on it. Then the card takes a tone of its own.
		const page = colorRgba( pageColors().text );
		if ( page && contrastRatio( colorOver( [ page[ 0 ], page[ 1 ], page[ 2 ], 0.76 ], bg ), bg ) < AA_TEXT ) {
			className = isDarkColor( bg ) ? 'wrbc-is-dark' : 'wrbc-is-light';
		}
	}
	// The secondary text (--wrbc-muted: the text colour at 85 % on dark, 76 %
	// otherwise; the tones' text is white / black) as a solid colour that
	// still reads on this card.
	let ink = vars.color || '';
	if ( ! ink && className === 'wrbc-is-dark' ) {
		ink = PAPER;
	} else if ( ! ink && className === 'wrbc-is-light' ) {
		ink = '#000000';
	}
	const fg = ink ? colorRgba( ink ) : null;
	if ( fg ) {
		const blend = colorOver( [ fg[ 0 ], fg[ 1 ], fg[ 2 ], className === 'wrbc-is-dark' ? 0.85 : 0.76 ], bg );
		vars[ '--wrbc-muted' ] = readableColor( colorHex( blend ), bg, AA_TEXT );
	}
	// A card colour the author picked, or one with a tone of its own: the
	// links in its text take the accent made readable on it (style.scss).
	const colored = !! text( cardBg ) || !! className;
	return { className: [ className, colored && 'wrbc-timeline-item__card--colored' ].filter( Boolean ).join( ' ' ), vars };
}
