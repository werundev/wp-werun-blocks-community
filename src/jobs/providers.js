/**
 * The job board providers, as the editor shows them. Twin of
 * includes/jobs/class-providers.php and each adapter's regions(),
 * needs_slug() and secret().
 */
import { __ } from '@wordpress/i18n';

export const SLUG = /^[A-Za-z0-9_-]{1,64}$/;

export const PROVIDERS = {
	greenhouse: {
		label: 'Greenhouse',
		slugLabel: __( 'Board token', 'werun-blocks-community' ),
		slugHelp: __( 'From boards.greenhouse.io/<token>.', 'werun-blocks-community' ),
	},
	lever: {
		label: 'Lever',
		slugLabel: __( 'Site name', 'werun-blocks-community' ),
		slugHelp: __( 'From jobs.lever.co/<site>.', 'werun-blocks-community' ),
		regions: [
			[ '', __( 'Global', 'werun-blocks-community' ) ],
			[ 'eu', __( 'EU', 'werun-blocks-community' ) ],
		],
	},
	ashby: {
		label: 'Ashby',
		slugLabel: __( 'Job board name', 'werun-blocks-community' ),
		slugHelp: __( 'From jobs.ashbyhq.com/<name>.', 'werun-blocks-community' ),
	},
	workable: {
		label: 'Workable',
		slugLabel: __( 'Account subdomain', 'werun-blocks-community' ),
		slugHelp: __( 'From apply.workable.com/<subdomain>.', 'werun-blocks-community' ),
	},
	smartrecruiters: {
		label: 'SmartRecruiters',
		slugLabel: __( 'Company identifier', 'werun-blocks-community' ),
		slugHelp: __( 'From jobs.smartrecruiters.com/<company>.', 'werun-blocks-community' ),
	},
	personio: {
		label: 'Personio',
		slugLabel: __( 'Subdomain', 'werun-blocks-community' ),
		slugHelp: __( 'From <subdomain>.jobs.personio.de.', 'werun-blocks-community' ),
		host: true,
		regions: [
			[ '', 'personio.de' ],
			[ 'com', 'personio.com' ],
		],
	},
	teamtailor: {
		label: 'Teamtailor',
		noSlug: true,
		secret: 'teamtailor_key',
	},
	bamboohr: {
		label: 'BambooHR',
		slugLabel: __( 'Subdomain', 'werun-blocks-community' ),
		slugHelp: __( 'From <subdomain>.bamboohr.com.', 'werun-blocks-community' ),
		host: true,
		secret: 'bamboohr_key',
		optionalSecret: true,
	},
};

/** Integrations values the editor received (window.wrbcSettings.integrations). */
export const integrations = () => window.wrbcSettings?.integrations || {};

/** The provider a block uses: its own, or the Integrations default (twin of Jobs::config()). */
export function effectiveSource( attributes ) {
	const jobs = integrations().jobs || {};
	const fallback = PROVIDERS[ jobs.provider ] ? jobs.provider : 'greenhouse';
	const provider = PROVIDERS[ attributes.provider ] ? attributes.provider : fallback;
	const def = PROVIDERS[ provider ];
	let board = '';
	if ( ! def.noSlug ) {
		board = ( attributes.board || '' ).trim();
		// The default board belongs to the default provider only.
		if ( ! board && provider === fallback ) {
			board = jobs.board || '';
		}
	}
	const regions = def.regions || [];
	const region = regions.some( ( [ value ] ) => value === attributes.region ) ? attributes.region : '';
	return { provider, board, region, def, fallback, hasSecret: ! def.secret || !! integrations().secrets?.[ def.secret ] };
}
