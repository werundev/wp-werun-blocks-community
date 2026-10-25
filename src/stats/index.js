import { registerBlockType } from '@wordpress/blocks';
import { InnerBlocks } from '@wordpress/block-editor';
import { __ } from '@wordpress/i18n';
import metadata from './block.json';
import { blockIcon } from '../shared/block-icons';
import Edit from './edit';
import './style.scss';
import './editor.scss';

// Transforming applies a variation's attributes only (never its inner blocks),
// so every variation sets the same keys: switching from one to another and
// back gives the same look, and the stats are kept.
const look = ( attributes ) => ( {
	layout: 'row',
	showIcon: false,
	iconStyle: 'none',
	iconSize: 28,
	separators: true,
	contentAlign: 'center',
	columnsDesktop: 4,
	columnsTablet: 2,
	numberSize: 3,
	cardStyle: 'filled',
	showDescription: false,
	...attributes,
} );

registerBlockType( metadata.name, {
	icon: blockIcon( metadata.name ),
	edit: Edit,
	save: () => <InnerBlocks.Content />,
	variations: [
		{
			name: 'row',
			title: __( 'Stats: counter row', 'werun-blocks-community' ),
			description: __( 'Four numbers in a row with lines between them, counting up.', 'werun-blocks-community' ),
			attributes: look( {} ),
			isActive: [ 'layout', 'showIcon' ],
			scope: [ 'transform' ],
		},
		{
			name: 'cards',
			title: __( 'Stats: cards', 'werun-blocks-community' ),
			description: __( 'Each number in a filled card.', 'werun-blocks-community' ),
			attributes: look( { layout: 'cards', contentAlign: 'left', numberSize: 2.75 } ),
			isActive: [ 'layout' ],
			scope: [ 'transform' ],
		},
		{
			name: 'icons',
			title: __( 'Stats: with icons', 'werun-blocks-community' ),
			description: __( 'An icon in a circle above every number.', 'werun-blocks-community' ),
			attributes: look( { showIcon: true, iconStyle: 'circle', iconSize: 24, separators: false } ),
			isActive: [ 'layout', 'showIcon' ],
			scope: [ 'transform' ],
		},
		{
			name: 'large',
			title: __( 'Stats: large with description', 'werun-blocks-community' ),
			description: __( 'Three large figures with a rule above and a line of context.', 'werun-blocks-community' ),
			attributes: look( { layout: 'large', showDescription: true, contentAlign: 'left', columnsDesktop: 3, columnsTablet: 3, numberSize: 4.5 } ),
			isActive: [ 'layout' ],
			scope: [ 'transform' ],
		},
	],
} );
