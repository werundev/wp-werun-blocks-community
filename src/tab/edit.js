import { __ } from '@wordpress/i18n';
import { InspectorControls, store as blockEditorStore, useBlockProps, useInnerBlocksProps } from '@wordpress/block-editor';
import { Button, PanelBody } from '@wordpress/components';
import { useSelect } from '@wordpress/data';
import { useRef } from '@wordpress/element';
import { IconControl } from '../shared/IconControl';
import { cx } from '../shared/controls';
import { ACCENT, AA_TEXT, blockSurface, colorRgba, readableColor, toneClass, useContextBackground } from '../shared/contrast';
import { ContrastAudit } from '../shared/a11y';

/**
 * A tab's panel in the editor. Its label is edited on the tab button (the
 * tabs block draws the buttons); the panel shows while its tab is open
 * (werun-community/tabs/editorActive, editor-only context from the tabs block).
 */
export default function Edit( { attributes, setAttributes, context, clientId, name } ) {
	const a = attributes;
	const active = context[ 'werun-community/tabs/editorActive' ];
	const index = useSelect( ( select ) => select( blockEditorStore ).getBlockIndex( clientId ), [ clientId ] );
	const showIcons = !! context[ 'werun-community/tabs/showIcons' ];
	// Its own icon, or the tabs block's while it has none ({ name: '' } hides it). Twin: src/tabs/render.php.
	const ownIcon = a.icon && typeof a.icon === 'object';
	const icon = ownIcon ? a.icon : context[ 'werun-community/tabs/tabIcon' ] || { name: 'sparkles' };

	// A panel with its own background: tone and readable accent for it. Twin: src/tab/render.php.
	const around = useContextBackground( clientId );
	const ownBg = blockSurface( a, name );
	const accent = context[ 'werun-community/tabs/accentColor' ];
	const accentText = ownBg ? readableColor( accent && colorRgba( accent ) ? accent : ACCENT, ownBg, AA_TEXT ) : '';

	const ref = useRef();
	const blockProps = useBlockProps( {
		ref,
		className: cx( 'wrbc-tab', ownBg && toneClass( ownBg, around ), active && active !== clientId && 'is-inactive' ),
		style: { '--wrbc-tab-i': index, ...( accentText ? { '--wrbc-accent-text': accentText, '--wrbc-focus': accentText } : {} ) },
	} );
	const innerBlocksProps = useInnerBlocksProps(
		{ className: 'wrbc-tab__content' },
		{
			template: [ [ 'core/paragraph', { placeholder: __( 'What this tab shows. Any block can go here.', 'werun-blocks-community' ) } ] ],
			templateLock: false,
		}
	);

	return (
		<>
			<ContrastAudit blockRef={ ref } deps={ [ attributes, active ] } />
			{ showIcons && (
				<InspectorControls>
					<PanelBody title={ __( 'Tab', 'werun-blocks-community' ) }>
						<IconControl
							label={ __( 'Icon', 'werun-blocks-community' ) }
							value={ icon }
							help={ ownIcon ? undefined : __( "The tabs block's icon. Change it here for this tab only.", 'werun-blocks-community' ) }
							onChange={ ( value ) => setAttributes( { icon: value || { name: '' } } ) }
						/>
						{ ownIcon && (
							<Button variant="link" onClick={ () => setAttributes( { icon: undefined } ) }>
								{ __( "Use the tabs block's icon", 'werun-blocks-community' ) }
							</Button>
						) }
					</PanelBody>
				</InspectorControls>
			) }
			<section { ...blockProps }>
				<div { ...innerBlocksProps } />
			</section>
		</>
	);
}
