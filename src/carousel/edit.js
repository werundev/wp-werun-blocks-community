import { __, sprintf } from '@wordpress/i18n';
import {
	InnerBlocks,
	InspectorControls,
	PanelColorSettings,
	store as blockEditorStore,
	useBlockProps,
	useInnerBlocksProps,
} from '@wordpress/block-editor';
import { Notice, PanelBody, RangeControl, SelectControl, TextControl } from '@wordpress/components';
import { useDispatch, useSelect } from '@wordpress/data';
import { useRef } from '@wordpress/element';
import { Icon } from '../shared/icons';
import { ContrastAudit } from '../shared/a11y';
import { accentVars, blockColors, toneClass, useContextBackground, useSurface } from '../shared/contrast';
import { CarouselPanel, carouselHasControls } from '../shared/controls-extra';
import { Choice, cssVars, cx, px, ResponsiveColumns, SectionHeader, SectionHeaderPanel, Toggle } from '../shared/controls';

const clamp = ( value, min, max, fallback ) => Math.max( min, Math.min( max, Number.isFinite( Number( value ) ) && value !== '' && value !== null ? Number( value ) : fallback ) );

const slide = ( title, text ) => [
	'werun-community/slide',
	{},
	[
		[ 'core/heading', { level: 3, content: title } ],
		[ 'core/paragraph', { content: text } ],
	],
];
export const TEMPLATE = [
	slide( 'First slide', 'Each slide holds any blocks: text, buttons, images, columns.' ),
	slide( 'Second slide', 'Give a slide a background image or colour in its sidebar.' ),
	slide( 'Third slide', 'Arrows, dots, keyboard and swipe move between slides.' ),
];

const RATIOS = [ 'auto', '21/9', '16/9', '3/2', '4/3', '1/1', '3/4' ];

/** The first image inside a slide's blocks. Twin of $find_image in render.php. */
function findImage( blocks ) {
	for ( const block of blocks || [] ) {
		if ( [ 'core/image', 'core/cover', 'core/media-text' ].includes( block.name ) ) {
			const url = block.name === 'core/media-text' ? block.attributes.mediaUrl : block.attributes.url;
			if ( url ) {
				return url;
			}
		}
		const found = findImage( block.innerBlocks );
		if ( found ) {
			return found;
		}
	}
	return '';
}

/** Twin of $thumb_of in render.php: own thumbnail, background, first image. */
const slideThumb = ( block ) => block.attributes.thumbUrl || block.attributes.bgUrl || findImage( block.innerBlocks );

const plain = ( html ) => String( html || '' ).replace( /<[^>]*>/g, '' ).trim();

/** Every heading block inside a slide, nested ones included. */
function headingsIn( blocks, found = [] ) {
	for ( const block of blocks || [] ) {
		if ( block.name === 'core/heading' ) {
			found.push( block );
		}
		headingsIn( block.innerBlocks, found );
	}
	return found;
}
const levelOf = ( heading ) => clamp( heading.attributes.level, 1, 6, 2 );

/* The Color panel's own text / link colour, dropped (the automatic ones apply again). */
function withoutTextColor( a ) {
	const color = { ...( a.style?.color || {} ) };
	delete color.text;
	return { textColor: undefined, style: { ...( a.style || {} ), color } };
}
function withoutLinkColor( a ) {
	const elements = { ...( a.style?.elements || {} ) };
	delete elements.link;
	return { style: { ...( a.style || {} ), elements } };
}

export default function Edit( { attributes, setAttributes, clientId, name } ) {
	const a = attributes;
	const ref = useRef();
	const uid = `wrbc-carousel-${ clientId.slice( 0, 8 ) }`;
	// Twin of render.php: what the carousel sits on gives its tone and the readable accent.
	const surface = useSurface( clientId, a, name );
	const around = useContextBackground( clientId );
	const slides = useSelect( ( select ) => select( blockEditorStore ).getBlocks( clientId ), [ clientId ] ).filter( ( b ) => b.name === 'werun-community/slide' );
	const style = [ 'plain', 'bordered', 'filled', 'shadow' ].includes( a.slideStyle ) ? a.slideStyle : 'filled';
	const ratio = RATIOS.includes( a.aspectRatio ) ? a.aspectRatio : 'auto';
	const position = a.controlsPosition === 'top' ? 'top' : 'bottom';
	const hasControls = carouselHasControls( a ); // twin of wrbc_carousel_has_controls()
	// Same rule as render.php: thumbnails need two slides or more.
	const hasThumbs = a.showThumbs && slides.length > 1;
	const minH = clamp( a.minHeight, 0, 900, 0 );
	// Twin of render.php: the header's title names the carousel when it prints one;
	// otherwise the "Name for screen readers" field does.
	const hasTitle = !! a.showHeader && plain( a.title ) !== '';
	const titleLevel = clamp( a.titleLevel, 2, 4, 2 ); // as wrbc_section_header()
	// Under a title, each slide's headings start one level below it (WCAG 1.3.1).
	const offSlides = hasTitle
		? slides.map( ( s ) => headingsIn( s.innerBlocks ) ).filter( ( hs ) => hs.length && Math.min( ...hs.map( levelOf ) ) !== titleLevel + 1 )
		: [];
	const { updateBlockAttributes } = useDispatch( blockEditorStore );
	const fixHeadings = () =>
		offSlides.forEach( ( hs ) => {
			const shift = titleLevel + 1 - Math.min( ...hs.map( levelOf ) );
			hs.forEach( ( h ) => updateBlockAttributes( h.clientId, { level: clamp( levelOf( h ) + shift, 1, 6, 3 ) } ) );
		} );

	const blockProps = useBlockProps( {
		ref,
		className: cx(
			'wrbc-root wrbc-carousel is-ready',
			`wrbc-carousel--${ style }`,
			`wrbc-carousel--valign-${ a.verticalAlign }`,
			`wrbc-carousel--controls-${ position }`,
			toneClass( surface, around ),
			hasThumbs && 'has-thumbs'
		),
		style: cssVars( {
			...accentVars( a, surface ),
			'--wrbc-pv-d': clamp( a.columnsDesktop, 1, 4, 1 ),
			'--wrbc-pv-t': clamp( a.columnsTablet, 1, 4, 1 ),
			'--wrbc-pv-m': clamp( a.columnsMobile, 1, 2, 1 ),
			'--wrbc-gap': px( clamp( a.gap, 0, 96, 24 ) ),
			'--wrbc-peek': px( clamp( a.peek, 0, 240, 0 ) ),
			'--wrbc-radius': px( clamp( a.slideRadius, 0, 48, 16 ) ),
			'--wrbc-slide-pad': px( clamp( a.slidePadding, 0, 120, 40 ) ),
			'--wrbc-ratio': ratio === 'auto' ? undefined : ratio.replace( '/', ' / ' ),
			'--wrbc-slide-min-h': minH ? `${ minH }px` : undefined,
			'--wrbc-thumb-size': hasThumbs ? px( clamp( a.thumbSize, 40, 120, 64 ) ) : undefined,
			'--wrbc-slide-bg': style !== 'plain' ? a.slideBg : undefined,
			'--wrbc-slide-border': style === 'bordered' ? a.slideBorderColor : undefined,
		} ),
	} );
	const innerBlocksProps = useInnerBlocksProps(
		{ className: 'wrbc-carousel__track' },
		{
			allowedBlocks: [ 'werun-community/slide' ],
			template: TEMPLATE,
			orientation: 'horizontal',
			renderAppender: InnerBlocks.ButtonBlockAppender,
		}
	);

	const controls = hasControls && (
		<div className="wrbc-carousel__controls" aria-hidden="true">
			{ a.autoplay && (
				<span className="wrbc-carousel__btn wrbc-carousel__play">
					<Icon icon={ { name: 'pause' } } />
				</span>
			) }
			{ a.showDots && (
				<div className="wrbc-carousel__dots">
					{ slides.map( ( s, i ) => <span key={ s.clientId } className="wrbc-carousel__dot" aria-current={ i === 0 ? 'true' : 'false' } /> ) }
				</div>
			) }
			{ a.showArrows && (
				<div className="wrbc-carousel__arrows">
					<span className="wrbc-carousel__btn wrbc-anim-host"><Icon icon={ a.prevIcon } /></span>
					<span className="wrbc-carousel__btn wrbc-anim-host"><Icon icon={ a.nextIcon } /></span>
				</div>
			) }
		</div>
	);

	return (
		<>
			<ContrastAudit
				blockRef={ ref }
				deps={ [ attributes, slides, surface ] }
				checks={ [
					// The controls preview draws the same dots, arrows and thumbnails as the page.
					a.showDots && { selector: '.wrbc-carousel__dot', pseudo: '::before', property: 'background-color', min: 3, label: __( 'Dots', 'werun-blocks-community' ) },
					( a.showArrows || a.autoplay ) && { selector: '.wrbc-carousel__btn', property: 'color', min: 3, label: __( 'Arrows', 'werun-blocks-community' ) },
					hasThumbs && { selector: '.wrbc-carousel__thumb[aria-current="true"]', property: 'border-color', min: 3, label: __( 'Current thumbnail', 'werun-blocks-community' ) },
				].filter( Boolean ) }
				actions={ [
					// Colours of the carousel's own Color panel are never changed for it (they may not read over a photo slide): the author can drop them here.
					blockColors( a ).text && { label: __( 'Use the automatic text colour', 'werun-blocks-community' ), onClick: () => setAttributes( withoutTextColor( a ) ) },
					a.style?.elements?.link && { label: __( 'Use the automatic link colour', 'werun-blocks-community' ), onClick: () => setAttributes( withoutLinkColor( a ) ) },
				] }
			/>
			<InspectorControls>
				<PanelBody title={ __( 'Slides', 'werun-blocks-community' ) }>
					{ offSlides.length > 0 && (
						<Notice
							status="warning"
							isDismissible={ false }
							actions={ [ { label: __( 'Fix the heading levels', 'werun-blocks-community' ), onClick: fixHeadings, variant: 'secondary' } ] }
						>
							{ sprintf(
								/* translators: 1: heading level of the slides (3), 2: heading level of the carousel title (2) */
								__( 'Slide headings should start at H%1$d, one level below the carousel title (H%2$d), so screen reader users get the outline right.', 'werun-blocks-community' ),
								titleLevel + 1,
								titleLevel
							) }
						</Notice>
					) }
					<ResponsiveColumns attributes={ a } setAttributes={ setAttributes } max={ 4 } label={ __( 'Slides in view', 'werun-blocks-community' ) } />
					<RangeControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Gap (px)', 'werun-blocks-community' ) }
						value={ a.gap }
						min={ 0 }
						max={ 96 }
						onChange={ ( gap ) => setAttributes( { gap } ) }
					/>
					<RangeControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Peek at the next slide (px)', 'werun-blocks-community' ) }
						help={ __( 'Shows the edge of the next slide, a hint that there is more.', 'werun-blocks-community' ) }
						value={ a.peek }
						min={ 0 }
						max={ 240 }
						onChange={ ( peek ) => setAttributes( { peek } ) }
					/>
					<SelectControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Aspect ratio', 'werun-blocks-community' ) }
						help={ ratio !== 'auto' ? __( 'A slide with more content than fits grows taller.', 'werun-blocks-community' ) : undefined }
						value={ ratio }
						options={ RATIOS.map( ( value ) => ( { value, label: value === 'auto' ? __( 'Fit the content', 'werun-blocks-community' ) : value.replace( '/', ':' ) } ) ) }
						onChange={ ( aspectRatio ) => setAttributes( { aspectRatio } ) }
					/>
					<RangeControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Minimum height (px)', 'werun-blocks-community' ) }
						help={ minH ? undefined : __( '0: as tall as the content (or the ratio) needs.', 'werun-blocks-community' ) }
						value={ a.minHeight }
						min={ 0 }
						max={ 900 }
						step={ 10 }
						onChange={ ( minHeight ) => setAttributes( { minHeight } ) }
					/>
					<Choice
						label={ __( 'Content position', 'werun-blocks-community' ) }
						value={ a.verticalAlign }
						options={ [
							[ 'top', __( 'Top', 'werun-blocks-community' ) ],
							[ 'center', __( 'Middle', 'werun-blocks-community' ) ],
							[ 'bottom', __( 'Bottom', 'werun-blocks-community' ) ],
						] }
						onChange={ ( verticalAlign ) => setAttributes( { verticalAlign } ) }
					/>
				</PanelBody>
				<PanelBody title={ __( 'Slide style', 'werun-blocks-community' ) } initialOpen={ false }>
					<Choice
						label={ __( 'Style', 'werun-blocks-community' ) }
						value={ style }
						options={ [
							[ 'plain', __( 'Plain', 'werun-blocks-community' ) ],
							[ 'bordered', __( 'Border', 'werun-blocks-community' ) ],
							[ 'filled', __( 'Filled', 'werun-blocks-community' ) ],
							[ 'shadow', __( 'Shadow', 'werun-blocks-community' ) ],
						] }
						onChange={ ( slideStyle ) => setAttributes( { slideStyle } ) }
					/>
					<RangeControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Corner radius (px)', 'werun-blocks-community' ) }
						value={ a.slideRadius }
						min={ 0 }
						max={ 48 }
						onChange={ ( slideRadius ) => setAttributes( { slideRadius } ) }
					/>
					<RangeControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Padding (px)', 'werun-blocks-community' ) }
						help={ __( 'For every slide; a slide can set its own under Dimensions.', 'werun-blocks-community' ) }
						value={ a.slidePadding }
						min={ 0 }
						max={ 120 }
						onChange={ ( slidePadding ) => setAttributes( { slidePadding } ) }
					/>
					<Toggle attributes={ a } setAttributes={ setAttributes } name="reveal" label={ __( 'Fade in when it scrolls into view', 'werun-blocks-community' ) } />
				</PanelBody>
				<CarouselPanel attributes={ a } setAttributes={ setAttributes }>
					{ ! hasTitle && (
						<TextControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							label={ __( 'Name for screen readers', 'werun-blocks-community' ) }
							help={ __( 'What the carousel is about, e.g. “Customer stories” (it has no visible title). Without one, screen readers call it by its number of slides.', 'werun-blocks-community' ) }
							value={ a.label || '' }
							onChange={ ( label ) => setAttributes( { label } ) }
						/>
					) }
				</CarouselPanel>
				<PanelBody title={ __( 'Thumbnails', 'werun-blocks-community' ) } initialOpen={ false }>
					<Toggle
						attributes={ a }
						setAttributes={ setAttributes }
						name="showThumbs"
						label={ __( 'Thumbnails under the slides', 'werun-blocks-community' ) }
						help={ a.showThumbs && slides.length < 2 ? __( 'Shows with two slides or more.', 'werun-blocks-community' ) : __( 'Small previews of each slide: its thumbnail, background image or first image.', 'werun-blocks-community' ) }
					/>
					{ /* Size and alignment only when thumbnails print (two slides or more). */ }
					{ hasThumbs && (
						<>
							<RangeControl
								__nextHasNoMarginBottom
								__next40pxDefaultSize
								label={ __( 'Thumbnail size (px)', 'werun-blocks-community' ) }
								value={ a.thumbSize }
								min={ 40 }
								max={ 120 }
								onChange={ ( thumbSize ) => setAttributes( { thumbSize } ) }
							/>
							<Choice
								label={ __( 'Alignment', 'werun-blocks-community' ) }
								value={ a.thumbsAlign }
								options={ [
									[ 'left', __( 'Left', 'werun-blocks-community' ) ],
									[ 'center', __( 'Center', 'werun-blocks-community' ) ],
								] }
								onChange={ ( thumbsAlign ) => setAttributes( { thumbsAlign } ) }
							/>
						</>
					) }
				</PanelBody>
				<SectionHeaderPanel attributes={ a } setAttributes={ setAttributes } />
				<PanelColorSettings
					title={ __( 'Colors', 'werun-blocks-community' ) }
					initialOpen={ false }
					colorSettings={ [
						{ value: a.accentColor, onChange: ( accentColor ) => setAttributes( { accentColor } ), label: __( 'Accent (dots, thumbnails, focus)', 'werun-blocks-community' ) },
						// A slide background for every style but plain, a border for the bordered style.
						style !== 'plain' && { value: a.slideBg, onChange: ( slideBg ) => setAttributes( { slideBg } ), label: __( 'Slide background', 'werun-blocks-community' ) },
						style === 'bordered' && { value: a.slideBorderColor, onChange: ( slideBorderColor ) => setAttributes( { slideBorderColor } ), label: __( 'Slide border', 'werun-blocks-community' ) },
					].filter( Boolean ) }
				/>
			</InspectorControls>

			<section { ...blockProps }>
				<SectionHeader attributes={ a } setAttributes={ setAttributes } uid={ uid } />
				{ position === 'top' && controls }
				<div className="wrbc-carousel__viewport">
					<div { ...innerBlocksProps } />
				</div>
				{ hasThumbs && (
					<div className={ `wrbc-carousel__thumbs wrbc-carousel__thumbs--${ a.thumbsAlign === 'left' ? 'left' : 'center' }` } aria-hidden="true">
						{ slides.map( ( s, i ) => {
							const url = slideThumb( s );
							return (
								<span key={ s.clientId } className="wrbc-carousel__thumb" aria-current={ i === 0 ? 'true' : undefined }>
									{ url ? <img className="wrbc-carousel__thumb-img" src={ url } alt="" /> : <span className="wrbc-carousel__thumb-num">{ i + 1 }</span> }
								</span>
							);
						} ) }
					</div>
				) }
				{ position !== 'top' && controls }
			</section>
		</>
	);
}
