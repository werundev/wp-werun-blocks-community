import { registerBlockType } from '@wordpress/blocks';
import { InnerBlocks } from '@wordpress/block-editor';
import { __ } from '@wordpress/i18n';
import metadata from './block.json';
import { blockIcon } from '../shared/block-icons';
import Edit from './edit';
import { legacyStyle } from './legacy';
import './style.scss';
import './editor.scss';

// Before 2.0 the look was the attribute `style` (a string), which the
// supports' own `style` object overwrote (src/accordion/legacy.js).
const { accordionStyle, ...current } = metadata.attributes;
const deprecated = [
	{
		attributes: { ...current, style: { type: [ 'string', 'object' ] } },
		supports: metadata.supports,
		isEligible: ( attributes ) => !! legacyStyle( attributes?.style ),
		migrate: ( attributes ) => {
			const legacy = legacyStyle( attributes.style );
			return { ...attributes, accordionStyle: legacy.accordionStyle, style: legacy.style };
		},
		save: () => <InnerBlocks.Content />,
	},
];

registerBlockType( metadata.name, {
	icon: blockIcon( metadata.name ),
	edit: Edit,
	save: () => <InnerBlocks.Content />,
	deprecated,
	// Every variation sets the same keys (docs/block-controls-audit.md rule 13),
	// so switching from one to another leaves nothing of the previous behind.
	variations: [
		{
			name: 'faq',
			title: __( 'FAQ with schema', 'werun-blocks-community' ),
			description: __( 'Lines, chevron, one open at a time, FAQPage structured data on.', 'werun-blocks-community' ),
			attributes: { accordionStyle: 'separated', columns: 1, iconType: 'chevron', iconPosition: 'right', showItemIcons: false, allowMultiple: false, firstOpen: true, showSearch: false, showExpandAll: false, faqSchema: true },
			isActive: [ 'accordionStyle', 'iconType', 'faqSchema' ],
			scope: [ 'transform' ],
		},
		{
			name: 'boxed-search',
			title: __( 'Accordion: boxes with search', 'werun-blocks-community' ),
			description: __( 'Boxed items, + / − icons, a search field, several open at once.', 'werun-blocks-community' ),
			attributes: { accordionStyle: 'boxed', columns: 1, iconType: 'plus', iconPosition: 'right', showItemIcons: false, allowMultiple: true, firstOpen: true, showSearch: true, showExpandAll: true, faqSchema: false },
			isActive: [ 'accordionStyle', 'showSearch' ],
			scope: [ 'transform' ],
		},
		{
			name: 'two-columns',
			title: __( 'Accordion: two columns', 'werun-blocks-community' ),
			attributes: { accordionStyle: 'minimal', columns: 2, iconType: 'plus', iconPosition: 'left', showItemIcons: false, allowMultiple: false, firstOpen: false, showSearch: false, showExpandAll: false, faqSchema: false },
			isActive: [ 'accordionStyle', 'columns' ],
			scope: [ 'transform' ],
		},
	],
} );
