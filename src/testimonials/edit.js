import { __ } from '@wordpress/i18n';
import {
	InnerBlocks,
	InspectorControls,
	PanelColorSettings,
	useBlockProps,
	useInnerBlocksProps,
} from '@wordpress/block-editor';
import { Notice, PanelBody, RangeControl, Spinner } from '@wordpress/components';
import { useSelect } from '@wordpress/data';
import { useEffect, useMemo, useRef } from '@wordpress/element';
import { Icon } from '../shared/icons';
import { IconControl } from '../shared/IconControl';
import { ContrastAudit } from '../shared/a11y';
import { accentVars, toneClass, useContextBackground, useSurface } from '../shared/contrast';
import { cardColors, withCardColors } from './colors';
import {
	Choice,
	cssVars,
	cx,
	px,
	ResponsiveColumns,
	SectionHeader,
	SectionHeaderPanel,
	Toggle,
} from '../shared/controls';
import { CarouselPanel, carouselHasControls } from '../shared/controls-extra';
import { useGet, useMetaKeys } from '../query/api';
import { effectiveType, withDefaults } from '../query/constants';
import { MetaPanel, OrderPanel, SourcePanel, TaxPanel } from '../query/panels-query';
import { CountPanel, FieldsPanel, normalizeMap, resetMapKeys, suggestTestimonialType, useCardsPreview } from './query';

// Placeholders, so a quote nobody said can never go live by accident.
const t = ( quote ) => [ 'werun-community/testimonial', { quote, name: 'Client name', role: 'Role, company', rating: 5 } ];
export const TEMPLATE = [
	t( 'Replace this with a real quote from a client: what changed after working with you, in their own words.' ),
	t( 'A second quote. Short ones read best: two or three sentences, one idea.' ),
	t( 'A third quote, ideally about something a new client worries about: deadlines, price or support.' ),
	t( 'A fourth quote. The carousel adds dots and arrows when there are more quotes than fit in view.' ),
];

export default function Edit( { attributes, setAttributes, clientId } ) {
	const a = attributes;
	const uid = `wrbc-testimonials-${ clientId.slice( 0, 8 ) }`;
	const carousel = a.layout !== 'grid';
	const dynamic = a.source === 'query';

	// Source "query": the query engine's panels (src/query), the field map and a server preview.
	const query = withDefaults( a.query );
	// Same path as useSources(), loaded only once the block uses a post type.
	const sources = useGet( dynamic ? '/wrbc/v1/query/sources' : null );
	const types = sources.data?.types || [];
	const typeName = effectiveType( a.query, 'posts', types );
	const source = types.find( ( t ) => t.name === typeName );
	const metaKeys = useMetaKeys( dynamic ? source?.name : null ).data;
	const map = normalizeMap( a.map, metaKeys );
	// A new post type: the map's custom fields belonged to the old one.
	const setQuery = ( patch ) =>
		setAttributes( {
			query: { ...( a.query || {} ), ...patch },
			...( patch.postType !== undefined && patch.postType !== a.query?.postType ? { map: resetMapKeys( a.map ) } : {} ),
		} );
	const postId = useSelect( ( select ) => select( 'core/editor' )?.getCurrentPostId?.() || 0, [] );
	const cards = useCardsPreview( dynamic, a, postId );
	// No type chosen yet: one named like testimonials or reviews, picked once.
	const suggested = dynamic && ! a.query?.postType ? suggestTestimonialType( types ) : '';
	useEffect( () => {
		if ( suggested ) {
			setQuery( { postType: suggested } );
		}
	}, [ suggested ] ); // eslint-disable-line react-hooks/exhaustive-deps

	// Without arrows and dots a mouse couldn't reach the slides out of view: the arrows show then (render.php: $wrbc_nav).
	const nav = ! a.showArrows && ! a.showDots ? { ...a, showArrows: true } : a;
	// The controls row only exists when one of its parts is on (and, from a post type, when there are cards: render.php).
	const hasControls = carousel && carouselHasControls( nav ) && ! ( dynamic && cards.count === 0 );
	// Stars show when the block shows them and a card can have a rating: always by hand, with a rating field from a post type.
	const ratingOn = a.showRating && ( ! dynamic || !! map.rating );

	// What the block sits on (its own background, or the section/group around it), as render.php works it out.
	const ref = useRef();
	const surface = useSurface( clientId, a, 'werun-community/testimonials' );
	const around = useContextBackground( clientId );
	const colors = cardColors( { cardStyle: a.cardStyle, cardBg: a.cardBg, starColor: a.starColor, accentColor: a.accentColor, surface } );
	// From a post type the server renders the cards alone, without the section around the block: the editor's colours win.
	const cardsHtml = useMemo( () => withCardColors( cards.html, colors ), [ cards.html, colors.tone, JSON.stringify( colors.vars ) ] ); // eslint-disable-line react-hooks/exhaustive-deps

	const blockProps = useBlockProps( {
		ref,
		className: cx(
			'wrbc-root wrbc-testimonials is-ready',
			`wrbc-testimonials--${ carousel ? 'carousel' : 'grid' }`,
			`wrbc-testimonials--${ a.cardStyle }`,
			`wrbc-testimonials--align-${ a.contentAlign }`,
			`wrbc-testimonials--controls-${ a.controlsPosition }`,
			// The shared carousel styles (assets/modules.css), as render.php prints them.
			carousel && `wrbc-carousel wrbc-carousel--controls-${ a.controlsPosition === 'top' ? 'top' : 'bottom' }`,
			carousel && a.autoplay && 'wrbc-testimonials--autoplay',
			toneClass( surface, around )
		),
		style: cssVars( {
			'--wrbc-cols-d': a.columnsDesktop,
			'--wrbc-cols-t': a.columnsTablet,
			'--wrbc-cols-m': a.columnsMobile,
			'--wrbc-pv-d': carousel ? a.columnsDesktop : undefined,
			'--wrbc-pv-t': carousel ? a.columnsTablet : undefined,
			'--wrbc-pv-m': carousel ? a.columnsMobile : undefined,
			'--wrbc-gap': px( a.gap ),
			'--wrbc-star': colors.star,
			'--wrbc-card-bg': a.cardBg,
			'--wrbc-card-border': a.cardBorderColor,
			'--wrbc-radius': px( a.cardRadius ),
			'--wrbc-icon-size': px( a.iconSize ),
			'--wrbc-icon-stroke': a.iconStroke,
			// As render.php: readable on the surface, and on the cards' tint when they're filled.
			...accentVars( a, colors.bg ? surface : colors.under ),
		} ),
	} );
	const innerBlocksProps = useInnerBlocksProps(
		{ className: cx( 'wrbc-testimonials__track', carousel && 'wrbc-carousel__track' ) },
		{
			allowedBlocks: [ 'werun-community/testimonial' ],
			template: TEMPLATE,
			orientation: 'horizontal',
			renderAppender: InnerBlocks.ButtonBlockAppender,
		}
	);

	const controls = hasControls && (
		<div className="wrbc-carousel__controls wrbc-testimonials__controls" aria-hidden="true">
			{ a.autoplay && (
				<span className="wrbc-carousel__btn wrbc-testimonials__btn">
					<Icon icon={ { name: 'pause' } } />
				</span>
			) }
			{ a.showDots && (
				<div className="wrbc-carousel__dots wrbc-testimonials__dots">
					<span className="wrbc-carousel__dot" aria-current="true" />
					<span className="wrbc-carousel__dot" />
				</div>
			) }
			{ nav.showArrows && (
				<div className="wrbc-carousel__arrows wrbc-testimonials__arrows">
					<span className="wrbc-carousel__btn wrbc-testimonials__btn wrbc-anim-host">
						<Icon icon={ a.prevIcon } />
					</span>
					<span className="wrbc-carousel__btn wrbc-testimonials__btn wrbc-anim-host">
						<Icon icon={ a.nextIcon } />
					</span>
				</div>
			) }
		</div>
	);

	return (
		<>
			{ /* Text is scanned as painted; the stars (meaningful, 3:1) and the dots are checked too. */ }
			<ContrastAudit
				blockRef={ ref }
				deps={ [ attributes, cardsHtml, surface ] }
				checks={ [
					{ selector: '.wrbc-testi__star', property: 'color', min: 3, label: __( 'Stars', 'werun-blocks-community' ) },
					{ selector: '.wrbc-carousel__dot:not([aria-current="true"])', pseudo: '::before', property: 'background-color', min: 3, label: __( 'Dots', 'werun-blocks-community' ) },
					{ selector: '.wrbc-carousel__dot[aria-current="true"]', pseudo: '::before', property: 'background-color', min: 3, label: __( 'Current dot', 'werun-blocks-community' ) },
				] }
			/>
			<InspectorControls>
				<PanelBody title={ __( 'Quotes', 'werun-blocks-community' ) }>
					<Choice
						label={ __( 'Quotes from', 'werun-blocks-community' ) }
						value={ dynamic ? 'query' : 'manual' }
						options={ [
							[ 'manual', __( 'Written here', 'werun-blocks-community' ) ],
							[ 'query', __( 'A post type', 'werun-blocks-community' ) ],
						] }
						help={ dynamic ? __( 'The quotes written here are kept (hidden) and come back when you switch.', 'werun-blocks-community' ) : undefined }
						onChange={ ( value ) => setAttributes( { source: value } ) }
					/>
				</PanelBody>
				{ dynamic && (
					<>
						<SourcePanel attributes={ a } setAttributes={ setAttributes } query={ query } setQuery={ setQuery } types={ types } source={ source } typeName={ typeName } loading={ sources.loading } />
						<TaxPanel query={ query } setQuery={ setQuery } source={ source } />
						<MetaPanel query={ query } setQuery={ setQuery } metaKeys={ metaKeys } />
						<OrderPanel query={ query } setQuery={ setQuery } metaKeys={ metaKeys } />
						<CountPanel query={ query } setQuery={ setQuery } source={ source } />
						<FieldsPanel attributes={ a } setAttributes={ setAttributes } map={ map } metaKeys={ metaKeys } source={ source } />
					</>
				) }
				<PanelBody title={ __( 'Layout', 'werun-blocks-community' ) }>
					<Choice
						label={ __( 'Show as', 'werun-blocks-community' ) }
						value={ a.layout }
						options={ [
							[ 'carousel', __( 'Carousel', 'werun-blocks-community' ) ],
							[ 'grid', __( 'Grid', 'werun-blocks-community' ) ],
						] }
						onChange={ ( layout ) => setAttributes( { layout } ) }
					/>
					<ResponsiveColumns
						attributes={ a }
						setAttributes={ setAttributes }
						max={ 4 }
						label={ carousel ? __( 'Slides in view', 'werun-blocks-community' ) : __( 'Columns', 'werun-blocks-community' ) }
					/>
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
				{ carousel && (
					<CarouselPanel attributes={ a } setAttributes={ setAttributes }>
						{ ! a.showArrows && ! a.showDots && (
							<p className="wrbc-testimonials__help">
								{ __( 'Without arrows or dots a mouse can’t reach the testimonials out of view, so the arrows still show while some are hidden.', 'werun-blocks-community' ) }
							</p>
						) }
					</CarouselPanel>
				) }
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
					<Choice
						label={ __( 'Alignment', 'werun-blocks-community' ) }
						value={ a.contentAlign }
						options={ [
							[ 'left', __( 'Left', 'werun-blocks-community' ) ],
							[ 'center', __( 'Center', 'werun-blocks-community' ) ],
						] }
						onChange={ ( contentAlign ) => setAttributes( { contentAlign } ) }
					/>
					{ /* Plain cards have no box: the radius only shows on a card given its own background, which only a card written here can have. */ }
					{ ! ( a.cardStyle === 'plain' && dynamic ) && (
						<RangeControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							label={ __( 'Corner radius (px)', 'werun-blocks-community' ) }
							help={ a.cardStyle === 'plain' ? __( 'Shows on cards given their own background.', 'werun-blocks-community' ) : undefined }
							value={ a.cardRadius }
							min={ 0 }
							max={ 40 }
							onChange={ ( cardRadius ) => setAttributes( { cardRadius } ) }
						/>
					) }
					{ ! carousel && <Toggle attributes={ a } setAttributes={ setAttributes } name="reveal" label={ __( 'Fade in when they scroll into view', 'werun-blocks-community' ) } /> }
				</PanelBody>
				<PanelBody title={ __( 'What every card shows', 'werun-blocks-community' ) } initialOpen={ false }>
					<Toggle attributes={ a } setAttributes={ setAttributes } name="showQuoteIcon" label={ __( 'Quote icon', 'werun-blocks-community' ) } />
					{ a.showQuoteIcon && (
						<IconControl label={ __( 'Quote icon', 'werun-blocks-community' ) } value={ a.quoteIcon } allowRemove={ false } onChange={ ( quoteIcon ) => setAttributes( { quoteIcon } ) } />
					) }
					<Toggle attributes={ a } setAttributes={ setAttributes } name="showRating" label={ __( 'Stars', 'werun-blocks-community' ) } />
					<Toggle attributes={ a } setAttributes={ setAttributes } name="showAvatar" label={ __( 'Photo', 'werun-blocks-community' ) } />
					<Toggle attributes={ a } setAttributes={ setAttributes } name="showRole" label={ __( 'Role and company', 'werun-blocks-community' ) } />
					{ a.showQuoteIcon && (
						<RangeControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							label={ __( 'Quote icon size (px)', 'werun-blocks-community' ) }
							value={ a.iconSize }
							min={ 12 }
							max={ 40 }
							onChange={ ( iconSize ) => setAttributes( { iconSize } ) }
						/>
					) }
					{ ( a.showQuoteIcon || ratingOn || hasControls ) && (
						<RangeControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							label={ __( 'Icon stroke', 'werun-blocks-community' ) }
							help={ __( 'Quote icon, stars and carousel buttons.', 'werun-blocks-community' ) }
							value={ a.iconStroke }
							min={ 1 }
							max={ 3 }
							step={ 0.25 }
							onChange={ ( iconStroke ) => setAttributes( { iconStroke } ) }
						/>
					) }
				</PanelBody>
				<SectionHeaderPanel attributes={ a } setAttributes={ setAttributes } />
				<PanelColorSettings
					title={ __( 'Colors', 'werun-blocks-community' ) }
					initialOpen={ false }
					colorSettings={ [
						{ value: a.accentColor, onChange: ( accentColor ) => setAttributes( { accentColor } ), label: __( 'Accent (quote icon, dots, focus)', 'werun-blocks-community' ) },
						// Only the colors something on the page uses: stars when shown, a card
						// background for every style but plain, a border for the bordered style.
						// Stars: ratingOn (from a post type, only with a rating field mapped).
						ratingOn && { value: a.starColor, onChange: ( starColor ) => setAttributes( { starColor } ), label: __( 'Stars', 'werun-blocks-community' ) },
						a.cardStyle !== 'plain' && { value: a.cardBg, onChange: ( cardBg ) => setAttributes( { cardBg } ), label: __( 'Card background', 'werun-blocks-community' ) },
						a.cardStyle === 'bordered' && { value: a.cardBorderColor, onChange: ( cardBorderColor ) => setAttributes( { cardBorderColor } ), label: __( 'Card border', 'werun-blocks-community' ) },
					].filter( Boolean ) }
				/>
			</InspectorControls>

			<section { ...blockProps }>
				<SectionHeader attributes={ a } setAttributes={ setAttributes } uid={ uid } />
				{ a.controlsPosition === 'top' && controls }
				{ dynamic && cards.busy && ! cards.html && <Spinner /> }
				{ dynamic && cards.error && <Notice status="error" isDismissible={ false }>{ cards.error }</Notice> }
				{ dynamic && cards.count === 0 && ! cards.busy && (
					<Notice status="info" isDismissible={ false }>
						{ a.emptyText
							? __( 'Nothing matches: the page shows the text for that case.', 'werun-blocks-community' )
							: __( 'Nothing matches: the page shows nothing here until it does.', 'werun-blocks-community' ) }
					</Notice>
				) }
				{ dynamic && cards.count === 0 && a.emptyText && <p className="wrbc-testimonials__empty">{ a.emptyText }</p> }
				{ /* From a post type: the server's cards (render.php through the block renderer, each in its <li>); the inner blocks stay in the post, unseen. */ }
				{ dynamic ? (
					cards.count > 0 && (
						<div className={ cx( 'wrbc-testimonials__viewport', cards.busy && 'is-loading' ) } aria-busy={ cards.busy }>
							{ /* role="list": Safari drops a <ul>'s list role with list-style: none (as render.php prints it). */ }
							{ /* eslint-disable-next-line jsx-a11y/no-redundant-roles */ }
							<ul className={ cx( 'wrbc-testimonials__track', carousel && 'wrbc-carousel__track' ) } role="list" dangerouslySetInnerHTML={ { __html: cardsHtml } } />
						</div>
					)
				) : (
					<div className="wrbc-testimonials__viewport">
						<div { ...innerBlocksProps } />
					</div>
				) }
				{ a.controlsPosition !== 'top' && controls }
			</section>
		</>
	);
}
