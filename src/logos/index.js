import { registerBlockType } from '@wordpress/blocks';
import { __ } from '@wordpress/i18n';
import metadata from './block.json';
import { blockIcon } from '../shared/block-icons';
import Edit from './edit';
import './style.scss';
import './editor.scss';

/* Same keys in every variation: no leftover (grey, dimmed, one flat colour) after a transform. */
const base = { logoTone: 'original', grayscale: false, opacity: 100, hoverReveal: true };

registerBlockType( metadata.name, {
	icon: blockIcon( metadata.name ),
	edit: Edit,
	save: () => null,
	variations: [
		{
			name: 'grid',
			title: __( 'Logos: grid', 'werun-blocks-community' ),
			description: __( 'Logos in full colour, in columns.', 'werun-blocks-community' ),
			attributes: { ...base, layout: 'grid' },
			isActive: [ 'layout', 'grayscale' ],
			scope: [ 'transform' ],
		},
		{
			name: 'marquee',
			title: __( 'Logos: infinite marquee', 'werun-blocks-community' ),
			description: __( 'An endless row that scrolls on its own, with a pause button. Still for visitors who ask for reduced motion.', 'werun-blocks-community' ),
			attributes: { ...base, layout: 'marquee', grayscale: true, opacity: 70 },
			isActive: [ 'layout' ],
			scope: [ 'transform' ],
		},
		{
			name: 'carousel',
			title: __( 'Logos: carousel', 'werun-blocks-community' ),
			description: __( 'Six in view on desktop, with arrows.', 'werun-blocks-community' ),
			attributes: { ...base, layout: 'carousel', showArrows: true, showDots: false, columnsDesktop: 6, columnsTablet: 4, columnsMobile: 2 },
			isActive: [ 'layout' ],
			scope: [ 'transform' ],
		},
		{
			name: 'grayscale-grid',
			title: __( 'Logos: grayscale grid with hover', 'werun-blocks-community' ),
			description: __( 'Grey, slightly dimmed logos that take their colour on hover.', 'werun-blocks-community' ),
			attributes: { ...base, layout: 'grid', grayscale: true, opacity: 60 },
			isActive: [ 'layout', 'grayscale' ],
			scope: [ 'transform' ],
		},
	],
} );
