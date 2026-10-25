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
			name: 'simple',
			title: __( 'Table of contents: simple list', 'werun-blocks-community' ),
			description: __( 'H2 and H3 headings in a nested list.', 'werun-blocks-community' ),
			attributes: { tocStyle: 'list', sticky: false, collapsible: false },
			isActive: [ 'tocStyle', 'sticky', 'collapsible' ],
			scope: [ 'transform' ],
		},
		{
			name: 'sticky-sidebar',
			title: __( 'Table of contents: sticky sidebar', 'werun-blocks-community' ),
			description: __( 'Stays in view beside the text and highlights the section being read.', 'werun-blocks-community' ),
			attributes: { tocStyle: 'list', sticky: true, highlight: true, collapsible: false },
			// tocStyle too: a numbered or pills TOC that is sticky is "numbered" / "pills".
			isActive: [ 'tocStyle', 'sticky', 'collapsible' ],
			scope: [ 'transform' ],
		},
		{
			name: 'mobile-dropdown',
			title: __( 'Table of contents: dropdown on phones', 'werun-blocks-community' ),
			description: __( 'Open on wide screens, folded under its title on phones.', 'werun-blocks-community' ),
			attributes: { tocStyle: 'list', collapsible: true, sticky: false },
			isActive: [ 'tocStyle', 'collapsible', 'sticky' ],
			scope: [ 'transform' ],
		},
		{
			name: 'numbered',
			title: __( 'Table of contents: numbered', 'werun-blocks-community' ),
			description: __( 'Chapters numbered 1, 1.1, 1.2…', 'werun-blocks-community' ),
			attributes: { tocStyle: 'numbered', numberStyle: 'nested' },
			isActive: [ 'tocStyle' ],
			scope: [ 'transform' ],
		},
		{
			name: 'pills',
			title: __( 'Table of contents: jump pills', 'werun-blocks-community' ),
			description: __( 'One row of H2 links, as chips.', 'werun-blocks-community' ),
			attributes: { tocStyle: 'pills', minLevel: 2, maxLevel: 2 },
			isActive: [ 'tocStyle' ],
			scope: [ 'transform' ],
		},
	],
} );
