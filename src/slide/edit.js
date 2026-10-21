import { __ } from '@wordpress/i18n';
import {
	InspectorControls,
	MediaUpload,
	MediaUploadCheck,
	PanelColorSettings,
	store as blockEditorStore,
	useBlockProps,
	useInnerBlocksProps,
} from '@wordpress/block-editor';
import { Button, FocalPointPicker, Notice, PanelBody, RangeControl, TextareaControl } from '@wordpress/components';
import { useSelect } from '@wordpress/data';
import { useRef } from '@wordpress/element';
import { cssVars, cx, OverlayOpacityControl } from '../shared/controls';
import { ContrastAudit } from '../shared/a11y';
import { blockColors, useContextBackground } from '../shared/contrast';
import { hasText, slideColors } from './colors';

/** Whether a slide's blocks show anything besides empty text placeholders. */
const TEXT_BLOCKS = [ 'core/heading', 'core/paragraph' ];
function hasContent( blocks ) {
	return ( blocks || [] ).some( ( block ) =>
		TEXT_BLOCKS.includes( block.name )
			? String( block.attributes.content ?? '' ).replace( /<[^>]*>/g, '' ).trim() !== ''
			: ! block.innerBlocks?.length || hasContent( block.innerBlocks )
	);
}

/** The slide's attributes without its own text colour (Color panel): the automatic one applies again. */
function withoutTextColor( a ) {
	const color = { ...( a.style?.color || {} ) };
	delete color.text;
	return { textColor: undefined, style: { ...( a.style || {} ), color } };
}

export const SLIDE_TEMPLATE = [
	[ 'core/heading', { level: 3, placeholder: __( 'Slide title', 'werun-blocks-community' ) } ],
	[ 'core/paragraph', { placeholder: __( 'Add text, buttons, an image or any other block.', 'werun-blocks-community' ) } ],
];

function ImageButtons( { id, url, onSelect, onRemove, addLabel, replaceLabel, removeLabel } ) {
	return (
		<MediaUploadCheck>
			<MediaUpload
				allowedTypes={ [ 'image' ] }
				value={ id }
				onSelect={ onSelect }
				render={ ( { open } ) => (
					<div className="wrbc-slide-edit__media">
						{ url && (
							<button type="button" className="wrbc-slide-edit__preview" onClick={ open } aria-label={ replaceLabel }>
								<img src={ url } alt="" />
							</button>
						) }
						<Button variant="secondary" onClick={ open }>{ url ? replaceLabel : addLabel }</Button>
						{ url && (
							<Button variant="tertiary" isDestructive onClick={ onRemove }>{ removeLabel }</Button>
						) }
					</div>
				) }
			/>
		</MediaUploadCheck>
	);
}

export default function Edit( { attributes, setAttributes, context, clientId } ) {
	const a = attributes;
	const ref = useRef();
	const hasBg = !! a.bgUrl;
	const focal = a.bgFocal && typeof a.bgFocal === 'object' ? a.bgFocal : { x: 0.5, y: 0.5 };
	const showThumbs = !! context[ 'werun-community/carousel/showThumbs' ];
	// Same rule as render.php: with alt text the background image is read, else it's decorative.
	const bgAlt = String( a.bgAlt || '' ).trim();
	const { onlyImage, text } = useSelect(
		( select ) => {
			const blocks = select( blockEditorStore ).getBlocks( clientId );
			return {
				// A slide that is only its photo says nothing to a screen reader without alt text.
				onlyImage: hasBg && ! bgAlt && ! hasContent( blocks ),
				text: hasText( blocks ),
			};
		},
		[ hasBg, bgAlt, clientId ]
	);
	const around = useContextBackground( clientId );
	// Twin of render.php: overlay floor, tone, automatic text colour, readable accent.
	const c = slideColors( a, context, { text, around } );

	const blockProps = useBlockProps( {
		ref,
		className: cx( 'wrbc-slide', hasBg && 'has-bg-image', c.tone ),
		style: cssVars( {
			'--wrbc-focal': hasBg ? `${ Math.round( ( focal.x ?? 0.5 ) * 10000 ) / 100 }% ${ Math.round( ( focal.y ?? 0.5 ) * 10000 ) / 100 }%` : undefined,
			'--wrbc-overlay': c.overlay ? c.overlayColor : undefined,
			'--wrbc-overlay-o': c.overlay ? c.overlay / 100 : undefined,
			color: c.fg || undefined,
			'--wrbc-accent-text': c.accentText || undefined,
			'--wrbc-focus': c.accentText || undefined,
		} ),
	} );
	const innerBlocksProps = useInnerBlocksProps( { className: 'wrbc-slide__content' }, { template: SLIDE_TEMPLATE } );

	return (
		<>
			<ContrastAudit
				blockRef={ ref }
				deps={ [ attributes, context, around, text ] }
				actions={ [
					// The slide's own text colour (Color panel) is never changed for it: the author can drop it here.
					blockColors( a ).text && { label: __( 'Use the automatic text colour', 'werun-blocks-community' ), onClick: () => setAttributes( withoutTextColor( a ) ) },
				] }
			/>
			<InspectorControls>
				<PanelBody title={ __( 'Background image', 'werun-blocks-community' ) }>
					<ImageButtons
						id={ a.bgId }
						url={ a.bgUrl }
						// The library's alt text comes along, as the Cover block does; clear it for a decorative image.
						onSelect={ ( media ) => setAttributes( { bgId: media.id, bgUrl: media.sizes?.large?.url || media.url, bgAlt: media.alt || '' } ) }
						onRemove={ () => setAttributes( { bgId: undefined, bgUrl: '', bgAlt: '' } ) }
						addLabel={ __( 'Add a background image', 'werun-blocks-community' ) }
						replaceLabel={ __( 'Replace the background image', 'werun-blocks-community' ) }
						removeLabel={ __( 'Remove', 'werun-blocks-community' ) }
					/>
					{ hasBg && (
						<>
							{ onlyImage && (
								<Notice status="warning" isDismissible={ false }>
									{ __( 'This slide shows only its image: describe it below, so screen reader users get it too.', 'werun-blocks-community' ) }
								</Notice>
							) }
							<TextareaControl
								__nextHasNoMarginBottom
								label={ __( 'Alternative text', 'werun-blocks-community' ) }
								help={ __( 'Describe the image when it carries information the slide’s text doesn’t give. Leave it empty when it’s decorative.', 'werun-blocks-community' ) }
								value={ a.bgAlt || '' }
								onChange={ ( value ) => setAttributes( { bgAlt: value } ) }
							/>
							<FocalPointPicker
								__nextHasNoMarginBottom
								label={ __( 'Focal point', 'werun-blocks-community' ) }
								url={ a.bgUrl }
								value={ focal }
								onChange={ ( bgFocal ) => setAttributes( { bgFocal } ) }
							/>
							{ text ? (
								// Text on the photo: the range starts at the opacity that keeps it readable over any image (render.php clamps the same way).
								<OverlayOpacityControl value={ a.overlayOpacity } onChange={ ( overlayOpacity ) => setAttributes( { overlayOpacity } ) } overlayColor={ c.overlayColor } textColor={ c.textFor } max={ 90 } />
							) : (
								<RangeControl
									__nextHasNoMarginBottom
									__next40pxDefaultSize
									label={ __( 'Overlay opacity (%)', 'werun-blocks-community' ) }
									help={ __( 'No text on this slide: the overlay only tints the photo. Add text and it never goes under the opacity that keeps the text readable.', 'werun-blocks-community' ) }
									value={ c.overlay }
									min={ 0 }
									max={ 90 }
									step={ 5 }
									onChange={ ( overlayOpacity ) => setAttributes( { overlayOpacity } ) }
								/>
							) }
						</>
					) }
				</PanelBody>
				{ /* Same rule as render.php: the overlay is drawn over a photo with text, or when a tint was asked for. */ }
				{ hasBg && ( text || c.overlay > 0 ) && (
					<PanelColorSettings
						title={ __( 'Overlay', 'werun-blocks-community' ) }
						initialOpen={ false }
						colorSettings={ [
							{ value: a.overlayColor, onChange: ( overlayColor ) => setAttributes( { overlayColor: overlayColor || '' } ), label: __( 'Overlay colour', 'werun-blocks-community' ) },
						] }
					/>
				) }
				{ showThumbs && (
					<PanelBody title={ __( 'Thumbnail', 'werun-blocks-community' ) } initialOpen={ false }>
						<p className="wrbc-slide-edit__help">
							{ __( 'The thumbnail under the carousel shows this image, else the background image, else the first image in the slide, else the slide number.', 'werun-blocks-community' ) }
						</p>
						<ImageButtons
							id={ a.thumbId }
							url={ a.thumbUrl }
							onSelect={ ( media ) => setAttributes( { thumbId: media.id, thumbUrl: media.sizes?.thumbnail?.url || media.url } ) }
							onRemove={ () => setAttributes( { thumbId: undefined, thumbUrl: '' } ) }
							addLabel={ __( 'Choose a thumbnail', 'werun-blocks-community' ) }
							replaceLabel={ __( 'Replace the thumbnail', 'werun-blocks-community' ) }
							removeLabel={ __( 'Remove', 'werun-blocks-community' ) }
						/>
					</PanelBody>
				) }
			</InspectorControls>
			<div { ...blockProps }>
				{ hasBg && <img className="wrbc-slide__bg" src={ a.bgUrl } alt={ bgAlt } aria-hidden={ bgAlt ? undefined : 'true' } data-wrbc-backdrop="image" /> }
				{ c.overlay > 0 && <span className="wrbc-slide__overlay" aria-hidden="true" data-wrbc-backdrop="overlay" /> }
				<div { ...innerBlocksProps } />
			</div>
		</>
	);
}
