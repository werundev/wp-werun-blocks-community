import { registerBlockType } from '@wordpress/blocks';
import { __ } from '@wordpress/i18n';
import metadata from './block.json';
import { blockIcon } from '../shared/block-icons';
import Edit from './edit';
import './style.scss';
import './editor.scss';

/*
 * Which layout a hero has, for "Transform to variation". One rule per
 * variation and they never overlap, so the order of the list doesn't matter
 * (getActiveBlockVariation() stops at the first function that matches).
 * Centred: with an image = centred, without = text only, or video background
 * when a video is chosen. Split: figures without checklist = figures,
 * otherwise by image side.
 */
const hasVideo = ( a ) => !! ( a.bgVideoUrl || a.bgVideoId );
const centred = ( a ) => a.layout === 'centered';
const figures = ( a ) => !! a.showStats && ! a.showPoints;
const isActive = {
	'split-right': ( a ) => ! centred( a ) && ! figures( a ) && a.mediaPosition !== 'left',
	'split-left': ( a ) => ! centred( a ) && ! figures( a ) && a.mediaPosition === 'left',
	centered: ( a ) => centred( a ) && a.showMedia !== false,
	figures: ( a ) => ! centred( a ) && figures( a ),
	'video-background': ( a ) => centred( a ) && a.showMedia === false && hasVideo( a ),
	'text-only': ( a ) => centred( a ) && a.showMedia === false && ! hasVideo( a ),
};

registerBlockType( metadata.name, {
	icon: blockIcon( metadata.name ),
	edit: Edit,
	save: () => null,
	// Each variation sets what tells it apart, so transforming back works
	// (from figures or text only to an image layout brings the image and the
	// checklist back). Texts, images and the video are never touched.
	variations: [
		{
			name: 'split-right',
			title: __( 'Hero: image on the right', 'werun-blocks-community' ),
			description: __( 'Text on the left, image on the right.', 'werun-blocks-community' ),
			attributes: { layout: 'split', mediaPosition: 'right', showMedia: true, showPoints: true, showStats: false },
			scope: [ 'transform' ],
			isActive: isActive[ 'split-right' ],
		},
		{
			name: 'split-left',
			title: __( 'Hero: image on the left', 'werun-blocks-community' ),
			attributes: { layout: 'split', mediaPosition: 'left', showMedia: true, showPoints: true, showStats: false },
			scope: [ 'transform' ],
			isActive: isActive[ 'split-left' ],
		},
		{
			name: 'centered',
			title: __( 'Hero: centred', 'werun-blocks-community' ),
			description: __( 'Everything centred, the image underneath.', 'werun-blocks-community' ),
			attributes: { layout: 'centered', showMedia: true, showPoints: false },
			scope: [ 'transform' ],
			isActive: isActive.centered,
		},
		{
			name: 'figures',
			title: __( 'Hero: with figures', 'werun-blocks-community' ),
			description: __( 'Split, with a row of figures instead of the checklist.', 'werun-blocks-community' ),
			attributes: { layout: 'split', showMedia: true, showStats: true, showPoints: false },
			scope: [ 'transform' ],
			isActive: isActive.figures,
		},
		{
			name: 'video-background',
			title: __( 'Hero: video background', 'werun-blocks-community' ),
			description: __( 'Centred text over a muted looping video from the media library, with a pause button. Choose the video under Background.', 'werun-blocks-community' ),
			attributes: { layout: 'centered', showMedia: false, showPoints: false, minHeight: 80, minHeightUnit: 'vh', overlayOpacity: 55 },
			scope: [ 'transform' ],
			isActive: isActive[ 'video-background' ],
		},
		{
			name: 'text-only',
			title: __( 'Hero: text only', 'werun-blocks-community' ),
			description: __( 'Centred text, no image (or with a video: the video background).', 'werun-blocks-community' ),
			attributes: { layout: 'centered', showMedia: false, showPoints: false, minHeight: 60, minHeightUnit: 'vh' },
			scope: [ 'transform' ],
			isActive: isActive[ 'text-only' ],
		},
	],
} );
