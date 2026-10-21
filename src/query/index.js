import { registerBlockType } from '@wordpress/blocks';
import { __ } from '@wordpress/i18n';
import metadata from './block.json';
import { blockIcon } from '../shared/block-icons';
import Edit from './edit';
import './style.scss';
import './editor.scss';

const f = {
	image: { type: 'image' },
	date: { type: 'date', source: 'published', dateFormat: '' },
	title: { type: 'title', level: 3 },
	excerpt: { type: 'excerpt', words: 20 },
	short: { type: 'excerpt', words: 12 },
	button: { type: 'button' },
	reading: { type: 'readingTime', wpm: 200 },
};

// A variation replaces the query, card and layout. An empty postType lets
// the variant suggest a type by name (Config::suggest_type / suggestType).
const variation = ( name, title, description, attributes ) => ( {
	name,
	title,
	description,
	attributes: { variant: name, ...attributes },
	isActive: [ 'variant' ],
	scope: [ 'transform' ],
} );

registerBlockType( metadata.name, {
	icon: blockIcon( metadata.name ),
	edit: Edit,
	save: () => null,
	variations: [
		variation( 'posts', __( 'Latest posts', 'werun-blocks-community' ), __( 'The newest posts as cards with image, date, title and excerpt.', 'werun-blocks-community' ), {
			query: { postType: 'post', mode: 'query', orderBy: 'date', order: 'DESC', perPage: 6, excludeCurrent: true },
			layout: 'grid',
			columnsDesktop: 3,
			card: { style: 'bordered', link: 'card', imageRatio: '3/2', imageSize: 'medium_large', fields: [ f.image, f.date, f.title, f.excerpt ] },
		} ),
		variation( 'related', __( 'Related posts', 'werun-blocks-community' ), __( 'Posts that share a category with the one being read, for single templates.', 'werun-blocks-community' ), {
			query: { postType: 'post', mode: 'query', orderBy: 'date', order: 'DESC', perPage: 3, excludeCurrent: true, related: { taxonomies: [ 'category' ] } },
			layout: 'grid',
			columnsDesktop: 3,
			pagination: 'none',
			card: { style: 'plain', link: 'card', imageRatio: '16/9', imageSize: 'medium_large', fields: [ f.image, f.title, f.date ] },
		} ),
		variation( 'team', __( 'Team', 'werun-blocks-community' ), __( 'People with photo, name and role, in manual order.', 'werun-blocks-community' ), {
			query: { postType: '', mode: 'query', orderBy: 'menu_order', order: 'ASC', perPage: 12, excludeCurrent: true },
			layout: 'grid',
			columnsDesktop: 4,
			columnsTablet: 3,
			columnsMobile: 2,
			card: { style: 'plain', link: 'none', imageRatio: '1/1', imageSize: 'medium', fields: [ f.image, f.title, f.short ] },
		} ),
		variation( 'events', __( 'Events (upcoming)', 'werun-blocks-community' ), __( 'Upcoming events, soonest first, by their start date field.', 'werun-blocks-community' ), {
			query: { postType: '', mode: 'query', orderBy: 'upcoming', upcoming: { startKey: '', endKey: '', format: 'Ymd', when: 'upcoming', includeOngoing: true }, perPage: 6, excludeCurrent: true },
			layout: 'list',
			card: { style: 'bordered', link: 'title', imageRatio: '4/3', imageSize: 'medium', fields: [ f.image, f.title, f.short, f.button ] },
		} ),
		variation( 'locations', __( 'Locations (map)', 'werun-blocks-community' ), __( 'Offices or stores on a map, with the list of addresses below it.', 'werun-blocks-community' ), {
			query: { postType: '', mode: 'query', orderBy: 'title', order: 'ASC', perPage: 24, excludeCurrent: true },
			layout: 'map',
			columnsDesktop: 3,
			card: { style: 'bordered', link: 'title', imageRatio: '3/2', imageSize: 'medium', fields: [ f.title ] },
		} ),
		variation( 'resources', __( 'Resource library', 'werun-blocks-community' ), __( 'Downloads with search and type filters; the files can be gated behind a form.', 'werun-blocks-community' ), {
			query: { postType: '', mode: 'query', orderBy: 'date', order: 'DESC', perPage: 9, excludeCurrent: true },
			layout: 'grid',
			columnsDesktop: 3,
			pagination: 'numbers',
			filters: { taxonomy: '', showAll: true, search: true, sort: [] },
			card: { style: 'filled', link: 'title', imageRatio: '4/3', imageSize: 'medium_large', fields: [ f.image, f.title, f.short ] },
		} ),
		variation( 'cases', __( 'Case studies', 'werun-blocks-community' ), __( 'Projects as large cards, two per row.', 'werun-blocks-community' ), {
			query: { postType: '', mode: 'query', orderBy: 'date', order: 'DESC', perPage: 4, excludeCurrent: true },
			layout: 'grid',
			columnsDesktop: 2,
			columnsTablet: 2,
			card: { style: 'shadow', link: 'card', imageRatio: '16/9', imageSize: 'large', fields: [ f.image, f.title, f.excerpt, f.button ] },
		} ),
		variation( 'custom', __( 'Custom query', 'werun-blocks-community' ), __( 'Any post type with your own rules, fields and layout.', 'werun-blocks-community' ), {
			layout: 'grid',
		} ),
	],
} );
