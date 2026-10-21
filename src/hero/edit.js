import { __, sprintf } from '@wordpress/i18n';
import { useRef } from '@wordpress/element';
import {
	BlockControls,
	InspectorControls,
	MediaPlaceholder,
	MediaReplaceFlow,
	MediaUpload,
	MediaUploadCheck,
	PanelColorSettings,
	RichText,
	useBlockProps,
} from '@wordpress/block-editor';
import {
	Button,
	Notice,
	PanelBody,
	RangeControl,
	SelectControl,
	TextareaControl,
	ToolbarButton,
} from '@wordpress/components';
import { Icon } from '../shared/icons';
import { IconControl } from '../shared/IconControl';
import { ContrastAudit } from '../shared/a11y';
import {
	accentVars,
	blockColors,
	colorHex,
	colorOver,
	colorRgba,
	contrastRatio,
	isDarkColor,
	minOverlayOpacity,
	onColor,
	overlayOpacity,
	toneClass,
	useContextBackground,
	useSurface,
} from '../shared/contrast';
import { Choice, cssVars, cx, IconSizeControls, LinkFields, OverlayOpacityControl, px, Toggle } from '../shared/controls';

const RADIUS = { pill: '999px', rounded: '10px', square: '0px' };

/** A button URL that is no link on the page: '', '#' or a refused scheme (render.php's $has_url()). */
const noUrl = ( url ) => {
	const u = typeof url === 'string' ? url.trim() : '';
	return ! u || u === '#' || /^(javascript|data|vbscript):/i.test( u );
};

/** Over a background image: the overlay at its opacity over the image pixel that's worse for the text (render.php twin). */
function imageSurface( overlay, opacity, text ) {
	const rgba = colorRgba( overlay );
	const layer = [ rgba[ 0 ], rgba[ 1 ], rgba[ 2 ], opacity / 100 ];
	const onWhite = colorOver( layer, [ 255, 255, 255, 1 ] );
	const onBlack = colorOver( layer, [ 0, 0, 0, 1 ] );
	return colorHex( contrastRatio( text, onWhite ) <= contrastRatio( text, onBlack ) ? onWhite : onBlack );
}

export default function Edit( { attributes, setAttributes, clientId, name } ) {
	const a = attributes;
	const ref = useRef();
	const uid = `wrbc-hero-${ clientId.slice( 0, 8 ) }`;
	const hasMedia = a.showMedia && ( a.mediaId || a.mediaUrl );
	const ratio = Math.max( 30, Math.min( 70, a.splitRatio || 55 ) );
	// Same clamp as render.php: H1 to H3.
	const level = Math.max( 1, Math.min( 3, Number( a.headingLevel ) || 1 ) );
	// Same rule as render.php: a video background shows its own poster, else the background image.
	const hasVideo = !! ( a.bgVideoUrl || a.bgVideoId );
	const bgStill = ( hasVideo && a.bgVideoPosterUrl ) || a.bgImageUrl;
	const hasBg = !! a.bgImageUrl || hasVideo;
	const controlsPos = [ 'bottom-right', 'bottom-left', 'top-right', 'top-left' ].includes( a.bgVideoControls ) ? a.bgVideoControls : 'bottom-right';

	// Colours: the same rules as render.php (docs/accessibility.md). Over an
	// image the text is the chosen colour, else the overlay's own; the overlay
	// never goes under the floor that text needs; the colours are checked
	// against the overlay over the worse image pixel.
	// Without a background the stored keys must not read as one (render.php twin: the hero is stricter than hasBackgroundMedia()).
	const ownSurface = useSurface(
		clientId,
		hasBg ? attributes : { ...attributes, bgImageId: undefined, bgImageUrl: undefined, bgVideoId: undefined, bgVideoUrl: undefined },
		name
	);
	const around = useContextBackground( clientId );
	const overlayRgba = colorRgba( typeof a.overlayColor === 'string' ? a.overlayColor : '' );
	const overlay = overlayRgba ? colorHex( [ overlayRgba[ 0 ], overlayRgba[ 1 ], overlayRgba[ 2 ], 1 ] ) : '#000000';
	const chosenText = blockColors( attributes ).text;
	const imageText = chosenText || onColor( overlay );
	const overlayO = overlayOpacity( a.overlayOpacity ?? 55, imageText, overlay );
	const surface = hasBg ? imageSurface( overlay, overlayO, imageText ) : ownSurface;
	let tone = toneClass( surface, around );
	if ( hasBg && ! tone && isDarkColor( surface ) === false ) {
		tone = 'wrbc-is-light'; // a light overlay keeps its dark text on a light page too
	}
	// One-click fix for the contrast warning: a chosen text colour no overlay can make readable.
	const textOnImageFails = hasBg && !! chosenText && minOverlayOpacity( chosenText, overlay ) > 95;
	const clearTextColor = () =>
		setAttributes( { textColor: undefined, style: { ...( a.style || {} ), color: { ...( a.style?.color || {} ), text: undefined } } } );
	// Buttons without a URL print as text on the page (render.php).
	const priNoUrl = a.showPrimary && noUrl( a.primaryUrl );
	const secNoUrl = a.showSecondary && noUrl( a.secondaryUrl );
	const noUrlNotice = __( 'No link yet: on the page this button shows as text, not as a link.', 'werun-blocks-community' );

	const blockProps = useBlockProps( {
		ref,
		className: cx(
			'wrbc-root wrbc-hero',
			`wrbc-hero--${ a.layout }`,
			`wrbc-hero--media-${ a.mediaPosition }`,
			`wrbc-hero--valign-${ a.verticalAlign }`,
			a.showMedia && 'has-media',
			a.mobileMediaFirst && 'wrbc-hero--mobile-media-first',
			hasBg && 'has-bg-image',
			hasVideo && 'has-bg-video',
			// Same rule as render.php: room for the pause button on its side.
			hasVideo && `wrbc-hero--toggle-${ controlsPos.startsWith( 'top' ) ? 'top' : 'bottom' }`,
			hasVideo && a.bgVideoMobile === false && 'wrbc-hero--video-no-mobile',
			tone
		),
		style: cssVars( {
			// Same as render.php: accent, label, hover fill, accent as text.
			...accentVars( a, surface ),
			// Same ranges as render.php.
			'--wrbc-icon-size': px( Math.max( 12, Math.min( 32, Number( a.iconSize ) || 0 ) ) ),
			'--wrbc-icon-stroke': Math.max( 1, Math.min( 3, Number( a.iconStroke ) || 0 ) ),
			'--wrbc-btn-radius': RADIUS[ a.buttonShape ],
			'--wrbc-split-a': `${ ratio }fr`,
			'--wrbc-split-b': `${ 100 - ratio }fr`,
			'--wrbc-hero-max': px( Math.max( 640, Math.min( 1600, Number( a.contentWidth ) || 1200 ) ) ),
			'--wrbc-hero-min-h':
				a.minHeight > 0 ? `${ Math.min( a.minHeight, a.minHeightUnit === 'px' ? 2000 : 100 ) }${ a.minHeightUnit === 'px' ? 'px' : 'vh' }` : undefined,
			'--wrbc-media-ratio': /^\d+\/\d+$/.test( a.mediaRatio || '' ) ? a.mediaRatio.replace( '/', ' / ' ) : undefined,
			'--wrbc-media-fit': a.mediaFit,
			'--wrbc-overlay': overlay,
			'--wrbc-overlay-o': overlayO / 100,
		} ),
	} );

	const setList = ( key, index, patch ) =>
		setAttributes( { [ key ]: a[ key ].map( ( item, i ) => ( i === index ? { ...item, ...patch } : item ) ) } );
	const removeFrom = ( key, index ) => setAttributes( { [ key ]: a[ key ].filter( ( _, i ) => i !== index ) } );
	// A new image brings its own alt text: the old one described another picture.
	const onSelectMedia = ( media ) => setAttributes( { mediaId: media?.id, mediaUrl: media?.url, mediaAlt: media?.alt || '' } );
	// "Remove" in IconControl sends undefined, which would bring the default icon
	// back on reload; an empty object keeps the part without an icon.
	const setIcon = ( key ) => ( value ) => setAttributes( { [ key ]: value?.name ? value : {} } );
	const setMinHeightUnit = ( minHeightUnit ) =>
		setAttributes( { minHeightUnit, ...( minHeightUnit === 'vh' && a.minHeight > 100 && { minHeight: 100 } ) } );

	const isSplit = a.layout === 'split' && a.showMedia;
	const hasButtons = a.showPrimary || a.showSecondary;
	const hasIcons =
		( a.showEyebrow && a.eyebrowIcon?.name ) ||
		( a.showPoints && a.pointsIcon?.name ) ||
		( a.showPrimary && a.primaryIcon?.name ) ||
		( a.showSecondary && a.secondaryIcon?.name );
	const colorSettings = [
		( hasButtons || hasIcons ) && {
			value: a.accentColor,
			onChange: ( accentColor ) => setAttributes( { accentColor } ),
			label: __( 'Accent (buttons, icons)', 'werun-blocks-community' ),
		},
		a.showPrimary && {
			value: a.onAccentColor,
			onChange: ( onAccentColor ) => setAttributes( { onAccentColor } ),
			label: __( 'Text on the accent', 'werun-blocks-community' ),
		},
		hasBg && {
			value: a.overlayColor,
			onChange: ( overlayColor ) => setAttributes( { overlayColor } ),
			label: __( 'Overlay', 'werun-blocks-community' ),
		},
	].filter( Boolean );

	return (
		<>
			<ContrastAudit
				blockRef={ ref }
				deps={ [ attributes, surface, around ] }
				actions={ [
					textOnImageFails && {
						label: __( 'Use the overlay’s own text colour', 'werun-blocks-community' ),
						onClick: clearTextColor,
					},
				] }
			/>
			<BlockControls group="other">
				{ hasMedia && (
					<MediaReplaceFlow
						mediaId={ a.mediaId }
						mediaURL={ a.mediaUrl }
						allowedTypes={ [ 'image' ] }
						accept="image/*"
						onSelect={ onSelectMedia }
						name={ __( 'Replace image', 'werun-blocks-community' ) }
					/>
				) }
				<ToolbarButton
					icon={ a.layout === 'split' ? 'align-center' : 'columns' }
					label={ a.layout === 'split' ? __( 'Centre the layout', 'werun-blocks-community' ) : __( 'Split the layout', 'werun-blocks-community' ) }
					onClick={ () => setAttributes( { layout: a.layout === 'split' ? 'centered' : 'split' } ) }
				/>
			</BlockControls>

			<InspectorControls>
				<PanelBody title={ __( 'Layout', 'werun-blocks-community' ) }>
					<Choice
						label={ __( 'Layout', 'werun-blocks-community' ) }
						value={ a.layout }
						options={ [
							[ 'split', __( 'Split', 'werun-blocks-community' ) ],
							[ 'centered', __( 'Centred', 'werun-blocks-community' ) ],
						] }
						onChange={ ( layout ) => setAttributes( { layout } ) }
					/>
					{ isSplit && (
						<>
							<Choice
								label={ __( 'Image side', 'werun-blocks-community' ) }
								value={ a.mediaPosition }
								options={ [
									[ 'left', __( 'Left', 'werun-blocks-community' ) ],
									[ 'right', __( 'Right', 'werun-blocks-community' ) ],
								] }
								onChange={ ( mediaPosition ) => setAttributes( { mediaPosition } ) }
							/>
							<RangeControl
								__nextHasNoMarginBottom
								__next40pxDefaultSize
								label={ __( 'Text column width (%)', 'werun-blocks-community' ) }
								value={ a.splitRatio }
								min={ 30 }
								max={ 70 }
								onChange={ ( splitRatio ) => setAttributes( { splitRatio } ) }
							/>
						</>
					) }
					{ a.showMedia && (
						<Toggle attributes={ a } setAttributes={ setAttributes } name="mobileMediaFirst" label={ __( 'Image first on phones', 'werun-blocks-community' ) } />
					) }
					{ ( isSplit || a.minHeight > 0 ) && (
						<Choice
							label={ __( 'Vertical alignment', 'werun-blocks-community' ) }
							value={ a.verticalAlign }
							options={ [
								[ 'start', __( 'Top', 'werun-blocks-community' ) ],
								[ 'center', __( 'Middle', 'werun-blocks-community' ) ],
								[ 'end', __( 'Bottom', 'werun-blocks-community' ) ],
							] }
							onChange={ ( verticalAlign ) => setAttributes( { verticalAlign } ) }
						/>
					) }
					<RangeControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Content width (px)', 'werun-blocks-community' ) }
						value={ a.contentWidth }
						min={ 640 }
						max={ 1600 }
						step={ 20 }
						onChange={ ( contentWidth ) => setAttributes( { contentWidth } ) }
					/>
					<div className="wrbc-panel-row">
						<RangeControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							label={ __( 'Minimum height (0 = auto)', 'werun-blocks-community' ) }
							value={ a.minHeight }
							min={ 0 }
							max={ a.minHeightUnit === 'vh' ? 100 : 1200 }
							onChange={ ( minHeight ) => setAttributes( { minHeight } ) }
						/>
						<SelectControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							label={ __( 'Unit', 'werun-blocks-community' ) }
							value={ a.minHeightUnit }
							options={ [
								{ value: 'vh', label: 'vh' },
								{ value: 'px', label: 'px' },
							] }
							onChange={ setMinHeightUnit }
						/>
					</div>
					<Toggle attributes={ a } setAttributes={ setAttributes } name="reveal" label={ __( 'Fade in when it scrolls into view', 'werun-blocks-community' ) } />
				</PanelBody>

				<PanelBody title={ __( 'Elements', 'werun-blocks-community' ) } initialOpen={ false }>
					<Toggle attributes={ a } setAttributes={ setAttributes } name="showEyebrow" label={ __( 'Eyebrow', 'werun-blocks-community' ) } />
					<Toggle attributes={ a } setAttributes={ setAttributes } name="showText" label={ __( 'Text', 'werun-blocks-community' ) } />
					<Toggle attributes={ a } setAttributes={ setAttributes } name="showPoints" label={ __( 'Checklist', 'werun-blocks-community' ) } />
					<Toggle attributes={ a } setAttributes={ setAttributes } name="showPrimary" label={ __( 'Main button', 'werun-blocks-community' ) } />
					<Toggle attributes={ a } setAttributes={ setAttributes } name="showSecondary" label={ __( 'Second button', 'werun-blocks-community' ) } />
					<Toggle attributes={ a } setAttributes={ setAttributes } name="showStats" label={ __( 'Figures', 'werun-blocks-community' ) } />
					<Toggle attributes={ a } setAttributes={ setAttributes } name="showMedia" label={ __( 'Image', 'werun-blocks-community' ) } />
					<Choice
						label={ __( 'Heading level', 'werun-blocks-community' ) }
						help={ __( 'One H1 per page: if the theme already shows the page title as H1, choose H2.', 'werun-blocks-community' ) }
						value={ String( level ) }
						options={ [
							[ '1', 'H1' ],
							[ '2', 'H2' ],
							[ '3', 'H3' ],
						] }
						onChange={ ( value ) => setAttributes( { headingLevel: Number( value ) } ) }
					/>
				</PanelBody>

				{ a.showEyebrow && (
					<PanelBody title={ __( 'Eyebrow', 'werun-blocks-community' ) } initialOpen={ false }>
						<Choice
							label={ __( 'Style', 'werun-blocks-community' ) }
							value={ a.eyebrowStyle }
							options={ [
								[ 'pill', __( 'Pill', 'werun-blocks-community' ) ],
								[ 'plain', __( 'Plain', 'werun-blocks-community' ) ],
							] }
							onChange={ ( eyebrowStyle ) => setAttributes( { eyebrowStyle } ) }
						/>
						<IconControl label={ __( 'Icon', 'werun-blocks-community' ) } value={ a.eyebrowIcon } onChange={ setIcon( 'eyebrowIcon' ) } />
					</PanelBody>
				) }

				{ a.showPoints && (
					<PanelBody title={ __( 'Checklist', 'werun-blocks-community' ) } initialOpen={ false }>
						<IconControl label={ __( 'Icon for every line', 'werun-blocks-community' ) } value={ a.pointsIcon } onChange={ setIcon( 'pointsIcon' ) } />
						<div className="wrbc-panel-list">
							{ a.points.map( ( point, index ) => (
								<div className="wrbc-panel-row" key={ index }>
									<span>{ sprintf( /* translators: %d: line number */ __( 'Line %d', 'werun-blocks-community' ), index + 1 ) }</span>
									<Button size="small" variant="tertiary" isDestructive onClick={ () => removeFrom( 'points', index ) }>
										{ __( 'Remove', 'werun-blocks-community' ) }
									</Button>
								</div>
							) ) }
							<Button variant="secondary" onClick={ () => setAttributes( { points: [ ...a.points, { text: __( 'Another reason', 'werun-blocks-community' ) } ] } ) }>
								{ __( 'Add a line', 'werun-blocks-community' ) }
							</Button>
						</div>
					</PanelBody>
				) }

				{ hasButtons && (
					<PanelBody title={ __( 'Buttons', 'werun-blocks-community' ) } initialOpen={ !! ( priNoUrl || secNoUrl ) }>
						<Choice
							label={ __( 'Shape', 'werun-blocks-community' ) }
							value={ a.buttonShape }
							options={ [
								[ 'pill', __( 'Pill', 'werun-blocks-community' ) ],
								[ 'rounded', __( 'Rounded', 'werun-blocks-community' ) ],
								[ 'square', __( 'Square', 'werun-blocks-community' ) ],
							] }
							onChange={ ( buttonShape ) => setAttributes( { buttonShape } ) }
						/>
						{ a.showPrimary && (
							<>
								<p className="wrbc-control-label">{ __( 'Main button', 'werun-blocks-community' ) }</p>
								<LinkFields
									url={ a.primaryUrl }
									newTab={ a.primaryNewTab }
									onChange={ ( v ) => setAttributes( { ...( 'url' in v && { primaryUrl: v.url } ), ...( 'newTab' in v && { primaryNewTab: v.newTab } ) } ) }
								/>
								{ priNoUrl && (
									<Notice status="warning" isDismissible={ false }>
										{ noUrlNotice }
									</Notice>
								) }
								<IconControl label={ __( 'Icon', 'werun-blocks-community' ) } value={ a.primaryIcon } onChange={ setIcon( 'primaryIcon' ) } />
							</>
						) }
						{ a.showSecondary && (
							<>
								<p className="wrbc-control-label">{ __( 'Second button', 'werun-blocks-community' ) }</p>
								<LinkFields
									url={ a.secondaryUrl }
									newTab={ a.secondaryNewTab }
									onChange={ ( v ) => setAttributes( { ...( 'url' in v && { secondaryUrl: v.url } ), ...( 'newTab' in v && { secondaryNewTab: v.newTab } ) } ) }
								/>
								{ secNoUrl && (
									<Notice status="warning" isDismissible={ false }>
										{ noUrlNotice }
									</Notice>
								) }
								<IconControl label={ __( 'Icon', 'werun-blocks-community' ) } value={ a.secondaryIcon } onChange={ setIcon( 'secondaryIcon' ) } />
							</>
						) }
					</PanelBody>
				) }

				{ a.showStats && (
					<PanelBody title={ __( 'Figures', 'werun-blocks-community' ) } initialOpen={ false }>
						<div className="wrbc-panel-list">
							{ a.stats.map( ( stat, index ) => (
								<div className="wrbc-panel-row" key={ index }>
									<span>{ stat.value || sprintf( /* translators: %d: figure number */ __( 'Figure %d', 'werun-blocks-community' ), index + 1 ) }</span>
									<Button size="small" variant="tertiary" isDestructive onClick={ () => removeFrom( 'stats', index ) }>
										{ __( 'Remove', 'werun-blocks-community' ) }
									</Button>
								</div>
							) ) }
							{ a.stats.length < 4 && (
								<Button variant="secondary" onClick={ () => setAttributes( { stats: [ ...a.stats, { value: '0', label: __( 'Label', 'werun-blocks-community' ) } ] } ) }>
									{ __( 'Add a figure', 'werun-blocks-community' ) }
								</Button>
							) }
						</div>
					</PanelBody>
				) }

				{ a.showMedia && (
					<PanelBody title={ __( 'Image', 'werun-blocks-community' ) } initialOpen={ false }>
						<TextareaControl
							__nextHasNoMarginBottom
							label={ __( 'Alternative text', 'werun-blocks-community' ) }
							help={ __( 'Describe the image for people who cannot see it. Leave empty if it is decorative.', 'werun-blocks-community' ) }
							value={ a.mediaAlt }
							onChange={ ( mediaAlt ) => setAttributes( { mediaAlt } ) }
						/>
						<SelectControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							label={ __( 'Aspect ratio', 'werun-blocks-community' ) }
							value={ a.mediaRatio }
							options={ [
								{ value: 'auto', label: __( 'Original', 'werun-blocks-community' ) },
								{ value: '1/1', label: '1:1' },
								{ value: '4/3', label: '4:3' },
								{ value: '3/4', label: '3:4' },
								{ value: '16/9', label: '16:9' },
								{ value: '4/5', label: '4:5' },
							] }
							onChange={ ( mediaRatio ) => setAttributes( { mediaRatio } ) }
						/>
						{ a.mediaRatio !== 'auto' && (
							<Choice
								label={ __( 'Fit', 'werun-blocks-community' ) }
								value={ a.mediaFit }
								options={ [
									[ 'cover', __( 'Fill', 'werun-blocks-community' ) ],
									[ 'contain', __( 'Fit', 'werun-blocks-community' ) ],
								] }
								onChange={ ( mediaFit ) => setAttributes( { mediaFit } ) }
							/>
						) }
						{ hasMedia && (
							<Button variant="secondary" isDestructive onClick={ () => setAttributes( { mediaId: undefined, mediaUrl: undefined } ) }>
								{ __( 'Remove image', 'werun-blocks-community' ) }
							</Button>
						) }
					</PanelBody>
				) }

				<PanelBody title={ __( 'Background', 'werun-blocks-community' ) } initialOpen={ false }>
					<p className="wrbc-control-label">{ __( 'Image', 'werun-blocks-community' ) }</p>
					<MediaUploadCheck>
						<MediaUpload
							allowedTypes={ [ 'image' ] }
							value={ a.bgImageId }
							onSelect={ ( media ) => setAttributes( { bgImageId: media.id, bgImageUrl: media.url } ) }
							render={ ( { open } ) => (
								<Button variant="secondary" onClick={ open }>
									{ a.bgImageUrl ? __( 'Replace background', 'werun-blocks-community' ) : __( 'Choose a background', 'werun-blocks-community' ) }
								</Button>
							) }
						/>
					</MediaUploadCheck>
					{ a.bgImageUrl && (
						<Button variant="tertiary" isDestructive onClick={ () => setAttributes( { bgImageId: undefined, bgImageUrl: undefined } ) }>
							{ __( 'Remove background', 'werun-blocks-community' ) }
						</Button>
					) }
					<p className="wrbc-control-label">{ __( 'Video', 'werun-blocks-community' ) }</p>
					<MediaUploadCheck>
						<MediaUpload
							allowedTypes={ [ 'video' ] }
							value={ a.bgVideoId }
							onSelect={ ( media ) => setAttributes( { bgVideoId: media?.id, bgVideoUrl: media?.url || '' } ) }
							render={ ( { open } ) => (
								<Button variant="secondary" onClick={ open }>
									{ hasVideo ? __( 'Replace video', 'werun-blocks-community' ) : __( 'Choose a video', 'werun-blocks-community' ) }
								</Button>
							) }
						/>
					</MediaUploadCheck>
					{ hasVideo && (
						<>
							<Button variant="tertiary" isDestructive onClick={ () => setAttributes( { bgVideoId: undefined, bgVideoUrl: '' } ) }>
								{ __( 'Remove video', 'werun-blocks-community' ) }
							</Button>
							<p className="components-base-control__help">
								{ __( 'Muted and looping, with a pause button. Visitors who prefer reduced motion or save data see the poster instead.', 'werun-blocks-community' ) }{ ' ' }
								{ __( 'It plays without sound or captions, so use it as decoration: keep every message in the text.', 'werun-blocks-community' ) }
							</p>
							<p className="wrbc-control-label">{ __( 'Poster', 'werun-blocks-community' ) }</p>
							<MediaUploadCheck>
								<MediaUpload
									allowedTypes={ [ 'image' ] }
									value={ a.bgVideoPosterId }
									onSelect={ ( media ) => setAttributes( { bgVideoPosterId: media?.id, bgVideoPosterUrl: media?.url || '' } ) }
									render={ ( { open } ) => (
										<Button variant="secondary" onClick={ open }>
											{ a.bgVideoPosterUrl ? __( 'Replace poster', 'werun-blocks-community' ) : __( 'Choose a poster', 'werun-blocks-community' ) }
										</Button>
									) }
								/>
							</MediaUploadCheck>
							{ a.bgVideoPosterUrl ? (
								<Button variant="tertiary" isDestructive onClick={ () => setAttributes( { bgVideoPosterId: undefined, bgVideoPosterUrl: '' } ) }>
									{ __( 'Remove poster', 'werun-blocks-community' ) }
								</Button>
							) : (
								<p className="components-base-control__help">
									{ a.bgImageUrl
										? __( 'Without a poster, the background image is shown until the video plays.', 'werun-blocks-community' )
										: __( 'Choose a poster or a background image: it is what visitors see before the video plays, or instead of it.', 'werun-blocks-community' ) }
								</p>
							) }
							<SelectControl
								__nextHasNoMarginBottom
								__next40pxDefaultSize
								label={ __( 'Pause button position', 'werun-blocks-community' ) }
								value={ controlsPos }
								options={ [
									{ value: 'bottom-right', label: __( 'Bottom right', 'werun-blocks-community' ) },
									{ value: 'bottom-left', label: __( 'Bottom left', 'werun-blocks-community' ) },
									{ value: 'top-right', label: __( 'Top right', 'werun-blocks-community' ) },
									{ value: 'top-left', label: __( 'Top left', 'werun-blocks-community' ) },
								] }
								onChange={ ( bgVideoControls ) => setAttributes( { bgVideoControls } ) }
							/>
							<Toggle
								attributes={ a }
								setAttributes={ setAttributes }
								name="bgVideoMobile"
								label={ __( 'Play on phones', 'werun-blocks-community' ) }
								help={ __( 'Off: phones (under 768 px) show the poster and don’t download the video.', 'werun-blocks-community' ) }
							/>
						</>
					) }
					{ hasBg && (
						// Starts at the opacity that keeps the text readable over any image (render.php clamps the same way).
						<OverlayOpacityControl
							value={ a.overlayOpacity }
							onChange={ ( overlayOpacity ) => setAttributes( { overlayOpacity } ) }
							overlayColor={ overlay }
							textColor={ imageText }
							max={ 95 }
						/>
					) }
				</PanelBody>

				{ colorSettings.length > 0 && (
					<PanelColorSettings
						title={ hasBg ? __( 'Accent and overlay', 'werun-blocks-community' ) : __( 'Accent', 'werun-blocks-community' ) }
						initialOpen={ false }
						colorSettings={ colorSettings }
					/>
				) }
				{ hasIcons && (
					<PanelBody title={ __( 'Icons', 'werun-blocks-community' ) } initialOpen={ false }>
						<IconSizeControls attributes={ a } setAttributes={ setAttributes } maxSize={ 32 } />
					</PanelBody>
				) }
			</InspectorControls>

			<section { ...blockProps } aria-labelledby={ `${ uid }-heading` }>
				{ hasBg && (
					<>
						{ bgStill && <img className="wrbc-hero__bg" src={ bgStill } alt="" data-wrbc-backdrop="image" /> }
						{ hasVideo && (
							<div className="wrbc-hero__video" data-wrbc-backdrop="image">
								<video className="wrbc-video__bg wrbc-hero__bg-video" src={ a.bgVideoUrl } muted loop playsInline autoPlay aria-hidden="true" tabIndex={ -1 } />
								<span className={ `wrbc-hero__video-toggle wrbc-hero__video-toggle--${ controlsPos }` } aria-hidden="true">
									<svg className="wrbc-hero__video-pause" viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false">
										<rect x="6" y="5" width="4" height="14" rx="1" />
										<rect x="14" y="5" width="4" height="14" rx="1" />
									</svg>
								</span>
							</div>
						) }
						<span className="wrbc-hero__overlay" data-wrbc-backdrop="overlay" aria-hidden="true" />
					</>
				) }
				<div className="wrbc-hero__inner">
					<div className="wrbc-hero__content">
						{ a.showEyebrow && (
							<p className={ `wrbc-hero__eyebrow wrbc-hero__eyebrow--${ a.eyebrowStyle } wrbc-anim-host` }>
								<Icon icon={ a.eyebrowIcon } />
								<RichText
									tagName="span"
									value={ a.eyebrow }
									onChange={ ( eyebrow ) => setAttributes( { eyebrow } ) }
									placeholder={ __( 'Eyebrow', 'werun-blocks-community' ) }
									allowedFormats={ [ 'core/bold', 'core/italic' ] }
								/>
							</p>
						) }
						<RichText
							tagName={ `h${ level }` }
							className="wrbc-hero__heading"
							id={ `${ uid }-heading` }
							value={ a.heading }
							onChange={ ( heading ) => setAttributes( { heading } ) }
							placeholder={ __( 'Heading', 'werun-blocks-community' ) }
						/>
						{ a.showText && (
							<RichText
								tagName="p"
								className="wrbc-hero__text"
								value={ a.text }
								onChange={ ( text ) => setAttributes( { text } ) }
								placeholder={ __( 'Text', 'werun-blocks-community' ) }
							/>
						) }
						{ a.showPoints && (
							<ul className="wrbc-hero__points" role="list">
								{ a.points.map( ( point, index ) => (
									<li className="wrbc-hero__point" key={ index }>
										<Icon icon={ a.pointsIcon } />
										<RichText
											tagName="span"
											value={ point.text }
											onChange={ ( text ) => setList( 'points', index, { text } ) }
											placeholder={ __( 'A reason', 'werun-blocks-community' ) }
											allowedFormats={ [ 'core/bold', 'core/italic', 'core/link' ] }
										/>
									</li>
								) ) }
							</ul>
						) }
						{ ( a.showPrimary || a.showSecondary ) && (
							<div className="wrbc-hero__actions">
								{ a.showPrimary && (
									<span className={ cx( 'wrbc-btn wrbc-hero__btn', priNoUrl ? 'wrbc-hero__btn--static is-missing-url' : 'wrbc-anim-host' ) }>
										<RichText
											tagName="span"
											value={ a.primaryLabel }
											onChange={ ( primaryLabel ) => setAttributes( { primaryLabel } ) }
											placeholder={ __( 'Button', 'werun-blocks-community' ) }
											allowedFormats={ [] }
										/>
										<Icon icon={ a.primaryIcon } />
									</span>
								) }
								{ a.showSecondary && (
									<span className={ cx( 'wrbc-btn wrbc-btn--outline wrbc-hero__btn', secNoUrl ? 'wrbc-hero__btn--static is-missing-url' : 'wrbc-anim-host' ) }>
										<Icon icon={ a.secondaryIcon } />
										<RichText
											tagName="span"
											value={ a.secondaryLabel }
											onChange={ ( secondaryLabel ) => setAttributes( { secondaryLabel } ) }
											placeholder={ __( 'Button', 'werun-blocks-community' ) }
											allowedFormats={ [] }
										/>
									</span>
								) }
							</div>
						) }
						{ a.showStats && (
							<dl className="wrbc-hero__stats">
								{ a.stats.map( ( stat, index ) => (
									<div className="wrbc-hero__stat" key={ index }>
										<RichText
											tagName="dt"
											className="wrbc-hero__stat-label"
											value={ stat.label }
											onChange={ ( label ) => setList( 'stats', index, { label } ) }
											placeholder={ __( 'Label', 'werun-blocks-community' ) }
											allowedFormats={ [] }
										/>
										<RichText
											tagName="dd"
											className="wrbc-hero__stat-value"
											value={ stat.value }
											onChange={ ( value ) => setList( 'stats', index, { value } ) }
											placeholder="0"
											allowedFormats={ [] }
										/>
									</div>
								) ) }
							</dl>
						) }
					</div>

					{ a.showMedia && (
						<figure className="wrbc-hero__media">
							{ hasMedia ? (
								<img className="wrbc-hero__img" src={ a.mediaUrl } alt={ a.mediaAlt } />
							) : (
								<MediaPlaceholder
									icon="format-image"
									labels={ { title: __( 'Hero image', 'werun-blocks-community' ) } }
									accept="image/*"
									allowedTypes={ [ 'image' ] }
									onSelect={ onSelectMedia }
								/>
							) }
						</figure>
					) }
				</div>
			</section>
		</>
	);
}
