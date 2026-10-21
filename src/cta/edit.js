import { __ } from '@wordpress/i18n';
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
import { Button, Notice, PanelBody, RangeControl, SelectControl, TextareaControl } from '@wordpress/components';
import { useRef } from '@wordpress/element';
import { Icon } from '../shared/icons';
import { IconControl } from '../shared/IconControl';
import { Choice, cssVars, cx, IconSizeControls, LinkFields, OverlayOpacityControl, px, Toggle } from '../shared/controls';
import {
	AA_TEXT,
	AA_UI,
	ACCENT,
	INK,
	PAPER,
	accentVars,
	blockColors,
	blockSurface,
	colorHex,
	colorOver,
	colorRgba,
	contrastRatio,
	isDarkColor,
	onColor,
	overlayOpacity,
	readableColor,
	toneClass,
	useContextBackground,
	useSurface,
} from '../shared/contrast';
import { ContrastAudit } from '../shared/a11y';

const RADIUS = { pill: '999px', rounded: '10px', square: '0px' };
const RATIOS = [ '1/1', '4/3', '3/2', '16/9', '3/4' ];
const plain = ( value ) => ( typeof value === 'string' ? value.replace( /<[^>]*>/g, '' ).trim() : '' );
// The schemes esc_url() keeps: a URL with any other one is no link on the page.
const PROTOCOLS = [ 'http', 'https', 'ftp', 'ftps', 'mailto', 'news', 'irc', 'irc6', 'ircs', 'gopher', 'nntp', 'feed', 'telnet', 'mms', 'rtsp', 'sms', 'svn', 'tel', 'fax', 'xmpp', 'webcal', 'urn' ];
/** Whether a button gets a link on the page ("#" goes nowhere): render.php's $button. */
const isLink = ( url ) => {
	const u = typeof url === 'string' ? url.trim() : '';
	const scheme = u.match( /^([a-z][a-z0-9+.-]*):/i );
	return !! u && u !== '#' && ( ! scheme || PROTOCOLS.includes( scheme[ 1 ].toLowerCase() ) );
};
/** Share of the text colour that secondary text needs on a colour the block paints (render.php $muted_for). */
const mutedFor = ( fg, bg ) => {
	const text = fg && bg ? colorRgba( fg ) : null;
	let pct = 0;
	for ( let p = 76; text && p <= 100; p++ ) {
		pct = p;
		if ( contrastRatio( [ text[ 0 ], text[ 1 ], text[ 2 ], p / 100 ], bg ) >= AA_TEXT ) {
			break;
		}
	}
	return pct > 76 ? pct : 0;
};

export default function Edit( { attributes, setAttributes, clientId } ) {
	const a = attributes;
	const uid = `wrbc-cta-${ clientId.slice( 0, 8 ) }`;

	// The same rules as render.php: an image only in the split and centred
	// layouts, alignment only for the card, image side only for split.
	const layout = [ 'centered', 'split', 'strip', 'card' ].includes( a.layout ) ? a.layout : 'centered';
	const mediaOk = layout === 'split' || layout === 'centered';
	const hasMediaFile = !! ( a.mediaId || a.mediaUrl );
	const showImg = mediaOk && a.showMedia && hasMediaFile;
	// Editor only: the empty image placeholder takes the image's place, so the
	// layout (and the image-side controls) already apply before one is chosen.
	const mediaSlot = mediaOk && a.showMedia;
	const align = layout === 'card' ? ( a.contentAlign === 'left' ? 'left' : 'center' ) : layout === 'centered' ? 'center' : 'left';
	const ratio = RATIOS.includes( a.mediaRatio ) ? a.mediaRatio : 'auto';
	const width = Math.max( 480, Math.min( 1600, Number( a.contentWidth ) || 1100 ) );
	const level = Math.max( 2, Math.min( 4, Number( a.titleLevel ) || 2 ) );
	const hasBgImage = !! a.bgImageUrl;
	// Centred shows the image above the text, first in the markup too (render.php: $media_first).
	const mediaFirst = layout === 'centered';
	const hasIcons =
		( a.showEyebrow && a.eyebrowIcon?.name ) ||
		( a.showPrimary && a.primaryIcon?.name ) ||
		( a.showSecondary && a.secondaryIcon?.name );
	const hasButtons = a.showPrimary || a.showSecondary;

	// Colours: the same rules as render.php (docs/accessibility.md).
	const colors = blockColors( a );
	const surface = useSurface( clientId, a, 'werun-community/cta' );
	const around = useContextBackground( clientId );
	const accentBase = a.accentColor && colorRgba( a.accentColor ) ? a.accentColor : ACCENT;
	let overlay = '';
	let imgText = '';
	let overO = 0;
	let toneCls = toneClass( surface, around );
	let btnBgs = [ surface ];
	if ( hasBgImage ) {
		overlay = ( colorHex( colorRgba( a.overlayColor || '' ) ) || '' ).slice( 0, 7 ) || '#000000';
		imgText = colors.text || ( isDarkColor( overlay ) === true ? PAPER : INK );
		overO = layout === 'card' ? Math.max( 0, Math.min( 95, typeof a.overlayOpacity === 'number' ? a.overlayOpacity : 55 ) ) : overlayOpacity( a.overlayOpacity ?? 55, imgText, overlay );
		toneCls = isDarkColor( imgText ) === true ? 'wrbc-is-light' : 'wrbc-is-dark';
		const ov = colorRgba( overlay );
		const layer = [ ov[ 0 ], ov[ 1 ], ov[ 2 ], overO / 100 ];
		btnBgs = [ colorOver( layer, [ 255, 255, 255, 1 ] ), colorOver( layer, [ 0, 0, 0, 1 ] ) ];
	}
	const textIs = colors.text || ( toneCls === 'wrbc-is-dark' ? PAPER : toneCls === 'wrbc-is-light' ? INK : '' );
	const ownBg = ! hasBgImage && ( colors.background || colors.gradient.length ) ? blockSurface( a, 'werun-community/cta' ) : '';
	// As a solid colour: WordPress strips color-mix() from a block's inline style (render.php).
	const rootPct = mutedFor( textIs, ownBg );
	const textRgba = rootPct ? colorRgba( textIs ) : null;
	const rootMuted = textRgba ? colorHex( colorOver( [ textRgba[ 0 ], textRgba[ 1 ], textRgba[ 2 ], rootPct / 100 ], colorRgba( ownBg ) ) ) : '';
	// The floating card paints its own colour (white unless chosen).
	let cardBg = '';
	let cardClass = '';
	let cardVars = {};
	if ( layout === 'card' ) {
		const chosen = colorRgba( a.cardBg || '' );
		const under = colorRgba( surface || PAPER );
		cardBg = ! chosen ? PAPER : colorHex( chosen[ 3 ] < 1 && under ? colorOver( chosen, under ) : chosen );
		// The chosen card text made readable on the card; none chosen on a chosen card colour: white or ink.
		const cardText = a.cardText && colorRgba( a.cardText ) ? a.cardText : '';
		const cardFg = cardText ? readableColor( cardText, cardBg, AA_TEXT ) : chosen ? onColor( cardBg ) : INK;
		const cardAt = readableColor( accentBase, cardBg, AA_TEXT );
		const cardMu = mutedFor( cardFg, cardBg );
		cardClass = toneClass( cardBg, surface );
		cardVars = {
			'--wrbc-cta-card-bg': a.cardBg,
			'--wrbc-cta-card-fg': cardText || chosen ? cardFg : undefined,
			'--wrbc-cta-card-accent': String( cardAt ).toLowerCase() !== String( accentBase ).toLowerCase() ? cardAt : undefined,
			'--wrbc-cta-card-muted': cardMu ? `${ cardMu }%` : undefined,
		};
		btnBgs = [ cardBg ];
	}
	// The primary button's fill on a background of (almost) its own colour gets a ring.
	let ring = '';
	btnBgs.forEach( ( bg ) => {
		if ( bg && contrastRatio( accentBase, bg ) < AA_UI ) {
			ring = imgText && layout !== 'card' ? imgText : onColor( bg );
		}
	} );

	// --wrbc-accent, the text on it (automatic, or the chosen one made readable), its hover fill and the accent as text.
	const accVars = accentVars( a, surface );
	// Over a picture only the text colour is sure to read: the accent takes it (render.php).
	if ( imgText && layout !== 'card' ) {
		accVars[ '--wrbc-accent-text' ] = imgText;
	}

	const ref = useRef();
	const blockProps = useBlockProps( {
		ref,
		className: cx(
			'wrbc-root wrbc-cta',
			`wrbc-cta--${ layout }`,
			`wrbc-cta--align-${ align }`,
			mediaSlot && 'has-media',
			mediaSlot && layout === 'split' && `wrbc-cta--media-${ a.mediaPosition === 'left' ? 'left' : 'right' }`,
			mediaSlot && layout === 'split' && a.mobileMediaFirst && 'wrbc-cta--mobile-media-first',
			hasBgImage && 'has-bg-image',
			toneCls,
			ring && 'wrbc-cta--btn-ring'
		),
		style: cssVars( {
			...accVars,
			'--wrbc-icon-size': px( a.iconSize ),
			'--wrbc-icon-stroke': a.iconStroke,
			'--wrbc-btn-radius': RADIUS[ a.buttonShape ],
			'--wrbc-cta-max': `${ width }px`,
			'--wrbc-media-ratio': ratio !== 'auto' ? ratio.replace( '/', ' / ' ) : undefined,
			'--wrbc-overlay': overlay || undefined,
			'--wrbc-overlay-o': hasBgImage ? overO / 100 : undefined,
			'--wrbc-cta-text': layout !== 'card' && imgText ? imgText : undefined,
			'--wrbc-cta-ring': ring || undefined,
			'--wrbc-muted': rootMuted || undefined,
			...cardVars,
		} ),
	} );

	// The block's own colour pairs (text on the accent, card text) are made
	// readable on the page; a Color panel text colour is never overridden, so
	// the warning offers to remove it.
	const behind = hasBgImage ? '' : surface;
	const auditActions = [
		layout !== 'card' && colors.text && behind && contrastRatio( colors.text, behind ) < AA_TEXT && {
			label: __( 'Remove the text colour', 'werun-blocks-community' ),
			onClick: () => setAttributes( { textColor: undefined, style: { ...a.style, color: { ...a.style?.color, text: undefined } } } ),
		},
	];

	// A new image brings its own alt text: the old one described another picture.
	const onSelectMedia = ( media ) => setAttributes( { mediaId: media?.id, mediaUrl: media?.url, mediaAlt: media?.alt || '' } );
	// "Remove" sends undefined, which would bring the default icon back: store {}.
	const setIcon = ( key ) => ( value ) => setAttributes( { [ key ]: value?.name ? value : {} } );

	const colorSettings = [
		// The eyebrow text is in the accent colour too (style.scss), icon or not.
		( hasButtons || hasIcons || a.showEyebrow ) && {
			value: a.accentColor,
			onChange: ( accentColor ) => setAttributes( { accentColor } ),
			label: __( 'Accent (buttons, eyebrow)', 'werun-blocks-community' ),
		},
		a.showPrimary && {
			value: a.onAccentColor,
			onChange: ( onAccentColor ) => setAttributes( { onAccentColor } ),
			label: __( 'Text on the accent', 'werun-blocks-community' ),
		},
		layout === 'card' && {
			value: a.cardBg,
			onChange: ( cardBg ) => setAttributes( { cardBg } ),
			label: __( 'Card background', 'werun-blocks-community' ),
		},
		layout === 'card' && {
			value: a.cardText,
			onChange: ( cardText ) => setAttributes( { cardText } ),
			label: __( 'Card text', 'werun-blocks-community' ),
		},
		hasBgImage && {
			value: a.overlayColor,
			onChange: ( overlayColor ) => setAttributes( { overlayColor } ),
			label: __( 'Overlay', 'werun-blocks-community' ),
		},
	].filter( Boolean );

	const media = (
		<figure className="wrbc-cta__media">
			{ hasMediaFile ? (
				<img className="wrbc-cta__img" src={ a.mediaUrl } alt={ a.mediaAlt } />
			) : (
				<MediaPlaceholder
					icon="format-image"
					labels={ { title: __( 'Image or illustration', 'werun-blocks-community' ) } }
					accept="image/*"
					allowedTypes={ [ 'image' ] }
					onSelect={ onSelectMedia }
				/>
			) }
		</figure>
	);

	const primaryLabel = (
		<RichText
			tagName="span"
			value={ a.primaryLabel }
			onChange={ ( value ) => setAttributes( { primaryLabel: value } ) }
			placeholder={ __( 'Button', 'werun-blocks-community' ) }
			allowedFormats={ [] }
		/>
	);
	const secondaryLabel = (
		<RichText
			tagName="span"
			value={ a.secondaryLabel }
			onChange={ ( value ) => setAttributes( { secondaryLabel: value } ) }
			placeholder={ __( 'Button', 'werun-blocks-community' ) }
			allowedFormats={ [] }
		/>
	);
	const noLinkNote = (
		<Notice status="warning" isDismissible={ false }>
			{ __( 'No link yet: on the page this button shows as plain text.', 'werun-blocks-community' ) }
		</Notice>
	);

	return (
		<>
			<ContrastAudit
				blockRef={ ref }
				deps={ [ attributes, surface, around ] }
				labels={ {
					'.wrbc-cta__eyebrow': __( 'Eyebrow', 'werun-blocks-community' ),
					'.wrbc-cta__title': __( 'Title', 'werun-blocks-community' ),
					'.wrbc-cta__text': __( 'Text', 'werun-blocks-community' ),
					'.wrbc-cta__btn': __( 'Button', 'werun-blocks-community' ),
				} }
				actions={ auditActions }
			/>
			<BlockControls group="other">
				{ showImg && (
					<MediaReplaceFlow
						mediaId={ a.mediaId }
						mediaURL={ a.mediaUrl }
						allowedTypes={ [ 'image' ] }
						accept="image/*"
						onSelect={ onSelectMedia }
						name={ __( 'Replace image', 'werun-blocks-community' ) }
					/>
				) }
			</BlockControls>

			<InspectorControls>
				<PanelBody title={ __( 'Layout', 'werun-blocks-community' ) }>
					<SelectControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Layout', 'werun-blocks-community' ) }
						value={ layout }
						options={ [
							{ value: 'centered', label: __( 'Centred banner', 'werun-blocks-community' ) },
							{ value: 'split', label: __( 'Split: text and image', 'werun-blocks-community' ) },
							{ value: 'strip', label: __( 'Compact strip', 'werun-blocks-community' ) },
							{ value: 'card', label: __( 'Floating card', 'werun-blocks-community' ) },
						] }
						onChange={ ( value ) => setAttributes( { layout: value } ) }
					/>
					{ layout === 'card' && (
						<Choice
							label={ __( 'Alignment', 'werun-blocks-community' ) }
							value={ align }
							options={ [
								[ 'left', __( 'Left', 'werun-blocks-community' ) ],
								[ 'center', __( 'Center', 'werun-blocks-community' ) ],
							] }
							onChange={ ( contentAlign ) => setAttributes( { contentAlign } ) }
						/>
					) }
					{ mediaSlot && layout === 'split' && (
						<>
							<Choice
								label={ __( 'Image side', 'werun-blocks-community' ) }
								value={ a.mediaPosition === 'left' ? 'left' : 'right' }
								options={ [
									[ 'left', __( 'Left', 'werun-blocks-community' ) ],
									[ 'right', __( 'Right', 'werun-blocks-community' ) ],
								] }
								onChange={ ( mediaPosition ) => setAttributes( { mediaPosition } ) }
							/>
							<Toggle attributes={ a } setAttributes={ setAttributes } name="mobileMediaFirst" label={ __( 'Image first on phones', 'werun-blocks-community' ) } />
						</>
					) }
					<RangeControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ layout === 'card' ? __( 'Card width (px)', 'werun-blocks-community' ) : __( 'Content width (px)', 'werun-blocks-community' ) }
						value={ width }
						min={ 480 }
						max={ 1600 }
						step={ 20 }
						onChange={ ( contentWidth ) => setAttributes( { contentWidth } ) }
					/>
					<Toggle attributes={ a } setAttributes={ setAttributes } name="reveal" label={ __( 'Fade in when it scrolls into view', 'werun-blocks-community' ) } />
				</PanelBody>

				<PanelBody title={ __( 'Elements', 'werun-blocks-community' ) } initialOpen={ false }>
					<Toggle attributes={ a } setAttributes={ setAttributes } name="showEyebrow" label={ __( 'Eyebrow', 'werun-blocks-community' ) } />
					<Toggle attributes={ a } setAttributes={ setAttributes } name="showText" label={ __( 'Text', 'werun-blocks-community' ) } />
					<Toggle attributes={ a } setAttributes={ setAttributes } name="showPrimary" label={ __( 'Main button', 'werun-blocks-community' ) } />
					<Toggle attributes={ a } setAttributes={ setAttributes } name="showSecondary" label={ __( 'Second button', 'werun-blocks-community' ) } />
					{ mediaOk && <Toggle attributes={ a } setAttributes={ setAttributes } name="showMedia" label={ __( 'Image', 'werun-blocks-community' ) } /> }
					<Choice
						label={ __( 'Title level', 'werun-blocks-community' ) }
						value={ String( level ) }
						options={ [
							[ '2', 'H2' ],
							[ '3', 'H3' ],
							[ '4', 'H4' ],
						] }
						onChange={ ( value ) => setAttributes( { titleLevel: Number( value ) } ) }
					/>
				</PanelBody>

				{ a.showEyebrow && (
					<PanelBody title={ __( 'Eyebrow', 'werun-blocks-community' ) } initialOpen={ false }>
						<IconControl label={ __( 'Icon', 'werun-blocks-community' ) } value={ a.eyebrowIcon } onChange={ setIcon( 'eyebrowIcon' ) } />
					</PanelBody>
				) }

				{ hasButtons && (
					<PanelBody title={ __( 'Buttons', 'werun-blocks-community' ) } initialOpen={ false }>
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
								{ ! isLink( a.primaryUrl ) && noLinkNote }
								<LinkFields
									url={ a.primaryUrl }
									newTab={ a.primaryNewTab }
									onChange={ ( v ) => setAttributes( { ...( 'url' in v && { primaryUrl: v.url } ), ...( 'newTab' in v && { primaryNewTab: v.newTab } ) } ) }
								/>
								<IconControl label={ __( 'Icon', 'werun-blocks-community' ) } value={ a.primaryIcon } onChange={ setIcon( 'primaryIcon' ) } />
							</>
						) }
						{ a.showSecondary && (
							<>
								<p className="wrbc-control-label">{ __( 'Second button', 'werun-blocks-community' ) }</p>
								{ ! isLink( a.secondaryUrl ) && noLinkNote }
								<LinkFields
									url={ a.secondaryUrl }
									newTab={ a.secondaryNewTab }
									onChange={ ( v ) => setAttributes( { ...( 'url' in v && { secondaryUrl: v.url } ), ...( 'newTab' in v && { secondaryNewTab: v.newTab } ) } ) }
								/>
								<IconControl label={ __( 'Icon', 'werun-blocks-community' ) } value={ a.secondaryIcon } onChange={ setIcon( 'secondaryIcon' ) } />
							</>
						) }
					</PanelBody>
				) }

				{ mediaSlot && (
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
							value={ ratio }
							options={ [
								{ value: 'auto', label: __( 'Original', 'werun-blocks-community' ) },
								...RATIOS.map( ( r ) => ( { value: r, label: r.replace( '/', ':' ) } ) ),
							] }
							onChange={ ( mediaRatio ) => setAttributes( { mediaRatio } ) }
						/>
						{ hasMediaFile && (
							<Button variant="secondary" isDestructive onClick={ () => setAttributes( { mediaId: undefined, mediaUrl: undefined, mediaAlt: '' } ) }>
								{ __( 'Remove image', 'werun-blocks-community' ) }
							</Button>
						) }
					</PanelBody>
				) }

				<PanelBody title={ layout === 'card' ? __( 'Background image (behind the card)', 'werun-blocks-community' ) : __( 'Background image', 'werun-blocks-community' ) } initialOpen={ false }>
					<MediaUploadCheck>
						<MediaUpload
							allowedTypes={ [ 'image' ] }
							value={ a.bgImageId }
							onSelect={ ( m ) => setAttributes( { bgImageId: m?.id, bgImageUrl: m?.url } ) }
							render={ ( { open } ) => (
								<Button variant="secondary" onClick={ open }>
									{ hasBgImage ? __( 'Replace background', 'werun-blocks-community' ) : __( 'Choose a background', 'werun-blocks-community' ) }
								</Button>
							) }
						/>
					</MediaUploadCheck>
					{ hasBgImage && (
						<>
							<Button variant="tertiary" isDestructive onClick={ () => setAttributes( { bgImageId: undefined, bgImageUrl: undefined } ) }>
								{ __( 'Remove background', 'werun-blocks-community' ) }
							</Button>
							{ layout === 'card' ? (
								<RangeControl
									__nextHasNoMarginBottom
									__next40pxDefaultSize
									label={ __( 'Overlay opacity (%)', 'werun-blocks-community' ) }
									help={ __( 'Only the picture around the card: the text sits on the card’s own colour.', 'werun-blocks-community' ) }
									value={ overO }
									min={ 0 }
									max={ 95 }
									onChange={ ( value ) => setAttributes( { overlayOpacity: value } ) }
								/>
							) : (
								<OverlayOpacityControl
									value={ a.overlayOpacity }
									onChange={ ( value ) => setAttributes( { overlayOpacity: value } ) }
									overlayColor={ overlay }
									textColor={ imgText }
								/>
							) }
						</>
					) }
				</PanelBody>

				{ colorSettings.length > 0 && (
					<PanelColorSettings title={ __( 'Accent, card and overlay', 'werun-blocks-community' ) } initialOpen={ false } colorSettings={ colorSettings } />
				) }
				{ hasIcons && (
					<PanelBody title={ __( 'Icons', 'werun-blocks-community' ) } initialOpen={ false }>
						<IconSizeControls attributes={ a } setAttributes={ setAttributes } maxSize={ 32 } />
					</PanelBody>
				) }
			</InspectorControls>

			<section { ...blockProps } aria-labelledby={ plain( a.title ) ? `${ uid }-title` : undefined }>
				{ hasBgImage && (
					<>
						<img className="wrbc-cta__bg" src={ a.bgImageUrl } alt="" data-wrbc-backdrop="image" />
						<span className="wrbc-cta__overlay" aria-hidden="true" data-wrbc-backdrop="overlay" />
					</>
				) }
				<div className={ cx( 'wrbc-cta__inner', cardClass ) }>
					{ mediaSlot && mediaFirst && media }
					<div className="wrbc-cta__content">
						<div className="wrbc-cta__copy">
							{ a.showEyebrow && (
								<p className="wrbc-cta__eyebrow wrbc-anim-host">
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
								className="wrbc-cta__title"
								id={ `${ uid }-title` }
								value={ a.title }
								onChange={ ( title ) => setAttributes( { title } ) }
								placeholder={ __( 'Title', 'werun-blocks-community' ) }
							/>
							{ a.showText && (
								<RichText
									tagName="p"
									className="wrbc-cta__text"
									value={ a.text }
									onChange={ ( text ) => setAttributes( { text } ) }
									placeholder={ __( 'Text', 'werun-blocks-community' ) }
								/>
							) }
						</div>
						{ hasButtons && (
							<div className="wrbc-cta__actions">
								{ /* Without a link the label is plain text, as on the page (render.php $button). */ }
								{ a.showPrimary &&
									( isLink( a.primaryUrl ) ? (
										<span className="wrbc-btn wrbc-cta__btn wrbc-anim-host">
											{ primaryLabel }
											<Icon icon={ a.primaryIcon } />
										</span>
									) : (
										<span className="wrbc-cta__btn wrbc-cta__btn--text">{ primaryLabel }</span>
									) ) }
								{ a.showSecondary &&
									( isLink( a.secondaryUrl ) ? (
										<span className="wrbc-btn wrbc-btn--outline wrbc-cta__btn wrbc-anim-host">
											<Icon icon={ a.secondaryIcon } />
											{ secondaryLabel }
										</span>
									) : (
										<span className="wrbc-cta__btn wrbc-cta__btn--text">{ secondaryLabel }</span>
									) ) }
							</div>
						) }
					</div>
					{ mediaSlot && ! mediaFirst && media }
				</div>
			</section>
		</>
	);
}
