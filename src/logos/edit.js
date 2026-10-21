import { __, _n, sprintf } from '@wordpress/i18n';
import {
	BlockControls,
	InspectorControls,
	MediaPlaceholder,
	MediaUpload,
	MediaUploadCheck,
	PanelColorSettings,
	useBlockProps,
} from '@wordpress/block-editor';
import { Notice, PanelBody, RangeControl, ToolbarButton, ToolbarGroup } from '@wordpress/components';
import { useRef } from '@wordpress/element';
import { Icon } from '../shared/icons';
import { CarouselPanel, carouselHasControls } from '../shared/controls-extra';
import { Choice, cssVars, cx, px, ResponsiveColumns, SectionHeader, SectionHeaderPanel, Toggle } from '../shared/controls';
import { accentVars, isDarkColor, toneClass, useContextBackground, useSurface } from '../shared/contrast';
import { ContrastAudit } from '../shared/a11y';
import { addMedia, LogoList } from './LogoList';
import { useFadingLogos } from './logo-tone';

const TONES = [ 'original', 'dark', 'light' ];

const clamp = ( value, min, max, fallback ) => Math.max( min, Math.min( max, Number.isFinite( Number( value ) ) && value !== '' && value !== null ? Number( value ) : fallback ) );

/** Twin of the validation loop at the top of render.php: an image needs an id or a URL. */
export function normalizeLogos( list ) {
	return ( Array.isArray( list ) ? list : [] )
		.filter( ( logo ) => logo && typeof logo === 'object' )
		.map( ( logo ) => ( {
			id: Number( logo.id ) > 0 ? Number( logo.id ) : 0,
			// render.php drops what esc_url() refuses; the editor at least drops script URLs.
			url: typeof logo.url === 'string' && ! /^\s*(javascript|data|vbscript):/i.test( logo.url ) ? logo.url : '',
			alt: typeof logo.alt === 'string' ? logo.alt.trim() : '',
			name: typeof logo.name === 'string' ? logo.name.trim() : '',
			link: typeof logo.link === 'string' ? logo.link.trim() : '',
			newTab: !! logo.newTab,
		} ) )
		.filter( ( logo ) => logo.id || logo.url );
}

/** A link render.php prints (esc_url() refuses script URLs). */
const isLink = ( link ) => !! link && ! /^\s*(javascript|data|vbscript):/i.test( link );

/** A link's last-resort name, as render.php: its host without www., or its path on this site. */
function linkName( link ) {
	// As esc_url(): no scheme and not relative means http://.
	const href = /^[/#?]/.test( link ) || link.includes( ':' ) ? link : `http://${ link }`;
	try {
		const url = new URL( href, 'http://relative.invalid' );
		if ( url.hostname && url.hostname !== 'relative.invalid' ) {
			return url.hostname.replace( /^www\./i, '' );
		}
		return decodeURIComponent( url.pathname ).replace( /^\/+|\/+$/g, '' );
	} catch ( e ) {
		return '';
	}
}

/**
 * The image's alt, twin of $wrbc_logo_html in render.php: alt field, else
 * name (empty when the name shows as a caption), and for a link at least
 * its site, its path or "Logo n". The editor can't read the media library's
 * alt text, which render.php tries before the link.
 */
export function logoAlt( logo, showNames, position ) {
	if ( showNames && logo.name ) {
		return logo.alt === logo.name ? '' : logo.alt;
	}
	if ( logo.alt || logo.name ) {
		return logo.alt || logo.name;
	}
	if ( ! isLink( logo.link ) ) {
		return '';
	}
	/* translators: %d: position of the logo in the list */
	return linkName( logo.link ) || sprintf( __( 'Logo %d', 'werun-blocks-community' ), position );
}

/** One logo as render.php's $wrbc_logo_html prints it (links don't navigate in the editor). */
function Logo( { logo, showNames, position } ) {
	const caption = showNames && logo.name;
	return (
		<span className={ cx( 'wrbc-logos__logo', isLink( logo.link ) && 'wrbc-logos__link' ) }>
			{ logo.url && <img className="wrbc-logos__img" src={ logo.url } alt={ logoAlt( logo, showNames, position ) } /> }
			{ caption && <span className="wrbc-logos__name">{ logo.name }</span> }
		</span>
	);
}

export default function Edit( { attributes, setAttributes, clientId, name } ) {
	const a = attributes;
	const ref = useRef();
	const uid = `wrbc-logos-${ clientId.slice( 0, 8 ) }`;
	// The sidebar edits the stored list as it is (no trimming while typing);
	// the preview shows what render.php will print.
	const stored = Array.isArray( a.logos ) ? a.logos.filter( ( logo ) => logo && typeof logo === 'object' ) : [];
	const logos = normalizeLogos( stored );
	const layout = [ 'grid', 'marquee', 'carousel' ].includes( a.layout ) ? a.layout : 'grid';
	// Twins of render.php's $tone and $gray: a flat logo colour has nothing to turn grey.
	const tone = TONES.includes( a.logoTone ) ? a.logoTone : 'original';
	const gray = tone === 'original' && !! a.grayscale;
	// Same floor as render.php: below 50% logos fade out instead of looking dimmed.
	const opacity = clamp( a.opacity, 50, 100, 100 );
	// Same rule as render.php ($reveal_hover): colour on hover needs grey or dimmed logos.
	const canReveal = gray || opacity < 100;
	const hasControls = layout === 'carousel' && carouselHasControls( a ); // twin of wrbc_carousel_has_controls()
	const setLogos = ( list ) => setAttributes( { logos: list } );
	// What the text, accent and focus ring sit on (render.php: wrbc_surface()).
	const surface = useSurface( clientId, a, name );
	const around = useContextBackground( clientId );
	const dark = isDarkColor( surface ) === true;
	const fading = useFadingLogos(
		logos.map( ( logo ) => logo.url ).filter( Boolean ),
		surface,
		{ tone, opacity: opacity / 100 }
	);

	const vars = {
		'--wrbc-gap': px( clamp( a.gap, 0, 120, 40 ) ),
		'--wrbc-logo-h': px( clamp( a.logoHeight, 16, 160, 48 ) ),
		'--wrbc-logo-w': px( clamp( a.logoMaxWidth, 40, 400, 160 ) ),
		'--wrbc-logo-o': opacity / 100,
		...accentVars( a, surface ),
	};
	if ( layout === 'grid' ) {
		vars[ '--wrbc-cols-d' ] = clamp( a.columnsDesktop, 1, 8, 6 );
		vars[ '--wrbc-cols-t' ] = clamp( a.columnsTablet, 1, 4, 4 );
		vars[ '--wrbc-cols-m' ] = clamp( a.columnsMobile, 1, 2, 2 );
	}
	if ( layout === 'marquee' ) {
		vars[ '--wrbc-marquee-dur' ] = `${ clamp( a.marqueeSpeed, 1, 10, 3 ) * Math.max( 1, logos.length ) }s`;
	}

	const blockProps = useBlockProps( {
		ref,
		className: cx(
			'wrbc-root wrbc-logos is-ready',
			`wrbc-logos--${ layout }`,
			// As render.php: a marquee is always centred.
			`wrbc-logos--align-${ layout === 'marquee' ? 'center' : a.itemAlign }`,
			toneClass( surface, around ),
			tone !== 'original' && `wrbc-logos--tone-${ tone }`,
			gray && 'is-grayscale',
			canReveal && a.hoverReveal && 'is-hover-reveal',
			a.showNames && 'has-names',
			layout === 'marquee' && a.marqueeDirection === 'right' && 'wrbc-logos--dir-right'
		),
		style: cssVars( vars ),
	} );

	// Logos that would vanish into this background: say so, with the fix.
	let toneHint = null;
	if ( tone === 'light' && dark === false ) {
		toneHint = {
			text: __( 'White logos disappear on this light background.', 'werun-blocks-community' ),
			action: { label: __( 'Use their own colours', 'werun-blocks-community' ), onClick: () => setAttributes( { logoTone: 'original' } ) },
		};
	} else if ( fading.fading ) {
		toneHint = {
			text: sprintf(
				/* translators: %d: number of logos */
				_n( '%d logo fades into this background.', '%d logos fade into this background.', fading.fading, 'werun-blocks-community' ),
				fading.fading
			),
			action: dark
				? { label: __( 'Show the logos in white', 'werun-blocks-community' ), onClick: () => setAttributes( { logoTone: 'light' } ) }
				: { label: __( 'Show the logos in black', 'werun-blocks-community' ), onClick: () => setAttributes( { logoTone: 'dark' } ) },
		};
	} else if ( dark && tone === 'original' && fading.unknown ) {
		// Images from another site can't be read: the decision is the author's.
		toneHint = {
			text: __( 'On a dark background, dark logos can disappear: check them.', 'werun-blocks-community' ),
			action: { label: __( 'Show the logos in white', 'werun-blocks-community' ), onClick: () => setAttributes( { logoTone: 'light' } ) },
		};
	}

	const items = logos.map( ( logo, i ) => <Logo key={ i } logo={ logo } showNames={ a.showNames } position={ i + 1 } /> );

	let body = null;
	if ( logos.length && layout === 'grid' ) {
		body = (
			<ul className="wrbc-logos__list wrbc-logos__grid" role="list">
				{ items.map( ( item, i ) => <li key={ i } className="wrbc-logos__item">{ item }</li> ) }
			</ul>
		);
	} else if ( logos.length && layout === 'marquee' ) {
		body = (
			<div className="wrbc-logos__marquee">
				<span className="wrbc-logos__btn wrbc-logos__pause" aria-hidden="true">
					<Icon icon={ { name: 'pause' } } />
				</span>
				<div className="wrbc-logos__rail">
					{ [ 0, 1 ].map( ( copy ) => (
						<ul key={ copy } className={ cx( 'wrbc-logos__list', copy && 'wrbc-logos__copy' ) } role="list" aria-hidden={ copy ? 'true' : undefined }>
							{ items.map( ( item, i ) => <li key={ i } className="wrbc-logos__item">{ item }</li> ) }
						</ul>
					) ) }
				</div>
			</div>
		);
	} else if ( logos.length ) {
		const controls = hasControls && (
			<div className="wrbc-carousel__controls wrbc-logos__controls" aria-hidden="true">
				{ a.autoplay && (
					<span className="wrbc-carousel__btn wrbc-logos__btn">
						<Icon icon={ { name: 'pause' } } />
					</span>
				) }
				{ a.showDots && (
					<div className="wrbc-carousel__dots wrbc-logos__dots">
						<span className="wrbc-carousel__dot" aria-current="true" />
						<span className="wrbc-carousel__dot" />
					</div>
				) }
				{ a.showArrows && (
					<div className="wrbc-carousel__arrows wrbc-logos__arrows">
						<span className="wrbc-carousel__btn wrbc-logos__btn wrbc-anim-host"><Icon icon={ a.prevIcon } /></span>
						<span className="wrbc-carousel__btn wrbc-logos__btn wrbc-anim-host"><Icon icon={ a.nextIcon } /></span>
					</div>
				) }
			</div>
		);
		body = (
			<div
				className={ `wrbc-logos__carousel is-ready wrbc-carousel--controls-${ a.controlsPosition === 'top' ? 'top' : 'bottom' }` }
				style={ cssVars( {
					'--wrbc-pv-d': clamp( a.columnsDesktop, 1, 8, 6 ),
					'--wrbc-pv-t': clamp( a.columnsTablet, 1, 4, 4 ),
					'--wrbc-pv-m': clamp( a.columnsMobile, 1, 2, 2 ),
				} ) }
			>
				{ a.controlsPosition === 'top' && controls }
				<div className="wrbc-carousel__track wrbc-logos__track">
					{ items.map( ( item, i ) => <div key={ i } className="wrbc-logos__item">{ item }</div> ) }
				</div>
				{ a.controlsPosition !== 'top' && controls }
			</div>
		);
	}

	return (
		<>
			<ContrastAudit
				blockRef={ ref }
				deps={ [ attributes, surface ] }
				labels={ { '.wrbc-logos__name': __( 'Logo names', 'werun-blocks-community' ) } }
				checks={ [
					{ selector: '.wrbc-logos__btn .wrbc-icon', property: 'stroke', min: 3, label: __( 'Pause and arrow icons', 'werun-blocks-community' ) },
					{ selector: '.wrbc-carousel__dot:not([aria-current="true"])', pseudo: '::before', property: 'background-color', min: 3, label: __( 'Carousel dots', 'werun-blocks-community' ) },
					{ selector: '.wrbc-carousel__dot[aria-current="true"]', pseudo: '::before', property: 'background-color', min: 3, label: __( 'Current dot', 'werun-blocks-community' ) },
				] }
			/>
			<BlockControls>
				<ToolbarGroup>
					<MediaUploadCheck>
						<MediaUpload
							allowedTypes={ [ 'image' ] }
							multiple
							onSelect={ ( media ) => setLogos( addMedia( stored, media ) ) }
							render={ ( { open } ) => <ToolbarButton icon="plus-alt2" label={ __( 'Add logos', 'werun-blocks-community' ) } onClick={ open } /> }
						/>
					</MediaUploadCheck>
				</ToolbarGroup>
			</BlockControls>
			<InspectorControls>
				{ toneHint && (
					<div className="wrbc-logos-edit__hint">
						<Notice status="warning" isDismissible={ false } actions={ [ { variant: 'secondary', ...toneHint.action } ] }>
							{ toneHint.text }
						</Notice>
					</div>
				) }
				<LogoList logos={ stored } onChange={ setLogos } showNames={ a.showNames } />
				<PanelBody title={ __( 'Layout', 'werun-blocks-community' ) } initialOpen={ false }>
					<Choice
						label={ __( 'Show as', 'werun-blocks-community' ) }
						value={ layout }
						options={ [
							[ 'grid', __( 'Grid', 'werun-blocks-community' ) ],
							[ 'marquee', __( 'Marquee', 'werun-blocks-community' ) ],
							[ 'carousel', __( 'Carousel', 'werun-blocks-community' ) ],
						] }
						onChange={ ( value ) => setAttributes( { layout: value } ) }
					/>
					{ layout !== 'marquee' && (
						<ResponsiveColumns
							attributes={ a }
							setAttributes={ setAttributes }
							max={ 8 }
							label={ layout === 'carousel' ? __( 'Logos in view', 'werun-blocks-community' ) : __( 'Columns', 'werun-blocks-community' ) }
						/>
					) }
					<RangeControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Gap (px)', 'werun-blocks-community' ) }
						value={ a.gap }
						min={ 0 }
						max={ 120 }
						onChange={ ( gap ) => setAttributes( { gap } ) }
					/>
					{ layout !== 'marquee' && (
						<Choice
							label={ __( 'Logo alignment', 'werun-blocks-community' ) }
							value={ a.itemAlign }
							options={ [
								[ 'left', __( 'Left', 'werun-blocks-community' ) ],
								[ 'center', __( 'Center', 'werun-blocks-community' ) ],
								[ 'right', __( 'Right', 'werun-blocks-community' ) ],
							] }
							onChange={ ( itemAlign ) => setAttributes( { itemAlign } ) }
						/>
					) }
				</PanelBody>
				{ layout === 'marquee' && (
					<PanelBody title={ __( 'Marquee', 'werun-blocks-community' ) } initialOpen={ false }>
						<RangeControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							label={ __( 'Seconds per logo', 'werun-blocks-community' ) }
							help={ __( 'Higher is slower. It pauses on hover and focus, and its pause button shows every logo in a still row, as visitors who ask for reduced motion see it.', 'werun-blocks-community' ) }
							value={ a.marqueeSpeed }
							min={ 1 }
							max={ 10 }
							step={ 0.5 }
							onChange={ ( marqueeSpeed ) => setAttributes( { marqueeSpeed } ) }
						/>
						<Choice
							label={ __( 'Direction', 'werun-blocks-community' ) }
							value={ a.marqueeDirection }
							options={ [
								[ 'left', __( 'To the left', 'werun-blocks-community' ) ],
								[ 'right', __( 'To the right', 'werun-blocks-community' ) ],
							] }
							onChange={ ( marqueeDirection ) => setAttributes( { marqueeDirection } ) }
						/>
					</PanelBody>
				) }
				{ layout === 'carousel' && <CarouselPanel attributes={ a } setAttributes={ setAttributes } /> }
				<PanelBody title={ __( 'Logos style', 'werun-blocks-community' ) } initialOpen={ false }>
					<RangeControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Max height (px)', 'werun-blocks-community' ) }
						value={ a.logoHeight }
						min={ 16 }
						max={ 160 }
						onChange={ ( logoHeight ) => setAttributes( { logoHeight } ) }
					/>
					<RangeControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Max width (px)', 'werun-blocks-community' ) }
						value={ a.logoMaxWidth }
						min={ 40 }
						max={ 400 }
						onChange={ ( logoMaxWidth ) => setAttributes( { logoMaxWidth } ) }
					/>
					<Choice
						label={ __( 'Logo colour', 'werun-blocks-community' ) }
						value={ tone }
						options={ [
							[ 'original', __( 'Original', 'werun-blocks-community' ) ],
							[ 'dark', __( 'Dark', 'werun-blocks-community' ) ],
							[ 'light', __( 'Light', 'werun-blocks-community' ) ],
						] }
						help={ __( 'Dark and Light paint every logo in one flat colour (black or white), so it reads on any background. For logos on a transparent background.', 'werun-blocks-community' ) }
						onChange={ ( logoTone ) => setAttributes( { logoTone } ) }
					/>
					{ /* A flat colour has nothing to turn grey (render.php: $gray). */ }
					{ tone === 'original' && <Toggle attributes={ a } setAttributes={ setAttributes } name="grayscale" label={ __( 'Grayscale', 'werun-blocks-community' ) } /> }
					<RangeControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Opacity (%)', 'werun-blocks-community' ) }
						help={ __( 'At least 50%: dimmer logos fade into the background.', 'werun-blocks-community' ) }
						value={ opacity }
						min={ 50 }
						max={ 100 }
						step={ 5 }
						onChange={ ( value ) => setAttributes( { opacity: value } ) }
					/>
					{ canReveal && (
						<Toggle
							attributes={ a }
							setAttributes={ setAttributes }
							name="hoverReveal"
							label={ tone === 'original' ? __( 'Full colour on hover', 'werun-blocks-community' ) : __( 'Full opacity on hover', 'werun-blocks-community' ) }
						/>
					) }
					<Toggle attributes={ a } setAttributes={ setAttributes } name="showNames" label={ __( 'Names under the logos', 'werun-blocks-community' ) } />
					<Toggle
						attributes={ a }
						setAttributes={ setAttributes }
						name="reveal"
						label={ layout === 'grid' ? __( 'Fade in one after another', 'werun-blocks-community' ) : __( 'Fade in when it scrolls into view', 'werun-blocks-community' ) }
					/>
				</PanelBody>
				<SectionHeaderPanel attributes={ a } setAttributes={ setAttributes } />
				<PanelColorSettings
					title={ __( 'Colors', 'werun-blocks-community' ) }
					initialOpen={ false }
					colorSettings={ [
						{
							value: a.accentColor,
							onChange: ( accentColor ) => setAttributes( { accentColor } ),
							// What the accent paints: the eyebrow (shared header), the focus ring, the carousel's current dot.
							label: layout === 'carousel' ? __( 'Accent (eyebrow, dots, focus)', 'werun-blocks-community' ) : __( 'Accent (eyebrow, focus)', 'werun-blocks-community' ),
						},
					] }
				/>
			</InspectorControls>

			<section { ...blockProps }>
				<SectionHeader attributes={ a } setAttributes={ setAttributes } uid={ uid } />
				{ body || (
					<MediaPlaceholder
						icon="images-alt2"
						labels={ {
							title: __( 'Logos', 'werun-blocks-community' ),
							instructions: __( 'Pick or upload one or several logos. Nothing shows on the page until there is at least one.', 'werun-blocks-community' ),
						} }
						accept="image/*"
						allowedTypes={ [ 'image' ] }
						multiple
						onSelect={ ( media ) => setLogos( addMedia( stored, media ) ) }
					/>
				) }
			</section>
		</>
	);
}
