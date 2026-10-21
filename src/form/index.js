import { registerBlockType } from '@wordpress/blocks';
import { __ } from '@wordpress/i18n';
import { registerPlugin } from '@wordpress/plugins';
import metadata from './block.json';
import { blockIcon } from '../shared/block-icons';
import Edit from './edit';
import DownloadPanel from './download-panel';
import { legacyStyle } from './legacy';
import './style.scss';
import './editor.scss';

const NATIVE = [ 'gravity', 'wpforms', 'cf7', 'fluent', 'ninja', 'formidable' ];
const gated = ( a ) => !! ( a.gate && a.gate.enabled );
// Every other layout switches gating off, so transforming back from "gated download" really ungates the form.
const NO_GATE = { enabled: false, resourceId: 0, label: 'Download' };

// In 2.0.0 the look was the attribute `style` (a string), which the
// supports' own `style` object overwrote (src/form/legacy.js).
const { formStyle, ...current } = metadata.attributes;
const deprecated = [
	{
		attributes: { ...current, style: { type: [ 'string', 'object' ] } },
		supports: metadata.supports,
		isEligible: ( attributes ) => !! legacyStyle( attributes?.style ),
		migrate: ( attributes ) => {
			const legacy = legacyStyle( attributes.style );
			return { ...attributes, formStyle: legacy.formStyle, style: legacy.style };
		},
		save: () => null,
	},
];

registerBlockType( metadata.name, {
	icon: blockIcon( metadata.name ),
	edit: Edit,
	save: () => null,
	deprecated,
	// Checked in order: the first match names the block in the toolbar. Layout and provider only: transforming never rewrites the texts.
	variations: [
		{
			name: 'gated-download',
			title: __( 'Form: gated download', 'werun-blocks-community' ),
			description: __( 'A form that unlocks a file once it is sent; returning visitors get the link straight away.', 'werun-blocks-community' ),
			attributes: { formStyle: 'card', gate: { enabled: true, resourceId: 0, label: 'Download' } },
			isActive: ( a ) => gated( a ),
			scope: [ 'transform' ],
		},
		{
			name: 'book-meeting',
			title: __( 'Form: book a meeting (Calendly)', 'werun-blocks-community' ),
			description: __( 'An inline Calendly scheduler, full width, no card.', 'werun-blocks-community' ),
			attributes: { provider: 'calendly', formId: '', region: '', extra: {}, formStyle: 'plain', width: 0, gate: NO_GATE },
			isActive: ( a ) => a.provider === 'calendly' && ! gated( a ),
			scope: [ 'transform' ],
		},
		{
			name: 'newsletter-compact',
			title: __( 'Form: newsletter (compact)', 'werun-blocks-community' ),
			description: __( 'Title beside a one-line Mailchimp signup.', 'werun-blocks-community' ),
			attributes: { provider: 'mailchimp', formId: '', region: '', extra: { button: 'Subscribe' }, formStyle: 'inline', width: 960, gate: NO_GATE },
			isActive: ( a ) => a.provider === 'mailchimp' && a.formStyle === 'inline' && ! gated( a ),
			scope: [ 'transform' ],
		},
		{
			name: 'hubspot',
			title: __( 'Form: HubSpot', 'werun-blocks-community' ),
			description: __( 'A HubSpot form in a card, loaded after consent.', 'werun-blocks-community' ),
			attributes: { provider: 'hubspot', formId: '', region: '', extra: {}, formStyle: 'card', width: 640, gate: NO_GATE },
			isActive: ( a ) => a.provider === 'hubspot' && ! gated( a ),
			scope: [ 'transform' ],
		},
		{
			name: 'contact',
			title: __( 'Form: contact', 'werun-blocks-community' ),
			description: __( 'A form from a plugin on this site (Contact Form 7, WPForms, Gravity Forms…) in a card.', 'werun-blocks-community' ),
			attributes: { provider: '', formId: '', region: '', extra: {}, formStyle: 'card', width: 640, gate: NO_GATE },
			isActive: ( a ) => ( ! a.provider || NATIVE.includes( a.provider ) ) && ! gated( a ),
			scope: [ 'transform' ],
		},
	],
} );

// "Gated download" file of a post (a resource the query block and form block can gate).
registerPlugin( 'wrbc-gated-download', { render: DownloadPanel } );
