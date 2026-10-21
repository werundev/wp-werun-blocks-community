import { registerBlockType } from '@wordpress/blocks';
import { InnerBlocks } from '@wordpress/block-editor';
import { __ } from '@wordpress/i18n';
import metadata from './block.json';
import { blockIcon } from '../shared/block-icons';
import Edit from './edit';
import './style.scss';
import './editor.scss';

const one = { columnsDesktop: 1, columnsTablet: 1, columnsMobile: 1 };
/*
 * Every variation sets the same keys, so transforming from one to another
 * never keeps a leftover of the previous one (padding, dots, min height).
 */
const base = { ...one, slideStyle: 'filled', showThumbs: false, showDots: true, aspectRatio: 'auto', minHeight: 0, peek: 0, verticalAlign: 'center', slidePadding: 40 };

registerBlockType( metadata.name, {
	icon: blockIcon( metadata.name ),
	edit: Edit,
	save: () => <InnerBlocks.Content />,
	variations: [
		{
			name: 'content',
			title: __( 'Carousel: content slides', 'werun-blocks-community' ),
			description: __( 'One slide at a time on a soft background, content in the middle.', 'werun-blocks-community' ),
			attributes: { ...base, minHeight: 360 },
			isActive: [ 'slideStyle', 'showThumbs' ],
			scope: [ 'transform' ],
		},
		{
			name: 'images',
			title: __( 'Carousel: image slides', 'werun-blocks-community' ),
			description: __( 'Full-width 16:9 slides for background images, text at the bottom.', 'werun-blocks-community' ),
			attributes: { ...base, slideStyle: 'plain', aspectRatio: '16/9', verticalAlign: 'bottom', slidePadding: 48 },
			isActive: [ 'slideStyle', 'showThumbs' ],
			scope: [ 'transform' ],
		},
		{
			name: 'cards',
			title: __( 'Carousel: cards', 'werun-blocks-community' ),
			description: __( 'Three bordered cards in view, with a peek at the next one.', 'werun-blocks-community' ),
			attributes: { ...base, columnsDesktop: 3, columnsTablet: 2, slideStyle: 'bordered', peek: 48, verticalAlign: 'top', slidePadding: 28 },
			isActive: [ 'slideStyle', 'showThumbs' ],
			scope: [ 'transform' ],
		},
		{
			name: 'thumbnails',
			title: __( 'Carousel: with thumbnails', 'werun-blocks-community' ),
			description: __( 'One image slide at a time with previews of every slide below.', 'werun-blocks-community' ),
			attributes: { ...base, slideStyle: 'plain', showThumbs: true, showDots: false, aspectRatio: '16/9', verticalAlign: 'bottom' },
			isActive: [ 'showThumbs' ],
			scope: [ 'transform' ],
		},
	],
} );
