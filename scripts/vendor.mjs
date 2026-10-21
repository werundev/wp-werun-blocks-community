/**
 * Copies the third-party front-end libraries the plugin serves itself into
 * assets/vendor/, so no page ever loads them from a CDN (privacy: the
 * visitor's IP only reaches a map's tile server after consent).
 *
 *   assets/vendor/leaflet/  Leaflet (BSD-2-Clause) and Leaflet.markercluster
 *                           (MIT): the minified builds, their CSS, the marker
 *                           images and both licences.
 *
 * wrbc-map injects them from window.wrbcModules.leaflet (werun-blocks-community.php) only
 * when a map is about to be drawn. Run: npm run vendor (also part of build).
 */
import { copyFileSync, cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = resolve( dirname( fileURLToPath( import.meta.url ) ), '..' );
const require = createRequire( import.meta.url );
const pkg = ( name ) => dirname( require.resolve( `${ name }/package.json` ) );

const leaflet = pkg( 'leaflet' );
const cluster = pkg( 'leaflet.markercluster' );
const out = resolve( root, 'assets/vendor/leaflet' );

// Start clean, so a file dropped upstream doesn't linger in the zip.
rmSync( out, { recursive: true, force: true } );
mkdirSync( out, { recursive: true } );

const files = [
	[ resolve( leaflet, 'dist/leaflet.js' ), 'leaflet.js' ],
	[ resolve( leaflet, 'dist/leaflet.css' ), 'leaflet.css' ],
	[ resolve( leaflet, 'LICENSE' ), 'LICENSE-leaflet.txt' ],
	[ resolve( cluster, 'dist/leaflet.markercluster.js' ), 'leaflet.markercluster.js' ],
	[ resolve( cluster, 'dist/MarkerCluster.css' ), 'MarkerCluster.css' ],
	[ resolve( cluster, 'dist/MarkerCluster.Default.css' ), 'MarkerCluster.Default.css' ],
	[ resolve( cluster, 'MIT-LICENCE.txt' ), 'LICENSE-markercluster.txt' ],
];
files.forEach( ( [ from, to ] ) => copyFileSync( from, resolve( out, to ) ) );
cpSync( resolve( leaflet, 'dist/images' ), resolve( out, 'images' ), { recursive: true } );

const versions = [ 'leaflet', 'leaflet.markercluster' ].map( ( name ) => `${ name } ${ require( `${ name }/package.json` ).version }` );
process.stdout.write( `Vendored ${ versions.join( ', ' ) } into assets/vendor/leaflet/\n` );
