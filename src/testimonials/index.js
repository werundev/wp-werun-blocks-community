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
	save: () => <InnerBlocks.Content />,
	variations: [
		// Layout variations keep the source (quotes written here or from a post type) and the
		// content; each sets every option the others change, so going back undoes them
		// (spotlight → carousel brings back three in view, arrows, no autoplay…). They are
		// the active one only for quotes written here: from a post type, "query" is.
		{
			name: 'carousel',
			title: __( 'Testimonials: carousel', 'werun-blocks-community' ),
			description: __( 'Three in view on desktop, arrows and dots.', 'werun-blocks-community' ),
			attributes: { layout: 'carousel', columnsDesktop: 3, columnsTablet: 2, columnsMobile: 1, contentAlign: 'left', cardStyle: 'bordered', autoplay: false, showArrows: true, headerAlign: 'left' },
			isActive: ( block ) => block.layout !== 'grid' && block.columnsDesktop !== 1 && block.source !== 'query',
			scope: [ 'transform' ],
		},
		{
			name: 'spotlight',
			title: __( 'Testimonials: one at a time', 'werun-blocks-community' ),
			description: __( 'A single large quote, centred, that plays on its own.', 'werun-blocks-community' ),
			attributes: { layout: 'carousel', columnsDesktop: 1, columnsTablet: 1, columnsMobile: 1, contentAlign: 'center', cardStyle: 'plain', autoplay: true, showArrows: false, headerAlign: 'center' },
			isActive: ( block ) => block.layout !== 'grid' && block.columnsDesktop === 1 && block.source !== 'query',
			scope: [ 'transform' ],
		},
		{
			name: 'grid',
			title: __( 'Testimonials: grid', 'werun-blocks-community' ),
			attributes: { layout: 'grid', cardStyle: 'filled', columnsDesktop: 2, columnsTablet: 2, columnsMobile: 1, contentAlign: 'left', headerAlign: 'left' },
			isActive: ( block ) => block.layout === 'grid' && block.source !== 'query',
			scope: [ 'transform' ],
		},
		{
			name: 'query',
			title: __( 'Testimonials: from a post type', 'werun-blocks-community' ),
			description: __( 'One card per published post of a post type (a testimonials or reviews type is picked if there is one), with the fields you map.', 'werun-blocks-community' ),
			attributes: { source: 'query' },
			isActive: [ 'source' ],
			scope: [ 'transform' ],
		},
	],
} );
