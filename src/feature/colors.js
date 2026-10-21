/**
 * Feature grid colours in the editor: the same decisions as colors.php
 * (wrbc_feature_badge_color(), wrbc_feature_icon_color(), wrbc_feature_colors()),
 * so the preview gets the classes and custom properties the page prints
 * (docs/accessibility.md).
 */
import { __ } from '@wordpress/i18n';
import { AA_TEXT, AA_UI, ACCENT, blockColors, blockSurface, colorHex, colorOver, colorRgba, isDarkColor, readableColor, toneClass } from '../shared/contrast';

const WHITE = [ 255, 255, 255, 1 ];

/** Names of the grid's parts in the editor's contrast warning (ContrastAudit). */
export function auditLabels() {
	return {
		'.wrbc-header__eyebrow': __( 'Eyebrow', 'werun-blocks-community' ),
		'.wrbc-header__title': __( 'Section title', 'werun-blocks-community' ),
		'.wrbc-header__intro': __( 'Intro', 'werun-blocks-community' ),
		'.wrbc-feature__badge': __( 'Badge', 'werun-blocks-community' ),
		'.wrbc-feature__title': __( 'Card title', 'werun-blocks-community' ),
		'.wrbc-feature__text': __( 'Card text', 'werun-blocks-community' ),
		'.wrbc-feature__link': __( 'Card link', 'werun-blocks-community' ),
	};
}

/**
 * The attributes that take a block back to the automatic text colour (no Color panel text).
 *
 * @param {Object} a The block's attributes.
 */
export function withoutTextColor( a ) {
	const style = { ...( a.style || {} ) };
	if ( style.color ) {
		const color = { ...style.color };
		delete color.text;
		if ( Object.keys( color ).length ) {
			style.color = color;
		} else {
			delete style.color;
		}
	}
	return { textColor: undefined, style: Object.keys( style ).length ? style : undefined };
}

/**
 * The attributes that take a block back to the automatic link colour (no Color panel link).
 *
 * @param {Object} a The block's attributes.
 */
export function withoutLinkColor( a ) {
	const style = { ...( a.style || {} ) };
	if ( style.elements ) {
		const elements = { ...style.elements };
		delete elements.link;
		if ( Object.keys( elements ).length ) {
			style.elements = elements;
		} else {
			delete style.elements;
		}
	}
	return { style: Object.keys( style ).length ? style : undefined };
}

/**
 * Whether a block's Color panel sets a link colour.
 *
 * @param {Object} a The block's attributes.
 */
export function hasLinkColor( a ) {
	return !! a?.style?.elements?.link?.color?.text;
}

/**
 * The badge's text colour: the accent made readable on its 12 % tint over
 * `bg`, aimed at 4.6:1 (the browser paints the tint itself, its rounding may
 * differ a little). PHP: wrbc_feature_badge_color().
 *
 * @param {string} base The accent.
 * @param {string} bg   The card's (opaque) background.
 */
export function featureBadgeColor( base, bg ) {
	const accent = colorRgba( base );
	const under = colorRgba( bg );
	if ( ! accent || ! under ) {
		return '';
	}
	return readableColor( base, colorHex( colorOver( [ accent[ 0 ], accent[ 1 ], accent[ 2 ], 0.12 ], under ) ), AA_TEXT + 0.1 );
}

/**
 * The icons' colour on a card when the grid picks an icon colour or an icon
 * background: made readable (3:1) on the holder or the card; '' when nothing
 * is picked (PHP: wrbc_feature_icon_color()).
 *
 * @param {Object} grid       The grid's values: iconStyle, iconColor, iconBg, accentColor.
 * @param {string} bg         The card's (opaque) background.
 * @param {string} accentText The accent as text on that card.
 */
export function featureIconColor( grid, bg, accentText ) {
	const picked = typeof grid.iconColor === 'string' && grid.iconColor && colorRgba( grid.iconColor ) ? grid.iconColor : '';
	const holder = [ 'circle', 'square' ].includes( grid.iconStyle ?? 'square' );
	const ownBg = holder && typeof grid.iconBg === 'string' && grid.iconBg ? colorRgba( grid.iconBg ) : null;
	if ( ! picked && ! ownBg ) {
		return '';
	}
	let under = colorRgba( bg );
	if ( ! under ) {
		return picked;
	}
	if ( ownBg ) {
		under = colorOver( ownBg, under );
	} else if ( holder ) {
		const accent = ( typeof grid.accentColor === 'string' && grid.accentColor && colorRgba( grid.accentColor ) ) || colorRgba( ACCENT );
		under = colorOver( [ accent[ 0 ], accent[ 1 ], accent[ 2 ], 0.12 ], under );
	}
	return readableColor( picked || accentText, colorHex( under ), AA_UI );
}

/**
 * What a card paints and the colours that keep it readable.
 *
 * @param {Object} a      The card's attributes.
 * @param {Object} grid   The grid's values (context): cardStyle, cardBg, accentColor, textColor, style, iconStyle, iconColor, iconBg.
 * @param {string} around The background around the card (useContextBackground()).
 * @return {{ className: string, vars: Object, bg: string, custom: boolean }} Tone class, custom properties, the card's background, whether it's a colour of its own.
 */
export function featureColors( a, grid, around ) {
	let under = colorRgba( around );
	under = under ? colorOver( under, WHITE ) : WHITE;
	const own = blockSurface( a, 'werun-community/feature' );
	const style = [ 'plain', 'bordered', 'filled', 'shadow' ].includes( grid.cardStyle ) ? grid.cardStyle : 'bordered';
	let bg = own ? colorRgba( own ) : null;
	if ( ! bg ) {
		bg = typeof grid.cardBg === 'string' && grid.cardBg ? colorRgba( grid.cardBg ) : null;
	}
	// A colour of its own (the card's, or the grid's card colour), not only the style's white or tint.
	const custom = !! bg;
	if ( ! custom && style === 'shadow' ) {
		bg = WHITE;
	} else if ( ! custom && style === 'filled' ) {
		// --wrbc-surface: 4 % of the text colour, light on a dark surface and dark on a light one.
		bg = isDarkColor( under ) === true ? [ 255, 255, 255, 0.04 ] : [ 0, 0, 0, 0.04 ];
	}
	const underHex = colorHex( under );
	const bgHex = bg ? colorHex( colorOver( bg, under ) ) : underHex;

	let className = isDarkColor( bgHex ) === isDarkColor( underHex ) ? '' : toneClass( bgHex, underHex );
	const gridText = blockColors( { textColor: grid.textColor || '', style: grid.style && typeof grid.style === 'object' ? grid.style : {} } ).text;
	if ( gridText && ! blockColors( a ).text ) {
		className = ''; // The grid's own text colour (Color panel) is never overridden.
	}

	const base = typeof grid.accentColor === 'string' && grid.accentColor && colorRgba( grid.accentColor ) ? grid.accentColor : ACCENT;
	const text = readableColor( base, bgHex, AA_TEXT );
	const vars = { '--wrbc-features-badge': featureBadgeColor( base, bgHex ) || undefined };
	if ( className || String( text ).toLowerCase() !== String( readableColor( base, underHex, AA_TEXT ) ).toLowerCase() ) {
		vars[ '--wrbc-accent-text' ] = text;
		vars[ '--wrbc-focus' ] = text;
	}
	const icon = featureIconColor( grid, bgHex, text );
	if ( icon ) {
		vars[ '--wrbc-icon-color' ] = icon;
	}
	return { className, vars, bg: bgHex, custom };
}
