import { __ } from '@wordpress/i18n';
import { InspectorControls, RichText, useBlockProps } from '@wordpress/block-editor';
import { Notice, PanelBody, TextControl } from '@wordpress/components';
import { useRef } from '@wordpress/element';
import { ContrastAudit } from '../shared/a11y';
import { AA_TEXT, blockColors, contrastRatio, useContextBackground } from '../shared/contrast';
import { Icon, IconWrap } from '../shared/icons';
import { IconControl } from '../shared/IconControl';
import { cssVars, cx, LinkFields, Toggle } from '../shared/controls';
import { planColors, withoutTextColor } from '../pricing/colors';

export default function Edit( { attributes, setAttributes, context, clientId } ) {
	const a = attributes;
	const get = ( key, fallback ) => context[ `werun-community/pricing/${ key }` ] ?? fallback;
	const currency = get( 'currency', '$' );
	const after = get( 'currencyPosition', 'before' ) === 'after';
	const btnStyle = get( 'buttonStyle', 'auto' );
	const btnClass = btnStyle === 'fill' || ( btnStyle === 'auto' && a.featured ) ? 'wrbc-btn' : 'wrbc-btn wrbc-btn--outline';
	const features = Array.isArray( a.features ) ? a.features : [];
	// What the table shows for every plan; the per-plan settings below only
	// apply to the parts it shows.
	const toggle = get( 'showToggle', true );
	const defaultPeriod = get( 'defaultPeriod', 'monthly' ) === 'yearly' ? 'yearly' : 'monthly';
	const showMonthly = toggle || defaultPeriod === 'monthly';
	const showYearly = toggle || defaultPeriod === 'yearly';
	const tableIcon = get( 'showPlanIcon', true );
	const tableDesc = get( 'showDescription', true );
	const tableNote = get( 'showNote', true );
	const tableBadge = get( 'showBadge', true );
	// Plan names sit one level under the table's title, or at its level when
	// the table shows none (same rule as $level in render.php).
	const titleLevel = Math.max( 2, Math.min( 4, Number( get( 'titleLevel', 2 ) ) || 2 ) );
	const hasTitle = !! get( 'showHeader', true ) && String( get( 'title', '' ) ).replace( /<[^>]*>/g, '' ).trim() !== '';
	const planLevel = hasTitle ? titleLevel + 1 : titleLevel;
	// "Remove" in IconControl sends undefined, which brings the default icon
	// back; an empty object keeps the plan without one.
	const setIcon = ( icon ) => setAttributes( { icon: icon?.name ? icon : {} } );
	// A number gets the currency and the period (same test as render.php).
	const isNumeric = ( value ) => /^[\d.,\s]*\d[\d.,\s]*$/.test( ( value || '' ).replace( /<[^>]*>/g, '' ).trim() );

	// Readable on whatever it paints (twin: wrbc_pricing_plan_colors() in render.php).
	const ref = useRef();
	const around = useContextBackground( clientId );
	const colors = planColors(
		a,
		{
			cardStyle: get( 'cardStyle', 'bordered' ),
			cardBg: get( 'cardBg', '' ),
			featuredBg: get( 'featuredBg', '' ),
			accentColor: get( 'accentColor', '' ),
			onAccentColor: get( 'onAccentColor', '' ),
			textColor: get( 'textColor', '' ),
			style: get( 'style', {} ),
		},
		around,
		!! a.featured
	);
	// Its own text colour, when it doesn't read on its background: one-click fix.
	const ownText = blockColors( a ).text;
	const textFails = !! ownText && !! colors.background && contrastRatio( ownText, colors.background ) < AA_TEXT;
	// No URL: render.php prints the label as text, not a link to nowhere.
	const noUrl = String( a.ctaLabel || '' ).replace( /<[^>]*>/g, '' ).trim() !== '' && ! String( a.ctaUrl || '' ).trim();

	const blockProps = useBlockProps( {
		ref,
		className: cx( 'wrbc-plan wrbc-anim-host', colors.className, a.featured && 'is-featured' ),
		role: 'listitem',
		style: cssVars( colors.vars ),
	} );

	const setFeature = ( index, patch ) =>
		setAttributes( { features: features.map( ( item, i ) => ( i === index ? { ...item, ...patch } : item ) ) } );

	const price = ( key, periodKey, cls ) => {
		const numeric = isNumeric( a[ key ] );
		return (
			<span className={ `wrbc-plan__amount ${ cls }` }>
				{ numeric && ! after && currency && <span className="wrbc-plan__currency">{ currency }</span> }
				<RichText
					tagName="span"
					className="wrbc-plan__value"
					value={ a[ key ] }
					onChange={ ( value ) => setAttributes( { [ key ]: value } ) }
					placeholder="0"
					allowedFormats={ [] }
					aria-label={ __( 'Price', 'werun-blocks-community' ) }
				/>
				{ numeric && after && currency && <span className="wrbc-plan__currency">{ currency }</span> }
				{ numeric && (
					<RichText
						tagName="span"
						className="wrbc-plan__period"
						value={ a[ periodKey ] }
						onChange={ ( value ) => setAttributes( { [ periodKey ]: value } ) }
						placeholder="/month"
						allowedFormats={ [] }
					/>
				) }
			</span>
		);
	};

	return (
		<>
			<ContrastAudit
				blockRef={ ref }
				deps={ [ attributes, context ] }
				checks={ [
					{ selector: '.wrbc-plan__feature.is-included .wrbc-icon', property: 'color', min: 3, label: __( 'Included icons', 'werun-blocks-community' ) },
					{ selector: '.wrbc-plan__feature.is-excluded .wrbc-icon', property: 'color', min: 3, label: __( 'Not-included icons', 'werun-blocks-community' ) },
				] }
				labels={ {
					'.wrbc-plan__badge': __( 'Badge', 'werun-blocks-community' ),
					'.wrbc-plan__cta': __( 'Button', 'werun-blocks-community' ),
					'.wrbc-plan__desc': __( 'Description', 'werun-blocks-community' ),
					'.wrbc-plan__period': __( 'Price period', 'werun-blocks-community' ),
					'.wrbc-plan__note': __( 'Note under the button', 'werun-blocks-community' ),
					'.wrbc-plan__feature': __( 'Feature lines', 'werun-blocks-community' ),
				} }
				actions={ textFails ? [ { label: __( 'Use the automatic text colour', 'werun-blocks-community' ), onClick: () => setAttributes( { textColor: undefined, style: withoutTextColor( a.style ) } ) } ] : [] }
			/>
			<InspectorControls>
				{ noUrl && (
					<div className="wrbc-pricing-notice">
						<Notice status="warning" isDismissible={ false }>
							{ __( 'Add a URL to the button (Button panel): without one the page shows its label as plain text.', 'werun-blocks-community' ) }
						</Notice>
					</div>
				) }
				<PanelBody title={ __( 'Plan', 'werun-blocks-community' ) }>
					<Toggle
						attributes={ a }
						setAttributes={ setAttributes }
						name="featured"
						label={ __( 'Featured plan', 'werun-blocks-community' ) }
						help={ __( 'Highlighted, with the badge and a filled button.', 'werun-blocks-community' ) }
					/>
					{ a.featured && tableBadge && (
						<TextControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							label={ __( 'Badge', 'werun-blocks-community' ) }
							value={ a.badge }
							onChange={ ( badge ) => setAttributes( { badge } ) }
						/>
					) }
					{ tableIcon && ! a.hideIcon && <IconControl label={ __( 'Icon', 'werun-blocks-community' ) } value={ a.icon } onChange={ setIcon } /> }
				</PanelBody>
				<PanelBody title={ __( 'Price', 'werun-blocks-community' ) }>
					{ showMonthly && (
						<>
							<TextControl
								__nextHasNoMarginBottom
								__next40pxDefaultSize
								label={ toggle ? __( 'Monthly price', 'werun-blocks-community' ) : __( 'Price', 'werun-blocks-community' ) }
								help={ __( 'A number gets the currency and the period. Text such as "Custom" stands alone.', 'werun-blocks-community' ) }
								value={ a.priceMonthly }
								onChange={ ( priceMonthly ) => setAttributes( { priceMonthly } ) }
							/>
							{ isNumeric( a.priceMonthly ) && (
								<TextControl
									__nextHasNoMarginBottom
									__next40pxDefaultSize
									label={ toggle ? __( 'Monthly period', 'werun-blocks-community' ) : __( 'Period', 'werun-blocks-community' ) }
									value={ a.periodMonthly }
									placeholder="/month"
									onChange={ ( periodMonthly ) => setAttributes( { periodMonthly } ) }
								/>
							) }
						</>
					) }
					{ showYearly && (
						<>
							<TextControl
								__nextHasNoMarginBottom
								__next40pxDefaultSize
								label={ toggle ? __( 'Yearly price', 'werun-blocks-community' ) : __( 'Price', 'werun-blocks-community' ) }
								help={ toggle ? undefined : __( 'A number gets the currency and the period. Text such as "Custom" stands alone.', 'werun-blocks-community' ) }
								value={ a.priceYearly }
								onChange={ ( priceYearly ) => setAttributes( { priceYearly } ) }
							/>
							{ isNumeric( a.priceYearly ) && (
								<TextControl
									__nextHasNoMarginBottom
									__next40pxDefaultSize
									label={ toggle ? __( 'Yearly period', 'werun-blocks-community' ) : __( 'Period', 'werun-blocks-community' ) }
									value={ a.periodYearly }
									placeholder="/month, billed yearly"
									onChange={ ( periodYearly ) => setAttributes( { periodYearly } ) }
								/>
							) }
						</>
					) }
				</PanelBody>
				<PanelBody title={ __( 'Button', 'werun-blocks-community' ) } initialOpen={ false }>
					<LinkFields
						url={ a.ctaUrl }
						newTab={ a.ctaNewTab }
						onChange={ ( v ) => setAttributes( { ...( 'url' in v && { ctaUrl: v.url } ), ...( 'newTab' in v && { ctaNewTab: v.newTab } ) } ) }
					/>
				</PanelBody>
				{ ( tableIcon || tableDesc || tableNote ) && (
					// Only the parts the table shows for every plan can be hidden here.
					<PanelBody title={ __( 'Hide in this plan', 'werun-blocks-community' ) } initialOpen={ false }>
						{ tableIcon && <Toggle attributes={ a } setAttributes={ setAttributes } name="hideIcon" label={ __( 'Icon', 'werun-blocks-community' ) } /> }
						{ tableDesc && <Toggle attributes={ a } setAttributes={ setAttributes } name="hideDescription" label={ __( 'Description', 'werun-blocks-community' ) } /> }
						{ tableNote && <Toggle attributes={ a } setAttributes={ setAttributes } name="hideNote" label={ __( 'Note', 'werun-blocks-community' ) } /> }
					</PanelBody>
				) }
			</InspectorControls>

			<div { ...blockProps }>
				<div className="wrbc-plan__head">
					{ tableIcon && ! a.hideIcon && <IconWrap icon={ a.icon } style="square" className="wrbc-plan__icon" /> }
					{ a.featured && tableBadge && (
						<RichText
							tagName="span"
							className="wrbc-plan__badge"
							value={ a.badge }
							onChange={ ( badge ) => setAttributes( { badge } ) }
							allowedFormats={ [] }
						/>
					) }
				</div>
				<RichText
					tagName={ `h${ planLevel }` }
					className="wrbc-plan__name"
					value={ a.name }
					onChange={ ( name ) => setAttributes( { name } ) }
					placeholder={ __( 'Plan name', 'werun-blocks-community' ) }
					allowedFormats={ [] }
				/>
				{ tableDesc && ! a.hideDescription && (
					<RichText
						tagName="p"
						className="wrbc-plan__desc"
						value={ a.description }
						onChange={ ( description ) => setAttributes( { description } ) }
						placeholder={ __( 'Who it is for.', 'werun-blocks-community' ) }
					/>
				) }
				<p className="wrbc-plan__price">
					{ showMonthly && price( 'priceMonthly', 'periodMonthly', 'wrbc-plan__amount--monthly' ) }
					{ showYearly && price( 'priceYearly', 'periodYearly', 'wrbc-plan__amount--yearly' ) }
				</p>
				<span className={ `${ btnClass } wrbc-btn--full wrbc-plan__cta` }>
					<RichText
						tagName="span"
						value={ a.ctaLabel }
						onChange={ ( ctaLabel ) => setAttributes( { ctaLabel } ) }
						placeholder={ __( 'Button', 'werun-blocks-community' ) }
						allowedFormats={ [] }
					/>
				</span>
				{ tableNote && ! a.hideNote && (
					<RichText
						tagName="p"
						className="wrbc-plan__note"
						value={ a.note }
						onChange={ ( note ) => setAttributes( { note } ) }
						placeholder={ __( 'A note under the button (optional)', 'werun-blocks-community' ) }
						allowedFormats={ [] }
					/>
				) }
				{ get( 'showFeatures', true ) && (
					// role="list" on purpose: Safari drops the list semantics of a list without bullets (render.php).
					// eslint-disable-next-line jsx-a11y/no-redundant-roles
					<ul className="wrbc-plan__features" role="list">
						{ features.map( ( feature, index ) => {
							const included = feature.included !== false;
							if ( ! included && ! get( 'showExcluded', true ) ) {
								return null;
							}
							return (
								<li key={ index } className={ cx( 'wrbc-plan__feature wrbc-plan__feature-edit', included ? 'is-included' : 'is-excluded' ) }>
									<button
										type="button"
										className="wrbc-plan__feature-toggle"
										aria-label={ __( 'Included', 'werun-blocks-community' ) }
										aria-pressed={ included }
										onClick={ () => setFeature( index, { included: ! included } ) }
										title={ included ? __( 'Included: click to mark as not included', 'werun-blocks-community' ) : __( 'Not included: click to include', 'werun-blocks-community' ) }
									>
										<Icon icon={ included ? get( 'includedIcon', { name: 'check' } ) : get( 'excludedIcon', { name: 'x' } ) } />
									</button>
									<RichText
										tagName="span"
										value={ feature.text }
										onChange={ ( text ) => setFeature( index, { text } ) }
										placeholder={ __( 'Feature', 'werun-blocks-community' ) }
										allowedFormats={ [ 'core/bold', 'core/italic', 'core/link' ] }
									/>
									<button
										type="button"
										className="wrbc-plan__feature-remove"
										// Editor control, not page content: left out of the contrast warning.
										data-wrbc-a11y-skip
										aria-label={ __( 'Remove this line', 'werun-blocks-community' ) }
										onClick={ () => setAttributes( { features: features.filter( ( _, i ) => i !== index ) } ) }
									>
										×
									</button>
								</li>
							);
						} ) }
						<li>
							<button
								type="button"
								className="wrbc-plan__add-feature"
								data-wrbc-a11y-skip
								onClick={ () => setAttributes( { features: [ ...features, { text: '', included: true } ] } ) }
							>
								{ __( '+ Add a line', 'werun-blocks-community' ) }
							</button>
						</li>
					</ul>
				) }
			</div>
		</>
	);
}
