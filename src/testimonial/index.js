import { registerBlockType } from '@wordpress/blocks';
import metadata from './block.json';
import { blockIcon } from '../shared/block-icons';
import Edit from './edit';

registerBlockType( metadata.name, {
	icon: blockIcon( metadata.name ),
	edit: Edit,
	save: () => null,
} );
