import { registerBlockType } from '@wordpress/blocks';
import { InnerBlocks } from '@wordpress/block-editor';
import { __ } from '@wordpress/i18n';
import metadata from './block.json';
import { blockIcon } from '../shared/block-icons';
import Edit from './edit';
import './style.scss';
import './editor.scss';

registerBlockType( metadata.name, {
	icon: blockIcon( metadata.name ),
	edit: Edit,
	// The panels' blocks are saved; the markup around them is render.php.
	save: () => <InnerBlocks.Content />,
	variations: [
		{
			name: 'horizontal',
			title: __( 'Tabs: horizontal', 'werun-blocks-community' ),
			description: __( 'Tabs in a row above the panels, underlined.', 'werun-blocks-community' ),
			attributes: { orientation: 'horizontal', tabStyle: 'underline', showIcons: false },
			isActive: [ 'orientation', 'tabStyle', 'showIcons' ],
			scope: [ 'transform' ],
		},
		{
			name: 'vertical',
			title: __( 'Tabs: vertical', 'werun-blocks-community' ),
			description: __( 'A column of tabs beside the panels; on phones they turn into an accordion.', 'werun-blocks-community' ),
			attributes: { orientation: 'vertical', tabStyle: 'underline', mobileMode: 'accordion', accordionBelow: 600 },
			isActive: [ 'orientation' ],
			scope: [ 'transform' ],
		},
		{
			name: 'pills',
			title: __( 'Tabs: pills', 'werun-blocks-community' ),
			description: __( 'Rounded tabs, centred, the open one filled with the accent colour.', 'werun-blocks-community' ),
			attributes: { orientation: 'horizontal', tabStyle: 'pills', tabAlign: 'center', fullWidth: false, showIcons: false },
			isActive: [ 'orientation', 'tabStyle', 'showIcons' ],
			scope: [ 'transform' ],
		},
		{
			name: 'icon-text',
			title: __( 'Tabs: icon and text', 'werun-blocks-community' ),
			description: __( 'An icon above each label, boxed tabs filling the width.', 'werun-blocks-community' ),
			attributes: { orientation: 'horizontal', tabStyle: 'boxed', showIcons: true, iconPosition: 'top', fullWidth: true, iconSize: 24 },
			isActive: [ 'orientation', 'showIcons' ],
			scope: [ 'transform' ],
		},
		{
			name: 'segmented',
			title: __( 'Tabs: segmented control', 'werun-blocks-community' ),
			description: __( 'A compact switch for two to four short options.', 'werun-blocks-community' ),
			attributes: { orientation: 'horizontal', tabStyle: 'segmented', tabAlign: 'center', fullWidth: false, showIcons: false },
			isActive: [ 'orientation', 'tabStyle', 'showIcons' ],
			scope: [ 'transform' ],
		},
	],
} );
