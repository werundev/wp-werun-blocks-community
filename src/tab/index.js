import { registerBlockType } from '@wordpress/blocks';
import { InnerBlocks } from '@wordpress/block-editor';
import metadata from './block.json';
import { blockIcon } from '../shared/block-icons';
import Edit from './edit';

registerBlockType( metadata.name, {
	icon: blockIcon( metadata.name ),
	edit: Edit,
	// The panel's blocks are saved; the markup around them is render.php.
	save: () => <InnerBlocks.Content />,
} );
