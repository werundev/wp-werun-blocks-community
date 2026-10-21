import { __ } from '@wordpress/i18n';
import {
	InnerBlocks,
	InspectorControls,
	PanelColorSettings,
	useBlockProps,
	useInnerBlocksProps,
} from '@wordpress/block-editor';
import { PanelBody, RangeControl } from '@wordpress/components';
import { useRef } from '@wordpress/element';
import { ContrastAudit } from '../shared/a11y';
import { AA_TEXT, accentVars, blockColors, contrastRatio, toneClass, useContextBackground, useSurface } from '../shared/contrast';
import { IconControl } from '../shared/IconControl';
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
import { pageValue, statColors, withoutTextColor } from '../stat/colors';
import { effective } from './effective';

const stat = ( number, label, description, name ) => [ 'werun-community/stat', { number, label, description, ...( name && { icon: { name, lib: 'lucide', anim: 'none', trigger: 'hover' } } ) } ];

export const TEMPLATE = [
	stat( '120+', 'Projects delivered', 'Sites, shops and platforms launched since 2016.' ),
	stat( '98%', 'Clients who stay', 'Renew their care plan after the first year.' ),
	stat( '4.9', 'Average rating', 'Across 300 reviews on Google and Clutch.' ),
	stat( '24/7', 'Monitoring', 'Uptime, security and backups, every day.' ),
];

export default function Edit( { attributes, setAttributes, clientId } ) {
	const a = attributes;
	const uid = `wrbc-stats-${ clientId.slice( 0, 8 ) }`;
	// The same rules as render.php (twin: effective.js / wrbc_stats_effective()).
	const e = effective( a );
	// As render.php: what the stats sit on, its tone and the readable accent.
	const surface = useSurface( clientId, a, 'werun-community/stats' );
	const around = useContextBackground( clientId );
	// One-click fix for the warning: a text colour chosen here that doesn't
	// read on the background, or on the cards (their background is the
	// stats block's; the chosen text colour is never overridden there),
	// goes back to the automatic one.
	const chosenText = blockColors( a ).text;
	const cardBack = statColors( {}, { layout: e.layout, cardStyle: e.cardStyle, cardBg: a.cardBg }, surface ).background;
	const textFails = !! chosenText && ( contrastRatio( chosenText, surface ) < AA_TEXT || ( !! cardBack && contrastRatio( chosenText, cardBack ) < AA_TEXT ) );

	const ref = useRef();
	const blockProps = useBlockProps( {
		ref,
		className: cx(
			'wrbc-root wrbc-stats',
			`wrbc-stats--${ e.layout }`,
			`wrbc-stats--align-${ e.align }`,
			toneClass( surface, around ),
			e.cards && `wrbc-stats--card-${ e.cardStyle }`,
			e.separators && 'wrbc-stats--sep'
		),
		style: cssVars( {
			...accentVars( a, surface ),
			'--wrbc-cols-d': e.colsD,
			'--wrbc-cols-t': e.colsT,
			'--wrbc-cols-m': e.colsM,
			'--wrbc-gap': px( e.gap ),
			// Colours as the page gets them (pageValue(): WordPress drops rgba() and the like there).
			'--wrbc-stats-sep': e.separators ? pageValue( a.separatorColor ) : undefined,
			'--wrbc-card-bg': e.cards ? pageValue( a.cardBg ) : undefined,
			'--wrbc-card-border': e.cards && e.cardStyle === 'bordered' ? pageValue( a.cardBorderColor ) : undefined,
			'--wrbc-radius': e.cards ? px( e.cardRadius ) : undefined,
			'--wrbc-card-pad': e.cards ? px( e.cardPadding ) : undefined,
			'--wrbc-icon-size': a.showIcon ? px( e.iconSize ) : undefined,
			'--wrbc-icon-stroke': a.showIcon ? e.iconStroke : undefined,
			'--wrbc-icon-color': a.showIcon ? pageValue( a.iconColor ) : undefined,
			'--wrbc-icon-bg': e.iconHasBg ? pageValue( a.iconBg ) : undefined,
			'--wrbc-stat-size': px( e.numberSize, 'em' ),
		} ),
	} );
	// No list role here (render.php has it): the editor makes every block
	// wrapper role="document", so a list in the canvas would have no items.
	const innerBlocksProps = useInnerBlocksProps(
		{ className: 'wrbc-stats__grid' },
		{
			allowedBlocks: [ 'werun-community/stat' ],
			template: TEMPLATE,
			orientation: 'horizontal',
			renderAppender: InnerBlocks.ButtonBlockAppender,
		}
	);

	return (
		<>
			{ /* Every text is checked; the rest is decoration (separators, card
			     borders and shadows, icon holders, aria-hidden icons), which
			     1.4.11 doesn't cover, so there are no non-text checks. */ }
			<ContrastAudit
				blockRef={ ref }
				deps={ [ attributes ] }
				labels={ {
					'.wrbc-stat__number': __( 'Numbers', 'werun-blocks-community' ),
					'.wrbc-stat__label': __( 'Labels', 'werun-blocks-community' ),
					'.wrbc-stat__desc': __( 'Descriptions', 'werun-blocks-community' ),
				} }
				actions={
					textFails
						? [ { label: __( 'Use the automatic text colour', 'werun-blocks-community' ), onClick: () => setAttributes( { textColor: undefined, style: withoutTextColor( a.style ) } ) } ]
						: []
				}
			/>
			<InspectorControls>
				<PanelBody title={ __( 'Layout', 'werun-blocks-community' ) }>
					<Choice
						label={ __( 'Layout', 'werun-blocks-community' ) }
						value={ e.layout }
						options={ [
							[ 'row', __( 'Row', 'werun-blocks-community' ) ],
							[ 'cards', __( 'Cards', 'werun-blocks-community' ) ],
							[ 'large', __( 'Large', 'werun-blocks-community' ) ],
						] }
						onChange={ ( layout ) => setAttributes( { layout } ) }
					/>
					<ResponsiveColumns attributes={ a } setAttributes={ setAttributes } max={ 6 } />
					<RangeControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Gap (px)', 'werun-blocks-community' ) }
						value={ e.gap }
						min={ 0 }
						max={ 96 }
						onChange={ ( gap ) => setAttributes( { gap } ) }
					/>
					<Choice
						label={ __( 'Alignment', 'werun-blocks-community' ) }
						value={ e.align }
						options={ [
							[ 'left', __( 'Left', 'werun-blocks-community' ) ],
							[ 'center', __( 'Center', 'werun-blocks-community' ) ],
						] }
						onChange={ ( contentAlign ) => setAttributes( { contentAlign } ) }
					/>
					{ ! e.cards && (
						<Toggle
							attributes={ a }
							setAttributes={ setAttributes }
							name="separators"
							label={ __( 'Separators', 'werun-blocks-community' ) }
							help={ e.layout === 'large' ? __( 'A rule above every stat.', 'werun-blocks-community' ) : __( 'Lines between the stats.', 'werun-blocks-community' ) }
						/>
					) }
					<Toggle attributes={ a } setAttributes={ setAttributes } name="reveal" label={ __( 'Fade in one after another', 'werun-blocks-community' ) } />
				</PanelBody>
				<PanelBody title={ __( 'Numbers', 'werun-blocks-community' ) } initialOpen={ false }>
					<RangeControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Number size (× text size)', 'werun-blocks-community' ) }
						value={ e.numberSize }
						min={ 1.5 }
						max={ 8 }
						step={ 0.25 }
						onChange={ ( numberSize ) => setAttributes( { numberSize } ) }
					/>
					<Toggle
						attributes={ a }
						setAttributes={ setAttributes }
						name="animate"
						label={ __( 'Count up when in view', 'werun-blocks-community' ) }
						help={ __( 'The number part of each stat counts up; "$", "+", "%" or "k" around it stay. Visitors who prefer less motion see the final number.', 'werun-blocks-community' ) }
					/>
					{ a.animate && (
						<RangeControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							label={ __( 'Count duration (ms)', 'werun-blocks-community' ) }
							help={ __( 'Up to 5 seconds: longer motion would need a pause button.', 'werun-blocks-community' ) }
							value={ e.duration }
							min={ 300 }
							max={ 5000 }
							step={ 100 }
							onChange={ ( counterDuration ) => setAttributes( { counterDuration } ) }
						/>
					) }
				</PanelBody>
				<PanelBody title={ __( 'What every stat shows', 'werun-blocks-community' ) } initialOpen={ false }>
					<Choice
						label={ __( 'Label', 'werun-blocks-community' ) }
						value={ a.labelPosition === 'above' ? 'above' : 'below' }
						options={ [
							[ 'above', __( 'Above the number', 'werun-blocks-community' ) ],
							[ 'below', __( 'Below the number', 'werun-blocks-community' ) ],
						] }
						onChange={ ( labelPosition ) => setAttributes( { labelPosition } ) }
					/>
					<Toggle attributes={ a } setAttributes={ setAttributes } name="showDescription" label={ __( 'Description', 'werun-blocks-community' ) } />
					<Toggle
						attributes={ a }
						setAttributes={ setAttributes }
						name="showIcon"
						label={ __( 'Icon', 'werun-blocks-community' ) }
						help={ __( 'Each stat can change or remove its own icon, and hide its description.', 'werun-blocks-community' ) }
					/>
				</PanelBody>
				{ a.showIcon && (
					<PanelBody title={ __( 'Icons', 'werun-blocks-community' ) } initialOpen={ false }>
						<IconControl
							label={ __( 'Icon for every stat', 'werun-blocks-community' ) }
							value={ a.itemIcon }
							allowRemove={ false }
							help={ __( 'Used by every stat that has no icon of its own.', 'werun-blocks-community' ) }
							onChange={ ( itemIcon ) => setAttributes( { itemIcon } ) }
						/>
						<Choice
							label={ __( 'Holder', 'werun-blocks-community' ) }
							value={ e.iconStyle }
							options={ [
								[ 'none', __( 'None', 'werun-blocks-community' ) ],
								[ 'circle', __( 'Circle', 'werun-blocks-community' ) ],
								[ 'square', __( 'Square', 'werun-blocks-community' ) ],
								[ 'outline', __( 'Ring', 'werun-blocks-community' ) ],
							] }
							onChange={ ( iconStyle ) => setAttributes( { iconStyle } ) }
						/>
						<IconSizeControls attributes={ { ...a, iconSize: e.iconSize, iconStroke: e.iconStroke } } setAttributes={ setAttributes } />
					</PanelBody>
				) }
				{ e.cards && (
					<PanelBody title={ __( 'Cards', 'werun-blocks-community' ) } initialOpen={ false }>
						<Choice
							label={ __( 'Style', 'werun-blocks-community' ) }
							value={ e.cardStyle }
							options={ [
								[ 'bordered', __( 'Border', 'werun-blocks-community' ) ],
								[ 'filled', __( 'Filled', 'werun-blocks-community' ) ],
								[ 'shadow', __( 'Shadow', 'werun-blocks-community' ) ],
							] }
							onChange={ ( cardStyle ) => setAttributes( { cardStyle } ) }
						/>
						<RangeControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							label={ __( 'Corner radius (px)', 'werun-blocks-community' ) }
							value={ e.cardRadius }
							min={ 0 }
							max={ 40 }
							onChange={ ( cardRadius ) => setAttributes( { cardRadius } ) }
						/>
						<RangeControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							label={ __( 'Padding (px)', 'werun-blocks-community' ) }
							value={ e.cardPadding }
							min={ 0 }
							max={ 64 }
							onChange={ ( cardPadding ) => setAttributes( { cardPadding } ) }
						/>
					</PanelBody>
				) }
				<SectionHeaderPanel attributes={ a } setAttributes={ setAttributes } />
				<PanelColorSettings
					title={ __( 'Stat colors', 'werun-blocks-community' ) }
					initialOpen={ false }
					colorSettings={ [
						{ value: a.accentColor, onChange: ( accentColor ) => setAttributes( { accentColor } ), label: __( 'Numbers (accent)', 'werun-blocks-community' ) },
						e.separators && { value: a.separatorColor, onChange: ( separatorColor ) => setAttributes( { separatorColor } ), label: __( 'Separators', 'werun-blocks-community' ) },
						a.showIcon && { value: a.iconColor, onChange: ( iconColor ) => setAttributes( { iconColor } ), label: __( 'Icon', 'werun-blocks-community' ) },
						e.iconHasBg && { value: a.iconBg, onChange: ( iconBg ) => setAttributes( { iconBg } ), label: __( 'Icon background', 'werun-blocks-community' ) },
						e.cards && { value: a.cardBg, onChange: ( cardBg ) => setAttributes( { cardBg } ), label: __( 'Card background', 'werun-blocks-community' ) },
						e.cards && e.cardStyle === 'bordered' && { value: a.cardBorderColor, onChange: ( cardBorderColor ) => setAttributes( { cardBorderColor } ), label: __( 'Card border', 'werun-blocks-community' ) },
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
