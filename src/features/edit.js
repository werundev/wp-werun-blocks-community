import { __, sprintf } from '@wordpress/i18n';
import {
	InnerBlocks,
	InspectorControls,
	PanelColorSettings,
	useBlockProps,
	useInnerBlocksProps,
} from '@wordpress/block-editor';
import { PanelBody, RangeControl } from '@wordpress/components';
import { useRef } from '@wordpress/element';
import {
	Choice,
	cssVars,
	cx,
	IconSizeControls,
	px,
	ResponsiveColumns,
	SectionHeader,
	SectionHeaderPanel,
	Toggle,
} from '../shared/controls';
import { accentVars, blockColors, toneClass, useContextBackground, useSurface } from '../shared/contrast';
import { ContrastAudit } from '../shared/a11y';
import { auditLabels, hasLinkColor, withoutLinkColor, withoutTextColor } from '../feature/colors';

const HOVER_OPTIONS = [
	[ 'none', __( 'Nothing', 'werun-blocks-community' ) ],
	[ 'lift', __( 'Lift', 'werun-blocks-community' ) ],
	[ 'border', __( 'Border', 'werun-blocks-community' ) ],
	[ 'accent', __( 'Accent', 'werun-blocks-community' ) ],
];

const TEMPLATE = [
	[ 'werun-community/feature', { icon: { name: 'zap', lib: 'animated', anim: 'auto', trigger: 'hover' }, title: 'Fast by default', text: 'Pages that load in a blink on any connection, because every byte has to earn its place.' } ],
	[ 'werun-community/feature', { icon: { name: 'shield-check', lib: 'lucide', anim: 'draw', trigger: 'hover' }, title: 'Secure and updated', text: 'Updates, backups and monitoring handled for you, every week, without asking.', badge: 'Included' } ],
	[ 'werun-community/feature', { icon: { name: 'chart-line', lib: 'animated', anim: 'auto', trigger: 'hover' }, title: 'Measured', text: 'Analytics and events set up from day one, so every decision has a number behind it.' } ],
];

export default function Edit( { attributes, setAttributes, clientId, name } ) {
	const a = attributes;
	const uid = `wrbc-features-${ clientId.slice( 0, 8 ) }`;

	// The same rules as render.php. "Beside" needs an icon or a badge to sit
	// beside the text; a plain card has no box, so it can only lift.
	const canInline = a.showIcon || a.showBadge;
	const layout = canInline && a.layout === 'inline' ? 'inline' : 'stacked';
	const hoverOptions = a.cardStyle === 'plain' ? HOVER_OPTIONS.filter( ( [ key ] ) => key === 'none' || key === 'lift' ) : HOVER_OPTIONS;
	const hover = hoverOptions.some( ( [ key ] ) => key === a.hover ) ? a.hover : 'none';
	const iconHasBg = a.iconStyle === 'circle' || a.iconStyle === 'square';
	// With one column at every width there are no rows to even out.
	const hasRows = a.columnsDesktop > 1 || a.columnsTablet > 1 || a.columnsMobile > 1;
	// As feature/render.php: with a section title on the page, card titles sit
	// one level below it, so "Card title level" only applies without one.
	const hasHeader = a.showHeader && !! String( a.title || '' ).replace( /<[^>]*>/g, '' ).trim();
	const cardLevel = Math.max( 2, Math.min( 4, Number( a.titleLevel ) || 2 ) ) + 1;
	// As render.php: what the grid sits on (its own background or the one
	// around it) sets its tone and the readable accent.
	const surface = useSurface( clientId, attributes, name );
	const around = useContextBackground( clientId );

	const ref = useRef();
	const blockProps = useBlockProps( {
		ref,
		className: cx(
			'wrbc-root wrbc-features',
			`wrbc-features--${ a.cardStyle }`,
			`wrbc-features--${ layout }`,
			`wrbc-features--align-${ a.contentAlign }`,
			`wrbc-features--hover-${ hover }`,
			`wrbc-features--link-${ a.linkStyle }`,
			a.equalHeight && 'is-equal-height',
			toneClass( surface, around )
		),
		style: cssVars( {
			...accentVars( a, surface ),
			'--wrbc-cols-d': a.columnsDesktop,
			'--wrbc-cols-t': a.columnsTablet,
			'--wrbc-cols-m': a.columnsMobile,
			'--wrbc-gap': px( a.gap ),
			'--wrbc-icon-bg': a.iconBg,
			'--wrbc-card-bg': a.cardBg,
			'--wrbc-card-border': a.cardBorderColor,
			'--wrbc-radius': px( a.cardRadius ),
			'--wrbc-card-pad': px( a.cardPadding ),
			'--wrbc-icon-size': px( a.iconSize ),
			'--wrbc-icon-stroke': a.iconStroke,
		} ),
	} );
	const innerBlocksProps = useInnerBlocksProps(
		{ className: 'wrbc-features__grid', role: 'list' },
		{
			allowedBlocks: [ 'werun-community/feature' ],
			template: TEMPLATE,
			orientation: 'horizontal',
			renderAppender: InnerBlocks.ButtonBlockAppender,
		}
	);

	return (
		<>
			<ContrastAudit
				blockRef={ ref }
				deps={ [ attributes ] }
				ignore=".is-missing-url"
				labels={ auditLabels() }
				checks={ [
					// The highlight ring, drawn inside the card as a shadow (plus the border of a bordered card).
					{ selector: '.wrbc-feature.is-highlight', property: 'box-shadow', against: 'self', min: 3, label: __( 'Highlight outline', 'werun-blocks-community' ) },
					a.showLink && a.linkStyle === 'button' && { selector: '.wrbc-feature__link.wrbc-btn--outline', property: 'border-color', min: 3, label: __( 'Button border', 'werun-blocks-community' ) },
				].filter( Boolean ) }
				actions={ [
					// Colours the grid's Color panel sets are never changed for it: the author can drop them here.
					blockColors( a ).text && { label: __( 'Use the automatic text colour', 'werun-blocks-community' ), onClick: () => setAttributes( withoutTextColor( a ) ) },
					hasLinkColor( a ) && { label: __( 'Use the automatic link colour', 'werun-blocks-community' ), onClick: () => setAttributes( withoutLinkColor( a ) ) },
				].filter( Boolean ) }
			/>
			<InspectorControls>
				<PanelBody title={ __( 'Columns and spacing', 'werun-blocks-community' ) }>
					<ResponsiveColumns attributes={ a } setAttributes={ setAttributes } max={ 6 } />
					<RangeControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Gap (px)', 'werun-blocks-community' ) }
						value={ a.gap }
						min={ 0 }
						max={ 80 }
						onChange={ ( gap ) => setAttributes( { gap } ) }
					/>
					{ hasRows && (
						<Toggle attributes={ a } setAttributes={ setAttributes } name="equalHeight" label={ __( 'Same height on every row', 'werun-blocks-community' ) } />
					) }
				</PanelBody>
				<PanelBody title={ __( 'Cards', 'werun-blocks-community' ) } initialOpen={ false }>
					<Choice
						label={ __( 'Style', 'werun-blocks-community' ) }
						value={ a.cardStyle }
						options={ [
							[ 'plain', __( 'Plain', 'werun-blocks-community' ) ],
							[ 'bordered', __( 'Border', 'werun-blocks-community' ) ],
							[ 'filled', __( 'Filled', 'werun-blocks-community' ) ],
							[ 'shadow', __( 'Shadow', 'werun-blocks-community' ) ],
						] }
						onChange={ ( cardStyle ) => setAttributes( { cardStyle } ) }
					/>
					{ canInline && (
						<Choice
							label={ a.showIcon ? __( 'Icon position', 'werun-blocks-community' ) : __( 'Badge position', 'werun-blocks-community' ) }
							value={ a.layout }
							options={ [
								[ 'stacked', __( 'Above', 'werun-blocks-community' ) ],
								[ 'inline', __( 'Beside', 'werun-blocks-community' ) ],
							] }
							onChange={ ( value ) => setAttributes( { layout: value } ) }
						/>
					) }
					{ layout === 'stacked' && (
						<Choice
							label={ __( 'Alignment', 'werun-blocks-community' ) }
							value={ a.contentAlign }
							options={ [
								[ 'left', __( 'Left', 'werun-blocks-community' ) ],
								[ 'center', __( 'Center', 'werun-blocks-community' ) ],
							] }
							onChange={ ( contentAlign ) => setAttributes( { contentAlign } ) }
						/>
					) }
					<Choice
						label={ __( 'On hover', 'werun-blocks-community' ) }
						value={ hover }
						options={ hoverOptions }
						help={ a.cardStyle === 'plain' ? __( 'A plain card has no box to outline, so it can only lift.', 'werun-blocks-community' ) : undefined }
						onChange={ ( value ) => setAttributes( { hover: value } ) }
					/>
					<RangeControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Corner radius (px)', 'werun-blocks-community' ) }
						value={ a.cardRadius }
						min={ 0 }
						max={ 40 }
						onChange={ ( cardRadius ) => setAttributes( { cardRadius } ) }
					/>
					<RangeControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Padding (px)', 'werun-blocks-community' ) }
						value={ a.cardPadding }
						min={ 0 }
						max={ 64 }
						onChange={ ( cardPadding ) => setAttributes( { cardPadding } ) }
					/>
					{ a.showTitle && ! hasHeader && (
						<Choice
							label={ __( 'Card title level', 'werun-blocks-community' ) }
							value={ String( a.itemTitleLevel ) }
							options={ [
								[ '2', 'H2' ],
								[ '3', 'H3' ],
								[ '4', 'H4' ],
							] }
							help={ __( 'Pick the level below the heading this grid sits under.', 'werun-blocks-community' ) }
							onChange={ ( value ) => setAttributes( { itemTitleLevel: Number( value ) } ) }
						/>
					) }
					{ a.showTitle && hasHeader && (
						<p className="components-base-control__help">
							{ sprintf(
								/* translators: %d: heading level of the card titles (3 to 5). */
								__( 'Card titles are H%d, one level below the section title.', 'werun-blocks-community' ),
								cardLevel
							) }
						</p>
					) }
					<Toggle attributes={ a } setAttributes={ setAttributes } name="reveal" label={ __( 'Fade in one after another', 'werun-blocks-community' ) } />
				</PanelBody>
				<PanelBody title={ __( 'What every card shows', 'werun-blocks-community' ) } initialOpen={ false }>
					<Toggle attributes={ a } setAttributes={ setAttributes } name="showIcon" label={ __( 'Icon', 'werun-blocks-community' ) } />
					<Toggle attributes={ a } setAttributes={ setAttributes } name="showBadge" label={ __( 'Badge', 'werun-blocks-community' ) } />
					<Toggle attributes={ a } setAttributes={ setAttributes } name="showTitle" label={ __( 'Title', 'werun-blocks-community' ) } />
					<Toggle attributes={ a } setAttributes={ setAttributes } name="showText" label={ __( 'Text', 'werun-blocks-community' ) } />
					<Toggle
						attributes={ a }
						setAttributes={ setAttributes }
						name="showLink"
						label={ __( 'Link', 'werun-blocks-community' ) }
						help={ __( 'A card shows its link only when it has a URL. Each card can also hide its own parts.', 'werun-blocks-community' ) }
					/>
					{ a.showLink && (
						<Choice
							label={ __( 'Link style', 'werun-blocks-community' ) }
							value={ a.linkStyle }
							options={ [
								[ 'link', __( 'Text', 'werun-blocks-community' ) ],
								[ 'button', __( 'Button', 'werun-blocks-community' ) ],
								[ 'card', __( 'Whole card', 'werun-blocks-community' ) ],
							] }
							help={
								a.linkStyle === 'card' && ! a.showTitle
									? __( 'The whole card links through its title. With titles off, cards show a text link instead.', 'werun-blocks-community' )
									: undefined
							}
							onChange={ ( linkStyle ) => setAttributes( { linkStyle } ) }
						/>
					) }
				</PanelBody>
				{ a.showIcon && (
					<PanelBody title={ __( 'Icons', 'werun-blocks-community' ) } initialOpen={ false }>
						<Choice
							label={ __( 'Holder', 'werun-blocks-community' ) }
							value={ a.iconStyle }
							options={ [
								[ 'none', __( 'None', 'werun-blocks-community' ) ],
								[ 'circle', __( 'Circle', 'werun-blocks-community' ) ],
								[ 'square', __( 'Square', 'werun-blocks-community' ) ],
								[ 'outline', __( 'Ring', 'werun-blocks-community' ) ],
							] }
							onChange={ ( iconStyle ) => setAttributes( { iconStyle } ) }
						/>
						<IconSizeControls attributes={ a } setAttributes={ setAttributes } />
					</PanelBody>
				) }
				<SectionHeaderPanel attributes={ a } setAttributes={ setAttributes } />
				<PanelColorSettings
					title={ __( 'Card colors', 'werun-blocks-community' ) }
					initialOpen={ false }
					colorSettings={ [
						{ value: a.accentColor, onChange: ( accentColor ) => setAttributes( { accentColor } ), label: __( 'Accent', 'werun-blocks-community' ) },
						a.showIcon && { value: a.iconColor, onChange: ( iconColor ) => setAttributes( { iconColor } ), label: __( 'Icon', 'werun-blocks-community' ) },
						a.showIcon && iconHasBg && { value: a.iconBg, onChange: ( iconBg ) => setAttributes( { iconBg } ), label: __( 'Icon background', 'werun-blocks-community' ) },
						{ value: a.cardBg, onChange: ( cardBg ) => setAttributes( { cardBg } ), label: __( 'Card background', 'werun-blocks-community' ) },
						a.cardStyle === 'bordered' && { value: a.cardBorderColor, onChange: ( cardBorderColor ) => setAttributes( { cardBorderColor } ), label: __( 'Card border', 'werun-blocks-community' ) },
					].filter( Boolean ) }
				/>
			</InspectorControls>
			<section { ...blockProps }>
				<SectionHeader attributes={ a } setAttributes={ setAttributes } uid={ uid } />
				<div { ...innerBlocksProps } />
			</section>
		</>
	);
}
