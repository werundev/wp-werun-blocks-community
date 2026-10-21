import { __, sprintf } from '@wordpress/i18n';
import {
	InspectorControls,
	PanelColorSettings,
	RichText,
	useBlockProps,
} from '@wordpress/block-editor';
import {
	BaseControl,
	Button,
	DateTimePicker,
	Dropdown,
	Notice,
	PanelBody,
	RangeControl,
	SelectControl,
} from '@wordpress/components';
import { dateI18n, getDate, getSettings } from '@wordpress/date';
import { useInstanceId } from '@wordpress/compose';
import { useEffect, useRef } from '@wordpress/element';
import { ContrastAudit } from '../shared/a11y';
import {
	AA_TEXT,
	AA_UI,
	ACCENT,
	blockSurface,
	colorHex,
	colorMix,
	colorOver,
	colorRgba,
	isDarkColor,
	onColor,
	PAPER,
	readableColor,
	toneClass,
	useContextBackground,
	useSurface,
} from '../shared/contrast';
import { Icon, IconWrap } from '../shared/icons';
import { IconControl } from '../shared/IconControl';
import {
	Choice,
	cssVars,
	cx,
	LinkFields,
	px,
	Toggle,
} from '../shared/controls';

/** Per-tone default icon: same map as render.php. */
export const TONE_ICONS = {
	info: 'info',
	success: 'circle-check',
	warning: 'triangle-alert',
	danger: 'octagon-alert',
	neutral: 'bell',
	brand: 'megaphone',
};
const TONES = Object.keys( TONE_ICONS );

/**
 * Role: twin of render.php (reasons there). A bar is a labelled region, an
 * inline notice a note; never a live region (the page prints it).
 *
 * @param {string} layout Effective layout.
 */
export function noticeRole( layout ) {
	return layout === 'bar' ? 'region' : 'note';
}

const TITLE_TAGS = [ 'p', 'h2', 'h3', 'h4', 'h5', 'h6' ];

/** Tone colours: same as style.scss and render.php (brand: the accent). */
const TONE_COLORS = {
	info: '#1d4ed8',
	success: '#15803d',
	warning: '#b45309',
	danger: '#b91c1c',
	neutral: '#334155',
	brand: ACCENT,
};

/**
 * The colours the notice paints with: twin of the "Colours" part of
 * render.php (same maths through src/shared/contrast.js).
 *
 * @param {Object}  a            Attributes.
 * @param {Object}  opts         What the notice is and what it sits on.
 * @param {string}  opts.tone    Effective tone.
 * @param {boolean} opts.solid   Solid look.
 * @param {boolean} opts.sticky  Sticky / fixed bar.
 * @param {string}  opts.own     Its own background ('' = none).
 * @param {string}  opts.surface That, or the background around it.
 * @param {string}  opts.around  The background around it.
 */
function noticeColors( a, { tone, solid, sticky, own, surface, around } ) {
	const surfaceRgba = colorRgba( surface ) || colorRgba( PAPER );
	let toneRgba =
		typeof a.toneColor === 'string' ? colorRgba( a.toneColor ) : null;
	if ( toneRgba && toneRgba[ 3 ] < 1 ) {
		toneRgba = colorOver( toneRgba, surfaceRgba );
	}
	const toneHex = toneRgba ? colorHex( toneRgba ) : TONE_COLORS[ tone ];
	let paint = own;
	if ( ! own ) {
		paint = solid
			? toneHex
			: colorHex( colorMix( surfaceRgba, colorRgba( toneHex ), 0.09 ) );
	}
	const onRgba =
		solid && typeof a.onToneColor === 'string'
			? colorRgba( a.onToneColor )
			: null;
	let chosen = '';
	if ( onRgba ) {
		chosen = colorHex(
			onRgba[ 3 ] < 1 ? colorOver( onRgba, colorRgba( toneHex ) ) : onRgba
		);
	}
	const onTone = chosen
		? readableColor( chosen, toneHex, AA_TEXT )
		: onColor( toneHex );
	// The tone as icon and ring colour on the tint or own background: 3:1.
	const ink = ! solid || own ? readableColor( toneHex, paint, AA_UI ) : '';
	// A tone-filled button with a dark label lightens on hover / focus.
	const hover =
		( ! solid || own ) && isDarkColor( onTone ) === true
			? colorHex(
					colorMix( colorRgba( toneHex ), colorRgba( PAPER ), 0.14 )
			  )
			: undefined;
	// The tone as render.php prints it: a colour it can read, or a palette variable.
	const toneCss =
		toneRgba ||
		( typeof a.toneColor === 'string' &&
			a.toneColor.trim().startsWith( 'var(' ) )
			? a.toneColor.trim()
			: undefined;
	return {
		className: toneClass( paint, around ),
		// The chosen colour on the tone had to change to stay readable.
		adjusted: !! chosen && onTone.toLowerCase() !== chosen.toLowerCase(),
		vars: {
			'--wrbc-tone-color': toneCss,
			'--wrbc-on-tone-color':
				chosen || onTone.toLowerCase() !== '#ffffff'
					? onTone
					: undefined,
			'--wrbc-tone-ink-color':
				ink && ink.toLowerCase() !== toneHex.toLowerCase()
					? ink
					: undefined,
			'--wrbc-tone-hover-color': hover,
			'--wrbc-notice-underlay':
				sticky && ! solid && ! own
					? colorHex( surfaceRgba )
					: undefined,
		},
	};
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$/;

/**
 * Where "now" is against the schedule, in the site's time zone: twin of the
 * schedule check in render.php. Returns 'live' | 'before' | 'after' | 'never'.
 * @param {string} start Stored start date.
 * @param {string} end   Stored end date.
 */
function scheduleState( start, end ) {
	const s = DATE_RE.test( start || '' ) ? getDate( start ).getTime() : null;
	const e = DATE_RE.test( end || '' ) ? getDate( end ).getTime() : null;
	const now = Date.now();
	if ( s !== null && e !== null && e <= s ) {
		return 'never';
	}
	if ( s !== null && now < s ) {
		return 'before';
	}
	if ( e !== null && now >= e ) {
		return 'after';
	}
	return 'live';
}

function DateField( { label, value, onChange } ) {
	const id = useInstanceId( DateField, 'wrbc-notice-date' );
	const valid = DATE_RE.test( value || '' );
	const format = `${ getSettings().formats.date } ${ getSettings().formats.time }`;
	return (
		<BaseControl
			__nextHasNoMarginBottom
			id={ id }
			label={ label }
			className="wrbc-notice-date"
		>
			<div className="wrbc-notice-date__row">
				<Dropdown
					popoverProps={ { placement: 'left-start' } }
					renderToggle={ ( { isOpen, onToggle } ) => (
						<Button
							id={ id }
							variant="secondary"
							size="small"
							onClick={ onToggle }
							aria-expanded={ isOpen }
						>
							{ valid
								? dateI18n( format, getDate( value ) )
								: __( 'Pick a date', 'werun-blocks-community' ) }
						</Button>
					) }
					renderContent={ () => (
						<div className="wrbc-notice-date__picker">
							<DateTimePicker
								currentDate={ valid ? value : undefined }
								onChange={ ( date ) => onChange( date || '' ) }
								is12Hour={ /a(?!\\)/i.test(
									getSettings().formats.time
								) }
							/>
						</div>
					) }
				/>
				{ valid && (
					<Button
						variant="tertiary"
						size="small"
						onClick={ () => onChange( '' ) }
					>
						{ __( 'Clear', 'werun-blocks-community' ) }
					</Button>
				) }
			</div>
		</BaseControl>
	);
}

export default function Edit( { attributes, setAttributes, clientId } ) {
	const a = attributes;
	const tone = TONES.includes( a.tone ) ? a.tone : 'info';
	const solid = a.appearance === 'solid';
	const layout = a.layout === 'bar' ? 'bar' : 'inline';
	const pos = [ 'top', 'sticky-top', 'sticky-bottom' ].includes(
		a.barPosition
	)
		? a.barPosition
		: 'top';
	const sticky = layout === 'bar' && pos !== 'top';
	// No icon set = the tone's icon; {} = no icon (render.php: same rule).
	const icon =
		a.icon && typeof a.icon === 'object'
			? a.icon
			: {
					name: TONE_ICONS[ tone ],
					lib: 'lucide',
					anim: 'none',
					trigger: 'hover',
				};
	const state = a.schedule
		? scheduleState( a.scheduleStart, a.scheduleEnd )
		: 'live';
	const role = noticeRole( layout );
	// Twin of render.php: the title tag, and whether a title is printed at all.
	const titleTag = TITLE_TAGS.includes( a.titleTag ) ? a.titleTag : 'p';
	const hasTitle = !! ( a.title || '' ).replace( /<[^>]*>/g, '' ).trim();

	// A stable id for "remember the dismissal" (with the text's hash).
	useEffect( () => {
		if ( ! a.noticeId ) {
			setAttributes( {
				noticeId: clientId
					.replace( /[^A-Za-z0-9]/g, '' )
					.slice( 0, 12 ),
			} );
		}
	}, [] ); // eslint-disable-line react-hooks/exhaustive-deps

	// Colours: twin of render.php (what it paints, its tone class, on-tone, ink).
	const surface = useSurface( clientId, a, 'werun-community/notice' );
	const around = useContextBackground( clientId );
	const colors = noticeColors( a, {
		tone,
		solid,
		sticky,
		own: blockSurface( a, 'werun-community/notice' ),
		surface,
		around,
	} );

	const ref = useRef();
	const blockProps = useBlockProps( {
		ref,
		className: cx(
			'wrbc-root wrbc-notice',
			`wrbc-notice--${ tone }`,
			`wrbc-notice--${ solid ? 'solid' : 'soft' }`,
			`wrbc-notice--${ layout }`,
			colors.className,
			layout === 'bar' && `wrbc-notice--pos-${ pos }`,
			layout === 'bar' &&
				a.contentAlign === 'center' &&
				'wrbc-notice--center',
			a.dismissible && 'is-dismissible',
			state !== 'live' && 'is-off-schedule'
		),
		role,
		style: cssVars( {
			...colors.vars,
			'--wrbc-icon-size': px(
				Math.max( 12, Math.min( 40, a.iconSize || 20 ) )
			),
			'--wrbc-radius':
				layout === 'inline'
					? px( Math.max( 0, Math.min( 32, a.radius ?? 12 ) ) )
					: undefined,
			'--wrbc-notice-offset': sticky
				? px( Math.max( 0, Math.min( 200, a.stickyOffset || 0 ) ) )
				: undefined,
		} ),
	} );

	const stateText = {
		before: __( 'Scheduled: not shown yet.', 'werun-blocks-community' ),
		after: __( 'Schedule ended: not shown any more.', 'werun-blocks-community' ),
		never: __(
			'The end is before the start: never shown.',
			'werun-blocks-community'
		),
	}[ state ];

	return (
		<>
			<ContrastAudit
				blockRef={ ref }
				deps={ [ attributes, surface, around ] }
				checks={ [
					{
						selector: '.wrbc-notice__icon',
						property: 'color',
						min: AA_UI,
						label: __( 'Tone icon', 'werun-blocks-community' ),
					},
					{
						selector: '.wrbc-notice__close',
						property: 'color',
						min: AA_UI,
						label: __( 'Close button', 'werun-blocks-community' ),
					},
				] }
				ignore=".wrbc-notice__schedule-flag"
			/>
			<InspectorControls>
				<PanelBody title={ __( 'Notice', 'werun-blocks-community' ) }>
					<SelectControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Tone', 'werun-blocks-community' ) }
						value={ tone }
						options={ [
							{
								value: 'info',
								label: __( 'Information', 'werun-blocks-community' ),
							},
							{
								value: 'success',
								label: __( 'Success', 'werun-blocks-community' ),
							},
							{
								value: 'warning',
								label: __( 'Warning', 'werun-blocks-community' ),
							},
							{
								value: 'danger',
								label: __( 'Danger', 'werun-blocks-community' ),
							},
							{
								value: 'neutral',
								label: __( 'Neutral', 'werun-blocks-community' ),
							},
							{
								value: 'brand',
								label: __(
									'Brand (accent colour)',
									'werun-blocks-community'
								),
							},
						] }
						onChange={ ( value ) =>
							setAttributes( { tone: value } )
						}
					/>
					<Choice
						label={ __( 'Look', 'werun-blocks-community' ) }
						value={ solid ? 'solid' : 'soft' }
						options={ [
							[ 'soft', __( 'Soft', 'werun-blocks-community' ) ],
							[ 'solid', __( 'Solid', 'werun-blocks-community' ) ],
						] }
						onChange={ ( appearance ) =>
							setAttributes( { appearance } )
						}
					/>
					{ ( tone === 'warning' || tone === 'danger' ) && (
						<Toggle
							attributes={ a }
							setAttributes={ setAttributes }
							name="urgent"
							label={ __(
								'Urgent: announce it at once',
								'werun-blocks-community'
							) }
							help={ __(
								'Screen readers read it out once, as soon as the page loads, interrupting whatever they are reading. Only for a genuinely urgent problem that needs action now, such as an outage.',
								'werun-blocks-community'
							) }
						/>
					) }
					{ hasTitle && (
						<SelectControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							label={ __( 'Title tag', 'werun-blocks-community' ) }
							value={ titleTag }
							options={ [
								{
									value: 'p',
									label: __(
										'Paragraph (not a heading)',
										'werun-blocks-community'
									),
								},
								...[ 2, 3, 4, 5, 6 ].map( ( level ) => ( {
									value: `h${ level }`,
									label: sprintf(
										/* translators: %d: heading level. */
										__( 'Heading %d', 'werun-blocks-community' ),
										level
									),
								} ) ),
							] }
							help={ __(
								'A heading puts the title in the page outline: pick the level that fits the headings around it.',
								'werun-blocks-community'
							) }
							onChange={ ( value ) =>
								setAttributes( { titleTag: value } )
							}
						/>
					) }
					<IconControl
						label={ __( 'Icon', 'werun-blocks-community' ) }
						value={ icon }
						onChange={ ( value ) =>
							setAttributes( { icon: value?.name ? value : {} } )
						}
						help={
							a.icon === undefined
								? __( 'The tone’s icon.', 'werun-blocks-community' )
								: undefined
						}
					/>
					{ a.icon !== undefined && (
						<Button
							variant="link"
							onClick={ () =>
								setAttributes( { icon: undefined } )
							}
						>
							{ __( 'Use the tone’s icon', 'werun-blocks-community' ) }
						</Button>
					) }
					{ !! icon.name && (
						<RangeControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							label={ __( 'Icon size (px)', 'werun-blocks-community' ) }
							value={ a.iconSize }
							min={ 12 }
							max={ 40 }
							onChange={ ( iconSize ) =>
								setAttributes( { iconSize } )
							}
						/>
					) }
					<Toggle
						attributes={ a }
						setAttributes={ setAttributes }
						name="showLink"
						label={ __( 'Link or button', 'werun-blocks-community' ) }
					/>
					{ a.showLink && (
						<>
							<Choice
								label={ __( 'Shown as', 'werun-blocks-community' ) }
								value={
									a.linkStyle === 'button' ? 'button' : 'link'
								}
								options={ [
									[ 'link', __( 'Link', 'werun-blocks-community' ) ],
									[
										'button',
										__( 'Button', 'werun-blocks-community' ),
									],
								] }
								onChange={ ( linkStyle ) =>
									setAttributes( { linkStyle } )
								}
							/>
							<LinkFields
								url={ a.linkUrl }
								newTab={ a.linkNewTab }
								onChange={ ( v ) =>
									setAttributes( {
										...( 'url' in v && { linkUrl: v.url } ),
										...( 'newTab' in v && {
											linkNewTab: v.newTab,
										} ),
									} )
								}
							/>
						</>
					) }
				</PanelBody>

				<PanelBody
					title={ __( 'Layout', 'werun-blocks-community' ) }
					initialOpen={ false }
				>
					<Choice
						label={ __( 'Layout', 'werun-blocks-community' ) }
						value={ layout }
						options={ [
							[
								'inline',
								__( 'In the content', 'werun-blocks-community' ),
							],
							[ 'bar', __( 'Full-width bar', 'werun-blocks-community' ) ],
						] }
						onChange={ ( value ) =>
							setAttributes( { layout: value } )
						}
					/>
					{ layout === 'bar' && (
						<>
							<SelectControl
								__nextHasNoMarginBottom
								__next40pxDefaultSize
								label={ __( 'Position', 'werun-blocks-community' ) }
								value={ pos }
								options={ [
									{
										value: 'top',
										label: __(
											'Where it is placed',
											'werun-blocks-community'
										),
									},
									{
										value: 'sticky-top',
										label: __(
											'Sticks to the top of the window',
											'werun-blocks-community'
										),
									},
									{
										value: 'sticky-bottom',
										label: __(
											'Fixed at the bottom of the window',
											'werun-blocks-community'
										),
									},
								] }
								help={
									{
										'sticky-top': __(
											'Place it first in the page (or template) so it sticks while the page scrolls.',
											'werun-blocks-community'
										),
										// Keyboard and screen reader order follow the content, not the window.
										'sticky-bottom': __(
											'Place it last in the page (or template): keyboards and screen readers reach it where it sits in the content.',
											'werun-blocks-community'
										),
									}[ pos ]
								}
								onChange={ ( barPosition ) =>
									setAttributes( { barPosition } )
								}
							/>
							{ sticky && (
								<RangeControl
									__nextHasNoMarginBottom
									__next40pxDefaultSize
									label={
										pos === 'sticky-top'
											? __(
													'Space above (px)',
													'werun-blocks-community'
												)
											: __(
													'Space below (px)',
													'werun-blocks-community'
												)
									}
									help={
										pos === 'sticky-top'
											? __(
													'For a sticky site header. The admin bar is added on its own.',
													'werun-blocks-community'
												)
											: undefined
									}
									value={ a.stickyOffset }
									min={ 0 }
									max={ 200 }
									onChange={ ( stickyOffset ) =>
										setAttributes( { stickyOffset } )
									}
								/>
							) }
							<Choice
								label={ __( 'Alignment', 'werun-blocks-community' ) }
								value={
									a.contentAlign === 'center'
										? 'center'
										: 'left'
								}
								options={ [
									[ 'left', __( 'Left', 'werun-blocks-community' ) ],
									[
										'center',
										__( 'Center', 'werun-blocks-community' ),
									],
								] }
								onChange={ ( contentAlign ) =>
									setAttributes( { contentAlign } )
								}
							/>
						</>
					) }
					{ layout === 'inline' && (
						<RangeControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							label={ __( 'Corner radius (px)', 'werun-blocks-community' ) }
							value={ a.radius }
							min={ 0 }
							max={ 32 }
							onChange={ ( radius ) =>
								setAttributes( { radius } )
							}
						/>
					) }
				</PanelBody>

				<PanelBody
					title={ __( 'Close button', 'werun-blocks-community' ) }
					initialOpen={ false }
				>
					<Toggle
						attributes={ a }
						setAttributes={ setAttributes }
						name="dismissible"
						label={ __( 'Visitors can close it', 'werun-blocks-community' ) }
					/>
					{ a.dismissible && (
						<>
							<RangeControl
								__nextHasNoMarginBottom
								__next40pxDefaultSize
								label={ __(
									'Stay closed for (days)',
									'werun-blocks-community'
								) }
								help={
									a.rememberDays
										? __(
												'In this browser. Editing the text shows it again.',
												'werun-blocks-community'
											)
										: __(
												'0: it comes back on the next page view.',
												'werun-blocks-community'
											)
								}
								value={ a.rememberDays }
								min={ 0 }
								max={ 365 }
								onChange={ ( rememberDays ) =>
									setAttributes( { rememberDays } )
								}
							/>
							<IconControl
								label={ __( 'Close icon', 'werun-blocks-community' ) }
								value={ a.closeIcon }
								allowRemove={ false }
								allowAnimation={ false }
								onChange={ ( closeIcon ) =>
									setAttributes( { closeIcon } )
								}
							/>
						</>
					) }
				</PanelBody>

				<PanelBody
					title={ __( 'Schedule', 'werun-blocks-community' ) }
					initialOpen={ false }
				>
					<Toggle
						attributes={ a }
						setAttributes={ setAttributes }
						name="schedule"
						label={ __(
							'Show only between two dates',
							'werun-blocks-community'
						) }
						help={
							a.schedule
								? sprintf(
										/* translators: %s: time zone. */ __(
											'Site time (%s). A page cache shows the change when it refreshes.',
											'werun-blocks-community'
										),
										getSettings().timezone?.string ||
											getSettings().timezone?.abbr ||
											'UTC'
									)
								: undefined
						}
					/>
					{ a.schedule && (
						<>
							<DateField
								label={ __(
									'From (empty: now)',
									'werun-blocks-community'
								) }
								value={ a.scheduleStart }
								onChange={ ( scheduleStart ) =>
									setAttributes( { scheduleStart } )
								}
							/>
							<DateField
								label={ __(
									'Until (empty: no end)',
									'werun-blocks-community'
								) }
								value={ a.scheduleEnd }
								onChange={ ( scheduleEnd ) =>
									setAttributes( { scheduleEnd } )
								}
							/>
							{ stateText && (
								<Notice
									status={
										state === 'never' ? 'error' : 'warning'
									}
									isDismissible={ false }
								>
									{ stateText }
								</Notice>
							) }
						</>
					) }
				</PanelBody>

				<PanelColorSettings
					title={ __( 'Notice colors', 'werun-blocks-community' ) }
					initialOpen={ false }
					colorSettings={ [
						{
							value: a.toneColor,
							onChange: ( toneColor ) =>
								setAttributes( { toneColor } ),
							label: __( 'Tone colour', 'werun-blocks-community' ),
						},
						solid && {
							value: a.onToneColor,
							onChange: ( onToneColor ) =>
								setAttributes( { onToneColor } ),
							label: __( 'Text on the tone', 'werun-blocks-community' ),
						},
					].filter( Boolean ) }
				>
					{ colors.adjusted && (
						<p className="components-base-control__help">
							{ __(
								'Shown a little lighter or darker so it stays readable on the tone (4.5:1). Your colour is kept and returns when the tone allows it.',
								'werun-blocks-community'
							) }
						</p>
					) }
				</PanelColorSettings>
			</InspectorControls>

			<div { ...blockProps }>
				{ stateText && (
					<p className="wrbc-notice__schedule-flag">{ stateText }</p>
				) }
				<div className="wrbc-notice__inner">
					{ !! icon.name && (
						<IconWrap icon={ icon } className="wrbc-notice__icon" />
					) }
					<div className="wrbc-notice__content">
						<RichText
							tagName={ titleTag }
							className="wrbc-notice__title"
							value={ a.title }
							onChange={ ( title ) => setAttributes( { title } ) }
							placeholder={ __(
								'Title (optional)',
								'werun-blocks-community'
							) }
							allowedFormats={ [ 'core/bold', 'core/italic' ] }
						/>
						<RichText
							tagName="p"
							className="wrbc-notice__message"
							value={ a.message }
							onChange={ ( message ) =>
								setAttributes( { message } )
							}
							placeholder={ __( 'Message', 'werun-blocks-community' ) }
							allowedFormats={ [
								'core/bold',
								'core/italic',
								'core/link',
							] }
						/>
					</div>
					{ a.showLink && (
						<span
							className={
								a.linkStyle === 'button'
									? 'wrbc-btn wrbc-notice__button'
									: 'wrbc-notice__link'
							}
						>
							<RichText
								tagName="span"
								value={ a.linkLabel }
								onChange={ ( linkLabel ) =>
									setAttributes( { linkLabel } )
								}
								placeholder={ __(
									'Link text',
									'werun-blocks-community'
								) }
								allowedFormats={ [] }
							/>
						</span>
					) }
					{ a.dismissible && (
						<span className="wrbc-notice__close" aria-hidden="true">
							<Icon
								icon={
									a.closeIcon?.name
										? a.closeIcon
										: { name: 'x' }
								}
							/>
						</span>
					) }
				</div>
			</div>
		</>
	);
}
