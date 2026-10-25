/**
 * wp-scripts' config plus the entries that aren't blocks (blocks keep being
 * found from their block.json):
 * - presets/index: the "Saved styles" panel (src/presets), editor only.
 * - shared/<module>: front-end modules several blocks share
 *   (src/shared/view/<module>.js → build/shared/<module>.js), registered as
 *   wrbc-<module> handles in werun-blocks-community.php. Contract: docs/shared-modules.md.
 */
const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );
const path = require( 'path' );

const MODULES = [ 'carousel', 'counter', 'video', 'tabs', 'filter', 'consent', 'map', 'gate' ];

module.exports = {
	...defaultConfig,
	entry: () => ( {
		...defaultConfig.entry(),
		'presets/index': path.resolve( __dirname, 'src/presets/index.js' ),
		...Object.fromEntries( MODULES.map( ( name ) => [ `shared/${ name }`, path.resolve( __dirname, `src/shared/view/${ name }.js` ) ] ) ),
	} ),
};
