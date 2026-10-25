import { __ } from '@wordpress/i18n';
import { InspectorControls, RichText, useBlockProps } from '@wordpress/block-editor';
import { PanelBody } from '@wordpress/components';
import { useRef } from '@wordpress/element';
import { Icon, IconWrap } from '../shared/icons';
import { IconControl } from '../shared/IconControl';
import { cssVars, cx, LinkFields, Toggle } from '../shared/controls';
import { blockColors, useContextBackground } from '../shared/contrast';
import { ContrastAudit } from '../shared/a11y';
import { auditLabels, featureColors, hasLinkColor, withoutLinkColor, withoutTextColor } from './colors';

export default function Edit( { attributes, setAttributes, context, isSelected, clientId } ) {
	const a = attributes;
	const get = ( key, fallback ) => ( context[ `werun-community/features/${ key }` ] ?? fallback );
	const stripTags = ( value ) => String( value || '' ).replace( /<[^>]*>/g, '' ).trim();
	const linkStyle = get( 'linkStyle', 'link' );
	// As render.php: one level below the grid's title when it prints one,
	// otherwise the level chosen on the grid (both H2 to H4).
	const hasHeader = get( 'showHeader', true ) && !! stripTags( get( 'title', '' ) );
	const level = hasHeader
		? Math.max( 2, Math.min( 4, Number( get( 'titleLevel', 2 ) ) || 2 ) ) + 1
		: Math.max( 2, Math.min( 4, Number( get( 'itemTitleLevel', 3 ) ) || 3 ) );
	// What the grid shows; a card can only hide what the grid shows.
	const gridIcon = get( 'showIcon', true );
	const gridTitle = get( 'showTitle', true );
	const gridText = get( 'showText', true );
	const gridLink = get( 'showLink', true );
	const gridBadge = get( 'showBadge', true );
	const showIcon = gridIcon && ! a.hideIcon;
	const showLink = gridLink && ! a.hideLink;
	// As render.php: the whole card links through its title, so without one it
	// falls back to a text link.
	const hasTitle = gridTitle && !! stripTags( a.title );
	const cardLink = linkStyle === 'card' && hasTitle;
	// The highlight is a coloured ring: a badge says it in words too (1.4.1).
	const hasBadge = gridBadge && !! stripTags( a.badge );

	// As render.php (wrbc_feature_colors()): what the card paints, and its
	// colours made readable on it.
	const around = useContextBackground( clientId );
	const colors = featureColors(
		a,
		{
			cardStyle: get( 'cardStyle', 'bordered' ),
			cardBg: get( 'cardBg', '' ),
			accentColor: get( 'accentColor', '' ),
			textColor: get( 'textColor', '' ),
			style: get( 'style', {} ),
			iconStyle: get( 'iconStyle', 'square' ),
			iconColor: get( 'iconColor', '' ),
			iconBg: get( 'iconBg', '' ),
		},
		around
	);
	if ( ! ( gridBadge && stripTags( a.badge ) ) ) {
		delete colors.vars[ '--wrbc-features-badge' ];
	}
	if ( ! showIcon ) {
		delete colors.vars[ '--wrbc-icon-color' ];
	}

	const ref = useRef();
	const blockProps = useBlockProps( {
		ref,
		className: cx( 'wrbc-feature wrbc-anim-host', a.highlight && 'is-highlight', colors.className, colors.custom && 'has-card-bg' ),
		role: 'listitem',
		style: cssVars( colors.vars ),
	} );

	return (
		<>
			<ContrastAudit
				blockRef={ ref }
				deps={ [ attributes, colors.className, colors.bg ] }
				ignore=".is-missing-url"
				labels={ auditLabels() }
				actions={ [
					// Colours this card's Color panel sets are never changed for it: the author can drop them here.
					blockColors( a ).text && { label: __( 'Use the automatic text colour', 'werun-blocks-community' ), onClick: () => setAttributes( withoutTextColor( a ) ) },
					hasLinkColor( a ) && { label: __( 'Use the automatic link colour', 'werun-blocks-community' ), onClick: () => setAttributes( withoutLinkColor( a ) ) },
				].filter( Boolean ) }
			/>
			<InspectorControls>
				<PanelBody title={ __( 'Card', 'werun-blocks-community' ) }>
					{ showIcon && (
						<IconControl label={ __( 'Icon', 'werun-blocks-community' ) } value={ a.icon } onChange={ ( icon ) => setAttributes( { icon } ) } />
					) }
					<Toggle
						attributes={ a }
						setAttributes={ setAttributes }
						name="highlight"
						label={ __( 'Highlight this card', 'werun-blocks-community' ) }
						help={
							a.highlight && ! hasBadge
								? __( 'The highlight is a coloured outline. Say why in the badge or the title too (“Most popular”), so it isn’t shown by colour alone.', 'werun-blocks-community' )
								: undefined
						}
					/>
				</PanelBody>
				{ showLink && (
					<PanelBody title={ __( 'Link', 'werun-blocks-community' ) } initialOpen={ false }>
						<LinkFields
							url={ a.linkUrl }
							newTab={ a.linkNewTab }
							onChange={ ( v ) =>
								setAttributes( { ...( 'url' in v && { linkUrl: v.url } ), ...( 'newTab' in v && { linkNewTab: v.newTab } ) } )
							}
						/>
					</PanelBody>
				) }
				{ ( gridIcon || gridText || gridLink ) && (
					<PanelBody title={ __( 'Hide in this card', 'werun-blocks-community' ) } initialOpen={ false }>
						{ gridIcon && <Toggle attributes={ a } setAttributes={ setAttributes } name="hideIcon" label={ __( 'Icon', 'werun-blocks-community' ) } /> }
						{ gridText && <Toggle attributes={ a } setAttributes={ setAttributes } name="hideText" label={ __( 'Text', 'werun-blocks-community' ) } /> }
						{ gridLink && <Toggle attributes={ a } setAttributes={ setAttributes } name="hideLink" label={ __( 'Link', 'werun-blocks-community' ) } /> }
					</PanelBody>
				) }
			</InspectorControls>

			<div { ...blockProps }>
				{ ( ( showIcon && a.icon?.name ) || ( gridBadge && ( a.badge || isSelected ) ) ) && (
					<div className="wrbc-feature__top">
						{ showIcon && <IconWrap icon={ a.icon } style={ get( 'iconStyle', 'square' ) } className="wrbc-feature__icon" /> }
						{ /* An empty badge is offered only on the selected card. */ }
						{ gridBadge && ( a.badge || isSelected ) && (
							<RichText
								tagName="span"
								className="wrbc-feature__badge"
								value={ a.badge }
								onChange={ ( badge ) => setAttributes( { badge } ) }
								placeholder={ __( 'Badge (optional)', 'werun-blocks-community' ) }
								allowedFormats={ [] }
								style={ a.badge ? undefined : { opacity: 0.45 } }
							/>
						) }
					</div>
				) }
				<div className="wrbc-feature__body">
					{ gridTitle && (
						<RichText
							tagName={ `h${ level }` }
							className="wrbc-feature__title"
							value={ a.title }
							onChange={ ( title ) => setAttributes( { title } ) }
							placeholder={ __( 'Card title', 'werun-blocks-community' ) }
							allowedFormats={ [ 'core/bold', 'core/italic' ] }
						/>
					) }
					{ gridText && ! a.hideText && (
						<RichText
							tagName="p"
							className="wrbc-feature__text"
							value={ a.text }
							onChange={ ( text ) => setAttributes( { text } ) }
							placeholder={ __( 'What it does, in a sentence or two.', 'werun-blocks-community' ) }
						/>
					) }
					{ showLink && ! cardLink && (
						<span
							className={ cx(
								'wrbc-feature__link wrbc-btn',
								linkStyle === 'button' ? 'wrbc-btn--outline' : 'wrbc-btn--link',
								! a.linkUrl && 'is-missing-url'
							) }
							title={ a.linkUrl ? a.linkUrl : __( 'No URL yet: the link is hidden on the page until you add one (Link, in the sidebar).', 'werun-blocks-community' ) }
						>
							<RichText
								tagName="span"
								value={ a.linkLabel }
								onChange={ ( linkLabel ) => setAttributes( { linkLabel } ) }
								placeholder={ __( 'Learn more', 'werun-blocks-community' ) }
								allowedFormats={ [] }
							/>
							<Icon icon={ { name: 'arrow-right', anim: 'nudge-x', trigger: 'hover' } } className="wrbc-feature__arrow" />
						</span>
					) }
				</div>
			</div>
		</>
	);
}
