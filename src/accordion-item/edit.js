import { __ } from '@wordpress/i18n';
import { InspectorControls, RichText, store as blockEditorStore, useBlockProps, useInnerBlocksProps } from '@wordpress/block-editor';
import { Button, Notice, PanelBody } from '@wordpress/components';
import { useSelect } from '@wordpress/data';
import { useRef, useState } from '@wordpress/element';
import { Icon } from '../shared/icons';
import { IconControl } from '../shared/IconControl';
import { cssVars, cx, Toggle } from '../shared/controls';
import { ContrastAudit } from '../shared/a11y';
import { AA_TEXT, blockColors, blockSurface, colorRgba, contrastRatio, readableColor, useContextBackground } from '../shared/contrast';
import { itemColors, NO_COLORS } from './colors';

const HEADINGS = [ 'auto', 'none', 'h2', 'h3', 'h4', 'h5', 'h6' ];

/**
 * In the editor an item is not a <details> (clicking the question would
 * toggle it instead of placing the cursor): the question is editable and the
 * icon button shows or hides the answer.
 */
export default function Edit( { attributes, setAttributes, context, clientId } ) {
	const a = attributes;
	const get = ( key, fallback ) => context[ `werun-community/accordion/${ key }` ] ?? fallback;
	const [ open, setOpen ] = useState( true );
	const type = get( 'iconType', 'chevron' );
	const showLead = get( 'showItemIcons', false );
	// Its own icon, or the accordion's while it has none ({ name: '' } hides it here).
	const ownIcon = a.icon && typeof a.icon === 'object';
	const leadIcon = ownIcon ? a.icon : get( 'itemIcon', { name: 'circle-question-mark' } );

	// The question's element. Twin: src/accordion-item/render.php.
	let heading = HEADINGS.includes( get( 'questionHeading', 'auto' ) ) ? get( 'questionHeading', 'auto' ) : 'auto';
	if ( heading === 'auto' ) {
		const hasTitle = !! get( 'showHeader', true ) && String( get( 'title', '' ) ?? '' ).replace( /<[^>]*>/g, '' ).trim() !== '';
		heading = hasTitle ? `h${ Math.max( 2, Math.min( 4, parseInt( get( 'titleLevel', 2 ), 10 ) || 0 ) ) + 1 }` : 'none';
	}
	const tagName = heading === 'none' ? 'span' : heading;

	// Two columns: the page splits the items into two column wrappers after
	// the first half (src/accordion/render.php); the editor keeps one list,
	// so the last item of the first column breaks the column there.
	const { index, count } = useSelect(
		( select ) => {
			const editor = select( blockEditorStore );
			return { index: editor.getBlockIndex( clientId ), count: editor.getBlockCount( editor.getBlockRootClientId( clientId ) ) };
		},
		[ clientId ]
	);
	const colEnd = Number( get( 'columns', 1 ) ) === 2 && count > 1 && index === Math.ceil( count / 2 ) - 1;

	// Its own background (Color panel), or the accordion's Item background in
	// Boxes. Twins: src/accordion-item/render.php (own) and
	// src/accordion/render.php (Item background).
	const around = useContextBackground( clientId );
	const ownBg = blockSurface( a, 'werun-community/accordion-item' );
	const itemBg = get( 'accordionStyle', 'separated' ) === 'boxed' ? get( 'itemBg', '' ) : '';
	const accent = typeof get( 'accentColor', '' ) === 'string' ? get( 'accentColor', '' ) : '';
	// The accordion's own text colour (Color panel), for the Item background.
	const parentText = useSelect(
		( select ) => {
			const editor = select( blockEditorStore );
			return blockColors( editor.getBlockAttributes( editor.getBlockRootClientId( clientId ) ) || {} ).text;
		},
		[ clientId ]
	);
	let colors = NO_COLORS;
	if ( ownBg ) {
		colors = itemColors( ownBg, around, accent );
	} else if ( itemBg ) {
		colors = itemColors( itemBg, around, accent );
		// A text colour picked for the accordion: the closest one that reads on
		// the items (twin of src/accordion/render.php).
		if ( colors.paint && parentText ) {
			const text = readableColor( parentText, colors.paint, AA_TEXT );
			const muted = colorRgba( text );
			const vars = { ...colors.vars, color: text };
			// Answers are --wrbc-muted: the full colour when that would fall under 4.5:1.
			if ( muted && contrastRatio( [ muted[ 0 ], muted[ 1 ], muted[ 2 ], colors.className === 'wrbc-is-dark' ? 0.85 : 0.76 ], colors.paint ) < AA_TEXT ) {
				vars[ '--wrbc-muted' ] = text;
			}
			colors = { ...colors, vars };
		}
	}
	const chosenText = blockColors( a ).text;
	const textFails = !! chosenText && contrastRatio( chosenText, colors.paint || around ) < AA_TEXT;

	const ref = useRef();
	const blockProps = useBlockProps( {
		ref,
		className: cx( 'wrbc-acc-item wrbc-anim-host', colEnd && 'wrbc-acc-item--col-end', colors.paint && 'wrbc-acc-item--bg', colors.className ),
		style: cssVars( colors.vars ),
	} );
	const innerBlocksProps = useInnerBlocksProps(
		{ className: 'wrbc-acc-item__content' },
		{
			template: [ [ 'core/paragraph', { placeholder: __( 'The answer. Any block can go here.', 'werun-blocks-community' ) } ] ],
			templateLock: false,
		}
	);

	let toggle = null;
	if ( type === 'chevron' ) {
		toggle = <Icon icon={ { name: 'chevron-down' } } className="wrbc-acc-item__chevron" />;
	} else if ( type === 'plus' ) {
		toggle = (
			<>
				<Icon icon={ { name: 'plus' } } className="wrbc-acc-item__when-closed" />
				<Icon icon={ { name: 'minus' } } className="wrbc-acc-item__when-open" />
			</>
		);
	} else if ( type === 'custom' ) {
		toggle = (
			<>
				<Icon icon={ get( 'iconClosed', { name: 'plus' } ) } className="wrbc-acc-item__when-closed" />
				<Icon icon={ get( 'iconOpen', { name: 'minus' } ) } className="wrbc-acc-item__when-open" />
			</>
		);
	}

	return (
		<>
			<ContrastAudit
				blockRef={ ref }
				deps={ [ attributes, context ] }
				labels={ {
					'.wrbc-acc-item__question': __( 'Question', 'werun-blocks-community' ),
					'.wrbc-acc-item__content': __( 'Answer', 'werun-blocks-community' ),
				} }
				checks={ [ { selector: '.wrbc-acc-item__toggle .wrbc-icon', property: 'stroke', min: 3, label: __( 'Open / close icon', 'werun-blocks-community' ) } ] }
				actions={
					textFails
						? [
								{
									label: __( 'Use the automatic text colour', 'werun-blocks-community' ),
									onClick: () => setAttributes( { textColor: undefined, style: a.style?.color?.text ? { ...a.style, color: { ...a.style.color, text: undefined } } : a.style } ),
								},
						  ]
						: []
				}
			/>
			<InspectorControls>
				<PanelBody title={ __( 'Item', 'werun-blocks-community' ) }>
					{ ! String( a.question ?? '' ).replace( /<[^>]*>/g, '' ).trim() && (
						<Notice status="warning" isDismissible={ false }>
							{ __( 'Write the question: an item without one is not shown on the page.', 'werun-blocks-community' ) }
						</Notice>
					) }
					<Toggle
						attributes={ a }
						setAttributes={ setAttributes }
						name="openByDefault"
						label={ __( 'Open when the page loads', 'werun-blocks-community' ) }
						help={
							get( 'allowMultiple', false )
								? undefined
								: __( 'One open at a time: only the first open item stays open (with "First question open on load", that is the first question).', 'werun-blocks-community' )
						}
					/>
					{ showLead && (
						<>
							<IconControl
								label={ __( 'Icon before the question', 'werun-blocks-community' ) }
								value={ leadIcon }
								help={ ownIcon ? undefined : __( "The accordion's icon. Change it here for this question only.", 'werun-blocks-community' ) }
								onChange={ ( icon ) => setAttributes( { icon: icon || { name: '' } } ) }
							/>
							{ ownIcon && (
								<Button variant="link" onClick={ () => setAttributes( { icon: undefined } ) }>
									{ __( "Use the accordion's icon", 'werun-blocks-community' ) }
								</Button>
							) }
						</>
					) }
				</PanelBody>
			</InspectorControls>
			<div { ...blockProps }>
				<div className={ cx( 'wrbc-acc-item__details', open && 'is-open' ) }>
					<div className="wrbc-acc-item__summary">
						{ showLead && leadIcon?.name && <Icon icon={ leadIcon } className="wrbc-acc-item__lead" /> }
						<RichText
							tagName={ tagName }
							className="wrbc-acc-item__question"
							value={ a.question }
							onChange={ ( question ) => setAttributes( { question } ) }
							placeholder={ __( 'Question', 'werun-blocks-community' ) }
							allowedFormats={ [ 'core/italic' ] }
						/>
						{ toggle && (
							<button
								type="button"
								className="wrbc-acc-item__toggle-btn"
								aria-expanded={ open }
								aria-label={ open ? __( 'Hide the answer', 'werun-blocks-community' ) : __( 'Show the answer', 'werun-blocks-community' ) }
								onClick={ () => setOpen( ! open ) }
							>
								<span className="wrbc-acc-item__toggle">{ toggle }</span>
							</button>
						) }
					</div>
					<div className="wrbc-acc-item__panel">
						<div { ...innerBlocksProps } />
					</div>
				</div>
			</div>
		</>
	);
}
