import { __, sprintf } from '@wordpress/i18n';
import {
	__experimentalUseMultipleOriginColorsAndGradients as useMultipleOriginColorsAndGradients,
	InspectorControls,
	MediaPlaceholder,
	PanelColorSettings,
	RichText,
	store as blockEditorStore,
	useBlockProps,
} from '@wordpress/block-editor';
import { useDispatch } from '@wordpress/data';
import { useEffect, useRef } from '@wordpress/element';
import { Button, FocalPointPicker, Notice, PanelBody, SelectControl } from '@wordpress/components';
import { Icon } from '../shared/icons';
import { IconControl } from '../shared/IconControl';
import { Choice, cssVars, cx, IconSizeControls, LinkFields, px, Toggle } from '../shared/controls';
import { AA_TEXT, INK, PAPER, accentVars, blockColors, blockSurface, contrastRatio, pageColors, toneClass, useContextBackground, useSurface } from '../shared/contrast';
import { ContrastAudit } from '../shared/a11y';
import { MediaOrVideoControl } from '../shared/controls-extra';
import { hasMedia } from './media-control';

const RADIUS = { pill: '999px', rounded: '10px', square: '0px' };
const RATIOS = [ '1/1', '4/3', '3/2', '16/9', '3/4' ];
const plain = ( value ) => ( typeof value === 'string' ? value.replace( /<[^>]*>/g, '' ).trim() : '' );

/**
 * "Transform to variation" sets a bare media value (index.js). Instead of
 * dropping the chosen file, the media the block had is kept: an image
 * variation keeps the image, the video variation keeps the video. Switching
 * between them parks the other one in media.kept (render.php ignores it), so
 * image → video → image gives the same image back with its alt text; with
 * nothing parked, the image becomes the video's cover image and back.
 * Returns the media to store, or null to leave it.
 */
function variationMedia( prev, next ) {
	const keys = next && typeof next === 'object' ? Object.keys( next ).sort().join( ',' ) : '';
	const p = prev && typeof prev === 'object' ? prev : {};
	const { kept, ...current } = p;
	const parked = kept && typeof kept === 'object' ? kept : null;
	const isVideoNow = p.type === 'video';
	const hasFile = isVideoNow ? hasMedia( p ) || !! p.posterUrl : !! ( p.id || p.url );
	if ( keys === 'type' && next.type === 'image' ) {
		if ( ! isVideoNow ) {
			return hasFile ? p : null;
		}
		if ( parked?.type === 'image' ) {
			return { ...parked, kept: current };
		}
		return { type: 'image', alt: '', ...( p.posterUrl && { id: p.posterId, url: p.posterUrl } ), ...( hasFile && { kept: current } ) };
	}
	if ( keys === 'provider,type' && next.type === 'video' && next.provider === 'youtube' ) {
		if ( isVideoNow ) {
			return p.provider || hasFile ? p : null;
		}
		if ( parked?.type === 'video' ) {
			return { ...parked, kept: current };
		}
		return hasFile ? { type: 'video', provider: 'youtube', posterId: p.id, posterUrl: p.url, alt: '', kept: current } : null;
	}
	return null;
}

export default function Edit( { attributes, setAttributes, clientId, name } ) {
	const a = attributes;
	const ref = useRef();
	const uid = `wrbc-media-text-${ clientId.slice( 0, 8 ) }`;
	const media = a.media && typeof a.media === 'object' ? a.media : { type: 'image' };

	// Colours come from the palette only: the accent is stored as a preset
	// slug and printed as var(--wp--preset--color--slug) by render.php.
	const { colors = [] } = useMultipleOriginColorsAndGradients() || {};
	const flat = colors.flatMap( ( group ) => ( Array.isArray( group?.colors ) ? group.colors : [ group ] ) ).filter( ( c ) => c?.slug );
	const slugToColor = ( slug ) => flat.find( ( c ) => c.slug === slug )?.color;
	const colorToSlug = ( value ) => ( value ? flat.find( ( c ) => c.color === value )?.slug || '' : '' );

	// The same rules as render.php.
	const isVideo = media.type === 'video';
	const showMedia = hasMedia( media );
	const ratio = RATIOS.includes( a.mediaRatio ) ? a.mediaRatio : '4/3';
	const side = a.mediaPosition === 'right' ? 'right' : 'left';
	const order = a.mobileOrder === 'text-first' ? 'text-first' : 'media-first';
	const valign = [ 'start', 'center', 'end' ].includes( a.verticalAlign ) ? a.verticalAlign : 'center';
	const level = Number.isFinite( Number( a.titleLevel ) ) ? Math.max( 2, Math.min( 4, Math.trunc( Number( a.titleLevel ) ) ) ) : 2; // H2–H4, render.php twin
	const btnType = [ 'solid', 'outline', 'link' ].includes( a.buttonStyle ) ? a.buttonStyle : 'solid';
	const focalX = Math.max( 0, Math.min( 1, Number( a.mediaFocal?.x ?? 0.5 ) || 0 ) );
	const focalY = Math.max( 0, Math.min( 1, Number( a.mediaFocal?.y ?? 0.5 ) || 0 ) );
	const isImage = ! isVideo && showMedia;
	const hasIcons = ( a.showPoints && a.pointsIcon?.name ) || ( a.showButton && a.buttonIcon?.name );
	// "#" (the default) or a script URL is no link: the page prints the label as text (render.php $has_url).
	const btnUrl = typeof a.buttonUrl === 'string' ? a.buttonUrl.trim() : '';
	const hasUrl = btnUrl !== '' && btnUrl !== '#' && ! /^(?:javascript|data|vbscript):/i.test( btnUrl.replace( /[\s\u0000-\u001f]+/g, '' ) );
	// The canvas always shows the button, to edit it (the page only with a link).
	const usesOnAccent = ( a.showButton && btnType === 'solid' ) || ( isVideo && showMedia );

	// ── Colours: the same steps as render.php (docs/accessibility.md).
	const surface = useSurface( clientId, a, name );
	const around = useContextBackground( clientId );
	const accent = slugToColor( a.accentColor ) || '';
	const onAccent = slugToColor( a.onAccentColor ) || '';
	const chosenText = blockColors( a ).text;
	let tone = toneClass( surface, around );
	if ( ! tone && blockSurface( a, name ) && ! chosenText ) {
		tone = 'wrbc-is-light'; // its own light background and no text colour: ink text
	}
	// Secondary text: the text colour itself where the token's mix wouldn't read (85 % on dark, 76 % otherwise).
	const toneText = { 'wrbc-is-dark': PAPER, 'wrbc-is-light': INK }[ tone ] || pageColors().text;
	const textColor = chosenText || toneText;
	const mutedRatio = contrastRatio( `color-mix(in srgb, ${ textColor } ${ tone === 'wrbc-is-dark' ? 85 : 76 }%, transparent)`, surface );
	// Automatic text on a custom accent, a picked one corrected to 4.5:1 (render.php $accent_css).
	const accentStyle = accentVars( { accentColor: accent, onAccentColor: onAccent }, surface );
	if ( ! usesOnAccent ) {
		delete accentStyle[ '--wrbc-on-accent' ];
		delete accentStyle[ '--wrbc-accent-hover' ];
	}

	const blockProps = useBlockProps( {
		ref,
		className: cx(
			'wrbc-root wrbc-media-text',
			`wrbc-media-text--media-${ side }`,
			`wrbc-media-text--${ order }`,
			`wrbc-media-text--valign-${ valign }`,
			// Editor: the media placeholder holds the media column before a file is chosen.
			'has-media',
			isVideo && showMedia && 'has-video',
			tone
		),
		style: cssVars( {
			...accentStyle,
			'--wrbc-muted': mutedRatio > 0 && mutedRatio < AA_TEXT ? 'currentColor' : undefined,
			'--wrbc-icon-size': px( a.iconSize ),
			'--wrbc-icon-stroke': a.iconStroke,
			'--wrbc-btn-radius': a.showButton && btnType !== 'link' ? RADIUS[ a.buttonShape ] : undefined,
			'--wrbc-mt-ratio': ratio.replace( '/', ' / ' ),
			'--wrbc-mt-focal': isImage ? `${ Math.round( focalX * 10000 ) / 100 }% ${ Math.round( focalY * 10000 ) / 100 }%` : undefined,
		} ),
	} );

	const setMedia = ( next ) => setAttributes( { media: next } );

	// Keep the file across "Transform to variation" (variationMedia()), in the same undo step.
	const { __unstableMarkNextChangeAsNotPersistent: notPersistent } = useDispatch( blockEditorStore );
	const prevMedia = useRef( a.media );
	useEffect( () => {
		const kept = variationMedia( prevMedia.current, a.media );
		prevMedia.current = kept || a.media;
		if ( kept ) {
			notPersistent?.();
			setAttributes( { media: kept } );
		}
	}, [ a.media ] ); // eslint-disable-line react-hooks/exhaustive-deps
	const setIcon = ( key ) => ( value ) => setAttributes( { [ key ]: value?.name ? value : {} } );
	const setPoint = ( index, text ) => setAttributes( { points: a.points.map( ( p, i ) => ( i === index ? { ...p, text } : p ) ) } );
	const points = Array.isArray( a.points ) ? a.points : [];

	const colorSettings = [
		( a.showPoints || a.showButton || ( isVideo && showMedia ) ) && {
			value: slugToColor( a.accentColor ),
			onChange: ( value ) => setAttributes( { accentColor: colorToSlug( value ) } ),
			label: __( 'Accent (button, checklist, play)', 'werun-blocks-community' ),
		},
		usesOnAccent && {
			value: slugToColor( a.onAccentColor ),
			onChange: ( value ) => setAttributes( { onAccentColor: colorToSlug( value ) } ),
			label: __( 'Text on the accent', 'werun-blocks-community' ),
		},
	]
		.filter( Boolean )
		.map( ( setting ) => ( { ...setting, colors, disableCustomColors: true } ) );

	let mediaView;
	if ( isImage ) {
		mediaView = <img className="wrbc-media-text__img" src={ media.url } alt={ media.alt || '' } />;
	} else if ( isVideo ) {
		mediaView = (
			<div className="wrbc-media-text__video">
				<span className="wrbc-media-text__play">
					{ media.posterUrl && <img className="wrbc-media-text__poster" src={ media.posterUrl } alt="" /> }
					<span className="wrbc-media-text__play-icon" aria-hidden="true">
						<Icon icon={ { name: 'play' } } />
					</span>
					{ ! showMedia && <span className="wrbc-media-text__hint">{ __( 'Add the video in the sidebar → Media.', 'werun-blocks-community' ) }</span> }
				</span>
			</div>
		);
	} else {
		mediaView = (
			<MediaPlaceholder
				icon="format-image"
				labels={ { title: __( 'Image', 'werun-blocks-community' ) } }
				accept="image/*"
				allowedTypes={ [ 'image' ] }
				onSelect={ ( m ) => setMedia( { type: 'image', id: m?.id, url: m?.url, alt: m?.alt || '' } ) }
			/>
		);
	}

	// The media column, as render.php prints it: a decorative image (no alt) in a
	// plain box, not a figure; a video's transcript under it.
	const MediaTag = isImage && ! plain( media.alt ) ? 'div' : 'figure';
	const transcript = isVideo && showMedia && typeof media.transcript === 'string' ? media.transcript.trim() : '';
	const mediaColumn = (
		<div className="wrbc-media-text__media-col">
			<MediaTag className="wrbc-media-text__media">{ mediaView }</MediaTag>
			{ transcript && (
				<details className="wrbc-media-text__transcript">
					<summary className="wrbc-media-text__transcript-toggle">{ __( 'Transcript', 'werun-blocks-community' ) }</summary>
					<div className="wrbc-media-text__transcript-body">
						{ /* wpautop() in render.php: blank lines make paragraphs, single ones line breaks. */ }
						{ transcript.split( /\n\s*\n/ ).map( ( paragraph, index ) => (
							<p key={ index }>{ paragraph.split( '\n' ).map( ( line, i ) => ( i ? [ <br key={ i } />, line ] : line ) ) }</p>
						) ) }
					</div>
				</details>
			) }
		</div>
	);

	return (
		<>
			<ContrastAudit
				blockRef={ ref }
				deps={ [ attributes, surface, around ] }
				checks={ [ { selector: '.wrbc-media-text__play-icon .wrbc-icon', property: 'fill', min: 3, label: __( 'Play icon on its badge', 'werun-blocks-community' ) } ] }
				ignore=".wrbc-media-text__hint"
				labels={ {
					'.wrbc-media-text__title': __( 'Title', 'werun-blocks-community' ),
					'.wrbc-media-text__text': __( 'Text', 'werun-blocks-community' ),
					'.wrbc-media-text__point': __( 'Checklist', 'werun-blocks-community' ),
					'.wrbc-media-text__btn': __( 'Button', 'werun-blocks-community' ),
					'.wrbc-media-text__transcript': __( 'Transcript', 'werun-blocks-community' ),
				} }
			/>
			<InspectorControls>
				{ a.showButton && plain( a.buttonLabel ) && ! hasUrl && (
					<div className="wrbc-media-text__notice">
						<Notice status="warning" isDismissible={ false }>
							{ __( 'The button has no link yet: on the page its label shows as plain text until you add one (Button → Link).', 'werun-blocks-community' ) }
						</Notice>
					</div>
				) }
				<PanelBody title={ __( 'Media', 'werun-blocks-community' ) }>
					<MediaOrVideoControl value={ media } onChange={ setMedia } allowVideo />
					{ isVideo && ! plain( media.alt ) && (
						<p className="components-base-control__help">{ __( 'Without a video title, the block’s title names the play button and the player.', 'werun-blocks-community' ) }</p>
					) }
					<SelectControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Aspect ratio', 'werun-blocks-community' ) }
						value={ ratio }
						options={ RATIOS.map( ( r ) => ( { value: r, label: r.replace( '/', ':' ) } ) ) }
						onChange={ ( mediaRatio ) => setAttributes( { mediaRatio } ) }
					/>
					{ isImage && (
						<FocalPointPicker
							__nextHasNoMarginBottom
							label={ __( 'Focal point', 'werun-blocks-community' ) }
							url={ media.url }
							value={ { x: focalX, y: focalY } }
							onChange={ ( mediaFocal ) => setAttributes( { mediaFocal } ) }
						/>
					) }
				</PanelBody>

				<PanelBody title={ __( 'Layout', 'werun-blocks-community' ) } initialOpen={ false }>
					<Choice
						label={ __( 'Media side', 'werun-blocks-community' ) }
						value={ side }
						options={ [
							[ 'left', __( 'Left', 'werun-blocks-community' ) ],
							[ 'right', __( 'Right', 'werun-blocks-community' ) ],
						] }
						onChange={ ( mediaPosition ) => setAttributes( { mediaPosition } ) }
					/>
					<Choice
						label={ __( 'On phones', 'werun-blocks-community' ) }
						help={ __( 'The columns stack when the block is narrower than 720 px. Screen readers and the keyboard follow this order on every screen.', 'werun-blocks-community' ) }
						value={ order }
						options={ [
							[ 'media-first', __( 'Media first', 'werun-blocks-community' ) ],
							[ 'text-first', __( 'Text first', 'werun-blocks-community' ) ],
						] }
						onChange={ ( mobileOrder ) => setAttributes( { mobileOrder } ) }
					/>
					<Choice
						label={ __( 'Vertical alignment', 'werun-blocks-community' ) }
						value={ valign }
						options={ [
							[ 'start', __( 'Top', 'werun-blocks-community' ) ],
							[ 'center', __( 'Middle', 'werun-blocks-community' ) ],
							[ 'end', __( 'Bottom', 'werun-blocks-community' ) ],
						] }
						onChange={ ( verticalAlign ) => setAttributes( { verticalAlign } ) }
					/>
					<Toggle attributes={ a } setAttributes={ setAttributes } name="reveal" label={ __( 'Fade in when it scrolls into view', 'werun-blocks-community' ) } />
				</PanelBody>

				<PanelBody title={ __( 'Elements', 'werun-blocks-community' ) } initialOpen={ false }>
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
					<Toggle attributes={ a } setAttributes={ setAttributes } name="showPoints" label={ __( 'Checklist', 'werun-blocks-community' ) } />
					<Toggle attributes={ a } setAttributes={ setAttributes } name="showButton" label={ __( 'Button', 'werun-blocks-community' ) } />
				</PanelBody>

				{ a.showPoints && (
					<PanelBody title={ __( 'Checklist', 'werun-blocks-community' ) } initialOpen={ false }>
						<IconControl label={ __( 'Icon for every line', 'werun-blocks-community' ) } value={ a.pointsIcon } onChange={ setIcon( 'pointsIcon' ) } />
						<div className="wrbc-panel-list">
							{ points.map( ( point, index ) => (
								<div className="wrbc-panel-row" key={ index }>
									<span>{ plain( point?.text ) || sprintf( /* translators: %d: line number */ __( 'Line %d', 'werun-blocks-community' ), index + 1 ) }</span>
									<Button size="small" variant="tertiary" isDestructive onClick={ () => setAttributes( { points: points.filter( ( _, i ) => i !== index ) } ) }>
										{ __( 'Remove', 'werun-blocks-community' ) }
									</Button>
								</div>
							) ) }
							<Button variant="secondary" onClick={ () => setAttributes( { points: [ ...points, { text: __( 'Another point', 'werun-blocks-community' ) } ] } ) }>
								{ __( 'Add a line', 'werun-blocks-community' ) }
							</Button>
						</div>
					</PanelBody>
				) }

				{ a.showButton && (
					<PanelBody title={ __( 'Button', 'werun-blocks-community' ) } initialOpen={ false }>
						<Choice
							label={ __( 'Style', 'werun-blocks-community' ) }
							value={ btnType }
							options={ [
								[ 'solid', __( 'Solid', 'werun-blocks-community' ) ],
								[ 'outline', __( 'Outline', 'werun-blocks-community' ) ],
								[ 'link', __( 'Text link', 'werun-blocks-community' ) ],
							] }
							onChange={ ( buttonStyle ) => setAttributes( { buttonStyle } ) }
						/>
						{ btnType !== 'link' && (
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
						) }
						<LinkFields
							url={ a.buttonUrl }
							newTab={ a.buttonNewTab }
							onChange={ ( v ) => setAttributes( { ...( 'url' in v && { buttonUrl: v.url } ), ...( 'newTab' in v && { buttonNewTab: v.newTab } ) } ) }
						/>
						<IconControl label={ __( 'Icon', 'werun-blocks-community' ) } value={ a.buttonIcon } onChange={ setIcon( 'buttonIcon' ) } />
					</PanelBody>
				) }

				{ colorSettings.length > 0 && (
					<PanelColorSettings
						title={ __( 'Accent', 'werun-blocks-community' ) }
						initialOpen={ false }
						disableCustomColors
						colorSettings={ colorSettings }
					>
						<p className="components-base-control__help">
							{ __( 'Kept readable (WCAG AA): text on the accent is white or dark when you don’t pick one, and a pick that doesn’t read is adjusted; the accent used as text and focus ring is lightened or darkened for the background.', 'werun-blocks-community' ) }
						</p>
					</PanelColorSettings>
				) }
				{ hasIcons && (
					<PanelBody title={ __( 'Icons', 'werun-blocks-community' ) } initialOpen={ false }>
						<IconSizeControls attributes={ a } setAttributes={ setAttributes } maxSize={ 32 } />
					</PanelBody>
				) }
			</InspectorControls>

			<section { ...blockProps } aria-labelledby={ plain( a.title ) ? `${ uid }-title` : undefined }>
				<div className="wrbc-media-text__inner">
					{ order === 'media-first' && mediaColumn }
					<div className="wrbc-media-text__content">
						<RichText
							tagName={ `h${ level }` }
							className="wrbc-media-text__title"
							id={ `${ uid }-title` }
							value={ a.title }
							onChange={ ( title ) => setAttributes( { title } ) }
							placeholder={ __( 'Title', 'werun-blocks-community' ) }
						/>
						<RichText
							tagName="p"
							className="wrbc-media-text__text"
							value={ a.text }
							onChange={ ( text ) => setAttributes( { text } ) }
							placeholder={ __( 'Text', 'werun-blocks-community' ) }
						/>
						{ a.showPoints && (
							// eslint-disable-next-line jsx-a11y/no-redundant-roles -- Safari drops the list semantics of a list-style: none list (render.php twin).
							<ul className="wrbc-media-text__points" role="list">
								{ points.map( ( point, index ) => (
									<li className="wrbc-media-text__point" key={ index }>
										<Icon icon={ a.pointsIcon } />
										<RichText
											tagName="span"
											value={ point?.text }
											onChange={ ( text ) => setPoint( index, text ) }
											placeholder={ __( 'A point', 'werun-blocks-community' ) }
											allowedFormats={ [ 'core/bold', 'core/italic', 'core/link' ] }
										/>
									</li>
								) ) }
							</ul>
						) }
						{ a.showButton && (
							<p className="wrbc-media-text__actions">
								<span className={ cx( 'wrbc-btn wrbc-media-text__btn wrbc-anim-host', btnType === 'outline' && 'wrbc-btn--outline', btnType === 'link' && 'wrbc-btn--link' ) }>
									<RichText
										tagName="span"
										value={ a.buttonLabel }
										onChange={ ( buttonLabel ) => setAttributes( { buttonLabel } ) }
										placeholder={ __( 'Button', 'werun-blocks-community' ) }
										allowedFormats={ [] }
									/>
									<Icon icon={ a.buttonIcon } />
								</span>
							</p>
						) }
					</div>
					{ order === 'text-first' && mediaColumn }
				</div>
			</section>
		</>
	);
}
