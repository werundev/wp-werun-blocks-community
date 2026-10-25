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
			name: 'modal-poster',
			title: __( 'Video: window with poster', 'werun-blocks-community' ),
			description: __(
				'A poster with a play button that opens the video in a window.',
				'werun-blocks-community'
			),
			attributes: { mode: 'modal', showTranscript: false },
			scope: [ 'transform' ],
			isActive: ( a ) => a.mode === 'modal' && ! a.showTranscript,
		},
		{
			name: 'inline-lazy',
			title: __( 'Video: in the page, loaded on click', 'werun-blocks-community' ),
			description: __(
				'Poster and play button in place; the player loads only when played.',
				'werun-blocks-community'
			),
			attributes: { mode: 'inline', showTranscript: false },
			scope: [ 'transform' ],
			isActive: ( a ) => a.mode === 'inline' && ! a.showTranscript,
		},
		{
			name: 'background',
			title: __( 'Video: background (self-hosted)', 'werun-blocks-community' ),
			description: __(
				'A file from the media library, muted and looping, with a pause button.',
				'werun-blocks-community'
			),
			attributes: {
				provider: 'file',
				mode: 'background',
				showTranscript: false,
				showCaption: false,
				ratio: '21/9',
				radius: 0,
			},
			scope: [ 'transform' ],
			isActive: ( a ) => a.provider === 'file' && a.mode === 'background',
		},
		{
			name: 'with-transcript',
			title: __( 'Video: with transcript', 'werun-blocks-community' ),
			description: __(
				'In the page, with a caption and a collapsible transcript underneath.',
				'werun-blocks-community'
			),
			attributes: {
				mode: 'inline',
				showCaption: true,
				showTranscript: true,
			},
			scope: [ 'transform' ],
			isActive: ( a ) => a.mode !== 'background' && !! a.showTranscript,
		},
	],
} );
