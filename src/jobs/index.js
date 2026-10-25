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
			name: 'grouped',
			title: __( 'Jobs: grouped by department', 'werun-blocks-community' ),
			description: __( 'Rows under a heading per department, with the apply button on each row.', 'werun-blocks-community' ),
			attributes: { layout: 'grouped-list', groupBy: true, showFilters: false },
			isActive: [ 'layout' ],
			scope: [ 'transform' ],
		},
		{
			name: 'cards',
			title: __( 'Jobs: cards', 'werun-blocks-community' ),
			description: __( 'A card per position in three columns.', 'werun-blocks-community' ),
			attributes: { layout: 'cards', columnsDesktop: 3, columnsTablet: 2, columnsMobile: 1 },
			isActive: [ 'layout' ],
			scope: [ 'transform' ],
		},
		{
			name: 'table',
			title: __( 'Jobs: compact table', 'werun-blocks-community' ),
			description: __( 'One row per position with department, location and type columns.', 'werun-blocks-community' ),
			attributes: { layout: 'table', showDescription: false, reveal: false },
			isActive: [ 'layout' ],
			scope: [ 'transform' ],
		},
		{
			name: 'list-filters',
			title: __( 'Jobs: list with filters', 'werun-blocks-community' ),
			description: __( 'A flat list with search, department and location selects and a remote toggle.', 'werun-blocks-community' ),
			attributes: { layout: 'list', groupBy: false, showFilters: true, filterSearch: true, filterDepartment: true, filterLocation: true, filterRemote: true },
			isActive: [ 'layout' ],
			scope: [ 'transform' ],
		},
	],
} );
