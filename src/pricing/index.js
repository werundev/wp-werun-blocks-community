import { registerBlockType } from '@wordpress/blocks';
import { InnerBlocks } from '@wordpress/block-editor';
import { __ } from '@wordpress/i18n';
import metadata from './block.json';
import { blockIcon } from '../shared/block-icons';
import Edit from './edit';
import './style.scss';
import './editor.scss';

/** @param {Object} a Attributes. */
const isCentered = ( a ) => a.cardStyle === 'filled' && a.contentAlign === 'center';

registerBlockType( metadata.name, {
	icon: blockIcon( metadata.name ),
	edit: Edit,
	save: () => <InnerBlocks.Content />,
	/*
	 * Layouts under "Transform to variation": they change options only (a
	 * transform keeps the inner blocks), and each one sets what the others
	 * change, so going back really goes back. isActive functions exclude each other.
	 */
	variations: [
		{
			name: 'three-plans',
			title: __( 'Pricing: three columns', 'werun-blocks-community' ),
			description: __( 'Three columns, the featured plan taller, with the billing switch.', 'werun-blocks-community' ),
			attributes: { columnsDesktop: 3, columnsTablet: 2, showToggle: true, featuredScale: true, cardStyle: 'bordered', contentAlign: 'left', showExcluded: true },
			scope: [ 'transform' ],
			isActive: ( a ) => a.columnsDesktop === 3 && a.showToggle !== false && ! isCentered( a ),
		},
		{
			name: 'two-plans',
			title: __( 'Pricing: two columns, one price', 'werun-blocks-community' ),
			description: __( 'Two columns side by side, no billing switch.', 'werun-blocks-community' ),
			attributes: { columnsDesktop: 2, columnsTablet: 2, showToggle: false, featuredScale: false, cardStyle: 'bordered', contentAlign: 'left', showExcluded: true },
			scope: [ 'transform' ],
			isActive: ( a ) => a.columnsDesktop === 2 && a.showToggle === false && ! isCentered( a ),
		},
		{
			name: 'centered',
			title: __( 'Pricing: centred, filled', 'werun-blocks-community' ),
			description: __( 'Filled cards with centred text and no excluded lines.', 'werun-blocks-community' ),
			attributes: { cardStyle: 'filled', contentAlign: 'center', showExcluded: false },
			scope: [ 'transform' ],
			isActive: isCentered,
		},
	],
} );
