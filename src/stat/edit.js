import { __, sprintf } from '@wordpress/i18n';
import { InspectorControls, RichText, useBlockProps } from '@wordpress/block-editor';
import { Button, PanelBody } from '@wordpress/components';
import { useRef } from '@wordpress/element';
import { ContrastAudit } from '../shared/a11y';
import { AA_TEXT, blockColors, contrastRatio, useContextBackground } from '../shared/contrast';
import { IconWrap } from '../shared/icons';
import { IconControl } from '../shared/IconControl';
import { cssVars, cx, Toggle } from '../shared/controls';
import { statColors, withoutTextColor } from './colors';
import { fitLength, parseStat } from './number';

export default function Edit( { attributes, setAttributes, context, isSelected, clientId } ) {
	const a = attributes;
	const get = ( key, fallback ) => context[ `werun-community/stats/${ key }` ] ?? fallback;
	const showIcons = get( 'showIcon', false );
	const showDescriptions = get( 'showDescription', false );
	const animate = get( 'animate', true );
	const labelAbove = get( 'labelPosition', 'below' ) === 'above';

	// As render.php: its own icon, or the stats block's while it has none
	// ({} after "Remove" hides it on this stat).
	const ownIcon = !! a.icon && typeof a.icon === 'object';
	const inherited = get( 'itemIcon', { name: 'trending-up' } );
	const icon = showIcons ? ( ownIcon && a.icon ) || inherited : null;
	const showDesc = showDescriptions && ! a.hideDescription;
	const parsed = parseStat( a.number );
	const fit = fitLength( a.number );

	// As render.php (wrbc_stat_colors()): the tone and readable accent of its
	// own background or its card's, on what the stats block sits on.
	const around = useContextBackground( clientId );
	const colors = statColors(
		a,
		{
			layout: get( 'layout', 'row' ),
			cardStyle: get( 'cardStyle', 'filled' ),
			cardBg: get( 'cardBg', '' ),
			accentColor: get( 'accentColor', '' ),
			textColor: get( 'textColor', '' ),
			style: get( 'style', {} ),
			showIcon: showIcons,
			iconStyle: get( 'iconStyle', 'none' ),
			iconColor: get( 'iconColor', '' ),
			iconBg: get( 'iconBg', '' ),
		},
		around
	);
	// One-click fix for the warning: this stat's own text colour, when it
	// doesn't read on its background, goes back to the automatic one.
	const chosenText = blockColors( a ).text;
	const textFails = !! chosenText && contrastRatio( chosenText, colors.background || around ) < AA_TEXT;

	// role="listitem" is render.php's only: the editor replaces any role on a
	// block wrapper with "document".
	const ref = useRef();
	const blockProps = useBlockProps( {
		ref,
		className: cx( 'wrbc-stat wrbc-anim-host', icon?.name && 'has-icon', colors.className ),
		style: cssVars( colors.vars ),
	} );

	const number = (
		<p className={ cx( 'wrbc-stat__number', fit && 'wrbc-stat__number--fit' ) } style={ fit ? { '--wrbc-stat-len': fit } : undefined }>
			<RichText
				tagName="span"
				className="wrbc-stat__value"
				value={ a.number }
				onChange={ ( value ) => setAttributes( { number: value } ) }
				placeholder={ __( '100+', 'werun-blocks-community' ) }
				allowedFormats={ [] }
				disableLineBreaks
			/>
		</p>
	);
	const label = (
		<RichText
			tagName="p"
			className="wrbc-stat__label"
			value={ a.label }
			onChange={ ( value ) => setAttributes( { label: value } ) }
			placeholder={ __( 'What it counts', 'werun-blocks-community' ) }
			allowedFormats={ [ 'core/bold', 'core/italic' ] }
			disableLineBreaks
		/>
	);

	let countHelp;
	if ( animate && ! a.noCount ) {
		countHelp = parsed
			? sprintf(
					/* translators: 1: number counted to, 2: text before it, 3: text after it. */
					__( 'Counts up to %1$s (before: "%2$s", after: "%3$s").', 'werun-blocks-community' ),
					parsed.to,
					parsed.prefix,
					parsed.suffix
			  )
			: __( 'No number to count in this text: it is shown as typed.', 'werun-blocks-community' );
	}

	return (
		<>
			<ContrastAudit
				blockRef={ ref }
				deps={ [ attributes ] }
				labels={ {
					'.wrbc-stat__number': __( 'Number', 'werun-blocks-community' ),
					'.wrbc-stat__label': __( 'Label', 'werun-blocks-community' ),
					'.wrbc-stat__desc': __( 'Description', 'werun-blocks-community' ),
				} }
				actions={
					textFails
						? [ { label: __( 'Use the automatic text colour', 'werun-blocks-community' ), onClick: () => setAttributes( { textColor: undefined, style: withoutTextColor( a.style ) } ) } ]
						: []
				}
			/>
			<InspectorControls>
				{ ( showIcons || animate ) && (
					<PanelBody title={ __( 'Stat', 'werun-blocks-community' ) }>
						{ showIcons && (
							<>
								<IconControl
									label={ __( 'Icon', 'werun-blocks-community' ) }
									value={ icon }
									help={ ownIcon ? undefined : __( "The stats block's icon. Change it here for this stat only.", 'werun-blocks-community' ) }
									onChange={ ( value ) => setAttributes( { icon: value || {} } ) }
								/>
								{ ownIcon && (
									<Button variant="link" onClick={ () => setAttributes( { icon: undefined } ) }>
										{ __( "Use the stats block's icon", 'werun-blocks-community' ) }
									</Button>
								) }
							</>
						) }
						{ animate && (
							<>
								{ /* As render.php: only a number it can parse counts, so the switch only then. */ }
								{ parsed && (
									<Toggle
										attributes={ a }
										setAttributes={ setAttributes }
										name="noCount"
										label={ __( "Don't count this one up", 'werun-blocks-community' ) }
										help={ __( 'For a year, a model number or a rating that should not animate.', 'werun-blocks-community' ) }
									/>
								) }
								{ countHelp && <p className="wrbc-stat__count-note">{ countHelp }</p> }
							</>
						) }
					</PanelBody>
				) }
				{ showDescriptions && (
					<PanelBody title={ __( 'Hide in this stat', 'werun-blocks-community' ) } initialOpen={ false }>
						<Toggle attributes={ a } setAttributes={ setAttributes } name="hideDescription" label={ __( 'Description', 'werun-blocks-community' ) } />
					</PanelBody>
				) }
			</InspectorControls>

			<div { ...blockProps }>
				{ icon?.name && <IconWrap icon={ icon } style={ get( 'iconStyle', 'none' ) } className="wrbc-stat__icon" /> }
				<div className="wrbc-stat__main">
					{ labelAbove ? label : number }
					{ labelAbove ? number : label }
				</div>
				{ showDesc && ( a.description || isSelected ) && (
					<RichText
						tagName="p"
						className={ cx( 'wrbc-stat__desc', ! a.description && 'is-empty' ) }
						value={ a.description }
						onChange={ ( description ) => setAttributes( { description } ) }
						placeholder={ __( 'A line of context (optional).', 'werun-blocks-community' ) }
					/>
				) }
			</div>
		</>
	);
}
