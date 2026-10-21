import { __, _n, sprintf } from '@wordpress/i18n';
import {
	InnerBlocks,
	InspectorControls,
	PanelColorSettings,
	store as blockEditorStore,
	useBlockProps,
	useInnerBlocksProps,
} from '@wordpress/block-editor';
import { Notice, PanelBody, RangeControl, TextControl } from '@wordpress/components';
import { useSelect } from '@wordpress/data';
import { useRef, useState } from '@wordpress/element';
import { ContrastAudit } from '../shared/a11y';
import { AA_TEXT, accentVars, blockColors, contrastRatio, toneClass, useContextBackground, useSurface } from '../shared/contrast';
import { IconControl } from '../shared/IconControl';
import { tableColors, withoutTextColor } from './colors';
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

const f = ( text, included = true ) => ( { text, included } );
export const TEMPLATE = [
	[
		'werun-community/pricing-plan',
		{
			icon: { name: 'sprout', lib: 'lucide', anim: 'pop', trigger: 'hover' },
			name: 'Starter',
			description: 'For a first site that has to look right.',
			priceMonthly: '19',
			priceYearly: '15',
			ctaLabel: 'Start with Starter',
			note: 'No card needed',
			features: [ f( 'Up to 5 pages' ), f( 'Contact form' ), f( 'Basic analytics' ), f( 'Priority support', false ), f( 'Custom integrations', false ) ],
		},
	],
	[
		'werun-community/pricing-plan',
		{
			icon: { name: 'rocket', lib: 'animated', anim: 'auto', trigger: 'hover' },
			name: 'Growth',
			description: 'For a business that sells through its site.',
			priceMonthly: '49',
			priceYearly: '39',
			featured: true,
			ctaLabel: 'Choose Growth',
			note: '14-day free trial',
			features: [ f( 'Up to 20 pages' ), f( 'Blog and newsletter' ), f( 'Advanced analytics' ), f( 'Priority support' ), f( 'Custom integrations', false ) ],
		},
	],
	[
		'werun-community/pricing-plan',
		{
			icon: { name: 'building', lib: 'lucide', anim: 'tilt', trigger: 'hover' },
			name: 'Scale',
			description: 'For teams with several sites and languages.',
			priceMonthly: 'Custom',
			priceYearly: 'Custom',
			ctaLabel: 'Talk to us',
			features: [ f( 'Unlimited pages' ), f( 'Several languages' ), f( 'Dedicated engineer' ), f( 'Priority support' ), f( 'Custom integrations' ) ],
		},
	],
];

export default function Edit( { attributes, setAttributes, clientId } ) {
	const a = attributes;
	const uid = `wrbc-pricing-${ clientId.slice( 0, 8 ) }`;
	const [ preview, setPreview ] = useState( null );
	const period = preview || a.defaultPeriod;
	// Same rule as render.php: a taller featured plan needs plans beside it.
	const featuredScale = a.featuredScale && a.columnsDesktop > 1;
	// Without a title, the title level is the plan names' own (pricing-plan's render.php).
	const hasTitle = a.showHeader && ( a.title || '' ).replace( /<[^>]*>/g, '' ).trim() !== '';
	// A radio needs a name: an emptied label falls back to the default (render.php).
	const optionLabel = ( p ) =>
		( ( p === 'monthly' ? a.monthlyLabel : a.yearlyLabel ) || '' ).trim() ||
		( p === 'monthly' ? __( 'Monthly', 'werun-blocks-community' ) : __( 'Yearly', 'werun-blocks-community' ) );

	// What the table sits on, its tone and readable accent (same as render.php).
	const ref = useRef();
	const surface = useSurface( clientId, a, 'werun-community/pricing' );
	const around = useContextBackground( clientId );
	const tableText = blockColors( a ).text;
	// The shared accent set, then the table's own (colors.js: twin of colors.php).
	const accentStyle = accentVars( a, surface );
	// The Color panel's text colour is never changed: the warning offers the
	// automatic one when it doesn't read (picked plan colours are corrected).
	const textFails = !! tableText && !! surface && contrastRatio( tableText, surface ) < AA_TEXT;
	// Plans whose button has a label but no URL: the page prints it as text.
	const missingUrls = useSelect(
		( select ) =>
			select( blockEditorStore )
				.getBlocks( clientId )
				.filter( ( b ) => b.name === 'werun-community/pricing-plan' && String( b.attributes.ctaLabel || '' ).replace( /<[^>]*>/g, '' ).trim() && ! String( b.attributes.ctaUrl || '' ).trim() ).length,
		[ clientId ]
	);

	const blockProps = useBlockProps( {
		ref,
		className: cx(
			'wrbc-root wrbc-pricing',
			`wrbc-pricing--${ a.cardStyle }`,
			`wrbc-pricing--align-${ a.contentAlign }`,
			toneClass( surface, around ),
			featuredScale && 'has-featured-scale'
		),
		'data-period': a.showToggle ? period : a.defaultPeriod,
		style: cssVars( {
			'--wrbc-cols-d': a.columnsDesktop,
			'--wrbc-cols-t': a.columnsTablet,
			'--wrbc-cols-m': a.columnsMobile,
			'--wrbc-gap': px( a.gap ),
			'--wrbc-card-bg': a.cardBg,
			'--wrbc-featured-bg': a.featuredBg,
			'--wrbc-card-border': a.cardBorderColor,
			'--wrbc-radius': px( a.cardRadius ),
			'--wrbc-icon-size': px( a.iconSize ),
			'--wrbc-icon-stroke': a.iconStroke,
			...accentStyle,
			...tableColors( a, surface, accentStyle ),
		} ),
	} );
	const innerBlocksProps = useInnerBlocksProps(
		{ className: 'wrbc-pricing__grid', role: 'list' },
		{
			allowedBlocks: [ 'werun-community/pricing-plan' ],
			template: TEMPLATE,
			orientation: 'horizontal',
			renderAppender: InnerBlocks.ButtonBlockAppender,
		}
	);

	return (
		<>
			{ /* Every text is checked; the non-text parts that carry meaning are
			     the switch's outline and selected option, the included /
			     not-included icons and the featured plan's ring. */ }
			<ContrastAudit
				blockRef={ ref }
				deps={ [ attributes ] }
				checks={ [
					{ selector: '.wrbc-pricing__switch', property: 'border-color', min: 3, label: __( 'Billing switch outline', 'werun-blocks-community' ) },
					{ selector: '.wrbc-pricing__radio:checked + .wrbc-pricing__option', property: 'border-color', min: 3, label: __( 'Selected billing period', 'werun-blocks-community' ) },
					{ selector: '.wrbc-plan__feature.is-included .wrbc-icon', property: 'color', min: 3, label: __( 'Included icons', 'werun-blocks-community' ) },
					{ selector: '.wrbc-plan__feature.is-excluded .wrbc-icon', property: 'color', min: 3, label: __( 'Not-included icons', 'werun-blocks-community' ) },
					{ selector: '.wrbc-plan.is-featured', property: 'border-color', min: 3, label: __( 'Featured plan outline', 'werun-blocks-community' ) },
				] }
				labels={ {
					'.wrbc-pricing__save': __( 'Saving note', 'werun-blocks-community' ),
					'.wrbc-pricing__option': __( 'Billing switch', 'werun-blocks-community' ),
					'.wrbc-plan__badge': __( 'Badge', 'werun-blocks-community' ),
					'.wrbc-plan__cta': __( 'Plan buttons', 'werun-blocks-community' ),
					'.wrbc-plan__desc': __( 'Plan descriptions', 'werun-blocks-community' ),
					'.wrbc-plan__period': __( 'Price periods', 'werun-blocks-community' ),
					'.wrbc-plan__note': __( 'Notes under the buttons', 'werun-blocks-community' ),
					'.wrbc-plan__feature': __( 'Feature lines', 'werun-blocks-community' ),
				} }
				actions={ textFails ? [ { label: __( 'Use the automatic text colour', 'werun-blocks-community' ), onClick: () => setAttributes( { textColor: undefined, style: withoutTextColor( a.style ) } ) } ] : [] }
			/>
			<InspectorControls>
				{ missingUrls > 0 && (
					<div className="wrbc-pricing-notice">
						<Notice status="warning" isDismissible={ false }>
							{ sprintf(
								/* translators: %d: number of plans whose button has no URL. */
								_n(
									'%d plan button has no URL: add one in the plan’s Button panel, or the page shows its label as plain text.',
									'%d plan buttons have no URL: add them in each plan’s Button panel, or the page shows their labels as plain text.',
									missingUrls,
									'werun-blocks-community'
								),
								missingUrls
							) }
						</Notice>
					</div>
				) }
				<PanelBody title={ __( 'Prices and billing switch', 'werun-blocks-community' ) }>
					<Toggle
						attributes={ a }
						setAttributes={ setAttributes }
						name="showToggle"
						label={ __( 'Show the monthly / yearly switch', 'werun-blocks-community' ) }
						help={ __( 'Off: only the default period is shown.', 'werun-blocks-community' ) }
					/>
					<Choice
						label={ a.showToggle ? __( 'Shown first', 'werun-blocks-community' ) : __( 'Price shown', 'werun-blocks-community' ) }
						help={ a.showToggle ? undefined : __( 'The other price of every plan is not used.', 'werun-blocks-community' ) }
						value={ a.defaultPeriod }
						options={ [
							[ 'monthly', __( 'Monthly', 'werun-blocks-community' ) ],
							[ 'yearly', __( 'Yearly', 'werun-blocks-community' ) ],
						] }
						onChange={ ( defaultPeriod ) => {
							setAttributes( { defaultPeriod } );
							setPreview( null );
						} }
					/>
					{ a.showToggle && (
						<>
							<TextControl
								__nextHasNoMarginBottom
								__next40pxDefaultSize
								label={ __( 'Monthly label', 'werun-blocks-community' ) }
								value={ a.monthlyLabel }
								onChange={ ( monthlyLabel ) => setAttributes( { monthlyLabel } ) }
							/>
							<TextControl
								__nextHasNoMarginBottom
								__next40pxDefaultSize
								label={ __( 'Yearly label', 'werun-blocks-community' ) }
								value={ a.yearlyLabel }
								onChange={ ( yearlyLabel ) => setAttributes( { yearlyLabel } ) }
							/>
							<Toggle attributes={ a } setAttributes={ setAttributes } name="showYearlyNote" label={ __( 'Saving note on yearly', 'werun-blocks-community' ) } />
							{ a.showYearlyNote && (
								<TextControl
									__nextHasNoMarginBottom
									__next40pxDefaultSize
									label={ __( 'Saving note', 'werun-blocks-community' ) }
									value={ a.yearlyNote }
									onChange={ ( yearlyNote ) => setAttributes( { yearlyNote } ) }
								/>
							) }
							{ ! a.showHeader && (
								// The switch follows the header's alignment; with the header off,
								// that setting is out of reach in the Section header panel.
								<Choice
									label={ __( 'Switch alignment', 'werun-blocks-community' ) }
									value={ a.headerAlign }
									options={ [
										[ 'left', __( 'Left', 'werun-blocks-community' ) ],
										[ 'center', __( 'Center', 'werun-blocks-community' ) ],
									] }
									onChange={ ( headerAlign ) => setAttributes( { headerAlign } ) }
								/>
							) }
						</>
					) }
					<div className="wrbc-panel-row">
						<TextControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							label={ __( 'Currency', 'werun-blocks-community' ) }
							value={ a.currency }
							onChange={ ( currency ) => setAttributes( { currency } ) }
						/>
						{ !! a.currency && (
							<Choice
								label={ __( 'Position', 'werun-blocks-community' ) }
								value={ a.currencyPosition }
								options={ [
									[ 'before', __( 'Before', 'werun-blocks-community' ) ],
									[ 'after', __( 'After', 'werun-blocks-community' ) ],
								] }
								onChange={ ( currencyPosition ) => setAttributes( { currencyPosition } ) }
							/>
						) }
					</div>
				</PanelBody>
				<PanelBody title={ __( 'Columns and spacing', 'werun-blocks-community' ) } initialOpen={ false }>
					<ResponsiveColumns attributes={ a } setAttributes={ setAttributes } max={ 4 } />
					<RangeControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Gap (px)', 'werun-blocks-community' ) }
						value={ a.gap }
						min={ 0 }
						max={ 64 }
						onChange={ ( gap ) => setAttributes( { gap } ) }
					/>
				</PanelBody>
				<PanelBody title={ __( 'Plans', 'werun-blocks-community' ) } initialOpen={ false }>
					<Choice
						label={ __( 'Style', 'werun-blocks-community' ) }
						value={ a.cardStyle }
						options={ [
							[ 'bordered', __( 'Border', 'werun-blocks-community' ) ],
							[ 'filled', __( 'Filled', 'werun-blocks-community' ) ],
							[ 'shadow', __( 'Shadow', 'werun-blocks-community' ) ],
						] }
						onChange={ ( cardStyle ) => setAttributes( { cardStyle } ) }
					/>
					<Choice
						label={ __( 'Alignment', 'werun-blocks-community' ) }
						value={ a.contentAlign }
						options={ [
							[ 'left', __( 'Left', 'werun-blocks-community' ) ],
							[ 'center', __( 'Center', 'werun-blocks-community' ) ],
						] }
						onChange={ ( contentAlign ) => setAttributes( { contentAlign } ) }
					/>
					{ ! hasTitle && (
						// With a title, plan names are one level under it (Section header → Title level).
						<Choice
							label={ __( 'Plan name level', 'werun-blocks-community' ) }
							help={ __( 'The table has no title, so the plan names are its top headings.', 'werun-blocks-community' ) }
							value={ String( a.titleLevel || 2 ) }
							options={ [
								[ '2', 'H2' ],
								[ '3', 'H3' ],
								[ '4', 'H4' ],
							] }
							onChange={ ( value ) => setAttributes( { titleLevel: Number( value ) } ) }
						/>
					) }
					<Choice
						label={ __( 'Buttons', 'werun-blocks-community' ) }
						value={ a.buttonStyle }
						options={ [
							[ 'auto', __( 'Featured filled', 'werun-blocks-community' ) ],
							[ 'fill', __( 'All filled', 'werun-blocks-community' ) ],
							[ 'outline', __( 'All outline', 'werun-blocks-community' ) ],
						] }
						onChange={ ( buttonStyle ) => setAttributes( { buttonStyle } ) }
					/>
					{ a.columnsDesktop > 1 && (
						<Toggle attributes={ a } setAttributes={ setAttributes } name="featuredScale" label={ __( 'Featured plan taller on desktop', 'werun-blocks-community' ) } />
					) }
					<RangeControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Corner radius (px)', 'werun-blocks-community' ) }
						value={ a.cardRadius }
						min={ 0 }
						max={ 40 }
						onChange={ ( cardRadius ) => setAttributes( { cardRadius } ) }
					/>
					<Toggle attributes={ a } setAttributes={ setAttributes } name="reveal" label={ __( 'Fade in when they scroll into view', 'werun-blocks-community' ) } />
				</PanelBody>
				<PanelBody title={ __( 'What every plan shows', 'werun-blocks-community' ) } initialOpen={ false }>
					<Toggle attributes={ a } setAttributes={ setAttributes } name="showPlanIcon" label={ __( 'Icon', 'werun-blocks-community' ) } />
					<Toggle attributes={ a } setAttributes={ setAttributes } name="showBadge" label={ __( 'Badge on the featured plan', 'werun-blocks-community' ) } />
					<Toggle attributes={ a } setAttributes={ setAttributes } name="showDescription" label={ __( 'Description', 'werun-blocks-community' ) } />
					<Toggle attributes={ a } setAttributes={ setAttributes } name="showNote" label={ __( 'Note under the button', 'werun-blocks-community' ) } />
					<Toggle attributes={ a } setAttributes={ setAttributes } name="showFeatures" label={ __( 'Feature list', 'werun-blocks-community' ) } />
					{ a.showFeatures && (
						<Toggle attributes={ a } setAttributes={ setAttributes } name="showExcluded" label={ __( 'Lines that are not included', 'werun-blocks-community' ) } />
					) }
				</PanelBody>
				{ ( a.showFeatures || a.showPlanIcon ) && (
					<PanelBody title={ __( 'Icons', 'werun-blocks-community' ) } initialOpen={ false }>
						{ a.showFeatures ? (
							<>
								<IconControl label={ __( 'Included', 'werun-blocks-community' ) } value={ a.includedIcon } allowRemove={ false } onChange={ ( includedIcon ) => setAttributes( { includedIcon } ) } />
								{ a.showExcluded && (
									<IconControl label={ __( 'Not included', 'werun-blocks-community' ) } value={ a.excludedIcon } allowRemove={ false } onChange={ ( excludedIcon ) => setAttributes( { excludedIcon } ) } />
								) }
								<IconSizeControls attributes={ a } setAttributes={ setAttributes } maxSize={ 28 } />
							</>
						) : (
							// The size is the feature-line icons' (plan icons have their own);
							// the stroke still reaches the plan icons.
							<RangeControl
								__nextHasNoMarginBottom
								__next40pxDefaultSize
								label={ __( 'Icon stroke', 'werun-blocks-community' ) }
								value={ a.iconStroke }
								min={ 1 }
								max={ 3 }
								step={ 0.25 }
								onChange={ ( iconStroke ) => setAttributes( { iconStroke } ) }
							/>
						) }
					</PanelBody>
				) }
				<SectionHeaderPanel attributes={ a } setAttributes={ setAttributes } />
				<PanelColorSettings
					title={ __( 'Plan colors', 'werun-blocks-community' ) }
					initialOpen={ false }
					colorSettings={ [
						{ value: a.accentColor, onChange: ( accentColor ) => setAttributes( { accentColor } ), label: __( 'Accent', 'werun-blocks-community' ) },
						{ value: a.onAccentColor, onChange: ( onAccentColor ) => setAttributes( { onAccentColor } ), label: __( 'Text on the accent', 'werun-blocks-community' ) },
						{ value: a.cardBg, onChange: ( cardBg ) => setAttributes( { cardBg } ), label: __( 'Plan background', 'werun-blocks-community' ) },
						{ value: a.featuredBg, onChange: ( featuredBg ) => setAttributes( { featuredBg } ), label: __( 'Featured plan background', 'werun-blocks-community' ) },
						// Only the Border style draws a border (the featured plan's is the accent).
						a.cardStyle === 'bordered' && { value: a.cardBorderColor, onChange: ( cardBorderColor ) => setAttributes( { cardBorderColor } ), label: __( 'Border', 'werun-blocks-community' ) },
					].filter( Boolean ) }
				/>
			</InspectorControls>

			<section { ...blockProps }>
				<SectionHeader attributes={ a } setAttributes={ setAttributes } uid={ uid } />
				{ a.showToggle && (
					<div className={ cx( 'wrbc-pricing__switch-wrap', a.headerAlign === 'center' && 'is-center' ) }>
						{ /* The same radio group as render.php; here it only previews a period. */ }
						<div className="wrbc-pricing__switch" role="radiogroup" aria-label={ __( 'Billing period (preview)', 'werun-blocks-community' ) }>
							{ [ 'monthly', 'yearly' ].map( ( p ) => (
								<label key={ p } className="wrbc-pricing__choice" htmlFor={ `${ uid }-period-${ p }` }>
									<input
										id={ `${ uid }-period-${ p }` }
										type="radio"
										className="wrbc-pricing__radio"
										name={ `${ uid }-period` }
										value={ p }
										checked={ period === p }
										onChange={ () => setPreview( p ) }
									/>
									<span className="wrbc-pricing__option">
										{ optionLabel( p ) }
										{ p === 'yearly' && a.showYearlyNote && ( a.yearlyNote || '' ).trim() && <span className="wrbc-pricing__save">{ a.yearlyNote }</span> }
									</span>
								</label>
							) ) }
						</div>
					</div>
				) }
				<div { ...innerBlocksProps } />
			</section>
		</>
	);
}
