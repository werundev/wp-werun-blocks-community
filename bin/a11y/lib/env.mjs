/**
 * Paths and environment of the harness (one local site).
 *
 * WRB_WP_ROOT (required): the WordPress root of the local test site, where
 * `wp` runs. WRB_SITE_URL: its home URL, for the scripts that open pages.
 * Nothing local is hard-coded: the repository is public.
 */
import { existsSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

export const HARNESS = dirname( dirname( fileURLToPath( import.meta.url ) ) );
export const A11Y = dirname( HARNESS );
export const WP_ROOT = process.env.WRB_WP_ROOT || '';
if ( ! WP_ROOT ) {
	console.error( 'Set WRB_WP_ROOT to the WordPress root of the local test site.' );
	process.exit( 1 );
}
// This repository, wherever it is checked out (its node_modules hold axe and Playwright).
export const PLUGIN = dirname( A11Y );
export const AXE = PLUGIN + '/node_modules/axe-core/axe.min.js';
export const SITE_URL = ( process.env.WRB_SITE_URL || '' ).replace( /\/*$/, '/' );

/** WCAG 2.2 AA tags for axe. */
export const WCAG_TAGS = [ 'wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa' ];

/**
 * Chromium to launch: the build Playwright expects when it is installed,
 * else the newest headless shell / Chromium in the Playwright cache, else
 * the installed Google Chrome. WRB_CHROMIUM overrides.
 */
export function chromiumExecutable( expectedPath ) {
	if ( process.env.WRB_CHROMIUM ) {
		return process.env.WRB_CHROMIUM;
	}
	if ( expectedPath && existsSync( expectedPath ) ) {
		return undefined; // Playwright's own
	}
	const cache = join( homedir(), 'Library/Caches/ms-playwright' );
	if ( existsSync( cache ) ) {
		const dirs = readdirSync( cache )
			.filter( ( d ) => /^chromium(_headless_shell)?-\d+$/.test( d ) )
			.sort( ( a, b ) => {
				const ra = parseInt( a.split( '-' ).pop(), 10 );
				const rb = parseInt( b.split( '-' ).pop(), 10 );
				// Newest revision first; the headless shell before the full browser.
				return rb - ra || ( a.includes( 'headless' ) ? -1 : 1 );
			} );
		for ( const d of dirs ) {
			const candidates = [
				join( cache, d, 'chrome-headless-shell-mac-arm64/chrome-headless-shell' ),
				join( cache, d, 'chrome-headless-shell-mac-x64/chrome-headless-shell' ),
				join( cache, d, 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing' ),
				join( cache, d, 'chrome-mac/Chromium.app/Contents/MacOS/Chromium' ),
				join( cache, d, 'chrome-linux/chrome' ),
				join( cache, d, 'chrome-headless-shell-linux64/chrome-headless-shell' ),
			];
			const found = candidates.find( ( p ) => existsSync( p ) );
			if ( found ) {
				return found;
			}
		}
	}
	const chrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
	return existsSync( chrome ) ? chrome : undefined;
}

/** debug.log lines that are not about the blocks (the theme on every request). */
export const PHP_IGNORE = [ /hello-elementor-child-style/ ];
