import { registerBlockType } from '@wordpress/blocks';
import { InnerBlocks } from '@wordpress/block-editor';
import { __ } from '@wordpress/i18n';
import metadata from './block.json';
import { blockIcon } from '../shared/block-icons';
import Edit from './edit';
import './style.scss';
import './editor.scss';

const hasBgColor = ( a ) => !! ( a.backgroundColor || a.gradient || a.style?.color?.background || a.style?.color?.gradient );

registerBlockType( metadata.name, {
	icon: blockIcon( metadata.name ),
	edit: Edit,
	save: () => <InnerBlocks.Content />,
	variations: [
		{
			name: 'contained',
			title: __( 'Section: contained', 'werun-blocks-community' ),
			description: __( 'Wide box with the content width inside, one column, no background image.', 'werun-blocks-community' ),
			attributes: { align: 'wide', innerWidth: 'content', columns: 'one', bgType: 'none', paddingY: 'md' },
			scope: [ 'transform' ],
			isActive: ( a ) => a.align === 'wide' && a.columns !== 'two' && a.bgType !== 'image',
		},
		{
			name: 'full-background',
			title: __( 'Section: full width with background', 'werun-blocks-community' ),
			description: __( 'Edge to edge, a soft background colour, generous padding.', 'werun-blocks-community' ),
			attributes: {
				align: 'full',
				innerWidth: 'wide',
				columns: 'one',
				bgType: 'none',
				paddingY: 'lg',
				textTone: 'dark',
				style: { color: { background: '#f1f5f9' } },
			},
			scope: [ 'transform' ],
			isActive: ( a ) => a.align === 'full' && a.columns !== 'two' && a.bgType !== 'image' && hasBgColor( a ),
		},
		{
			name: 'image-overlay',
			title: __( 'Section: background image with overlay', 'werun-blocks-community' ),
			description: __( 'Full width, an image under a dark overlay, light text, 60% of the screen tall.', 'werun-blocks-community' ),
			attributes: {
				align: 'full',
				bgType: 'image',
				columns: 'one',
				overlayColor: '#000000',
				overlayOpacity: 55,
				textTone: 'light',
				minHeight: 60,
				minHeightUnit: 'vh',
				verticalAlign: 'center',
				paddingY: 'xl',
			},
			scope: [ 'transform' ],
			isActive: ( a ) => a.bgType === 'image' && a.columns !== 'two',
		},
		{
			name: 'two-columns',
			title: __( 'Section: two columns', 'werun-blocks-community' ),
			description: __( 'Two columns side by side that stack on phones. Each block inside is one column.', 'werun-blocks-community' ),
			attributes: { columns: 'two', columnsRatio: '50-50', verticalAlign: 'center' },
			scope: [ 'transform' ],
			isActive: ( a ) => a.columns === 'two',
		},
	],
} );
