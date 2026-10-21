import { __, sprintf } from '@wordpress/i18n';
import { useRef } from '@wordpress/element';
import {
	InspectorControls,
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
	Placeholder,
	RangeControl,
	SelectControl,
	TextareaControl,
	TextControl,
	ToggleControl,
} from '@wordpress/components';
import { Choice, cssVars, cx, Toggle } from '../shared/controls';
import { ContrastAudit } from '../shared/a11y';
import {
	accentVars,
	toneClass,
	useContextBackground,
	useSurface,
} from '../shared/contrast';
import { ConsentControl } from './consent-control';
import { effective, em, HOST, parseVideoUrl, playColors } from './source';

const RATIOS = [
	{ value: '16/9', label: '16:9' },
	{ value: '4/3', label: '4:3' },
	{ value: '1/1', label: '1:1' },
	{ value: '9/16', label: '9:16' },
	{ value: '21/9', label: '21:9' },
];

const PlayIcon = () => (
	<svg
		className="wrbc-video__play-svg"
		viewBox="0 0 24 24"
		width="24"
		height="24"
		aria-hidden="true"
		focusable="false"
	>
		<path d="M8 5.14v13.72a1 1 0 0 0 1.5.86l11-6.86a1 1 0 0 0 0-1.72l-11-6.86A1 1 0 0 0 8 5.14z" />
	</svg>
);

/**
 * Choose / replace / remove one media library file.
 * @param root0
 * @param root0.label
 * @param root0.allowedTypes
 * @param root0.id
 * @param root0.url
 * @param root0.onSelect
 * @param root0.onRemove
 * @param root0.chooseLabel
 * @param root0.replaceLabel
 * @param root0.removeLabel
 */
function MediaField( {
	label,
	allowedTypes,
	id,
	url,
	onSelect,
	onRemove,
	chooseLabel,
	replaceLabel,
	removeLabel,
} ) {
	return (
		<div className="wrbc-video-media-field">
			{ label && <p className="wrbc-control-label">{ label }</p> }
			{ url && (
				<p className="wrbc-video-media-field__file">
					{ url.split( '/' ).pop() }
				</p>
			) }
			<MediaUploadCheck>
				<MediaUpload
					allowedTypes={ allowedTypes }
					value={ id }
					onSelect={ onSelect }
					render={ ( { open } ) => (
						<Button variant="secondary" onClick={ open }>
							{ url ? replaceLabel : chooseLabel }
						</Button>
					) }
				/>
			</MediaUploadCheck>
			{ url && (
				<Button variant="tertiary" isDestructive onClick={ onRemove }>
					{ removeLabel }
				</Button>
			) }
		</div>
	);
}

export default function Edit( { attributes, setAttributes, clientId, name } ) {
	const a = attributes;
	const ref = useRef();
	// Same effective values as render.php (twin: wrbc_video_block_effective()).
	const e = effective( a );
	// What the block's text and focus ring sit on, as render.php decides it (wrbc_surface()).
	const surface = useSurface( clientId, a, name );
	const around = useContextBackground( clientId );
	const uid = `wrbc-video-${ clientId.slice( 0, 8 ) }`;
	const title = a.title?.trim() || '';
	// The play button's name, as render.php prints it: "Play video: <title>", or just "Play video".
	const playLabel = title
		? sprintf(
				/* translators: %s: video title */ __(
					'Play video: %s',
					'werun-blocks-community'
				),
				title
			)
		: __( 'Play video', 'werun-blocks-community' );
	const isBackground = e.mode === 'background';
	const consentNote = e.thirdParty && e.consent !== 'none';
	const playStyle = [ 'circle', 'square', 'pill' ].includes( a.playStyle )
		? a.playStyle
		: 'circle';
	// The badge's icon reads on its button (twin: wrbc_video_block_play_colors()).
	const play = ! isBackground
		? playColors( a, playStyle )
		: { bg: '', fg: '', chosen: '' };
	const iconAdjusted =
		!! play.chosen && play.fg.toLowerCase() !== play.chosen.toLowerCase();
	const describedUrl = a.describedUrl?.trim() || '';
	// As render.php's esc_url( …, [ http, https ] ): a web or relative address, never javascript: and the like.
	const describedOk =
		!! describedUrl &&
		( /^https?:\/\//i.test( describedUrl ) ||
			! /^[a-z][a-z0-9+.-]*:/i.test( describedUrl ) );

	const blockProps = useBlockProps( {
		ref,
		className: cx(
			'wrbc-root wrbc-video',
			`wrbc-video--${ e.mode }`,
			`wrbc-video--${ e.provider }`,
			toneClass( surface, around ),
			! isBackground && `wrbc-video--play-${ playStyle }`,
			e.poster && 'has-poster'
		),
		style: cssVars( {
			...accentVars( a, surface ),
			'--wrbc-video-ratio': e.ratio.replace( '/', ' / ' ),
			'--wrbc-video-radius': em( e.radius ),
			'--wrbc-video-play': ! isBackground ? em( e.playSize ) : undefined,
			'--wrbc-video-play-bg': play.bg,
			'--wrbc-video-play-fg': play.fg,
		} ),
	} );

	const setUrl = ( url ) =>
		setAttributes( { url, videoId: parseVideoUrl( e.provider, url ) } );
	const setProvider = ( provider ) =>
		setAttributes( {
			provider,
			// Re-read the pasted URL for the new provider; a stale id would be wrong.
			videoId:
				provider === 'file' ? '' : parseVideoUrl( provider, a.url ),
		} );
	const urlInvalid = e.thirdParty && !! a.url?.trim() && ! e.id;

	const modeOptions = [
		[ 'inline', __( 'In the page', 'werun-blocks-community' ) ],
		[ 'modal', __( 'Window', 'werun-blocks-community' ) ],
		...( e.provider === 'file'
			? [ [ 'background', __( 'Background', 'werun-blocks-community' ) ] ]
			: [] ),
	];

	const sourceFields = (
		<>
			<Choice
				label={ __( 'Source', 'werun-blocks-community' ) }
				value={ e.provider }
				options={ [
					[ 'youtube', 'YouTube' ],
					[ 'vimeo', 'Vimeo' ],
					[ 'file', __( 'File', 'werun-blocks-community' ) ],
				] }
				onChange={ setProvider }
			/>
			{ e.thirdParty ? (
				<TextControl
					__nextHasNoMarginBottom
					__next40pxDefaultSize
					type="url"
					label={
						e.provider === 'youtube'
							? __( 'YouTube URL', 'werun-blocks-community' )
							: __( 'Vimeo URL', 'werun-blocks-community' )
					}
					value={ a.url }
					onChange={ setUrl }
					placeholder={
						e.provider === 'youtube'
							? 'https://www.youtube.com/watch?v=…'
							: 'https://vimeo.com/…'
					}
					help={
						urlInvalid
							? __(
									'This is not a link to a video on this provider.',
									'werun-blocks-community'
								)
							: e.id &&
								sprintf(
									/* translators: %s: video id */ __(
										'Video id: %s',
										'werun-blocks-community'
									),
									e.id
								)
					}
				/>
			) : (
				<MediaField
					allowedTypes={ [ 'video' ] }
					id={ a.fileId }
					url={ a.fileUrl }
					onSelect={ ( media ) =>
						setAttributes( {
							fileId: media?.id,
							fileUrl: media?.url || '',
							...( ! a.title &&
								media?.title && { title: media.title } ),
						} )
					}
					onRemove={ () =>
						setAttributes( { fileId: undefined, fileUrl: '' } )
					}
					chooseLabel={ __( 'Choose a video', 'werun-blocks-community' ) }
					replaceLabel={ __( 'Replace video', 'werun-blocks-community' ) }
					removeLabel={ __( 'Remove video', 'werun-blocks-community' ) }
				/>
			) }
		</>
	);

	return (
		<>
			<ContrastAudit
				blockRef={ ref }
				deps={ [ attributes, surface ] }
				checks={ [
					{
						selector: '.wrbc-video__play-svg',
						property: 'fill',
						min: 3,
						label: __( 'Play icon', 'werun-blocks-community' ),
					},
					{
						selector: '.wrbc-video__toggle svg',
						property: 'fill',
						against: 'self',
						min: 3,
						label: __( 'Pause button', 'werun-blocks-community' ),
					},
				] }
			/>
			<InspectorControls>
				<PanelBody title={ __( 'Video', 'werun-blocks-community' ) }>
					{ sourceFields }
					{ ( ! isBackground || a.schema ) && (
						<TextControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							label={ __( 'Title', 'werun-blocks-community' ) }
							help={ __(
								'Read out by screen readers ("Play video: …"), the window’s name and the schema name.',
								'werun-blocks-community'
							) }
							value={ a.title }
							onChange={ ( value ) =>
								setAttributes( { title: value } )
							}
						/>
					) }
					{ ! isBackground && ! title && (
						<Notice status="warning" isDismissible={ false }>
							{ __(
								'Without a title, screen readers only hear “Play video”: with several videos on a page, nobody can tell them apart.',
								'werun-blocks-community'
							) }
						</Notice>
					) }
				</PanelBody>

				<PanelBody
					title={ __( 'Display', 'werun-blocks-community' ) }
					initialOpen={ false }
				>
					<Choice
						label={ __( 'Plays', 'werun-blocks-community' ) }
						// A window waiting for its poster stays selected (the notice below says why it plays in the page).
						value={
							a.mode === 'modal' &&
							e.mode === 'inline' &&
							! e.poster
								? 'modal'
								: e.mode
						}
						options={ modeOptions }
						onChange={ ( mode ) => setAttributes( { mode } ) }
					/>
					{ a.mode === 'modal' && ! e.poster && (
						<Notice status="warning" isDismissible={ false }>
							{ __(
								'The window mode needs a poster: until there is one, the video plays in the page.',
								'werun-blocks-community'
							) }
						</Notice>
					) }
					{ isBackground && (
						<p className="components-base-control__help">
							{ __(
								'Muted, looping, without sound or controls, with a pause button. Visitors who prefer reduced motion or save data see the poster.',
								'werun-blocks-community'
							) }{ ' ' }
							{ __(
								'Screen readers skip it as decoration: when the video carries information, play it in the page or in a window, with captions or a transcript.',
								'werun-blocks-community'
							) }
						</p>
					) }
					<SelectControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Aspect ratio', 'werun-blocks-community' ) }
						value={ e.ratio }
						options={ RATIOS }
						onChange={ ( ratio ) => setAttributes( { ratio } ) }
					/>
					{ ! isBackground && (
						<TextControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							type="number"
							label={ __( 'Start at (seconds)', 'werun-blocks-community' ) }
							min={ 0 }
							max={ 86400 }
							value={ String( e.start ) }
							onChange={ ( value ) =>
								setAttributes( {
									start: Math.max(
										0,
										Math.min(
											86400,
											parseInt( value, 10 ) || 0
										)
									),
								} )
							}
						/>
					) }
					<RangeControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Rounded corners (px)', 'werun-blocks-community' ) }
						value={ e.radius }
						min={ 0 }
						max={ 48 }
						onChange={ ( radius ) => setAttributes( { radius } ) }
					/>
				</PanelBody>

				<PanelBody
					title={ __( 'Poster', 'werun-blocks-community' ) }
					initialOpen={ false }
				>
					<MediaField
						allowedTypes={ [ 'image' ] }
						id={ a.posterId }
						url={ a.posterUrl }
						onSelect={ ( media ) =>
							setAttributes( {
								posterId: media?.id,
								posterUrl: media?.url || '',
							} )
						}
						onRemove={ () =>
							setAttributes( {
								posterId: undefined,
								posterUrl: '',
							} )
						}
						chooseLabel={ __( 'Choose a poster', 'werun-blocks-community' ) }
						replaceLabel={ __( 'Replace poster', 'werun-blocks-community' ) }
						removeLabel={ __( 'Remove poster', 'werun-blocks-community' ) }
					/>
					{ e.provider === 'youtube' && ! a.posterUrl && (
						<Toggle
							attributes={ a }
							setAttributes={ setAttributes }
							name="useProviderThumb"
							label={ __(
								'Use YouTube’s thumbnail',
								'werun-blocks-community'
							) }
							help={ __(
								'Privacy: the thumbnail loads from i.ytimg.com (Google) as soon as the page opens, before the visitor clicks or consents. Upload a poster to avoid it.',
								'werun-blocks-community'
							) }
						/>
					) }
				</PanelBody>

				{ e.provider === 'file' && ! isBackground && (
					<PanelBody
						title={ __( 'Captions', 'werun-blocks-community' ) }
						// Open while the video has none: they're how deaf and hard-of-hearing visitors follow it.
						initialOpen={ ! e.hasCaptions }
					>
						{ ! e.hasCaptions && (
							<Notice status="warning" isDismissible={ false }>
								{ __(
									'Add a captions file (WebVTT) unless the video has no speech or sound that matters: people who can’t hear the audio need them (WCAG 1.2.2).',
									'werun-blocks-community'
								) }
							</Notice>
						) }
						<MediaField
							allowedTypes={ [ 'text/vtt' ] }
							id={ a.captionsId }
							url={ a.captionsUrl }
							onSelect={ ( media ) =>
								setAttributes( {
									captionsId: media?.id,
									captionsUrl: media?.url || '',
								} )
							}
							onRemove={ () =>
								setAttributes( {
									captionsId: undefined,
									captionsUrl: '',
								} )
							}
							chooseLabel={ __(
								'Choose a WebVTT file',
								'werun-blocks-community'
							) }
							replaceLabel={ __(
								'Replace captions',
								'werun-blocks-community'
							) }
							removeLabel={ __(
								'Remove captions',
								'werun-blocks-community'
							) }
						/>
						{ e.hasCaptions && (
							<>
								<TextControl
									__nextHasNoMarginBottom
									__next40pxDefaultSize
									label={ __(
										'Language code',
										'werun-blocks-community'
									) }
									help={ __(
										'e.g. en, es, pt-BR. Empty: the site language.',
										'werun-blocks-community'
									) }
									value={ a.captionsLang }
									onChange={ ( captionsLang ) =>
										setAttributes( { captionsLang } )
									}
								/>
								<TextControl
									__nextHasNoMarginBottom
									__next40pxDefaultSize
									label={ __(
										'Label in the player',
										'werun-blocks-community'
									) }
									value={ a.captionsLabel }
									placeholder={ __(
										'Captions',
										'werun-blocks-community'
									) }
									onChange={ ( captionsLabel ) =>
										setAttributes( { captionsLabel } )
									}
								/>
							</>
						) }
					</PanelBody>
				) }

				{ ! isBackground && (
					<PanelBody
						title={ __( 'Play button', 'werun-blocks-community' ) }
						initialOpen={ false }
					>
						<Choice
							label={ __( 'Style', 'werun-blocks-community' ) }
							value={ playStyle }
							options={ [
								[ 'circle', __( 'Circle', 'werun-blocks-community' ) ],
								[ 'square', __( 'Square', 'werun-blocks-community' ) ],
								[ 'pill', __( 'With text', 'werun-blocks-community' ) ],
							] }
							onChange={ ( value ) =>
								setAttributes( { playStyle: value } )
							}
						/>
						<RangeControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							label={ __(
								'Size (px at the base font size)',
								'werun-blocks-community'
							) }
							value={ e.playSize }
							min={ 40 }
							max={ 160 }
							onChange={ ( playSize ) =>
								setAttributes( { playSize } )
							}
						/>
					</PanelBody>
				) }
				{ ! isBackground && (
					<PanelColorSettings
						title={ __( 'Play button colours', 'werun-blocks-community' ) }
						initialOpen={ false }
						colorSettings={ [
							{
								value: a.playColor,
								onChange: ( playColor ) =>
									setAttributes( { playColor } ),
								label: __( 'Button', 'werun-blocks-community' ),
							},
							{
								value: a.playIconColor,
								onChange: ( playIconColor ) =>
									setAttributes( { playIconColor } ),
								label: __( 'Icon and text', 'werun-blocks-community' ),
							},
						] }
					>
						{ iconAdjusted && (
							<Notice status="info" isDismissible={ false }>
								{ sprintf(
									/* translators: %s: a colour such as #1f2937 */ __(
										'The icon shows as %s: the closest colour to yours that stands out on the button (3:1, or 4.5:1 with the “Play video” text). Your colour is kept, and comes back if the button colour allows it.',
										'werun-blocks-community'
									),
									play.fg
								) }
							</Notice>
						) }
					</PanelColorSettings>
				) }

				<PanelBody
					title={ __(
						'Caption, transcript and audio description',
						'werun-blocks-community'
					) }
					initialOpen={ false }
				>
					<Toggle
						attributes={ a }
						setAttributes={ setAttributes }
						name="showCaption"
						label={ __(
							'Caption under the video',
							'werun-blocks-community'
						) }
					/>
					<Toggle
						attributes={ a }
						setAttributes={ setAttributes }
						name="showTranscript"
						label={ __( 'Transcript', 'werun-blocks-community' ) }
						help={ __(
							'A collapsible text version: needed for people who can’t hear or see the video (WCAG 1.2).',
							'werun-blocks-community'
						) }
					/>
					<TextControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						type="url"
						label={ __(
							'Audio-described version (URL)',
							'werun-blocks-community'
						) }
						help={ __(
							'The same video with a narrator describing what’s on screen, for people who can’t see it (WCAG 1.2.5): needed when the picture shows something the soundtrack doesn’t say. A link to it shows under the video.',
							'werun-blocks-community'
						) }
						value={ a.describedUrl }
						placeholder="https://"
						onChange={ ( value ) =>
							setAttributes( { describedUrl: value } )
						}
					/>
					{ describedUrl && ! describedOk && (
						<Notice status="warning" isDismissible={ false }>
							{ __(
								'This isn’t a web address: no link shows on the page.',
								'werun-blocks-community'
							) }
						</Notice>
					) }
					{ describedOk && (
						<ToggleControl
							__nextHasNoMarginBottom
							label={ __( 'Open in a new tab', 'werun-blocks-community' ) }
							checked={ !! a.describedNewTab }
							onChange={ ( value ) =>
								setAttributes( { describedNewTab: value } )
							}
						/>
					) }
					{ e.thirdParty && (
						<p className="components-base-control__help">
							{ e.provider === 'youtube'
								? __(
										'Captions come from YouTube: upload or check them in YouTube Studio, and visitors turn them on with the player’s CC button.',
										'werun-blocks-community'
									)
								: __(
										'Captions come from Vimeo: upload them in the video’s settings on Vimeo, and visitors turn them on with the player’s CC button.',
										'werun-blocks-community'
									) }
						</p>
					) }
				</PanelBody>

				{ e.thirdParty && (
					<PanelBody
						title={ __( 'Privacy', 'werun-blocks-community' ) }
						initialOpen={ false }
					>
						<ConsentControl
							value={ a.consent }
							onChange={ ( consent ) =>
								setAttributes( { consent } )
							}
							help={ sprintf(
								/* translators: %s: host name */
								__(
									'Nothing loads from %s until the visitor plays the video; this decides whether a consent step comes first.',
									'werun-blocks-community'
								),
								HOST[ e.provider ]
							) }
						/>
					</PanelBody>
				) }

				<PanelBody
					title={ __( 'Search engines', 'werun-blocks-community' ) }
					initialOpen={ false }
				>
					<Toggle
						attributes={ a }
						setAttributes={ setAttributes }
						name="schema"
						label={ __(
							'VideoObject schema (JSON-LD)',
							'werun-blocks-community'
						) }
					/>
					{ a.schema && (
						<>
							{ ( ! a.title?.trim() || ! e.poster ) && (
								<Notice
									status="warning"
									isDismissible={ false }
								>
									{ __(
										'The schema needs a title and a poster; it is left out until both are set.',
										'werun-blocks-community'
									) }
								</Notice>
							) }
							<TextareaControl
								__nextHasNoMarginBottom
								label={ __( 'Description', 'werun-blocks-community' ) }
								help={ __(
									'Empty: the caption, or the title.',
									'werun-blocks-community'
								) }
								value={ a.schemaDescription }
								onChange={ ( schemaDescription ) =>
									setAttributes( { schemaDescription } )
								}
							/>
							<TextControl
								__nextHasNoMarginBottom
								__next40pxDefaultSize
								type="date"
								label={ __( 'Upload date', 'werun-blocks-community' ) }
								help={
									e.provider === 'file'
										? __(
												'Empty: the date the file was uploaded.',
												'werun-blocks-community'
											)
										: undefined
								}
								value={ a.schemaDate }
								onChange={ ( schemaDate ) =>
									setAttributes( { schemaDate } )
								}
							/>
						</>
					) }
				</PanelBody>
			</InspectorControls>

			<div { ...blockProps }>
				{ ! e.hasSource ? (
					<Placeholder
						icon="video-alt3"
						label={ __( 'Video', 'werun-blocks-community' ) }
						instructions={ __(
							'Paste a YouTube or Vimeo link, or choose a file from the media library.',
							'werun-blocks-community'
						) }
					>
						<div className="wrbc-video-placeholder">
							{ sourceFields }
						</div>
					</Placeholder>
				) : (
					<figure className="wrbc-video__figure">
						{ /* Editor preview: the facade only, nothing loads from the provider. */ }
						<div className="wrbc-video__stage wrbc-is-dark">
							{ e.poster && (
								<img
									className="wrbc-video__poster"
									src={ e.poster }
									alt=""
									data-wrbc-backdrop="image"
								/>
							) }
							{ isBackground ? (
								<span
									className="wrbc-video__toggle"
									aria-hidden="true"
								>
									<svg
										className="wrbc-video__toggle-pause"
										viewBox="0 0 24 24"
										width="24"
										height="24"
										aria-hidden="true"
										focusable="false"
									>
										<rect
											x="6"
											y="5"
											width="4"
											height="14"
											rx="1"
										/>
										<rect
											x="14"
											y="5"
											width="4"
											height="14"
											rx="1"
										/>
									</svg>
								</span>
							) : (
								<>
									<span
										className="wrbc-video__play"
										title={ playLabel }
									>
										<span
											className="wrbc-video__play-btn"
											aria-hidden="true"
										>
											<PlayIcon />
											{ playStyle === 'pill' && (
												<span className="wrbc-video__play-text">
													{ __(
														'Play video',
														'werun-blocks-community'
													) }
												</span>
											) }
										</span>
									</span>
									{ /* Outside the play button, as render.php prints it. */ }
									{ consentNote && (
										<span
											className="wrbc-video__note"
											id={ `${ uid }-note` }
										>
											{ sprintf(
												/* translators: %s: host name */ __(
													'Plays from %s',
													'werun-blocks-community'
												),
												HOST[ e.provider ]
											) }
										</span>
									) }
								</>
							) }
						</div>
						{ a.showCaption && (
							<RichText
								tagName="figcaption"
								className="wrbc-video__caption"
								value={ a.caption }
								onChange={ ( caption ) =>
									setAttributes( { caption } )
								}
								placeholder={ __( 'Caption', 'werun-blocks-community' ) }
								allowedFormats={ [
									'core/bold',
									'core/italic',
									'core/link',
								] }
							/>
						) }
					</figure>
				) }
				{ e.hasSource && describedOk && (
					<p className="wrbc-video__described">
						{ /* Twin of render.php: a link (not followed in the editor). */ }
						<a
							href={ describedUrl }
							onClick={ ( event ) => event.preventDefault() }
						>
							{ __(
								'Watch the audio-described version',
								'werun-blocks-community'
							) }
						</a>
					</p>
				) }
				{ e.hasSource && a.showTranscript && (
					<details className="wrbc-video__transcript" open>
						{ /* Twin of render.php: named "Transcript: <title>" for screen readers. */ }
						<summary className="wrbc-video__transcript-toggle">
							{ title ? (
								<>
									<span aria-hidden="true">
										{ __( 'Transcript', 'werun-blocks-community' ) }
									</span>
									<span className="wrbc-sr-only">
										{ sprintf(
											/* translators: %s: video title */ __(
												'Transcript: %s',
												'werun-blocks-community'
											),
											title
										) }
									</span>
								</>
							) : (
								__( 'Transcript', 'werun-blocks-community' )
							) }
						</summary>
						<RichText
							tagName="div"
							className="wrbc-video__transcript-body"
							value={ a.transcript }
							onChange={ ( transcript ) =>
								setAttributes( { transcript } )
							}
							placeholder={ __(
								'Write or paste the transcript…',
								'werun-blocks-community'
							) }
							allowedFormats={ [
								'core/bold',
								'core/italic',
								'core/link',
							] }
						/>
					</details>
				) }
			</div>
		</>
	);
}
