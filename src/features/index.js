import { registerBlockType } from '@wordpress/blocks';
import { InnerBlocks } from '@wordpress/block-editor';
import { __ } from '@wordpress/i18n';
import metadata from './block.json';
import { blockIcon } from '../shared/block-icons';
import Edit from './edit';
import './style.scss';
import './editor.scss';

/*
 * Every variation sets the same keys (the block.json defaults where it doesn't
 * care), so transforming from one to another never keeps a leftover of the
 * previous one: "minimal" switching links off, "list" its round icons…
 */
const base = {
	columnsDesktop: 3,
	columnsTablet: 2,
	cardStyle: 'bordered',
	layout: 'stacked',
	contentAlign: 'left',
	hover: 'lift',
	linkStyle: 'link',
	showLink: true,
	iconStyle: 'square',
	iconSize: 24,
	headerAlign: 'left',
};

const item = ( name, title, text, lib = 'lucide' ) => [
	'werun-community/feature',
	{ icon: { name, lib, anim: lib === 'animated' ? 'auto' : 'pop', trigger: 'hover' }, title, text },
];

registerBlockType( metadata.name, {
	icon: blockIcon( metadata.name ),
	edit: Edit,
	save: () => <InnerBlocks.Content />,
	variations: [
		{
			name: 'cards',
			title: __( 'Feature grid: cards', 'werun-blocks-community' ),
			description: __( 'Three bordered cards per row, icon on top.', 'werun-blocks-community' ),
			attributes: { ...base },
			isActive: [ 'cardStyle', 'layout' ],
			scope: [ 'transform' ],
		},
		{
			name: 'list',
			title: __( 'Feature grid: list with icons beside', 'werun-blocks-community' ),
			description: __( 'Two columns, the icon left of the text, no card.', 'werun-blocks-community' ),
			attributes: { ...base, columnsDesktop: 2, columnsTablet: 2, cardStyle: 'plain', layout: 'inline', iconStyle: 'circle', hover: 'none' },
			isActive: [ 'cardStyle', 'layout' ],
			scope: [ 'transform' ],
			innerBlocks: [
				item( 'clock', 'Delivered on time', 'Dates agreed before we start, and kept.' ),
				item( 'messages-square', 'One person to talk to', 'The same contact from the first call to launch.' ),
				item( 'wallet', 'A fixed price', 'Agreed in writing. Anything new is quoted apart.' ),
				item( 'life-buoy', 'Support after launch', 'A month of fixes and questions included.' ),
			],
		},
		{
			name: 'minimal',
			title: __( 'Feature grid: minimal, centred', 'werun-blocks-community' ),
			description: __( 'Four columns, large icons, no links.', 'werun-blocks-community' ),
			attributes: { ...base, columnsDesktop: 4, columnsTablet: 2, cardStyle: 'plain', contentAlign: 'center', iconStyle: 'none', iconSize: 36, showLink: false, hover: 'none', headerAlign: 'center' },
			isActive: [ 'cardStyle', 'contentAlign', 'iconStyle' ],
			scope: [ 'transform' ],
			innerBlocks: [
				item( 'rocket', 'Launch', 'Live in weeks, not months.', 'animated' ),
				item( 'gauge', 'Speed', 'Green on every vital.', 'animated' ),
				item( 'search', 'Found', 'Built to be indexed.', 'animated' ),
				item( 'heart-handshake', 'Looked after', 'We stay after launch.' ),
			],
		},
		{
			name: 'filled',
			title: __( 'Feature grid: filled cards', 'werun-blocks-community' ),
			description: __( 'Filled cards, whole card clickable.', 'werun-blocks-community' ),
			attributes: { ...base, cardStyle: 'filled', linkStyle: 'card', iconStyle: 'circle' },
			isActive: [ 'cardStyle', 'linkStyle' ],
			scope: [ 'transform' ],
		},
	],
} );
