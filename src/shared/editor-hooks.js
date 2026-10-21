/**
 * Editor-wide hooks for every werun.Blocks.Community block (loaded with the Saved
 * styles panel, src/presets/index.js, which every editor gets).
 *
 * - wrbc-has-link-color on a block whose Color panel sets a link colour:
 *   WordPress only prints wp-elements-N, and the shared dark-context link
 *   rule (assets/shared.css) must not override the author's choice. Twin of
 *   wrbc_mark_link_color() in includes/a11y/context.php.
 */
import { createHigherOrderComponent } from '@wordpress/compose';
import { addFilter } from '@wordpress/hooks';

/** Whether a block's attributes set a link colour (normal or hover). */
export function hasLinkColor( attributes ) {
	const link = attributes?.style?.elements?.link;
	return !! ( link && ( link.color?.text || link[ ':hover' ]?.color?.text ) );
}

const withLinkColorClass = createHigherOrderComponent(
	( BlockListBlock ) => ( props ) => {
		if ( ! props.name?.startsWith( 'werun-community/' ) || ! hasLinkColor( props.attributes ) ) {
			return <BlockListBlock { ...props } />;
		}
		return <BlockListBlock { ...props } className={ [ props.className, 'wrbc-has-link-color' ].filter( Boolean ).join( ' ' ) } />;
	},
	'withLinkColorClass'
);

addFilter( 'editor.BlockListBlock', 'werun-blocks-community/link-color-class', withLinkColorClass );
