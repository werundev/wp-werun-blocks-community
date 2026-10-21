import { registerBlockType } from '@wordpress/blocks';
import { addFilter } from '@wordpress/hooks';
import { __ } from '@wordpress/i18n';
import metadata from './block.json';
import { blockIcon } from '../shared/block-icons';
import Edit from './edit';
import './style.scss';
import './editor.scss';

/*
 * Colours from the palette only: no custom colour picker for this block
 * (background, text, link, accent). block.json supports can't say that, so the
 * block's own settings are overridden in the editor. Limit: a custom value
 * typed in the code editor is still rendered by the colour support.
 */
addFilter( 'blockEditor.useSetting.before', 'werun-community/media-text/palette-only', ( value, path, clientId, blockName ) => {
	if ( blockName === metadata.name && ( path === 'color.custom' || path === 'color.customGradient' ) ) {
		return false;
	}
	return value;
} );

const isVideo = ( a ) => a.media?.type === 'video';

registerBlockType( metadata.name, {
	icon: blockIcon( metadata.name ),
	edit: Edit,
	save: () => null,
	variations: [
		// The bare media values ({ type: 'image' }, { type: 'video', provider: 'youtube' })
		// tell edit.js (variationMedia()) to keep the chosen file: an image
		// becomes the video's cover image and back. Keep them bare.
		{
			name: 'image-left',
			title: __( 'Media and text: image left', 'werun-blocks-community' ),
			description: __( 'A 4:3 image on the left, the text on the right.', 'werun-blocks-community' ),
			attributes: { media: { type: 'image' }, mediaPosition: 'left', mediaRatio: '4/3' },
			scope: [ 'transform' ],
			isActive: ( a ) => ! isVideo( a ) && a.mediaPosition !== 'right' && a.mediaRatio !== '1/1',
		},
		{
			name: 'image-right',
			title: __( 'Media and text: image right', 'werun-blocks-community' ),
			description: __( 'The text on the left, a 4:3 image on the right.', 'werun-blocks-community' ),
			attributes: { media: { type: 'image' }, mediaPosition: 'right', mediaRatio: '4/3' },
			scope: [ 'transform' ],
			isActive: ( a ) => ! isVideo( a ) && a.mediaPosition === 'right' && a.mediaRatio !== '1/1',
		},
		{
			name: 'video',
			title: __( 'Media and text: video', 'werun-blocks-community' ),
			description: __( 'A 16:9 YouTube, Vimeo or uploaded video that loads only on play.', 'werun-blocks-community' ),
			attributes: { media: { type: 'video', provider: 'youtube' }, mediaRatio: '16/9' },
			scope: [ 'transform' ],
			isActive: isVideo,
		},
		{
			name: 'square',
			title: __( 'Media and text: square media', 'werun-blocks-community' ),
			description: __( 'A square image beside the text.', 'werun-blocks-community' ),
			attributes: { media: { type: 'image' }, mediaRatio: '1/1' },
			scope: [ 'transform' ],
			isActive: ( a ) => ! isVideo( a ) && a.mediaRatio === '1/1',
		},
	],
} );
