import { __, sprintf } from '@wordpress/i18n';
import { createBlock } from '@wordpress/blocks';
import {
	BlockContextProvider,
	InspectorControls,
	PanelColorSettings,
	RichText,
	store as blockEditorStore,
	useBlockProps,
	useInnerBlocksProps,
} from '@wordpress/block-editor';
import { Button, Notice, PanelBody, RangeControl } from '@wordpress/components';
import { useDispatch, useSelect } from '@wordpress/data';
import { useEffect, useRef, useState } from '@wordpress/element';
import { Icon } from '../shared/icons';
import { IconControl } from '../shared/IconControl';
import { Choice, cssVars, cx, IconSizeControls, px, SectionHeader, SectionHeaderPanel, Toggle } from '../shared/controls';
import { accentVars, toneClass, useContextBackground, useSurface } from '../shared/contrast';
import { ContrastAudit } from '../shared/a11y';

const tab = ( label, text ) => [ 'werun-community/tab', { label }, [ [ 'core/paragraph', { content: text } ] ] ];
export const TEMPLATE = [
	tab( 'Plan', 'We start with a workshop: goals, audience and what the site has to do. You get a plan and a date.' ),
	tab( 'Build', 'Design and development in short rounds, with a preview link you can comment on at every step.' ),
	tab( 'Launch', 'Content, testing and the move to your server. Your team learns to edit everything.' ),
];

const BREAKPOINTS = [ 480, 600, 782, 960 ];
const clamp = ( value, min, max, fallback ) => {
	const n = Number( value );
	return Number.isFinite( n ) ? Math.min( max, Math.max( min, n ) ) : fallback;
};

/** Effective options. Twin: src/tabs/render.php (the block above its markup). */
export function effective( a ) {
	const orientation = a.orientation === 'vertical' ? 'vertical' : 'horizontal';
	const tabStyle = [ 'underline', 'pills', 'boxed', 'segmented' ].includes( a.tabStyle ) ? a.tabStyle : 'underline';
	const horizontal = orientation === 'horizontal';
	const fullWidth = horizontal && !! a.fullWidth;
	const tabAlign = horizontal && ! fullWidth && [ 'start', 'center', 'end' ].includes( a.tabAlign ) ? a.tabAlign : 'start';
	const iconPos = [ 'start', 'top', 'end' ].includes( a.iconPosition ) ? a.iconPosition : 'start';
	const accordion = a.mobileMode === 'accordion';
	const breakpoint = BREAKPOINTS.includes( Number( a.accordionBelow ) ) ? Number( a.accordionBelow ) : 600;
	return { orientation, tabStyle, horizontal, fullWidth, tabAlign, iconPos, accordion, breakpoint, showIcons: !! a.showIcons };
}

/** The label as plain text, to tell an empty one (and its fallback) apart. */
const plain = ( value ) => String( value ?? '' ).replace( /<[^>]*>/g, '' ).trim();

/**
 * In the editor the tab buttons switch the visible panel (which one is open
 * is editor state, not saved). The open tab's label is edited in place; the
 * panel is the tab block itself, hidden while another tab is open.
 */
export default function Edit( { attributes, setAttributes, clientId, name } ) {
	const a = attributes;
	const e = effective( a );
	const uid = `wrbc-tabs-${ clientId.slice( 0, 8 ) }`;
	// What the tabs sit on (own background or the one around). Twin: render.php.
	const surface = useSurface( clientId, a, name );
	const around = useContextBackground( clientId );

	const tabs = useSelect( ( select ) => select( blockEditorStore ).getBlocks( clientId ), [ clientId ] );
	// The tab that holds the selected block (selected in the canvas or the list view).
	const selectedTab = useSelect(
		( select ) => {
			const store = select( blockEditorStore );
			const selected = store.getSelectedBlockClientId();
			if ( ! selected ) {
				return null;
			}
			const chain = [ ...store.getBlockParents( selected ), selected ];
			const at = chain.indexOf( clientId );
			return at >= 0 && chain[ at + 1 ] ? chain[ at + 1 ] : null;
		},
		[ clientId ]
	);
	const [ active, setActive ] = useState( null );
	useEffect( () => {
		if ( selectedTab ) {
			setActive( selectedTab );
		}
	}, [ selectedTab ] );
	const activeId = tabs.some( ( t ) => t.clientId === active ) ? active : tabs[ 0 ]?.clientId;

	const { insertBlock, updateBlockAttributes } = useDispatch( blockEditorStore );
	const addTab = () => {
		const block = createBlock( 'werun-community/tab', { label: '' }, [ createBlock( 'core/paragraph' ) ] );
		insertBlock( block, tabs.length, clientId, false );
		setActive( block.clientId );
	};

	const ref = useRef();
	const blockProps = useBlockProps( {
		ref,
		className: cx(
			'wrbc-root wrbc-tabs',
			`wrbc-tabs--${ e.orientation }`,
			`wrbc-tabs--${ e.tabStyle }`,
			e.horizontal && ( e.fullWidth ? 'wrbc-tabs--full' : `wrbc-tabs--align-${ e.tabAlign }` ),
			e.showIcons && `wrbc-tabs--icon-${ e.iconPos }`,
			e.accordion ? `wrbc-tabs--accordion wrbc-tabs--acc-${ e.breakpoint }` : 'wrbc-tabs--scroll',
			toneClass( surface, around )
		),
		style: cssVars( {
			...accentVars( a, surface ),
			'--wrbc-radius': [ 'boxed', 'segmented' ].includes( e.tabStyle ) ? px( clamp( a.radius, 0, 24, 10 ) ) : undefined,
			'--wrbc-tabs-nav-w': e.horizontal ? undefined : px( clamp( a.navWidth, 140, 400, 240 ) ),
			'--wrbc-icon-size': e.showIcons ? px( clamp( a.iconSize, 12, 32, 18 ) ) : undefined,
			'--wrbc-icon-stroke': e.showIcons ? clamp( a.iconStroke, 1, 3, 2 ) : undefined,
		} ),
	} );
	const innerBlocksProps = useInnerBlocksProps(
		{ className: 'wrbc-tabs__panels' },
		{ allowedBlocks: [ 'werun-community/tab' ], template: TEMPLATE, renderAppender: false }
	);

	const defaultIcon = a.tabIcon && typeof a.tabIcon === 'object' ? a.tabIcon : { name: 'sparkles' };

	// The open tab's line, ring or edge has to read against what's around it
	// (WCAG 1.4.11); the labels are checked with every other text. The open
	// segment is always light (Canvas): its edge is measured on it, while on a
	// dark track the light segment itself is what stands out.
	const openTab = '.wrbc-tabs__list > .wrbc-tabs__tab[aria-selected="true"]';
	const marker = __( 'Open tab marker', 'werun-blocks-community' );
	let checks = [ { selector: openTab, property: 'border-color', min: 3, label: marker } ];
	if ( e.tabStyle === 'underline' ) {
		checks = [
			{ selector: openTab, property: 'border-bottom-color', min: 3, label: marker },
			{ selector: openTab, property: 'border-inline-start-color', min: 3, label: marker },
		];
	} else if ( e.tabStyle === 'segmented' ) {
		checks = [ { selector: openTab, property: 'border-color', against: 'self', min: 3, label: marker } ];
	}

	return (
		<>
			<ContrastAudit blockRef={ ref } deps={ [ attributes, activeId ] } checks={ checks } />
			<InspectorControls>
				<PanelBody title={ __( 'Layout', 'werun-blocks-community' ) }>
					<Choice
						label={ __( 'Orientation', 'werun-blocks-community' ) }
						value={ e.orientation }
						options={ [
							[ 'horizontal', __( 'Horizontal', 'werun-blocks-community' ) ],
							[ 'vertical', __( 'Vertical', 'werun-blocks-community' ) ],
						] }
						help={ e.horizontal ? undefined : __( 'Under 600 px of block width the tabs move on top of the panels.', 'werun-blocks-community' ) }
						onChange={ ( orientation ) => setAttributes( { orientation } ) }
					/>
					<Choice
						label={ __( 'Style', 'werun-blocks-community' ) }
						value={ e.tabStyle }
						options={ [
							[ 'underline', __( 'Line', 'werun-blocks-community' ) ],
							[ 'pills', __( 'Pills', 'werun-blocks-community' ) ],
							[ 'boxed', __( 'Boxes', 'werun-blocks-community' ) ],
							[ 'segmented', __( 'Segments', 'werun-blocks-community' ) ],
						] }
						onChange={ ( tabStyle ) => setAttributes( { tabStyle } ) }
					/>
					{ e.horizontal && (
						<Toggle attributes={ a } setAttributes={ setAttributes } name="fullWidth" label={ __( 'Tabs fill the width', 'werun-blocks-community' ) } />
					) }
					{ e.horizontal && ! e.fullWidth && (
						<Choice
							label={ __( 'Alignment', 'werun-blocks-community' ) }
							value={ e.tabAlign }
							options={ [
								[ 'start', __( 'Start', 'werun-blocks-community' ) ],
								[ 'center', __( 'Center', 'werun-blocks-community' ) ],
								[ 'end', __( 'End', 'werun-blocks-community' ) ],
							] }
							onChange={ ( tabAlign ) => setAttributes( { tabAlign } ) }
						/>
					) }
					{ ! e.horizontal && (
						<RangeControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							label={ __( 'Width of the tab column (px)', 'werun-blocks-community' ) }
							value={ clamp( a.navWidth, 140, 400, 240 ) }
							min={ 140 }
							max={ 400 }
							onChange={ ( navWidth ) => setAttributes( { navWidth } ) }
						/>
					) }
					{ [ 'boxed', 'segmented' ].includes( e.tabStyle ) && (
						<RangeControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							label={ __( 'Corner radius (px)', 'werun-blocks-community' ) }
							value={ clamp( a.radius, 0, 24, 10 ) }
							min={ 0 }
							max={ 24 }
							onChange={ ( radius ) => setAttributes( { radius } ) }
						/>
					) }
					<Toggle attributes={ a } setAttributes={ setAttributes } name="reveal" label={ __( 'Fade in when it scrolls into view', 'werun-blocks-community' ) } />
				</PanelBody>
				<PanelBody title={ __( 'Behaviour', 'werun-blocks-community' ) } initialOpen={ false }>
					<Choice
						label={ __( 'Keyboard', 'werun-blocks-community' ) }
						value={ a.activation === 'manual' ? 'manual' : 'auto' }
						options={ [
							[ 'auto', __( 'Arrows open', 'werun-blocks-community' ) ],
							[ 'manual', __( 'Enter opens', 'werun-blocks-community' ) ],
						] }
						help={
							a.activation === 'manual'
								? __( 'Arrow keys move between tabs; Enter or Space opens one. Best when panels are heavy (videos, maps).', 'werun-blocks-community' )
								: __( 'Arrow keys move between tabs and open them at once.', 'werun-blocks-community' )
						}
						onChange={ ( activation ) => setAttributes( { activation } ) }
					/>
					<Toggle
						attributes={ a }
						setAttributes={ setAttributes }
						name="deepLinks"
						label={ __( 'Links to a tab (#anchor)', 'werun-blocks-community' ) }
						help={ __( 'A link to a tab, or to anything inside its panel, opens that tab.', 'werun-blocks-community' ) }
					/>
					{ a.deepLinks && tabs.length > 0 && ! tabs.some( ( t ) => t.attributes.anchor ) && (
						<Notice status="info" isDismissible={ false }>
							{ __( 'Give a tab an HTML anchor (select it › Advanced) to link to it as #anchor.', 'werun-blocks-community' ) }
						</Notice>
					) }
				</PanelBody>
				<PanelBody title={ __( 'Narrow screens', 'werun-blocks-community' ) } initialOpen={ false }>
					<Choice
						label={ __( 'When the tabs do not fit', 'werun-blocks-community' ) }
						value={ e.accordion ? 'accordion' : 'scroll' }
						options={ [
							[ 'scroll', __( 'Scroll sideways', 'werun-blocks-community' ) ],
							[ 'accordion', __( 'Accordion', 'werun-blocks-community' ) ],
						] }
						onChange={ ( mobileMode ) => setAttributes( { mobileMode } ) }
					/>
					{ e.accordion && (
						<Choice
							label={ __( 'Accordion below (block width, px)', 'werun-blocks-community' ) }
							value={ String( e.breakpoint ) }
							options={ BREAKPOINTS.map( ( bp ) => [ String( bp ), String( bp ) ] ) }
							help={ __( 'Each tab sits above its own panel; one is always open.', 'werun-blocks-community' ) }
							onChange={ ( value ) => setAttributes( { accordionBelow: Number( value ) } ) }
						/>
					) }
				</PanelBody>
				<PanelBody title={ __( 'Icons', 'werun-blocks-community' ) } initialOpen={ false }>
					<Toggle attributes={ a } setAttributes={ setAttributes } name="showIcons" label={ __( 'An icon on each tab', 'werun-blocks-community' ) } />
					{ e.showIcons && (
						<>
							<IconControl
								label={ __( 'Icon for every tab', 'werun-blocks-community' ) }
								help={ __( 'Select a tab to give it its own icon, or none.', 'werun-blocks-community' ) }
								value={ defaultIcon }
								allowRemove={ false }
								onChange={ ( tabIcon ) => setAttributes( { tabIcon } ) }
							/>
							<Choice
								label={ __( 'Icon position', 'werun-blocks-community' ) }
								value={ e.iconPos }
								options={ [
									[ 'start', __( 'Before', 'werun-blocks-community' ) ],
									[ 'top', __( 'Above', 'werun-blocks-community' ) ],
									[ 'end', __( 'After', 'werun-blocks-community' ) ],
								] }
								onChange={ ( iconPosition ) => setAttributes( { iconPosition } ) }
							/>
							<IconSizeControls attributes={ a } setAttributes={ setAttributes } maxSize={ 32 } />
						</>
					) }
				</PanelBody>
				<SectionHeaderPanel attributes={ a } setAttributes={ setAttributes } />
				<PanelColorSettings
					title={ __( 'Colors', 'werun-blocks-community' ) }
					initialOpen={ false }
					colorSettings={ [
						{ value: a.accentColor, onChange: ( accentColor ) => setAttributes( { accentColor } ), label: __( 'Accent (active tab, focus)', 'werun-blocks-community' ) },
					] }
				/>
			</InspectorControls>

			<section { ...blockProps }>
				<SectionHeader attributes={ a } setAttributes={ setAttributes } uid={ uid } />
				<div className="wrbc-tabs__body">
					<div className="wrbc-tabs__list" role="tablist" aria-orientation={ e.horizontal ? undefined : 'vertical' }>
						{ tabs.map( ( t, i ) => {
							const selected = t.clientId === activeId;
							const fallback = sprintf( /* translators: %d: position of the tab. */ __( 'Tab %d', 'werun-blocks-community' ), i + 1 );
							// Twin of render.php: own icon, or the block's; an own icon with no name hides it.
							const own = t.attributes.icon && typeof t.attributes.icon === 'object' ? t.attributes.icon : null;
							const icon = e.showIcons ? own || defaultIcon : null;
							return (
								<div
									key={ t.clientId }
									role="tab"
									className="wrbc-tabs__tab wrbc-anim-host"
									aria-selected={ selected }
									tabIndex={ selected ? -1 : 0 }
									style={ { '--wrbc-tab-i': i } }
									onClick={ () => setActive( t.clientId ) }
									onKeyDown={ ( event ) => {
										if ( event.target === event.currentTarget && ( event.key === 'Enter' || event.key === ' ' ) ) {
											event.preventDefault();
											setActive( t.clientId );
										}
									} }
								>
									{ icon?.name && <Icon icon={ icon } className="wrbc-tabs__icon" /> }
									{ selected ? (
										<RichText
											tagName="span"
											className="wrbc-tabs__label"
											value={ t.attributes.label }
											onChange={ ( label ) => updateBlockAttributes( t.clientId, { label } ) }
											placeholder={ fallback }
											allowedFormats={ [ 'core/bold', 'core/italic' ] }
											withoutInteractiveFormatting
										/>
									) : (
										<span className="wrbc-tabs__label">
											{ plain( t.attributes.label ) ? <RichText.Content value={ t.attributes.label } /> : fallback }
										</span>
									) }
								</div>
							);
						} ) }
					</div>
					<Button className="wrbc-tabs__add" variant="secondary" icon="plus" size="compact" onClick={ addTab }>
						{ __( 'Add tab', 'werun-blocks-community' ) }
					</Button>
					<BlockContextProvider value={ { 'werun-community/tabs/editorActive': activeId } }>
						<div { ...innerBlocksProps } />
					</BlockContextProvider>
				</div>
			</section>
		</>
	);
}
