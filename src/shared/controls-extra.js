/**
 * Editor pieces for the shared modules (docs/shared-modules.md):
 *
 *   CarouselPanel        the Carousel panel (attributes named like testimonials')
 *   RuleRows             add / remove / reorder a list of rule rows
 *   ConsentControl       inherit | click | cmp | none
 *   MediaOrVideoControl  image from the media library, or a YouTube / Vimeo /
 *                        uploaded video with its poster, captions (uploaded
 *                        files) and transcript
 *
 * Every control is shown only when render.php would use it
 * (docs/block-controls-audit.md, rule 3).
 */
import { __, sprintf } from '@wordpress/i18n';
import {
	BaseControl,
	Button,
	Notice,
	PanelBody,
	RangeControl,
	SelectControl,
	TextareaControl,
	TextControl,
	ToggleControl,
} from '@wordpress/components';
import { MediaUpload, MediaUploadCheck } from '@wordpress/block-editor';
import { useInstanceId } from '@wordpress/compose';
import { Choice } from './controls';
import { IconControl } from './IconControl';
import { videoId, videoProvider } from './view/video-id';

export { videoId, videoProvider };

/* ── Carousel ────────────────────────────────────────────────────────── */

/**
 * Whether the controls row exists: arrows, dots or autoplay (its pause
 * button). Twin of wrbc_carousel_has_controls() in includes/modules/carousel.php.
 *
 * @param {Object} a Block attributes.
 */
export const carouselHasControls = ( a ) => !! ( a.showArrows || a.showDots || a.autoplay );

/**
 * The Carousel panel. Attributes: loop, autoplay, interval (2–20 s, as
 * wrbc_carousel_attrs() clamps), pauseOnHover, showArrows, showDots,
 * controlsPosition (top | bottom), prevIcon, nextIcon. A block without one
 * of them passes `without={ [ 'showDots' ] }` and so on.
 *
 * @param {Object}   props
 * @param {Object}   props.attributes
 * @param {Function} props.setAttributes
 * @param {string}   [props.title]
 * @param {boolean}  [props.initialOpen]
 * @param {string[]} [props.without]     Attribute names the block doesn't have.
 * @param {*}        [props.children]    Extra controls at the end of the panel.
 */
export function CarouselPanel( { attributes: a, setAttributes, title, initialOpen = false, without = [], children } ) {
	const has = ( name ) => ! without.includes( name );
	const toggle = ( name, label, help ) =>
		has( name ) && (
			<ToggleControl
				__nextHasNoMarginBottom
				label={ label }
				help={ help }
				checked={ !! a[ name ] }
				onChange={ ( value ) => setAttributes( { [ name ]: value } ) }
			/>
		);
	return (
		<PanelBody title={ title || __( 'Carousel', 'werun-blocks-community' ) } initialOpen={ initialOpen }>
			{ toggle( 'showArrows', __( 'Arrows', 'werun-blocks-community' ) ) }
			{ toggle( 'showDots', __( 'Dots', 'werun-blocks-community' ) ) }
			{ /* The row only exists when one of its parts is on. */ }
			{ has( 'controlsPosition' ) && carouselHasControls( a ) && (
				<Choice
					label={ __( 'Controls', 'werun-blocks-community' ) }
					value={ a.controlsPosition === 'top' ? 'top' : 'bottom' }
					options={ [
						[ 'top', __( 'Above', 'werun-blocks-community' ) ],
						[ 'bottom', __( 'Below', 'werun-blocks-community' ) ],
					] }
					onChange={ ( controlsPosition ) => setAttributes( { controlsPosition } ) }
				/>
			) }
			{ toggle(
				'loop',
				__( 'Loop back to the start', 'werun-blocks-community' ),
				a.loop ? undefined : __( 'The arrows and the keyboard stop at the ends, and autoplay stops at the last slide.', 'werun-blocks-community' )
			) }
			{ toggle( 'autoplay', __( 'Autoplay', 'werun-blocks-community' ), __( 'Adds a pause button, and never plays for visitors who ask for reduced motion.', 'werun-blocks-community' ) ) }
			{ a.autoplay && (
				<>
					{ has( 'interval' ) && (
						<RangeControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							label={ __( 'Seconds per slide', 'werun-blocks-community' ) }
							value={ a.interval }
							min={ 2 }
							max={ 20 }
							onChange={ ( interval ) => setAttributes( { interval } ) }
						/>
					) }
					{ toggle( 'pauseOnHover', __( 'Pause on hover', 'werun-blocks-community' ) ) }
				</>
			) }
			{ a.showArrows && (
				<>
					{ has( 'prevIcon' ) && (
						<IconControl label={ __( 'Previous arrow', 'werun-blocks-community' ) } value={ a.prevIcon } allowRemove={ false } onChange={ ( prevIcon ) => setAttributes( { prevIcon } ) } />
					) }
					{ has( 'nextIcon' ) && (
						<IconControl label={ __( 'Next arrow', 'werun-blocks-community' ) } value={ a.nextIcon } allowRemove={ false } onChange={ ( nextIcon ) => setAttributes( { nextIcon } ) } />
					) }
				</>
			) }
			{ children }
		</PanelBody>
	);
}

/* ── Rule rows ───────────────────────────────────────────────────────── */

/**
 * A list of rows (query filters, card fields…): add, remove, move up/down.
 * Rows are plain objects; `renderRow( row, index, update )` draws one, and
 * `update( patch )` merges into it.
 *
 * @param {Object}   props
 * @param {Object[]} props.rows
 * @param {Function} props.onChange     ( rows ) => void
 * @param {Function} props.renderRow    ( row, index, update ) => element
 * @param {string}   [props.addLabel]
 * @param {number}   [props.max]        No "Add" past this many.
 * @param {Function} [props.newRow]     () => a fresh row; default {}.
 * @param {string}   [props.label]      Heading above the list.
 * @param {Function} [props.rowLabel]   ( row, index ) => accessible name of a row.
 */
export function RuleRows( { rows, onChange, renderRow, addLabel, max = 20, newRow = () => ( {} ), label, rowLabel } ) {
	const list = Array.isArray( rows ) ? rows : [];
	const set = ( next ) => onChange( next );
	const update = ( i ) => ( patch ) => set( list.map( ( row, j ) => ( j === i ? { ...row, ...patch } : row ) ) );
	const move = ( i, by ) => {
		const next = [ ...list ];
		const [ row ] = next.splice( i, 1 );
		next.splice( i + by, 0, row );
		set( next );
	};
	const name = ( row, i ) => ( rowLabel ? rowLabel( row, i ) : sprintf( /* translators: %d: row number */ __( 'Row %d', 'werun-blocks-community' ), i + 1 ) );

	return (
		<div className="wrbc-rule-rows">
			{ label && <p className="wrbc-control-label">{ label }</p> }
			{ list.map( ( row, i ) => (
				<fieldset key={ i } className="wrbc-rule-rows__row" style={ { margin: '0 0 12px', padding: '8px 10px 4px', border: '1px solid #ddd', borderRadius: 4 } }>
					<legend className="screen-reader-text">{ name( row, i ) }</legend>
					{ renderRow( row, i, update( i ) ) }
					<div className="wrbc-rule-rows__actions" style={ { display: 'flex', gap: 4, justifyContent: 'flex-end', margin: '4px 0' } }>
						<Button
							size="small"
							icon="arrow-up-alt2"
							label={ sprintf( /* translators: %s: row name */ __( 'Move %s up', 'werun-blocks-community' ), name( row, i ) ) }
							disabled={ i === 0 }
							accessibleWhenDisabled
							onClick={ () => move( i, -1 ) }
						/>
						<Button
							size="small"
							icon="arrow-down-alt2"
							label={ sprintf( /* translators: %s: row name */ __( 'Move %s down', 'werun-blocks-community' ), name( row, i ) ) }
							disabled={ i === list.length - 1 }
							accessibleWhenDisabled
							onClick={ () => move( i, 1 ) }
						/>
						<Button
							size="small"
							icon="trash"
							isDestructive
							label={ sprintf( /* translators: %s: row name */ __( 'Remove %s', 'werun-blocks-community' ), name( row, i ) ) }
							onClick={ () => set( list.filter( ( _, j ) => j !== i ) ) }
						/>
					</div>
				</fieldset>
			) ) }
			{ list.length < max && (
				<Button variant="secondary" icon="plus-alt2" onClick={ () => set( [ ...list, newRow() ] ) }>
					{ addLabel || __( 'Add a rule', 'werun-blocks-community' ) }
				</Button>
			) }
		</div>
	);
}

/* ── Consent ─────────────────────────────────────────────────────────── */

const CONSENT_LABELS = () => ( {
	click: __( 'Ask with a click on each embed', 'werun-blocks-community' ),
	cmp: __( 'Follow the cookie banner', 'werun-blocks-community' ),
	none: __( 'Load right away', 'werun-blocks-community' ),
} );

/**
 * How a third-party embed asks for consent: '' (the site's setting under
 * Integrations → Privacy), click, cmp or none. Twin of wrbc_consent_mode().
 *
 * @param {Object}   props
 * @param {string}   props.value
 * @param {Function} props.onChange
 * @param {string}   [props.label]
 */
export function ConsentControl( { value, onChange, label } ) {
	const labels = CONSENT_LABELS();
	const site = window.wrbcSettings?.integrations?.privacy?.consent;
	const inherit = labels[ site ]
		? sprintf( /* translators: %s: the site's consent setting */ __( 'Site setting (%s)', 'werun-blocks-community' ), labels[ site ] )
		: __( 'Site setting', 'werun-blocks-community' );
	const current = [ 'click', 'cmp', 'none' ].includes( value ) ? value : '';
	return (
		<SelectControl
			__nextHasNoMarginBottom
			__next40pxDefaultSize
			label={ label || __( 'Privacy: load the embed', 'werun-blocks-community' ) }
			value={ current }
			options={ [
				{ value: '', label: inherit },
				{ value: 'click', label: labels.click },
				{ value: 'cmp', label: labels.cmp },
				{ value: 'none', label: labels.none },
			] }
			help={
				current === 'none'
					? __( 'The third party receives the visitor’s IP address on page load. Only choose this when your privacy policy covers it.', 'werun-blocks-community' )
					: undefined
			}
			onChange={ onChange }
		/>
	);
}

/* ── Media or video ──────────────────────────────────────────────────── */

const EMPTY_MEDIA = { type: 'image', id: 0, url: '', provider: '', videoId: '', posterId: 0, posterUrl: '', alt: '', captionsId: 0, captionsUrl: '', transcript: '' };

function MediaButton( { allowedTypes, id, onSelect, label, replaceLabel, hasValue } ) {
	return (
		<MediaUploadCheck>
			<MediaUpload
				allowedTypes={ allowedTypes }
				value={ id || undefined }
				onSelect={ onSelect }
				render={ ( { open } ) => (
					<Button variant="secondary" onClick={ open }>
						{ hasValue ? replaceLabel : label }
					</Button>
				) }
			/>
		</MediaUploadCheck>
	);
}

/**
 * An image from the media library, or a video: a YouTube / Vimeo URL (or
 * id), validated with the same patterns as wrbc_video_id(), or an uploaded
 * file; videos get a poster image, a title, a transcript (WCAG 1.2.1 /
 * 1.2.3) and, for an uploaded file, captions from a WebVTT file in the media
 * library (WCAG 1.2.2; printed as <track kind="captions">).
 *
 * value: { type: 'image' | 'video', id, url, provider: '' | 'youtube' | 'vimeo' | 'file',
 *          videoId, posterId, posterUrl, alt, captionsId, captionsUrl, transcript }
 * (`alt` is the image's alternative text, or the video's title: the shape
 * media-text stores.)
 *
 * @param {Object}   props
 * @param {Object}   props.value
 * @param {Function} props.onChange   ( value ) => void, always the full object.
 * @param {boolean}  [props.allowVideo]
 * @param {string}   [props.label]
 */
export function MediaOrVideoControl( { value, onChange, allowVideo = true, label } ) {
	const v = { ...EMPTY_MEDIA, ...( value && typeof value === 'object' ? value : {} ) };
	const type = allowVideo && v.type === 'video' ? 'video' : 'image';
	const set = ( patch ) => onChange( { ...v, ...patch } );
	const remote = v.provider === 'youtube' || v.provider === 'vimeo';
	const invalid = remote && v.url && ! v.videoId;
	// One id per instance; the label names the group (it isn't one field's <label>).
	const id = useInstanceId( MediaOrVideoControl, 'wrbc-media-or-video' );

	return (
		<BaseControl __nextHasNoMarginBottom className="wrbc-media-or-video">
			<div role="group" aria-labelledby={ label ? `${ id }-label` : undefined }>
				{ label && (
					<p className="wrbc-control-label" id={ `${ id }-label` }>
						{ label }
					</p>
				) }
				{ allowVideo && (
					<Choice
						label={ __( 'Media', 'werun-blocks-community' ) }
						value={ type }
						options={ [
							[ 'image', __( 'Image', 'werun-blocks-community' ) ],
							[ 'video', __( 'Video', 'werun-blocks-community' ) ],
						] }
						// A new kind of media starts empty: an image id isn't a video.
						onChange={ ( next ) => onChange( { ...EMPTY_MEDIA, type: next, provider: next === 'video' ? 'youtube' : '', posterId: v.posterId, posterUrl: v.posterUrl, alt: v.alt } ) }
					/>
				) }

				{ type === 'image' && (
					<>
						{ v.url && <img src={ v.url } alt="" style={ { display: 'block', maxWidth: '100%', margin: '8px 0', borderRadius: 4 } } /> }
						<div style={ { display: 'flex', gap: 8, margin: '8px 0' } }>
							<MediaButton
								allowedTypes={ [ 'image' ] }
								id={ v.id }
								hasValue={ !! v.url }
								label={ __( 'Choose an image', 'werun-blocks-community' ) }
								replaceLabel={ __( 'Replace', 'werun-blocks-community' ) }
								// The new image's own alt text: the old one described another picture.
								onSelect={ ( media ) => set( { id: media.id, url: media.url, alt: media.alt || '' } ) }
							/>
							{ v.url && (
								<Button variant="tertiary" isDestructive onClick={ () => set( { id: 0, url: '', alt: '' } ) }>
									{ __( 'Remove', 'werun-blocks-community' ) }
								</Button>
							) }
						</div>
						{ v.url && (
							<TextControl
								__nextHasNoMarginBottom
								__next40pxDefaultSize
								label={ __( 'Alternative text', 'werun-blocks-community' ) }
								help={ __( 'Leave empty when the image is decorative.', 'werun-blocks-community' ) }
								value={ v.alt }
								onChange={ ( alt ) => set( { alt } ) }
							/>
						) }
					</>
				) }

				{ type === 'video' && (
					<>
						<SelectControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							label={ __( 'Source', 'werun-blocks-community' ) }
							value={ v.provider || 'youtube' }
							options={ [
								{ value: 'youtube', label: 'YouTube' },
								{ value: 'vimeo', label: 'Vimeo' },
								{ value: 'file', label: __( 'Uploaded file', 'werun-blocks-community' ) },
							] }
							// Captions are timed to one file: they go with it.
							onChange={ ( provider ) => set( { provider, id: 0, url: '', videoId: '', captionsId: 0, captionsUrl: '' } ) }
						/>
						{ v.provider !== 'file' && (
							<TextControl
								__nextHasNoMarginBottom
								__next40pxDefaultSize
								type="url"
								label={ v.provider === 'vimeo' ? __( 'Vimeo URL', 'werun-blocks-community' ) : __( 'YouTube URL', 'werun-blocks-community' ) }
								placeholder={ v.provider === 'vimeo' ? 'https://vimeo.com/123456789' : 'https://www.youtube.com/watch?v=…' }
								value={ v.url }
								onChange={ ( url ) => {
									// A pasted link from the other service switches the source.
									const provider = videoProvider( url ) || v.provider || 'youtube';
									set( { url, provider, videoId: videoId( provider, url ) } );
								} }
							/>
						) }
						{ invalid && (
							<Notice status="warning" isDismissible={ false }>
								{ __( 'That isn’t a link to a single video. Paste the address of the video’s page or its share link.', 'werun-blocks-community' ) }
							</Notice>
						) }
						{ v.provider === 'file' && (
							<div style={ { display: 'flex', gap: 8, margin: '8px 0', alignItems: 'center', flexWrap: 'wrap' } }>
								{ v.url && <code style={ { wordBreak: 'break-all' } }>{ v.url.split( '/' ).pop() }</code> }
								<MediaButton
									allowedTypes={ [ 'video' ] }
									id={ v.id }
									hasValue={ !! v.url }
									label={ __( 'Choose a video', 'werun-blocks-community' ) }
									replaceLabel={ __( 'Replace', 'werun-blocks-community' ) }
									onSelect={ ( media ) => set( { id: media.id, url: media.url, videoId: '', captionsId: 0, captionsUrl: '' } ) }
								/>
							</div>
						) }
						{ v.provider === 'file' && v.url && (
							<div style={ { display: 'flex', gap: 8, margin: '8px 0', alignItems: 'center', flexWrap: 'wrap' } }>
								{ v.captionsUrl && <code style={ { wordBreak: 'break-all' } }>{ v.captionsUrl.split( '/' ).pop() }</code> }
								<MediaButton
									allowedTypes={ [ 'text/vtt' ] }
									id={ v.captionsId }
									hasValue={ !! v.captionsUrl }
									label={ __( 'Choose captions (.vtt)', 'werun-blocks-community' ) }
									replaceLabel={ __( 'Replace captions', 'werun-blocks-community' ) }
									onSelect={ ( media ) => set( { captionsId: media.id, captionsUrl: media.url } ) }
								/>
								{ v.captionsUrl && (
									<Button variant="tertiary" isDestructive onClick={ () => set( { captionsId: 0, captionsUrl: '' } ) }>
										{ __( 'Remove captions', 'werun-blocks-community' ) }
									</Button>
								) }
							</div>
						) }

						<p className="wrbc-control-label" style={ { margin: '12px 0 4px' } }>
							{ __( 'Poster', 'werun-blocks-community' ) }
						</p>
						{ v.posterUrl && <img src={ v.posterUrl } alt="" style={ { display: 'block', maxWidth: '100%', margin: '0 0 8px', borderRadius: 4 } } /> }
						<div style={ { display: 'flex', gap: 8, margin: '0 0 8px' } }>
							<MediaButton
								allowedTypes={ [ 'image' ] }
								id={ v.posterId }
								hasValue={ !! v.posterUrl }
								label={ __( 'Choose a poster', 'werun-blocks-community' ) }
								replaceLabel={ __( 'Replace poster', 'werun-blocks-community' ) }
								// The poster's alt describes a still, not the video: the title stays as it is.
								onSelect={ ( media ) => set( { posterId: media.id, posterUrl: media.url } ) }
							/>
							{ v.posterUrl && (
								<Button variant="tertiary" isDestructive onClick={ () => set( { posterId: 0, posterUrl: '' } ) }>
									{ __( 'Remove', 'werun-blocks-community' ) }
								</Button>
							) }
						</div>
						{ ! v.posterUrl && remote && (
							<p style={ { margin: 0, color: '#757575', fontSize: 12 } }>
								{ __( 'Without a poster the play button shows on a plain background: the provider’s thumbnail would load from its servers before consent.', 'werun-blocks-community' ) }
							</p>
						) }
						<TextControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							label={ __( 'Video title', 'werun-blocks-community' ) }
							help={ __( 'Names the play button and the player for screen readers.', 'werun-blocks-community' ) }
							value={ v.alt }
							onChange={ ( alt ) => set( { alt } ) }
						/>
						<TextareaControl
							__nextHasNoMarginBottom
							label={ __( 'Transcript', 'werun-blocks-community' ) }
							help={ __( 'What is said and shown in the video, for people who can’t hear or see it. Empty: none.', 'werun-blocks-community' ) }
							value={ v.transcript }
							onChange={ ( transcript ) => set( { transcript } ) }
						/>
					</>
				) }
			</div>
		</BaseControl>
	);
}
