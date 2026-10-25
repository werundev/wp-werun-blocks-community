import { __ } from '@wordpress/i18n';
import {
	InnerBlocks,
	InspectorControls,
	MediaUpload,
	MediaUploadCheck,
	PanelColorSettings,
	store as blockEditorStore,
	useBlockProps,
	useInnerBlocksProps,
} from '@wordpress/block-editor';
import {
	Button,
	FocalPointPicker,
	Notice,
	PanelBody,
	RangeControl,
	SelectControl,
} from '@wordpress/components';
import { cloneBlock, createBlock } from '@wordpress/blocks';
import { useDispatch, useSelect } from '@wordpress/data';
import { useRef } from '@wordpress/element';
import { Choice, cssVars, cx, OverlayOpacityControl, SectionHeader, SectionHeaderPanel, Toggle } from '../shared/controls';
import {
	AA_TEXT,
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
	overlayOpacity,
	readableColor,
	toneClass,
	useContextBackground,
	useSurface,
} from '../shared/contrast';
import { ContrastAudit } from '../shared/a11y';

const TEMPLATE = [
	[ 'core/heading', { level: 2, content: __( 'A section for anything', 'werun-blocks-community' ) } ],
	[ 'core/paragraph', { content: __( 'Add any blocks here. Width, padding, background and columns are in the sidebar.', 'werun-blocks-community' ) } ],
];

const SCALE = [
	[ 'none', __( 'None', 'werun-blocks-community' ) ],
	[ 'sm', 'S' ],
	[ 'md', 'M' ],
	[ 'lg', 'L' ],
	[ 'xl', 'XL' ],
];
const SCALE_KEYS = SCALE.map( ( [ key ] ) => key );
const pick = ( value, allowed, fallback ) => ( allowed.includes( value ) ? value : fallback );
const clamp = ( value, min, max, fallback ) => {
	const n = Number( value );
	return Number.isFinite( n ) ? Math.max( min, Math.min( max, Math.round( n ) ) ) : fallback;
};

export default function Edit( { attributes, setAttributes, clientId } ) {
	const a = attributes;
	const uid = `wrbc-section-${ clientId.slice( 0, 8 ) }`;
	const TagName = pick( a.tagName, [ 'section', 'div', 'article', 'aside' ], 'section' );

	const blocks = useSelect( ( select ) => select( blockEditorStore ).getBlocks( clientId ), [ clientId ] );
	const { replaceInnerBlocks } = useDispatch( blockEditorStore );

	// The same rules as render.php.
	const padD = pick( a.paddingY, SCALE_KEYS, 'lg' );
	const padT = pick( a.paddingYTablet, SCALE_KEYS, '' );
	const padM = pick( a.paddingYMobile, SCALE_KEYS, '' );
	const cols = a.columns === 'two' ? 'two' : 'one';
	const ratio = pick( a.columnsRatio, [ '50-50', '60-40', '40-60' ], '50-50' );
	const gap = clamp( a.columnGap, 0, 120, 48 );
	const inner = pick( a.innerWidth, [ 'content', 'wide', 'full', 'custom' ], 'wide' );
	const maxW = clamp( a.innerMaxWidth, 320, 1920, 1200 );
	const valign = pick( a.verticalAlign, [ 'start', 'center', 'end' ], 'center' );
	const minUnit = a.minHeightUnit === 'px' ? 'px' : 'vh';
	const minH = clamp( a.minHeight, 0, minUnit === 'px' ? 2000 : 100, 0 );
	const hasImg = a.bgType === 'image' && !! ( a.bgImageId || a.bgImageUrl );
	const fixed = hasImg && a.bgFixed;
	const focalX = Math.max( 0, Math.min( 1, Number( a.bgFocal?.x ?? 0.5 ) || 0 ) );
	const focalY = Math.max( 0, Math.min( 1, Number( a.bgFocal?.y ?? 0.5 ) || 0 ) );
	const hasTextColor = !! ( a.textColor || a.style?.color?.text );
	const tone = hasTextColor ? 'auto' : pick( a.textTone, [ 'light', 'dark' ], 'auto' );
	const hasBg = hasImg || !! ( a.backgroundColor || a.gradient || a.style?.color?.background || a.style?.color?.gradient );
	const valignApplies = minH > 0 || cols === 'two';

	// Colours: the same rules as render.php. Over a picture "automatic" takes
	// what the overlay calls for, and the overlay never goes under the floor
	// that keeps that text readable over any image.
	const colors = blockColors( a );
	const surface = useSurface( clientId, a, 'werun-community/section' );
	const around = useContextBackground( clientId );
	const overlay = hasImg ? ( colorHex( colorRgba( a.overlayColor || '' ) ) || '' ).slice( 0, 7 ) || '#000000' : '';
	const effTone = hasImg && tone === 'auto' && ! hasTextColor ? ( isDarkColor( overlay ) === true ? 'light' : 'dark' ) : tone;
	const imgText = hasImg ? colors.text || ( effTone === 'dark' ? INK : PAPER ) : '';
	const overO = hasImg ? overlayOpacity( a.overlayOpacity ?? 55, imgText, overlay ) : 0;
	let toneCls = toneClass( surface, around );
	if ( hasImg ) {
		toneCls = isDarkColor( imgText ) === true ? 'wrbc-is-light' : 'wrbc-is-dark';
	}
	// The tone on the section's own colour: its readable version when it needs one (render.php $tone_text).
	const ownBg = ! hasImg && ( colors.background || colors.gradient.length ) ? blockSurface( a, 'werun-community/section' ) : '';
	let toneText = '';
	if ( effTone !== 'auto' && ownBg ) {
		const picked = effTone === 'light' ? PAPER : INK;
		const readableTone = readableColor( picked, ownBg, AA_TEXT );
		toneText = String( readableTone ).toLowerCase() !== picked ? readableTone : '';
	}
	// Secondary text on the section's own colour: as much of the text colour as 4.5:1 needs.
	const textIs = colors.text || toneText || ( effTone === 'light' || ( effTone === 'auto' && toneCls === 'wrbc-is-dark' ) ? PAPER : effTone === 'dark' ? INK : '' );
	const fg = ownBg && textIs ? colorRgba( textIs ) : null;
	let mutedPct = 0;
	for ( let pct = 76; fg && pct <= 100; pct++ ) {
		mutedPct = pct;
		if ( contrastRatio( [ fg[ 0 ], fg[ 1 ], fg[ 2 ], pct / 100 ], ownBg ) >= AA_TEXT ) {
			break;
		}
	}
	// As a solid colour: WordPress strips color-mix() from a block's inline style (render.php).
	const muted = mutedPct > 76 ? colorHex( colorOver( [ fg[ 0 ], fg[ 1 ], fg[ 2 ], mutedPct / 100 ], colorRgba( ownBg ) ) ) : '';

	const accVars = accentVars( {}, surface );
	// Over a picture only the text colour is sure to read: the accent takes it (render.php).
	if ( hasImg ) {
		accVars[ '--wrbc-accent-text' ] = imgText;
	}

	const ref = useRef();
	const blockProps = useBlockProps( {
		ref,
		className: cx(
			'wrbc-root wrbc-section',
			`wrbc-section--cols-${ cols }`,
			`wrbc-section--inner-${ inner }`,
			`wrbc-section--valign-${ valign }`,
			`wrbc-section--py-${ padD }`,
			padT && `wrbc-section--py-t-${ padT }`,
			padM && `wrbc-section--py-m-${ padM }`,
			cols === 'two' && `wrbc-section--ratio-${ ratio }`,
			cols === 'two' && a.mobileReverse && 'wrbc-section--mobile-reverse',
			effTone !== 'auto' && `wrbc-section--tone-${ effTone }`,
			toneCls,
			hasImg && 'has-bg-image',
			fixed && 'wrbc-section--fixed',
			minH > 0 && 'has-min-height',
			( a.align === 'full' || hasBg ) && 'has-gutter'
		),
		style: cssVars( {
			'--wrbc-section-max': inner === 'custom' ? `${ maxW }px` : undefined,
			'--wrbc-section-min-h': minH > 0 ? `${ minH }${ minUnit }` : undefined,
			'--wrbc-section-gap': cols === 'two' ? `${ gap }px` : undefined,
			'--wrbc-section-focal': hasImg ? `${ Math.round( focalX * 10000 ) / 100 }% ${ Math.round( focalY * 10000 ) / 100 }%` : undefined,
			'--wrbc-section-overlay': overlay || undefined,
			'--wrbc-section-over-o': hasImg ? overO / 100 : undefined,
			'--wrbc-section-text': imgText || undefined,
			'--wrbc-section-tone': toneText || undefined,
			'--wrbc-muted': muted || undefined,
			...accVars,
		} ),
	} );

	// One-click fixes the warning offers. On its own colour the tone is
	// corrected on the page; without one it's taken as a statement about
	// what's behind, so a tone that doesn't read on the page around gets a
	// fix. A Color panel text colour is never overridden: it can be removed.
	const behind = hasImg ? '' : ownBg || around;
	const toneColor = { light: PAPER, dark: INK }[ tone ];
	const auditActions = [
		toneColor && ! ownBg && behind && contrastRatio( toneColor, behind ) < AA_TEXT && {
			label: __( 'Pick the text colour automatically', 'werun-blocks-community' ),
			onClick: () => setAttributes( { textTone: 'auto' } ),
		},
		colors.text && behind && contrastRatio( colors.text, behind ) < AA_TEXT && {
			label: __( 'Remove the text colour', 'werun-blocks-community' ),
			onClick: () => setAttributes( { textColor: undefined, style: { ...a.style, color: { ...a.style?.color, text: undefined } } } ),
		},
	];

	const innerBlocksProps = useInnerBlocksProps(
		{ className: cx( 'wrbc-section__content', cols === 'one' && 'is-layout-flow' ) },
		{
			template: TEMPLATE,
			renderAppender: blocks.length ? undefined : InnerBlocks.ButtonBlockAppender,
		}
	);

	const setMinHeightUnit = ( minHeightUnit ) =>
		setAttributes( { minHeightUnit, ...( minHeightUnit === 'vh' && a.minHeight > 100 && { minHeight: 100 } ) } );

	// Two columns take one direct block each: wrap what is there in two groups.
	const wrapInColumns = () => {
		const half = Math.ceil( blocks.length / 2 );
		const second = blocks.slice( half ).map( ( b ) => cloneBlock( b ) );
		replaceInnerBlocks(
			clientId,
			[
				createBlock( 'core/group', {}, blocks.slice( 0, half ).map( ( b ) => cloneBlock( b ) ) ),
				createBlock( 'core/group', {}, second.length ? second : [ createBlock( 'core/paragraph' ) ] ),
			],
			false
		);
	};

	return (
		<>
			<ContrastAudit
				blockRef={ ref }
				deps={ [ attributes, surface, around ] }
				// Werun blocks inside run their own audit.
				ignore=".wrbc-section__content .wrbc-root"
				labels={ {
					'.wrbc-header__eyebrow': __( 'Eyebrow', 'werun-blocks-community' ),
					'.wrbc-header__title': __( 'Title', 'werun-blocks-community' ),
					'.wrbc-header__intro': __( 'Intro', 'werun-blocks-community' ),
					'.wrbc-section__content': __( 'Content', 'werun-blocks-community' ),
				} }
				actions={ auditActions }
			/>
			<InspectorControls>
				<PanelBody title={ __( 'Layout', 'werun-blocks-community' ) }>
					<Choice
						label={ __( 'Section width', 'werun-blocks-community' ) }
						value={ a.align === 'full' || a.align === 'wide' ? a.align : 'content' }
						options={ [
							[ 'content', __( 'Content', 'werun-blocks-community' ) ],
							[ 'wide', __( 'Wide', 'werun-blocks-community' ) ],
							[ 'full', __( 'Full', 'werun-blocks-community' ) ],
						] }
						onChange={ ( value ) => setAttributes( { align: value === 'content' ? '' : value } ) }
					/>
					<Choice
						label={ __( 'Inner width', 'werun-blocks-community' ) }
						help={ __( 'How wide the content inside can get: the theme’s content or wide size, no limit, or your own.', 'werun-blocks-community' ) }
						value={ inner }
						options={ [
							[ 'content', __( 'Content', 'werun-blocks-community' ) ],
							[ 'wide', __( 'Wide', 'werun-blocks-community' ) ],
							[ 'full', __( 'None', 'werun-blocks-community' ) ],
							[ 'custom', __( 'Custom', 'werun-blocks-community' ) ],
						] }
						onChange={ ( innerWidth ) => setAttributes( { innerWidth } ) }
					/>
					{ inner === 'custom' && (
						<RangeControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							label={ __( 'Inner max width (px)', 'werun-blocks-community' ) }
							value={ maxW }
							min={ 320 }
							max={ 1920 }
							step={ 20 }
							onChange={ ( innerMaxWidth ) => setAttributes( { innerMaxWidth } ) }
						/>
					) }
					<Choice
						label={ __( 'Columns', 'werun-blocks-community' ) }
						value={ cols }
						options={ [
							[ 'one', __( 'One', 'werun-blocks-community' ) ],
							[ 'two', __( 'Two', 'werun-blocks-community' ) ],
						] }
						onChange={ ( columns ) => setAttributes( { columns } ) }
					/>
					{ cols === 'two' && (
						<>
							<Choice
								label={ __( 'Column widths', 'werun-blocks-community' ) }
								value={ ratio }
								options={ [
									[ '50-50', '50/50' ],
									[ '60-40', '60/40' ],
									[ '40-60', '40/60' ],
								] }
								onChange={ ( columnsRatio ) => setAttributes( { columnsRatio } ) }
							/>
							<RangeControl
								__nextHasNoMarginBottom
								__next40pxDefaultSize
								label={ __( 'Gap between columns (px)', 'werun-blocks-community' ) }
								value={ gap }
								min={ 0 }
								max={ 120 }
								step={ 4 }
								onChange={ ( columnGap ) => setAttributes( { columnGap } ) }
							/>
							<Toggle
								attributes={ a }
								setAttributes={ setAttributes }
								name="mobileReverse"
								label={ __( 'Second column first on phones', 'werun-blocks-community' ) }
								help={
									a.mobileReverse
										? __( 'Only the order on screen changes: screen readers and the keyboard still go through the first column first. Use it when the second column is a picture or has no links or buttons.', 'werun-blocks-community' )
										: __( 'Columns stack when the section is narrower than 720 px.', 'werun-blocks-community' )
								}
							/>
							{ blocks.length !== 2 && (
								<Notice status="info" isDismissible={ false }>
									<p>{ __( 'Each block directly inside is one column. Put a Group in each column to stack several blocks.', 'werun-blocks-community' ) }</p>
									{ blocks.length > 0 && (
										<Button variant="secondary" size="small" onClick={ wrapInColumns }>
											{ __( 'Wrap the blocks in two columns', 'werun-blocks-community' ) }
										</Button>
									) }
								</Notice>
							) }
						</>
					) }
					<div className="wrbc-panel-row">
						<RangeControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							label={ __( 'Minimum height (0 = auto)', 'werun-blocks-community' ) }
							value={ a.minHeight }
							min={ 0 }
							max={ minUnit === 'vh' ? 100 : 1200 }
							onChange={ ( minHeight ) => setAttributes( { minHeight } ) }
						/>
						<SelectControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							label={ __( 'Unit', 'werun-blocks-community' ) }
							value={ minUnit }
							options={ [
								{ value: 'vh', label: 'vh' },
								{ value: 'px', label: 'px' },
							] }
							onChange={ setMinHeightUnit }
						/>
					</div>
					{ valignApplies && (
						<Choice
							label={ cols === 'two' ? __( 'Vertical alignment (columns and content)', 'werun-blocks-community' ) : __( 'Vertical alignment', 'werun-blocks-community' ) }
							value={ valign }
							options={ [
								[ 'start', __( 'Top', 'werun-blocks-community' ) ],
								[ 'center', __( 'Middle', 'werun-blocks-community' ) ],
								[ 'end', __( 'Bottom', 'werun-blocks-community' ) ],
							] }
							onChange={ ( verticalAlign ) => setAttributes( { verticalAlign } ) }
						/>
					) }
					<SelectControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'HTML element', 'werun-blocks-community' ) }
						value={ TagName }
						options={ [
							{ value: 'section', label: '<section>' },
							{ value: 'div', label: '<div>' },
							{ value: 'article', label: '<article>' },
							{ value: 'aside', label: '<aside>' },
						] }
						onChange={ ( tagName ) => setAttributes( { tagName } ) }
					/>
					<Toggle attributes={ a } setAttributes={ setAttributes } name="reveal" label={ __( 'Fade in when it scrolls into view', 'werun-blocks-community' ) } />
				</PanelBody>

				<PanelBody title={ __( 'Padding', 'werun-blocks-community' ) } initialOpen={ false }>
					<Choice
						label={ __( 'Top and bottom', 'werun-blocks-community' ) }
						value={ padD }
						options={ SCALE }
						onChange={ ( paddingY ) => setAttributes( { paddingY } ) }
					/>
					<Choice
						label={ __( 'Tablet (under 960 px)', 'werun-blocks-community' ) }
						value={ padT || 'same' }
						options={ [ [ 'same', __( 'Same', 'werun-blocks-community' ) ], ...SCALE ] }
						onChange={ ( value ) => setAttributes( { paddingYTablet: value === 'same' ? '' : value } ) }
					/>
					<Choice
						label={ __( 'Phone (under 600 px)', 'werun-blocks-community' ) }
						value={ padM || 'same' }
						options={ [ [ 'same', __( 'Same', 'werun-blocks-community' ) ], ...SCALE ] }
						onChange={ ( value ) => setAttributes( { paddingYMobile: value === 'same' ? '' : value } ) }
					/>
				</PanelBody>

				<PanelBody title={ __( 'Background image', 'werun-blocks-community' ) } initialOpen={ false }>
					<Choice
						label={ __( 'Background', 'werun-blocks-community' ) }
						help={ __( 'Colours and gradients are under Styles → Color. An image goes over them.', 'werun-blocks-community' ) }
						value={ a.bgType === 'image' ? 'image' : 'none' }
						options={ [
							[ 'none', __( 'Colour only', 'werun-blocks-community' ) ],
							[ 'image', __( 'Image', 'werun-blocks-community' ) ],
						] }
						onChange={ ( bgType ) => setAttributes( { bgType } ) }
					/>
					{ a.bgType === 'image' && (
						<>
							<MediaUploadCheck>
								<MediaUpload
									allowedTypes={ [ 'image' ] }
									value={ a.bgImageId }
									onSelect={ ( media ) => setAttributes( { bgImageId: media?.id, bgImageUrl: media?.url } ) }
									render={ ( { open } ) => (
										<Button variant="secondary" onClick={ open }>
											{ hasImg ? __( 'Replace image', 'werun-blocks-community' ) : __( 'Choose an image', 'werun-blocks-community' ) }
										</Button>
									) }
								/>
							</MediaUploadCheck>
							{ hasImg && (
								<>
									<FocalPointPicker
										__nextHasNoMarginBottom
										label={ __( 'Focal point', 'werun-blocks-community' ) }
										url={ a.bgImageUrl }
										value={ { x: focalX, y: focalY } }
										onChange={ ( bgFocal ) => setAttributes( { bgFocal } ) }
									/>
									<OverlayOpacityControl
										value={ a.overlayOpacity }
										onChange={ ( overlayOpacity ) => setAttributes( { overlayOpacity } ) }
										overlayColor={ overlay }
										textColor={ imgText }
									/>
									<Toggle
										attributes={ a }
										setAttributes={ setAttributes }
										name="bgFixed"
										label={ __( 'Fixed while scrolling', 'werun-blocks-community' ) }
										help={ __( 'Off for people who ask for reduced motion.', 'werun-blocks-community' ) }
									/>
									<Button variant="tertiary" isDestructive onClick={ () => setAttributes( { bgImageId: undefined, bgImageUrl: undefined } ) }>
										{ __( 'Remove image', 'werun-blocks-community' ) }
									</Button>
								</>
							) }
						</>
					) }
				</PanelBody>

				{ hasImg && (
					<PanelColorSettings
						title={ __( 'Overlay', 'werun-blocks-community' ) }
						initialOpen={ false }
						colorSettings={ [
							{ value: a.overlayColor, onChange: ( overlayColor ) => setAttributes( { overlayColor } ), label: __( 'Overlay colour', 'werun-blocks-community' ) },
						] }
					/>
				) }

				{ ! hasTextColor && (
					<PanelBody title={ __( 'Text', 'werun-blocks-community' ) } initialOpen={ false }>
						<Choice
							label={ __( 'Text on this background', 'werun-blocks-community' ) }
							help={ __( 'Automatic: light text on a dark colour, gradient or overlay, dark on a light one; without a background, the theme’s text colour. A text colour set under Styles replaces it.', 'werun-blocks-community' ) }
							value={ tone }
							options={ [
								[ 'auto', __( 'Automatic', 'werun-blocks-community' ) ],
								[ 'light', __( 'Light', 'werun-blocks-community' ) ],
								[ 'dark', __( 'Dark', 'werun-blocks-community' ) ],
							] }
							onChange={ ( textTone ) => setAttributes( { textTone } ) }
						/>
					</PanelBody>
				) }

				<SectionHeaderPanel attributes={ a } setAttributes={ setAttributes } />
			</InspectorControls>

			<TagName { ...blockProps }>
				{ hasImg && (
					<>
						<span className="wrbc-section__bg" aria-hidden="true" data-wrbc-backdrop="image">
							<img className="wrbc-section__bg-img" src={ a.bgImageUrl } alt="" />
						</span>
						<span className="wrbc-section__overlay" aria-hidden="true" data-wrbc-backdrop="overlay" />
					</>
				) }
				<div className="wrbc-section__inner">
					<SectionHeader attributes={ a } setAttributes={ setAttributes } uid={ uid } />
					<div { ...innerBlocksProps } />
				</div>
			</TagName>
		</>
	);
}
