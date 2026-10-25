#!/usr/bin/env node
/**
 * Copies the release contents (everything except what .distignore lists) into
 * a WordPress plugins folder, so the site runs exactly what ships to
 * WordPress.org. Files that are no longer in the release are removed there.
 *
 * Usage: npm run sync -- <path to wp-content/plugins>
 *        or WRBC_PLUGINS_DIR=<path> npm run sync
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join( dirname( fileURLToPath( import.meta.url ) ), '..' );
const plugins = process.argv[ 2 ] || process.env.WRBC_PLUGINS_DIR;

if ( ! plugins || ! existsSync( plugins ) ) {
	console.error( 'Give the wp-content/plugins folder: npm run sync -- <path>, or set WRBC_PLUGINS_DIR.' );
	process.exit( 1 );
}

const target = join( resolve( plugins ), 'werun-blocks-community' );
execFileSync(
	'rsync',
	[ '-a', '--delete', '--delete-excluded', `--exclude-from=${ join( root, '.distignore' ) }`, `${ root }/`, `${ target }/` ],
	{ stdio: 'inherit' }
);
console.log( `Synced ${ target }` );
