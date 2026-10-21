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
// back gives the same look, and the items are kept.
const look = ( attributes ) => ( {
	orientation: 'vertical',
	markerStyle: 'dot',
	datePosition: 'card',
	cardStyle: 'bordered',
	lineStyle: 'solid',
	...attributes,
} );

registerBlockType( metadata.name, {
	icon: blockIcon( metadata.name ),
	edit: Edit,
	save: () => <InnerBlocks.Content />,
	variations: [
		{
			name: 'vertical',
			title: __( 'Timeline: vertical', 'werun-blocks-community' ),
			description: __( 'One line down the side, dots on it, dates in the cards.', 'werun-blocks-community' ),
			attributes: look( {} ),
			isActive: [ 'orientation', 'markerStyle' ],
			scope: [ 'transform' ],
		},
		{
			name: 'alternating',
			title: __( 'Timeline: alternating', 'werun-blocks-community' ),
			description: __( 'Cards on both sides of a centred line, dates across from them.', 'werun-blocks-community' ),
			attributes: look( { orientation: 'alternating', datePosition: 'opposite', cardStyle: 'filled', alternateStart: 'end' } ),
			isActive: [ 'orientation' ],
			scope: [ 'transform' ],
		},
		{
			name: 'horizontal',
			title: __( 'Timeline: horizontal scroll', 'werun-blocks-community' ),
			description: __( 'A numbered process on a track that scrolls sideways, with arrows.', 'werun-blocks-community' ),
			attributes: look( { orientation: 'horizontal', markerStyle: 'number', cardStyle: 'plain', lineStyle: 'dashed', showArrows: true, itemWidth: 300 } ),
			isActive: [ 'orientation' ],
			scope: [ 'transform' ],
		},
		{
			name: 'years',
			title: __( 'Timeline: by year', 'werun-blocks-community' ),
			description: __( 'Company history with each year on the line.', 'werun-blocks-community' ),
			attributes: look( { markerStyle: 'year', cardStyle: 'plain' } ),
			isActive: [ 'orientation', 'markerStyle' ],
			scope: [ 'transform' ],
		},
	],
} );
