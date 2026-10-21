#!/usr/bin/env node
/**
 * Builds werun-blocks-community.zip with a single top-level werun-blocks-community/ folder,
 * excluding everything listed in .distignore. Needs rsync and zip.
 *
 * Usage: npm run zip
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join( dirname( fileURLToPath( import.meta.url ) ), '..' );
const stage = mkdtempSync( join( tmpdir(), 'werun-blocks-community-' ) );
const target = join( stage, 'werun-blocks-community' );
const zip = join( root, 'werun-blocks-community.zip' );

try {
	execFileSync( 'rsync', [ '-a', `--exclude-from=${ join( root, '.distignore' ) }`, `${ root }/`, `${ target }/` ], { stdio: 'inherit' } );
	rmSync( zip, { force: true } );
	execFileSync( 'zip', [ '-rq', zip, 'werun-blocks-community' ], { cwd: stage, stdio: 'inherit' } );
	console.log( `Created ${ zip }` );
} finally {
	rmSync( stage, { recursive: true, force: true } );
}
