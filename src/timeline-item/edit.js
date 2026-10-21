import { __, sprintf } from '@wordpress/i18n';
import { InspectorControls, MediaUpload, MediaUploadCheck, RichText, useBlockProps } from '@wordpress/block-editor';
import { Button, PanelBody, TextareaControl, TextControl } from '@wordpress/components';
import { Icon } from '../shared/icons';
import { IconControl } from '../shared/IconControl';
import { cssVars, cx, Toggle } from '../shared/controls';
import { blockColors, useContextBackground } from '../shared/contrast';
import { cardColors, itemTitleLevel } from '../timeline/effective';
import { timelineDatetime } from './datetime';

const MARKERS = [ 'dot', 'icon', 'number', 'year' ];

export default function Edit( { attributes, setAttributes, context, clientId } ) {
	const a = attributes;
	const get = ( key, fallback ) => context[ `werun-community/timeline/${ key }` ] ?? fallback;
	const marker = MARKERS.includes( get( 'markerStyle', 'dot' ) ) ? get( 'markerStyle', 'dot' ) : 'dot';
	// Twin of render.php: one level below a printed section title.
	const level = itemTitleLevel( {
		showHeader: get( 'showHeader', false ),
		title: get( 'title', '' ),
		titleLevel: get( 'titleLevel', 2 ),
		itemTitleLevel: get( 'itemTitleLevel', 3 ),
	} );
	const showImages = get( 'showImages', true );
	// A card with its own background on the surface the timeline sits on
	// (twin of wrbc_timeline_card_colors() in render.php).
	const surface = useContextBackground( clientId );
	const cardText = blockColors( { textColor: get( 'textColor', '' ), style: get( 'style', {} ) } ).text;
	const card = cardColors( get( 'cardStyle', 'bordered' ), get( 'cardBg', '' ), get( 'accentColor', '' ), surface, cardText );
	// Twin of render.php: with year markers the date is the marker; otherwise
	// in the card or on the other side of the line.
	let dateAt = get( 'datePosition', 'card' ) === 'opposite' ? 'opposite' : 'card';
	if ( marker === 'year' ) {
		dateAt = 'marker';
	}
	// Its own icon, or the timeline's while it has none ({} hides it here).
	const ownIcon = !! a.icon && typeof a.icon === 'object';
	const icon = ownIcon ? a.icon : get( 'markerIcon', { name: 'circle-check' } );
	const datetime = timelineDatetime( a.date, a.dateTime );
	// As render.php: <time> is printed only around a date that is there.
	const hasDate = String( a.date ?? '' ).replace( /<[^>]*>/g, '' ).trim() !== '';

	const blockProps = useBlockProps( {
		className: cx( 'wrbc-timeline-item wrbc-anim-host', a.highlight && 'is-highlight', dateAt === 'opposite' && 'has-opposite-date' ),
	} );

	const date = ( className ) => (
		<RichText
			tagName="p"
			className={ className }
			value={ a.date }
			onChange={ ( value ) => setAttributes( { date: value } ) }
			placeholder={ __( 'Date', 'werun-blocks-community' ) }
			allowedFormats={ [] }
			disableLineBreaks
		/>
	);

	return (
		<>
			<InspectorControls>
				<PanelBody title={ __( 'Item', 'werun-blocks-community' ) }>
					{ hasDate && (
						<TextControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							label={ __( 'Date for search engines (optional)', 'werun-blocks-community' ) }
							value={ a.dateTime || '' }
							placeholder="2021-03"
							help={
								datetime
									? sprintf(
											/* translators: %s: a date like 2021-03. */
											__( 'Marked up as the date %s.', 'werun-blocks-community' ),
											datetime
									  )
									: __( 'The label is not read as a date (fine for "Step 1" or "Q3"). Type YYYY, YYYY-MM or YYYY-MM-DD here to mark it up as one.', 'werun-blocks-community' )
							}
							onChange={ ( dateTime ) => setAttributes( { dateTime } ) }
						/>
					) }
					{ marker === 'icon' && (
						<>
							<IconControl
								label={ __( 'Icon on the line', 'werun-blocks-community' ) }
								value={ icon }
								help={ ownIcon ? undefined : __( "The timeline's icon. Change it here for this item only.", 'werun-blocks-community' ) }
								onChange={ ( value ) => setAttributes( { icon: value || {} } ) }
							/>
							{ ownIcon && (
								<Button variant="link" onClick={ () => setAttributes( { icon: undefined } ) }>
									{ __( "Use the timeline's icon", 'werun-blocks-community' ) }
								</Button>
							) }
						</>
					) }
					<Toggle attributes={ a } setAttributes={ setAttributes } name="highlight" label={ __( 'Highlight this item', 'werun-blocks-community' ) } />
				</PanelBody>
				{ showImages && (
					<PanelBody title={ __( 'Image', 'werun-blocks-community' ) } initialOpen={ false }>
						<MediaUploadCheck>
							<MediaUpload
								allowedTypes={ [ 'image' ] }
								value={ a.imageId || undefined }
								onSelect={ ( media ) => setAttributes( { imageId: media.id || 0, imageUrl: media.url || '', imageAlt: media.alt || '' } ) }
								render={ ( { open } ) => (
									<Button variant="secondary" onClick={ open }>
										{ a.imageUrl ? __( 'Replace image', 'werun-blocks-community' ) : __( 'Choose image', 'werun-blocks-community' ) }
									</Button>
								) }
							/>
						</MediaUploadCheck>
						{ a.imageUrl && (
							<>
								<Button variant="tertiary" isDestructive onClick={ () => setAttributes( { imageId: 0, imageUrl: '', imageAlt: '' } ) }>
									{ __( 'Remove', 'werun-blocks-community' ) }
								</Button>
								<TextareaControl
									__nextHasNoMarginBottom
									label={ __( 'Alternative text', 'werun-blocks-community' ) }
									help={ __( 'Describe the image; leave empty if it is only decoration.', 'werun-blocks-community' ) }
									value={ a.imageAlt || '' }
									onChange={ ( imageAlt ) => setAttributes( { imageAlt } ) }
								/>
							</>
						) }
					</PanelBody>
				) }
			</InspectorControls>

			<li { ...blockProps }>
				{ /* As render.php: the highlight said in words too. */ }
				{ a.highlight && <span className="wrbc-sr-only">{ __( 'Highlighted:', 'werun-blocks-community' ) } </span> }
				{ dateAt === 'opposite' && date( 'wrbc-timeline-item__date wrbc-timeline-item__date--opposite' ) }
				<div className="wrbc-timeline-item__axis">
					{ marker === 'year' ? (
						<div className="wrbc-timeline-item__marker wrbc-timeline-item__marker--year">{ date( 'wrbc-timeline-item__year' ) }</div>
					) : (
						// As render.php: an item without an icon gets a plain dot.
						<div className={ `wrbc-timeline-item__marker wrbc-timeline-item__marker--${ marker === 'icon' && ! icon?.name ? 'dot' : marker }` } aria-hidden="true">
							{ marker === 'icon' && <Icon icon={ icon } /> }
						</div>
					) }
				</div>
				<div className={ cx( 'wrbc-timeline-item__card', card.className ) } style={ cssVars( card.vars ) }>
					{ showImages && a.imageUrl && <img className="wrbc-timeline-item__img" src={ a.imageUrl } alt={ a.imageAlt || '' } /> }
					{ dateAt === 'card' && date( 'wrbc-timeline-item__date' ) }
					<RichText
						tagName={ `h${ level }` }
						className="wrbc-timeline-item__title"
						value={ a.title }
						onChange={ ( title ) => setAttributes( { title } ) }
						placeholder={ __( 'What happened', 'werun-blocks-community' ) }
						allowedFormats={ [ 'core/bold', 'core/italic' ] }
					/>
					<RichText
						tagName="p"
						className="wrbc-timeline-item__text"
						value={ a.text }
						onChange={ ( text ) => setAttributes( { text } ) }
						placeholder={ __( 'A sentence or two about it.', 'werun-blocks-community' ) }
						allowedFormats={ [ 'core/bold', 'core/italic', 'core/link' ] }
					/>
				</div>
			</li>
		</>
	);
}
