import { __ } from '@wordpress/i18n';
import { InspectorControls, PanelColorSettings, useBlockProps, useInnerBlocksProps } from '@wordpress/block-editor';
import { Notice, PanelBody, RangeControl, SelectControl, TextControl } from '@wordpress/components';
import { useEffect, useRef } from '@wordpress/element';
import { Icon } from '../shared/icons';
import { IconControl } from '../shared/IconControl';
import { Choice, cssVars, cx, IconSizeControls, px, SectionHeader, SectionHeaderPanel, Toggle } from '../shared/controls';
import { ContrastAudit } from '../shared/a11y';
import { AA_TEXT, accentVars, blockColors, colorHex, colorOver, colorRgba, contrastRatio, isDarkColor, toneClass, useContextBackground, useSurface } from '../shared/contrast';
import { legacyStyle } from './legacy';

/** The supports' style object without its text colour (undefined when nothing is left). */
const withoutTextColor = ( style ) => {
	if ( ! style || ! style.color || ! style.color.text ) {
		return style;
	}
	const { text, ...color } = style.color; // eslint-disable-line no-unused-vars
	const next = { ...style, color };
	if ( ! Object.keys( color ).length ) {
		delete next.color;
	}
	return Object.keys( next ).length ? next : undefined;
};

/** Numbers within the controls' ranges, as render.php clamps them. */
const clamp = ( value, min, max ) => ( value === undefined || value === null || value === '' || ! Number.isFinite( Number( value ) ) ? undefined : Math.max( min, Math.min( max, Number( value ) ) ) );

const q = ( question, answer ) => [ 'werun-community/accordion-item', { question }, [ [ 'core/paragraph', { content: answer } ] ] ];
export const TEMPLATE = [
	q( 'How long does a project take?', 'Most sites go live in four to eight weeks. The date is agreed before we start.' ),
	q( 'Can I edit the site myself?', 'Yes. Every page is built with blocks you can change, and we show your team how.' ),
	q( 'What happens after launch?', 'Updates, backups and fixes for a month are included. After that, a monthly plan if you want one.' ),
	q( 'Do you work in other languages?', 'Yes. Sites can be built in as many languages as you need.' ),
];

export default function Edit( { attributes, setAttributes, clientId } ) {
	const a = attributes;
	const uid = `wrbc-accordion-${ clientId.slice( 0, 8 ) }`;
	// Effective values. Twin: src/accordion/render.php.
	const style = [ 'separated', 'boxed', 'minimal' ].includes( a.accordionStyle ) ? a.accordionStyle : 'separated';
	const columns = Number( a.columns ) === 2 ? 2 : 1;
	// Same test as wrbc_section_header(): the header is on and its title has text.
	const hasTitle = !! a.showHeader && String( a.title ?? '' ).replace( /<[^>]*>/g, '' ).trim() !== '';
	// What the accordion sits on: its own background, or the one around it.
	// Each item does the same for its own (src/accordion-item/edit.js).
	const surface = useSurface( clientId, a, 'werun-community/accordion' );
	const around = useContextBackground( clientId );
	const chosenText = blockColors( a ).text;
	const textFails = !! chosenText && contrastRatio( chosenText, surface ) < AA_TEXT;
	// The accent as text sits on the surface and, in Boxes without an Item
	// background, on the items' 4 % tint of the text colour: readable on the
	// tint. Twin: src/accordion/render.php.
	let accentBg = surface;
	if ( style === 'boxed' && ! ( a.itemBg && colorRgba( a.itemBg ) && colorRgba( a.itemBg )[ 3 ] > 0 ) ) {
		const ink = colorRgba( chosenText || ( isDarkColor( surface ) === true ? '#ffffff' : '#000000' ) );
		const base = colorRgba( surface );
		if ( ink && base ) {
			accentBg = colorHex( colorOver( [ ink[ 0 ], ink[ 1 ], ink[ 2 ], 0.04 ], base ) );
		}
	}
	const tone = toneClass( surface, around );
	const accent = accentVars( a, accentBg );

	// The look used to be stored in `style`, which is also the attribute of
	// the colour / spacing / typography supports. A value that still arrives
	// there (a saved style made before 2.0) moves to accordionStyle.
	useEffect( () => {
		const legacy = legacyStyle( a.style );
		if ( legacy ) {
			setAttributes( { accordionStyle: legacy.accordionStyle, style: legacy.style } );
		}
	}, [ a.style ] ); // eslint-disable-line react-hooks/exhaustive-deps

	const ref = useRef();
	const blockProps = useBlockProps( {
		ref,
		className: cx(
			'wrbc-root wrbc-accordion',
			`wrbc-accordion--${ style }`,
			`wrbc-accordion--icon-${ a.iconType === 'none' ? 'none' : a.iconPosition }`,
			tone
		),
		style: cssVars( {
			// The accent, and the accent as text (icons, eyebrow, links, focus ring) made readable where it sits.
			...accent,
			'--wrbc-acc-cols': columns,
			'--wrbc-gap': px( clamp( a.gap, 0, 40 ) ),
			'--wrbc-item-bg': style === 'boxed' ? a.itemBg : undefined,
			'--wrbc-item-border': style !== 'minimal' ? a.itemBorderColor : undefined,
			'--wrbc-radius': px( clamp( a.radius, 0, 32 ) ),
			'--wrbc-icon-size': px( clamp( a.iconSize, 12, 32 ) ),
			'--wrbc-icon-stroke': clamp( a.iconStroke, 1, 3 ),
		} ),
	} );
	const innerBlocksProps = useInnerBlocksProps(
		{ className: 'wrbc-accordion__list' },
		{ allowedBlocks: [ 'werun-community/accordion-item' ], template: TEMPLATE }
	);

	return (
		<>
			<ContrastAudit
				blockRef={ ref }
				deps={ [ attributes ] }
				labels={ {
					'.wrbc-acc-item__question': __( 'Questions', 'werun-blocks-community' ),
					'.wrbc-acc-item__content': __( 'Answers', 'werun-blocks-community' ),
					'.wrbc-accordion__all-btn': __( 'Expand / collapse buttons', 'werun-blocks-community' ),
				} }
				checks={ [
					{ selector: '.wrbc-acc-item__toggle .wrbc-icon', property: 'stroke', min: 3, label: __( 'Open / close icons', 'werun-blocks-community' ) },
					{ selector: '.wrbc-accordion__input', property: 'border-color', min: 3, label: __( 'Search field border', 'werun-blocks-community' ) },
					{ selector: '.wrbc-accordion__input', pseudo: '::placeholder', property: 'color', min: AA_TEXT, against: 'self', label: __( 'Search placeholder', 'werun-blocks-community' ) },
				] }
				actions={
					textFails
						? [ { label: __( 'Use the automatic text colour', 'werun-blocks-community' ), onClick: () => setAttributes( { textColor: undefined, style: withoutTextColor( a.style ) } ) } ]
						: []
				}
			/>
			<InspectorControls>
				<PanelBody title={ __( 'Behaviour', 'werun-blocks-community' ) }>
					<Toggle
						attributes={ a }
						setAttributes={ setAttributes }
						name="allowMultiple"
						label={ __( 'Several open at once', 'werun-blocks-community' ) }
						help={ a.allowMultiple ? undefined : __( 'Opening one closes the others.', 'werun-blocks-community' ) }
					/>
					<Toggle attributes={ a } setAttributes={ setAttributes } name="firstOpen" label={ __( 'First question open on load', 'werun-blocks-community' ) } />
					<Toggle attributes={ a } setAttributes={ setAttributes } name="showSearch" label={ __( 'Search field', 'werun-blocks-community' ) } />
					{ a.showSearch && (
						<>
							<TextControl
								__nextHasNoMarginBottom
								__next40pxDefaultSize
								label={ __( 'Search placeholder', 'werun-blocks-community' ) }
								value={ a.searchPlaceholder }
								onChange={ ( searchPlaceholder ) => setAttributes( { searchPlaceholder } ) }
							/>
							<TextControl
								__nextHasNoMarginBottom
								__next40pxDefaultSize
								label={ __( 'Message when nothing matches', 'werun-blocks-community' ) }
								value={ a.noResults }
								onChange={ ( noResults ) => setAttributes( { noResults } ) }
							/>
						</>
					) }
					{ a.allowMultiple && (
						<Toggle attributes={ a } setAttributes={ setAttributes } name="showExpandAll" label={ __( 'Expand all / collapse all buttons', 'werun-blocks-community' ) } />
					) }
					<SelectControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Questions as headings', 'werun-blocks-community' ) }
						value={ a.questionHeading }
						options={ [
							{ value: 'auto', label: __( 'Automatic: one level below the title', 'werun-blocks-community' ) },
							{ value: 'none', label: __( 'No, plain text', 'werun-blocks-community' ) },
							{ value: 'h2', label: 'H2' },
							{ value: 'h3', label: 'H3' },
							{ value: 'h4', label: 'H4' },
							{ value: 'h5', label: 'H5' },
							{ value: 'h6', label: 'H6' },
						] }
						help={
							a.questionHeading === 'auto' && ! hasTitle
								? __( 'The section title is hidden, so Automatic leaves the questions as plain text: pick the level that follows the heading above the accordion.', 'werun-blocks-community' )
								: __( 'Headings let screen-reader users jump from question to question.', 'werun-blocks-community' )
						}
						onChange={ ( questionHeading ) => setAttributes( { questionHeading } ) }
					/>
					<Toggle
						attributes={ a }
						setAttributes={ setAttributes }
						name="faqSchema"
						label={ __( 'FAQ structured data (schema.org)', 'werun-blocks-community' ) }
						help={ __( 'Adds FAQPage JSON-LD from the questions and answers. Use it on one accordion per page.', 'werun-blocks-community' ) }
					/>
					<Notice status="info" isDismissible={ false }>
						{ __( 'Link to a question with #its-anchor (Advanced › HTML anchor on the item): it opens when the page loads.', 'werun-blocks-community' ) }
					</Notice>
				</PanelBody>
				<PanelBody title={ __( 'Layout', 'werun-blocks-community' ) } initialOpen={ false }>
					<Choice
						label={ __( 'Style', 'werun-blocks-community' ) }
						value={ style }
						options={ [
							[ 'separated', __( 'Lines', 'werun-blocks-community' ) ],
							[ 'boxed', __( 'Boxes', 'werun-blocks-community' ) ],
							[ 'minimal', __( 'Minimal', 'werun-blocks-community' ) ],
						] }
						onChange={ ( accordionStyle ) => setAttributes( { accordionStyle } ) }
					/>
					<Choice
						label={ __( 'Columns on wide screens', 'werun-blocks-community' ) }
						value={ String( columns ) }
						options={ [
							[ '1', '1' ],
							[ '2', '2' ],
						] }
						help={ __( 'Always one column below 880 px.', 'werun-blocks-community' ) }
						onChange={ ( value ) => setAttributes( { columns: Number( value ) } ) }
					/>
					{ /* Lines sit edge to edge: there the gap only separates two columns. */ }
					{ ( style !== 'separated' || columns === 2 ) && (
						<RangeControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							label={ style === 'separated' ? __( 'Gap between the columns (px)', 'werun-blocks-community' ) : __( 'Gap (px)', 'werun-blocks-community' ) }
							help={ columns === 2 ? __( 'Columns are 2.5 times this apart.', 'werun-blocks-community' ) : undefined }
							value={ a.gap }
							min={ 0 }
							max={ 40 }
							onChange={ ( gap ) => setAttributes( { gap } ) }
						/>
					) }
					{ style === 'boxed' && (
						<RangeControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							label={ __( 'Corner radius (px)', 'werun-blocks-community' ) }
							value={ a.radius }
							min={ 0 }
							max={ 32 }
							onChange={ ( radius ) => setAttributes( { radius } ) }
						/>
					) }
				</PanelBody>
				<PanelBody title={ __( 'Icons', 'werun-blocks-community' ) } initialOpen={ false }>
					<Choice
						label={ __( 'Open / close icon', 'werun-blocks-community' ) }
						value={ a.iconType }
						options={ [
							[ 'chevron', __( 'Chevron', 'werun-blocks-community' ) ],
							[ 'plus', '+ / −' ],
							[ 'custom', __( 'Custom', 'werun-blocks-community' ) ],
							[ 'none', __( 'None', 'werun-blocks-community' ) ],
						] }
						onChange={ ( iconType ) => setAttributes( { iconType } ) }
					/>
					{ a.iconType === 'custom' && (
						<>
							<IconControl label={ __( 'Closed', 'werun-blocks-community' ) } value={ a.iconClosed } allowRemove={ false } allowAnimation={ false } onChange={ ( iconClosed ) => setAttributes( { iconClosed } ) } />
							<IconControl label={ __( 'Open', 'werun-blocks-community' ) } value={ a.iconOpen } allowRemove={ false } allowAnimation={ false } onChange={ ( iconOpen ) => setAttributes( { iconOpen } ) } />
						</>
					) }
					{ a.iconType !== 'none' && (
						<Choice
							label={ __( 'Side', 'werun-blocks-community' ) }
							value={ a.iconPosition }
							options={ [
								[ 'left', __( 'Left', 'werun-blocks-community' ) ],
								[ 'right', __( 'Right', 'werun-blocks-community' ) ],
							] }
							onChange={ ( iconPosition ) => setAttributes( { iconPosition } ) }
						/>
					) }
					<Toggle
						attributes={ a }
						setAttributes={ setAttributes }
						name="showItemIcons"
						label={ __( 'An icon before each question', 'werun-blocks-community' ) }
					/>
					{ a.showItemIcons && (
						<IconControl
							label={ __( 'Icon for every question', 'werun-blocks-community' ) }
							help={ __( 'Select a question to give it its own icon, or none.', 'werun-blocks-community' ) }
							value={ a.itemIcon }
							allowRemove={ false }
							onChange={ ( itemIcon ) => setAttributes( { itemIcon } ) }
						/>
					) }
					{ ( a.iconType !== 'none' || a.showItemIcons ) && <IconSizeControls attributes={ a } setAttributes={ setAttributes } maxSize={ 32 } /> }
				</PanelBody>
				<SectionHeaderPanel attributes={ a } setAttributes={ setAttributes } />
				<PanelColorSettings
					title={ __( 'Colors', 'werun-blocks-community' ) }
					initialOpen={ false }
					colorSettings={ [
						{ value: a.accentColor, onChange: ( accentColor ) => setAttributes( { accentColor } ), label: __( 'Accent (icons, focus)', 'werun-blocks-community' ) },
						style === 'boxed' && { value: a.itemBg, onChange: ( itemBg ) => setAttributes( { itemBg } ), label: __( 'Item background', 'werun-blocks-community' ) },
						style !== 'minimal' && {
							value: a.itemBorderColor,
							onChange: ( itemBorderColor ) => setAttributes( { itemBorderColor } ),
							label: style === 'boxed' ? __( 'Borders', 'werun-blocks-community' ) : __( 'Lines', 'werun-blocks-community' ),
						},
					].filter( Boolean ) }
				/>
			</InspectorControls>

			<section { ...blockProps }>
				<SectionHeader attributes={ a } setAttributes={ setAttributes } uid={ uid } />
				{ ( a.showSearch || ( a.allowMultiple && a.showExpandAll ) ) && (
					<div className="wrbc-accordion__tools">
						{ a.showSearch && (
							<div className="wrbc-accordion__search">
								<Icon icon={ { name: 'search' } } className="wrbc-accordion__search-icon" />
								<input
									type="search"
									className="wrbc-accordion__input"
									placeholder={ a.searchPlaceholder }
									aria-label={ String( a.searchPlaceholder ?? '' ).trim() || __( 'Search the questions', 'werun-blocks-community' ) }
									disabled
								/>
							</div>
						) }
						{ a.allowMultiple && a.showExpandAll && (
							<div className="wrbc-accordion__all">
								<span className="wrbc-btn wrbc-btn--outline wrbc-accordion__all-btn">{ __( 'Expand all', 'werun-blocks-community' ) }</span>
								<span className="wrbc-btn wrbc-btn--outline wrbc-accordion__all-btn">{ __( 'Collapse all', 'werun-blocks-community' ) }</span>
							</div>
						) }
					</div>
				) }
				<div { ...innerBlocksProps } />
			</section>
		</>
	);
}
