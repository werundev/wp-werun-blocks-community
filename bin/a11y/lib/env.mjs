/**
 * Paths and environment of the harness (one local site).
 */
import { existsSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

export const HARNESS = dirname( dirname( fileURLToPath( import.meta.url ) ) );
export const A11Y = dirname( HARNESS );
export const WP_ROOT = process.env.WRB_WP_ROOT || '/Volumes/ExtHDD/DevStuff/LocalWP/werun-template/app/public';
export const PLUGIN = WP_ROOT + '/wp-content/plugins/werun-blocks-community';
export const AXE = PLUGIN + '/node_modules/axe-core/axe.min.js';
export const SITE_HOST = 'werun-template.local';

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
