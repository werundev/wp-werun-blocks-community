import { __, sprintf } from '@wordpress/i18n';
import {
	InnerBlocks,
	InspectorControls,
	PanelColorSettings,
	useBlockProps,
	useInnerBlocksProps,
} from '@wordpress/block-editor';
import { Notice, PanelBody, RangeControl } from '@wordpress/components';
import { useRef } from '@wordpress/element';
import { decodeEntities } from '@wordpress/html-entities';
import { Icon } from '../shared/icons';
import { IconControl } from '../shared/IconControl';
import { ContrastAudit } from '../shared/a11y';
import { AA_TEXT, blockColors, contrastRatio, useContextBackground, useSurface } from '../shared/contrast';
import {
	Choice,
	cssVars,
	cx,
	IconSizeControls,
	px,
	SectionHeader,
	SectionHeaderPanel,
	Toggle,
} from '../shared/controls';
import { effective, itemTitleLevel, timelineColors } from './effective';

export const TEMPLATE = [
	[ 'werun-community/timeline-item', { date: '2016', title: 'Two people, one laptop', text: 'The first client site goes live from a kitchen table.' } ],
	[ 'werun-community/timeline-item', { date: '2019', title: 'A team of twelve', text: 'Design, development and support under one roof.' } ],
	[ 'werun-community/timeline-item', { date: '2022', title: 'Our own platform', text: 'Hosting and care plans for every site we build.', highlight: true } ],
	[ 'werun-community/timeline-item', { date: '2025', title: '300 sites and counting', text: 'Clients in 35 countries, the same team that built them.' } ],
];

// What "date position" means in each orientation.
const DATE_LABELS = {
	vertical: __( 'Beside the line', 'werun-blocks-community' ),
	alternating: __( 'Across the line', 'werun-blocks-community' ),
	horizontal: __( 'Above the line', 'werun-blocks-community' ),
};

export default function Edit( { attributes, setAttributes, clientId, name } ) {
	const a = attributes;
	const uid = `wrbc-timeline-${ clientId.slice( 0, 8 ) }`;
	const ref = useRef();
	const track = useRef();
	// The same rules as render.php (twin: effective.js / wrbc_timeline_effective()).
	const e = effective( a );
	const isIcon = e.marker === 'icon';
	// What the timeline sits on and the colours that read on it (twin:
	// timelineColors() / wrbc_timeline_colors()).
	const surface = useSurface( clientId, a, name );
	const around = useContextBackground( clientId );
	const colors = timelineColors( a, e, surface, around );
	// A chosen text colour that doesn't read on the surface: one click hands
	// it back to the automatic one (the tone class).
	const chosenText = blockColors( a ).text;
	const textFails = !! chosenText && contrastRatio( chosenText, surface ) > 0 && contrastRatio( chosenText, surface ) < AA_TEXT;
	// Under a printed section title the item titles follow its level (twin of
	// the items' render.php), so the level control only applies without one.
	const plainTitle = decodeEntities( String( a.title ?? '' ).replace( /<[^>]*>/g, '' ) ).trim();
	const headerTitle = !! a.showHeader && plainTitle !== '';
	const itemLevel = itemTitleLevel( a );
	// The scroll group's name, as render.php: not the section's own name.
	const trackLabel = headerTitle
		? sprintf(
				/* translators: %s: the timeline's title. */
				__( '%s, use the arrow keys to scroll', 'werun-blocks-community' ),
				plainTitle
		  )
		: __( 'Timeline, use the arrow keys to scroll', 'werun-blocks-community' );

	const blockProps = useBlockProps( {
		ref,
		className: cx(
			'wrbc-root wrbc-timeline',
			`wrbc-timeline--${ e.orientation }`,
			`wrbc-timeline--marker-${ e.marker }`,
			`wrbc-timeline--date-${ e.dateAt }`,
			`wrbc-timeline--card-${ e.cardStyle }`,
			`wrbc-timeline--line-${ e.lineStyle }`,
			e.alternating && `wrbc-timeline--start-${ e.start }`,
			colors.className
		),
		style: cssVars( {
			'--wrbc-gap': px( e.gap ),
			'--wrbc-tl-line-w': e.hasLine ? px( e.lineWidth ) : undefined,
			'--wrbc-tl-line-color': e.hasLine ? a.lineColor : undefined,
			'--wrbc-tl-item-w': e.horizontal ? px( e.itemWidth ) : undefined,
			'--wrbc-tl-marker': a.markerColor,
			// --wrbc-accent, --wrbc-on-accent, --wrbc-accent-text, --wrbc-tl-marker-text.
			...colors.vars,
			'--wrbc-icon-size': isIcon ? px( e.iconSize ) : undefined,
			'--wrbc-icon-stroke': isIcon ? e.iconStroke : undefined,
			'--wrbc-card-bg': e.boxed ? a.cardBg : undefined,
			'--wrbc-card-border': e.cardStyle === 'bordered' ? a.cardBorderColor : undefined,
			'--wrbc-radius': e.boxed ? px( e.cardRadius ) : undefined,
			'--wrbc-card-pad': e.boxed ? px( e.cardPadding ) : undefined,
		} ),
	} );
	const innerBlocksProps = useInnerBlocksProps(
		{ className: 'wrbc-timeline__list', role: 'list' },
		{
			allowedBlocks: [ 'werun-community/timeline-item' ],
			template: TEMPLATE,
			orientation: e.horizontal ? 'horizontal' : 'vertical',
			renderAppender: InnerBlocks.ButtonBlockAppender,
		}
	);
	const scroll = ( dir ) => {
		const el = track.current;
		if ( el ) {
			const view = el.ownerDocument.defaultView;
			const rtl = view.getComputedStyle( el ).direction === 'rtl';
			// As view.js: no smooth scrolling under reduced motion.
			const reduce = view.matchMedia?.( '(prefers-reduced-motion: reduce)' ).matches;
			el.scrollBy( { left: dir * ( rtl ? -1 : 1 ) * ( e.itemWidth + e.gap ), behavior: reduce ? 'auto' : 'smooth' } );
		}
	};

	return (
		<>
			<ContrastAudit
				blockRef={ ref }
				deps={ [ attributes, surface ] }
				checks={ [
					// Step numbers are a CSS counter: text no scan of the DOM sees.
					{ selector: '.wrbc-timeline-item__marker--number', pseudo: '::before', property: 'color', against: 'pseudo', min: AA_TEXT, label: __( 'Marker numbers', 'werun-blocks-community' ) },
					// The highlight's ring is drawn in the marker's text colour.
					{ selector: '.wrbc-timeline-item.is-highlight .wrbc-timeline-item__marker', property: 'color', against: 'self', min: 3, label: __( 'Highlight ring', 'werun-blocks-community' ) },
				] }
				actions={
					textFails
						? [
								{
									label: __( 'Use the automatic text colour', 'werun-blocks-community' ),
									onClick: () =>
										setAttributes( {
											textColor: undefined,
											style: { ...( a.style || {} ), color: { ...( a.style?.color || {} ), text: undefined } },
										} ),
								},
						  ]
						: []
				}
			/>
			<InspectorControls>
				<PanelBody title={ __( 'Layout', 'werun-blocks-community' ) }>
					<Choice
						label={ __( 'Orientation', 'werun-blocks-community' ) }
						value={ e.orientation }
						options={ [
							[ 'vertical', __( 'Vertical', 'werun-blocks-community' ) ],
							[ 'alternating', __( 'Alternating', 'werun-blocks-community' ) ],
							[ 'horizontal', __( 'Horizontal', 'werun-blocks-community' ) ],
						] }
						help={ e.alternating ? __( 'On narrow screens the items line up on one side.', 'werun-blocks-community' ) : undefined }
						onChange={ ( orientation ) => setAttributes( { orientation } ) }
					/>
					{ e.alternating && (
						<Choice
							label={ __( 'First item on the', 'werun-blocks-community' ) }
							value={ e.start }
							options={ [
								[ 'start', __( 'Left', 'werun-blocks-community' ) ],
								[ 'end', __( 'Right', 'werun-blocks-community' ) ],
							] }
							help={ __( 'Mirrored in right-to-left languages.', 'werun-blocks-community' ) }
							onChange={ ( alternateStart ) => setAttributes( { alternateStart } ) }
						/>
					) }
					{ e.horizontal && (
						<>
							<RangeControl
								__nextHasNoMarginBottom
								__next40pxDefaultSize
								label={ __( 'Item width (px)', 'werun-blocks-community' ) }
								value={ e.itemWidth }
								min={ 200 }
								max={ 520 }
								step={ 10 }
								onChange={ ( itemWidth ) => setAttributes( { itemWidth } ) }
							/>
							<Toggle
								attributes={ a }
								setAttributes={ setAttributes }
								name="showArrows"
								label={ __( 'Back and forward arrows', 'werun-blocks-community' ) }
								help={ __( 'Shown only when the items overflow. The track also scrolls by touch, trackpad and keyboard.', 'werun-blocks-community' ) }
							/>
						</>
					) }
					<RangeControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Gap between items (px)', 'werun-blocks-community' ) }
						value={ e.gap }
						min={ 0 }
						max={ 96 }
						onChange={ ( gap ) => setAttributes( { gap } ) }
					/>
					<Toggle attributes={ a } setAttributes={ setAttributes } name="reveal" label={ __( 'Fade in as they scroll into view', 'werun-blocks-community' ) } />
				</PanelBody>
				<PanelBody title={ __( 'Line and markers', 'werun-blocks-community' ) } initialOpen={ false }>
					<Choice
						label={ __( 'Line', 'werun-blocks-community' ) }
						value={ e.lineStyle }
						options={ [
							[ 'solid', __( 'Solid', 'werun-blocks-community' ) ],
							[ 'dashed', __( 'Dashed', 'werun-blocks-community' ) ],
							[ 'dotted', __( 'Dotted', 'werun-blocks-community' ) ],
							[ 'none', __( 'None', 'werun-blocks-community' ) ],
						] }
						onChange={ ( lineStyle ) => setAttributes( { lineStyle } ) }
					/>
					{ e.hasLine && (
						<RangeControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							label={ __( 'Line width (px)', 'werun-blocks-community' ) }
							value={ e.lineWidth }
							min={ 1 }
							max={ 6 }
							onChange={ ( lineWidth ) => setAttributes( { lineWidth } ) }
						/>
					) }
					<Choice
						label={ __( 'Marker', 'werun-blocks-community' ) }
						value={ e.marker }
						options={ [
							[ 'dot', __( 'Dot', 'werun-blocks-community' ) ],
							[ 'icon', __( 'Icon', 'werun-blocks-community' ) ],
							[ 'number', __( 'Number', 'werun-blocks-community' ) ],
							[ 'year', __( 'Date', 'werun-blocks-community' ) ],
						] }
						help={ e.marker === 'year' ? __( "Each item's date sits on the line, so it is not repeated in the card.", 'werun-blocks-community' ) : undefined }
						onChange={ ( markerStyle ) => setAttributes( { markerStyle } ) }
					/>
					{ isIcon && (
						<>
							<IconControl
								label={ __( 'Icon for every item', 'werun-blocks-community' ) }
								value={ a.markerIcon }
								allowRemove={ false }
								help={ __( 'Used by every item that has no icon of its own.', 'werun-blocks-community' ) }
								onChange={ ( markerIcon ) => setAttributes( { markerIcon } ) }
							/>
							<IconSizeControls attributes={ { ...a, iconSize: e.iconSize, iconStroke: e.iconStroke } } setAttributes={ setAttributes } maxSize={ 40 } />
						</>
					) }
					{ e.marker !== 'year' && (
						<Choice
							label={ __( 'Date', 'werun-blocks-community' ) }
							value={ e.dateAt }
							options={ [
								[ 'card', __( 'In the card', 'werun-blocks-community' ) ],
								[ 'opposite', DATE_LABELS[ e.orientation ] ],
							] }
							onChange={ ( datePosition ) => setAttributes( { datePosition } ) }
						/>
					) }
				</PanelBody>
				<PanelBody title={ __( 'Cards', 'werun-blocks-community' ) } initialOpen={ false }>
					<Choice
						label={ __( 'Style', 'werun-blocks-community' ) }
						value={ e.cardStyle }
						options={ [
							[ 'plain', __( 'Plain', 'werun-blocks-community' ) ],
							[ 'bordered', __( 'Border', 'werun-blocks-community' ) ],
							[ 'filled', __( 'Filled', 'werun-blocks-community' ) ],
							[ 'shadow', __( 'Shadow', 'werun-blocks-community' ) ],
						] }
						onChange={ ( cardStyle ) => setAttributes( { cardStyle } ) }
					/>
					{ e.boxed && (
						<>
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
						</>
					) }
					{ headerTitle ? (
						<Notice status="info" isDismissible={ false }>
							{ sprintf(
								/* translators: 1: heading level of the item titles, e.g. 3; 2: heading level of the section title. */
								__( 'Item titles are H%1$d, one level below the section title (H%2$d).', 'werun-blocks-community' ),
								itemLevel,
								itemLevel - 1
							) }
						</Notice>
					) : (
						<Choice
							label={ __( 'Item title level', 'werun-blocks-community' ) }
							value={ String( itemLevel ) }
							options={ [
								[ '2', 'H2' ],
								[ '3', 'H3' ],
								[ '4', 'H4' ],
							] }
							help={ __( 'One level below the heading above the timeline.', 'werun-blocks-community' ) }
							onChange={ ( value ) => setAttributes( { itemTitleLevel: Number( value ) } ) }
						/>
					) }
					<Toggle
						attributes={ a }
						setAttributes={ setAttributes }
						name="showImages"
						label={ __( 'Images', 'werun-blocks-community' ) }
						help={ __( 'Each item can have an image, chosen in its sidebar.', 'werun-blocks-community' ) }
					/>
				</PanelBody>
				<SectionHeaderPanel attributes={ a } setAttributes={ setAttributes } />
				<PanelColorSettings
					title={ __( 'Timeline colors', 'werun-blocks-community' ) }
					initialOpen={ false }
					colorSettings={ [
						{ value: a.accentColor, onChange: ( accentColor ) => setAttributes( { accentColor } ), label: __( 'Accent (dates, highlight)', 'werun-blocks-community' ) },
						e.hasLine && { value: a.lineColor, onChange: ( lineColor ) => setAttributes( { lineColor } ), label: __( 'Line', 'werun-blocks-community' ) },
						{ value: a.markerColor, onChange: ( markerColor ) => setAttributes( { markerColor } ), label: __( 'Marker', 'werun-blocks-community' ) },
						e.marker !== 'dot' && {
							value: a.markerTextColor,
							onChange: ( markerTextColor ) => setAttributes( { markerTextColor } ),
							label: isIcon ? __( 'Marker icon', 'werun-blocks-community' ) : __( 'Marker text', 'werun-blocks-community' ),
						},
						e.boxed && { value: a.cardBg, onChange: ( cardBg ) => setAttributes( { cardBg } ), label: __( 'Card background', 'werun-blocks-community' ) },
						e.cardStyle === 'bordered' && { value: a.cardBorderColor, onChange: ( cardBorderColor ) => setAttributes( { cardBorderColor } ), label: __( 'Card border', 'werun-blocks-community' ) },
					].filter( Boolean ) }
				/>
			</InspectorControls>
			<section { ...blockProps }>
				<SectionHeader attributes={ a } setAttributes={ setAttributes } uid={ uid } />
				{ e.horizontal ? (
					<>
						{ /* As render.php (without its tabindex: the items are focusable here). */ }
						<div className="wrbc-timeline__viewport" ref={ track } role="group" aria-label={ trackLabel }>
							<ol { ...innerBlocksProps } />
						</div>
						{ e.arrows && (
							<div className="wrbc-timeline__nav">
								<button type="button" className="wrbc-timeline__arrow" aria-label={ __( 'Scroll back', 'werun-blocks-community' ) } onClick={ () => scroll( -1 ) }>
									<Icon icon={ { name: 'chevron-left' } } />
								</button>
								<button type="button" className="wrbc-timeline__arrow" aria-label={ __( 'Scroll forward', 'werun-blocks-community' ) } onClick={ () => scroll( 1 ) }>
									<Icon icon={ { name: 'chevron-right' } } />
								</button>
							</div>
						) }
					</>
				) : (
					<ol { ...innerBlocksProps } />
				) }
			</section>
		</>
	);
}
