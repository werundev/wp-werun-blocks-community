import { registerBlockType } from '@wordpress/blocks';
import { __ } from '@wordpress/i18n';
import metadata from './block.json';
import { blockIcon } from '../shared/block-icons';
import Edit from './edit';
import './style.scss';
import './editor.scss';

registerBlockType( metadata.name, {
	icon: blockIcon( metadata.name ),
	edit: Edit,
	save: () => null,
	variations: [
		{
			name: 'centered',
			title: __( 'Call to action: centred banner', 'werun-blocks-community' ),
			description: __( 'Everything centred, two buttons.', 'werun-blocks-community' ),
			// Back from the strip: the eyebrow and text come back too.
			attributes: { layout: 'centered', showMedia: false, showSecondary: true, showEyebrow: true, showText: true },
			scope: [ 'transform' ],
			isActive: [ 'layout' ],
		},
		{
			name: 'split',
			title: __( 'Call to action: split with image', 'werun-blocks-community' ),
			description: __( 'Text on one side, an image on the other.', 'werun-blocks-community' ),
			attributes: { layout: 'split', showMedia: true, mediaPosition: 'right', mediaRatio: '4/3', showEyebrow: true, showText: true },
			scope: [ 'transform' ],
			isActive: [ 'layout' ],
		},
		{
			name: 'strip',
			title: __( 'Call to action: compact strip', 'werun-blocks-community' ),
			description: __( 'One row: a short title and a button at the end.', 'werun-blocks-community' ),
			attributes: { layout: 'strip', showEyebrow: false, showText: false, showSecondary: false },
			scope: [ 'transform' ],
			isActive: [ 'layout' ],
		},
		{
			name: 'card',
			title: __( 'Call to action: floating card', 'werun-blocks-community' ),
			description: __( 'A card over the block’s background colour, gradient or image.', 'werun-blocks-community' ),
			attributes: { layout: 'card', contentAlign: 'center', contentWidth: 760, align: 'full' },
			scope: [ 'transform' ],
			isActive: [ 'layout' ],
		},
	],
} );
