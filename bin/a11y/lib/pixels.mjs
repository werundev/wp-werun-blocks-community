/**
 * Pixel comparison of two PNG screenshots of the same clip (focused vs not
 * focused). Uses the PNG codec bundled with playwright-core.
 */
import { createRequire } from 'module';
import { PLUGIN } from './env.mjs';

const require = createRequire( import.meta.url );
const { PNG } = require( PLUGIN + '/node_modules/playwright-core/lib/utilsBundle.js' );

const LIN = new Float64Array( 256 );
for ( let v = 0; v < 256; v++ ) {
	const c = v / 255;
	LIN[ v ] = c <= 0.04045 ? c / 12.92 : Math.pow( ( c + 0.055 ) / 1.055, 2.4 );
}
const lum = ( d, i ) => 0.2126 * LIN[ d[ i ] ] + 0.7152 * LIN[ d[ i + 1 ] ] + 0.0722 * LIN[ d[ i + 2 ] ];

/**
 * @param {Buffer} focusedPng
 * @param {Buffer} plainPng
 * @return {{changed:number, strong:number, maxRatio:number, medianRatio:number, bbox:object|null, width:number, height:number}}
 *   changed: pixels that differ (any channel > 8); strong: of those, the
 *   ones whose two colours differ by >= 3:1 (WCAG "change of contrast");
 *   bbox: where the change is, relative to the clip.
 */
export function diffPng( focusedPng, plainPng ) {
	const a = PNG.sync.read( focusedPng );
	const b = PNG.sync.read( plainPng );
	if ( a.width !== b.width || a.height !== b.height ) {
		return { error: 'size mismatch', changed: 0, strong: 0 };
	}
	const A = a.data;
	const B = b.data;
	let changed = 0;
	let strong = 0;
	let maxRatio = 1;
	let minX = Infinity;
	let minY = Infinity;
	let maxX = -1;
	let maxY = -1;
	const buckets = new Uint32Array( 22 ); // ratio histogram 1..21
	for ( let i = 0; i < A.length; i += 4 ) {
		if ( Math.abs( A[ i ] - B[ i ] ) <= 8 && Math.abs( A[ i + 1 ] - B[ i + 1 ] ) <= 8 && Math.abs( A[ i + 2 ] - B[ i + 2 ] ) <= 8 ) {
			continue;
		}
		changed++;
		const l1 = lum( A, i );
		const l2 = lum( B, i );
		const r = ( Math.max( l1, l2 ) + 0.05 ) / ( Math.min( l1, l2 ) + 0.05 );
		if ( r >= 3 ) {
			strong++;
		}
		if ( r > maxRatio ) {
			maxRatio = r;
		}
		buckets[ Math.min( 21, Math.floor( r ) ) ]++;
		const p = i >> 2;
		const x = p % a.width;
		const y = ( p / a.width ) | 0;
		if ( x < minX ) {
			minX = x;
		}
		if ( y < minY ) {
			minY = y;
		}
		if ( x > maxX ) {
			maxX = x;
		}
		if ( y > maxY ) {
			maxY = y;
		}
	}
	let median = 1;
	let seen = 0;
	for ( let k = 0; k < buckets.length; k++ ) {
		seen += buckets[ k ];
		if ( seen >= changed / 2 ) {
			median = k;
			break;
		}
	}
	return {
		changed,
		strong,
		maxRatio: Math.round( maxRatio * 100 ) / 100,
		medianRatio: median,
		bbox: changed ? { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 } : null,
		width: a.width,
		height: a.height,
	};
}
