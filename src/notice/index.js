import { registerBlockType } from '@wordpress/blocks';
import { __ } from '@wordpress/i18n';
import metadata from './block.json';
import { blockIcon } from '../shared/block-icons';
import Edit from './edit';
import './style.scss';
import './editor.scss';

/* Layouts under "Transform to variation"; the texts stay as they are. */
registerBlockType( metadata.name, {
	icon: blockIcon( metadata.name ),
	edit: Edit,
	save: () => null,
	variations: [
		{
			name: 'top-bar',
			title: __( 'Notice: top bar, can be closed', 'werun-blocks-community' ),
			description: __(
				'A full-width brand strip at the top of the content, with a close button that remembers for a week.',
				'werun-blocks-community'
			),
			attributes: {
				layout: 'bar',
				barPosition: 'top',
				tone: 'brand',
				appearance: 'solid',
				dismissible: true,
				rememberDays: 7,
				contentAlign: 'center',
				schedule: false,
				align: 'full',
			},
			scope: [ 'transform' ],
			isActive: ( a ) =>
				a.layout === 'bar' && !! a.dismissible && ! a.schedule,
		},
		{
			name: 'inline-info',
			title: __( 'Notice: information', 'werun-blocks-community' ),
			description: __(
				'A soft info box inside the content.',
				'werun-blocks-community'
			),
			attributes: {
				layout: 'inline',
				tone: 'info',
				appearance: 'soft',
				dismissible: false,
				schedule: false,
				// Back from a bar: not full width any more.
				align: undefined,
			},
			scope: [ 'transform' ],
			isActive: ( a ) =>
				a.layout !== 'bar' &&
				( a.tone || 'info' ) === 'info' &&
				! a.schedule,
		},
		{
			name: 'inline-warning',
			title: __( 'Notice: warning', 'werun-blocks-community' ),
			description: __(
				'A soft warning box inside the content.',
				'werun-blocks-community'
			),
			attributes: {
				layout: 'inline',
				tone: 'warning',
				appearance: 'soft',
				dismissible: false,
				schedule: false,
				// Back from a bar: not full width any more.
				align: undefined,
			},
			scope: [ 'transform' ],
			isActive: ( a ) =>
				a.layout !== 'bar' && a.tone === 'warning' && ! a.schedule,
		},
		{
			name: 'scheduled',
			title: __( 'Notice: scheduled announcement', 'werun-blocks-community' ),
			description: __(
				'A bar that shows only between two dates (set them in Schedule) and can be closed.',
				'werun-blocks-community'
			),
			attributes: {
				schedule: true,
				layout: 'bar',
				barPosition: 'top',
				tone: 'neutral',
				appearance: 'solid',
				dismissible: true,
				align: 'full',
			},
			scope: [ 'transform' ],
			isActive: ( a ) => !! a.schedule,
		},
	],
} );
