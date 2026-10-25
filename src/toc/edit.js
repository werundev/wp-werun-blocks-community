import { __, sprintf } from '@wordpress/i18n';
import { InspectorControls, PanelColorSettings, RichText, store as blockEditorStore, useBlockProps } from '@wordpress/block-editor';
import { Notice, PanelBody, RangeControl } from '@wordpress/components';
import { useSelect } from '@wordpress/data';
import { useMemo, useRef } from '@wordpress/element';
import { Icon } from '../shared/icons';
import { Choice, cssVars, cx, px, Toggle } from '../shared/controls';
import { accentVars, toneClass, useContextBackground, useSurface } from '../shared/contrast';
import { ContrastAudit } from '../shared/a11y';
import { buildTree, collect, effective, pick } from './headings';

/**
 * Whether the list has a column of its own beside the text: inside a
 * Columns column, a two-column werun section, a row or grid group, or a
 * widget area (a sidebar). Anywhere else a sticky list sticks over the text
 * it scrolls past.
 *
 * @param {Array} parents Parents' names and attributes, nearest first.
 */
function besideText( parents ) {
	if ( parents.some( ( p ) => p.name === 'core/column' || p.name === 'core/widget-area' ) ) {
		return true;
	}
	const parent = parents[ 0 ];
	if ( ! parent ) {
		return false;
	}
	if ( parent.name === 'werun-community/section' ) {
		return parent.attributes.columns === 'two';
	}
	const layout = parent.attributes.layout || {};
	return parent.name === 'core/group' && ( layout.type === 'grid' || ( layout.type === 'flex' && layout.orientation !== 'vertical' ) );
}

const LEVELS = [ 2, 3, 4, 5, 6 ].map( ( n ) => [ String( n ), `H${ n }` ] );

function Tree( { nodes, tag: Tag, sub } ) {
	return (
		<Tag className={ cx( 'wrbc-toc__list', sub && 'wrbc-toc__list--sub' ) } role="list">
			{ nodes.map( ( node ) => (
				<li key={ node.clientId } className={ `wrbc-toc__item wrbc-toc__item--h${ node.level }` }>
					<a className="wrbc-toc__link" href={ `#${ node.id }` } onClick={ ( event ) => event.preventDefault() }>
						{ node.text }
					</a>
					{ node.children.length > 0 && <Tree nodes={ node.children } tag={ Tag } sub /> }
				</li>
			) ) }
		</Tag>
	);
}

/**
 * The editor preview lists the headings of the blocks being edited, live
 * (unsaved changes too), with the same levels, depth and styles as the page.
 */
export default function Edit( { attributes, setAttributes, clientId, name } ) {
	const a = attributes;
	const e = effective( a );
	const uid = `wrbc-toc-${ clientId.slice( 0, 8 ) }`;
	// What the list sits on (own background or the one around). Twin: render.php.
	const surface = useSurface( clientId, a, name );
	const around = useContextBackground( clientId );

	const blocks = useSelect( ( select ) => select( blockEditorStore ).getBlocks(), [] );
	const beside = useSelect(
		( select ) => {
			const store = select( blockEditorStore );
			return besideText(
				store.getBlockParents( clientId, true ).map( ( id ) => ( { name: store.getBlockName( id ), attributes: store.getBlockAttributes( id ) || {} } ) )
			);
		},
		[ clientId ]
	);
	const headings = useMemo( () => collect( blocks ), [ blocks ] );
	const items = pick( headings, e );
	const tree = buildTree( items );
	const tag = e.tocStyle === 'numbered' ? 'ol' : 'ul';
	const titleShown = e.collapsible || a.showTitle;

	const ref = useRef();
	const blockProps = useBlockProps( {
		ref,
		className: cx(
			'wrbc-root wrbc-toc',
			`wrbc-toc--${ e.tocStyle }`,
			e.tocStyle === 'numbered' && `wrbc-toc--num-${ e.numberStyle }`,
			e.sticky && 'wrbc-toc--sticky',
			e.collapsible && 'wrbc-toc--collapsible',
			toneClass( surface, around )
		),
		style: cssVars( { ...accentVars( a, surface ), '--wrbc-toc-top': e.sticky ? px( e.offset ) : undefined } ),
	} );
	// The chapter numbers are text drawn by ::before: checked like text (4.5:1).
	const checks =
		e.tocStyle === 'numbered'
			? [ { selector: '.wrbc-toc__link', pseudo: '::before', property: 'color', against: 'pseudo', min: 4.5, label: __( 'Numbers', 'werun-blocks-community' ) } ]
			: [];

	const title = (
		<RichText
			tagName="span"
			className="wrbc-toc__title-text"
			value={ a.title }
			onChange={ ( value ) => setAttributes( { title: value } ) }
			placeholder={ __( 'On this page', 'werun-blocks-community' ) }
			allowedFormats={ [ 'core/bold', 'core/italic' ] }
		/>
	);
	const body = (
		<div className="wrbc-toc__body">
			{ tree.length > 0 ? (
				<Tree nodes={ tree } tag={ tag } />
			) : (
				<p className="wrbc-toc__empty">
					{ sprintf(
						/* translators: 1: lowest heading level, 2: highest, e.g. H2 and H3. */
						__( 'Add headings (%1$s to %2$s) to the page and they are listed here. On the page an empty table of contents is not shown.', 'werun-blocks-community' ),
						`H${ e.minLevel }`,
						`H${ e.maxLevel }`
					) }
				</p>
			) }
		</div>
	);

	return (
		<>
			<ContrastAudit blockRef={ ref } deps={ [ attributes, tree.length ] } checks={ checks } />
			{ e.sticky && ! beside && (
				// Sticky over the text, it covers what scrolls under it (and the
				// focus there): said at the top, not in a closed panel.
				<InspectorControls>
					<div className="wrbc-toc__sticky-note">
						<Notice status="warning" isDismissible={ false }>
							{ __(
								'Here the list sticks over the text it scrolls past and covers it. Put it in a column beside the text (a Columns block, or a two-column section).',
								'werun-blocks-community'
							) }
						</Notice>
					</div>
				</InspectorControls>
			) }
			<InspectorControls>
				<PanelBody title={ __( 'Headings', 'werun-blocks-community' ) }>
					<Choice
						label={ __( 'From', 'werun-blocks-community' ) }
						value={ String( e.minLevel ) }
						options={ LEVELS }
						onChange={ ( value ) => {
							const minLevel = Number( value );
							setAttributes( { minLevel, maxLevel: Math.max( minLevel, e.maxLevel ) } );
						} }
					/>
					<Choice
						label={ __( 'To', 'werun-blocks-community' ) }
						value={ String( e.maxLevel ) }
						options={ LEVELS.filter( ( [ n ] ) => Number( n ) >= e.minLevel ) }
						onChange={ ( value ) => setAttributes( { maxLevel: Number( value ) } ) }
					/>
					{ e.tocStyle !== 'pills' && e.depthLimit > 1 && (
						<RangeControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							label={ __( 'Nesting depth', 'werun-blocks-community' ) }
							help={ e.depth === 1 ? __( 'One flat list.', 'werun-blocks-community' ) : __( 'Deeper headings are listed at the last level.', 'werun-blocks-community' ) }
							value={ e.depth }
							min={ 1 }
							max={ e.depthLimit }
							onChange={ ( maxDepth ) => setAttributes( { maxDepth } ) }
						/>
					) }
					<Notice status="info" isDismissible={ false }>
						{ __( 'Headings get an id from their text unless they have an HTML anchor. Add the class wrbc-toc-skip (Advanced › Additional CSS class) to leave one out. werun section titles are listed when their block has an anchor.', 'werun-blocks-community' ) }
					</Notice>
				</PanelBody>
				<PanelBody title={ __( 'Layout', 'werun-blocks-community' ) } initialOpen={ false }>
					<Choice
						label={ __( 'Style', 'werun-blocks-community' ) }
						value={ e.tocStyle }
						options={ [
							[ 'list', __( 'List', 'werun-blocks-community' ) ],
							[ 'numbered', __( 'Numbered', 'werun-blocks-community' ) ],
							[ 'pills', __( 'Pills', 'werun-blocks-community' ) ],
						] }
						onChange={ ( tocStyle ) => setAttributes( { tocStyle } ) }
					/>
					{ e.tocStyle === 'numbered' && (
						<Choice
							label={ __( 'Numbers', 'werun-blocks-community' ) }
							value={ e.numberStyle }
							options={ [
								[ 'decimal', '1. 2.' ],
								[ 'nested', '1.1 1.2' ],
								[ 'leading-zero', '01 02' ],
							] }
							onChange={ ( numberStyle ) => setAttributes( { numberStyle } ) }
						/>
					) }
					{ ! e.collapsible && <Toggle attributes={ a } setAttributes={ setAttributes } name="showTitle" label={ __( 'Show the title', 'werun-blocks-community' ) } /> }
					<Toggle
						attributes={ a }
						setAttributes={ setAttributes }
						name="sticky"
						label={ __( 'Sticky beside the content', 'werun-blocks-community' ) }
						help={ __( 'Stays in view while its column scrolls (from 782 px wide). Put it in a column next to the text.', 'werun-blocks-community' ) }
					/>
					{ e.sticky && (
						<RangeControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							label={ __( 'Distance from the top (px)', 'werun-blocks-community' ) }
							help={ __( 'Room for a fixed site header. Links also land this far below the top.', 'werun-blocks-community' ) }
							value={ e.offset }
							min={ 0 }
							max={ 200 }
							onChange={ ( stickyOffset ) => setAttributes( { stickyOffset } ) }
						/>
					) }
					<Toggle
						attributes={ a }
						setAttributes={ setAttributes }
						name="collapsible"
						label={ __( 'Dropdown on phones', 'werun-blocks-community' ) }
						help={ __( 'Under 782 px the list folds under its title.', 'werun-blocks-community' ) }
					/>
				</PanelBody>
				<PanelBody title={ __( 'Behaviour', 'werun-blocks-community' ) } initialOpen={ false }>
					<Toggle attributes={ a } setAttributes={ setAttributes } name="highlight" label={ __( 'Highlight the section in view', 'werun-blocks-community' ) } />
					<Toggle
						attributes={ a }
						setAttributes={ setAttributes }
						name="smoothScroll"
						label={ __( 'Smooth scrolling', 'werun-blocks-community' ) }
						help={ __( 'Not for visitors who ask for reduced motion.', 'werun-blocks-community' ) }
					/>
				</PanelBody>
				<PanelColorSettings
					title={ __( 'Colors', 'werun-blocks-community' ) }
					initialOpen={ false }
					colorSettings={ [
						{ value: a.accentColor, onChange: ( accentColor ) => setAttributes( { accentColor } ), label: __( 'Accent (current section, numbers, focus)', 'werun-blocks-community' ) },
					] }
				/>
			</InspectorControls>

			<nav { ...blockProps } aria-labelledby={ titleShown ? `${ uid }-title` : undefined }>
				{ e.collapsible ? (
					<div className="wrbc-toc__details">
						<div className="wrbc-toc__title wrbc-toc__summary" id={ `${ uid }-title` }>
							{ title }
							<Icon icon={ { name: 'chevron-down' } } className="wrbc-toc__chevron" />
						</div>
						{ body }
					</div>
				) : (
					<>
						{ titleShown && (
							<p className="wrbc-toc__title" id={ `${ uid }-title` }>
								{ title }
							</p>
						) }
						{ body }
					</>
				) }
			</nav>
		</>
	);
}
