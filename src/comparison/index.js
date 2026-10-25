import { registerBlockType } from '@wordpress/blocks';
import { __ } from '@wordpress/i18n';
import metadata from './block.json';
import { blockIcon } from '../shared/block-icons';
import Edit from './edit';
import './style.scss';
import './editor.scss';

/*
 * Layouts are variations under "Transform to variation". They change options
 * only: plans and rows are content and stay as they are.
 */
registerBlockType( metadata.name, {
	icon: blockIcon( metadata.name ),
	edit: Edit,
	save: () => null,
	variations: [
		{
			name: 'plans-features',
			title: __( 'Comparison: plans × features', 'werun-blocks-community' ),
			description: __(
				'Feature rows in groups, prices and buttons under the table, no featured plan.',
				'werun-blocks-community'
			),
			attributes: {
				showPrices: true,
				showCta: true,
				pricesOnTop: false,
				featuredColumn: 0,
				showGroups: true,
			},
			scope: [ 'transform' ],
			isActive: ( a ) =>
				a.showPrices !== false && ! a.pricesOnTop && ! a.featuredColumn,
		},
		{
			name: 'checks',
			title: __( 'Comparison: checks and crosses', 'werun-blocks-community' ),
			description: __(
				'Only what each plan includes: no prices, no buttons, striped rows.',
				'werun-blocks-community'
			),
			attributes: {
				showPrices: false,
				showCta: false,
				showToggle: false,
				zebra: true,
				featuredColumn: 0,
			},
			scope: [ 'transform' ],
			isActive: ( a ) => a.showPrices === false && a.showCta === false,
		},
		{
			name: 'featured',
			title: __( 'Comparison: with a featured plan', 'werun-blocks-community' ),
			description: __(
				'The second plan highlighted, with its badge and a filled button.',
				'werun-blocks-community'
			),
			attributes: {
				featuredColumn: 2,
				showBadge: true,
				// From "checks and crosses": the filled button needs prices and buttons back.
				showPrices: true,
				showCta: true,
				buttonStyle: 'auto',
				pricesOnTop: false,
			},
			scope: [ 'transform' ],
			isActive: ( a ) =>
				a.featuredColumn > 0 &&
				! a.pricesOnTop &&
				a.showPrices !== false,
		},
		{
			name: 'prices-top',
			title: __( 'Comparison: prices on top', 'werun-blocks-community' ),
			description: __(
				'Prices and buttons in the sticky header row, so they stay in view.',
				'werun-blocks-community'
			),
			attributes: {
				showPrices: true,
				showCta: true,
				pricesOnTop: true,
				stickyHeader: true,
			},
			scope: [ 'transform' ],
			isActive: ( a ) => !! a.pricesOnTop && a.showPrices !== false,
		},
	],
} );
