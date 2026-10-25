/**
 * Editor only: which logos would fade into the block's background. Logos
 * are exempt from contrast minimums (logotypes), but a dark logo on a dark
 * section, or a white one on a white page, simply disappears. Each image is
 * drawn into a small canvas once, and its visible pixels are compared with
 * the background, with the block's logo colour and opacity applied.
 */
import { useEffect, useState } from '@wordpress/element';
import { colorOver, colorRgba, contrastRatio } from '../shared/contrast';

/** A logo "disappears" when not even its most contrasting tenth reaches 3:1. */
const MIN = 3;
const SHARE = 0.9;

/** url → Promise of the visible pixels as [ r, g, b ], or null when unreadable. */
const cache = new Map();

function pixelsOf( url ) {
	if ( ! cache.has( url ) ) {
		cache.set(
			url,
			new Promise( ( resolve ) => {
				const img = new window.Image();
				// Another site's image only reads with CORS; without it, it's "unknown".
				img.crossOrigin = 'anonymous';
				img.onload = () => {
					try {
						const w = img.naturalWidth || 160;
						const h = img.naturalHeight || 80;
						const scale = Math.min( 1, 96 / Math.max( w, h ) );
						const canvas = document.createElement( 'canvas' );
						canvas.width = Math.max( 1, Math.round( w * scale ) );
						canvas.height = Math.max( 1, Math.round( h * scale ) );
						const ctx = canvas.getContext( '2d', { willReadFrequently: true } );
						ctx.drawImage( img, 0, 0, canvas.width, canvas.height );
						const data = ctx.getImageData( 0, 0, canvas.width, canvas.height ).data;
						const px = [];
						for ( let i = 0; i < data.length; i += 4 ) {
							if ( data[ i + 3 ] > 127 ) {
								px.push( [ data[ i ], data[ i + 1 ], data[ i + 2 ] ] );
							}
						}
						resolve( px.length ? px : null );
					} catch ( e ) {
						resolve( null );
					}
				};
				img.onerror = () => resolve( null );
				img.src = url;
			} )
		);
	}
	return cache.get( url );
}

/**
 * Whether a logo fades into `bg`: logo colour (original | dark | light) and
 * opacity (0–1) as the page paints them. Grey keeps roughly the luminance,
 * so it isn't simulated.
 */
export function logoFades( px, bg, tone, opacity ) {
	const flat = tone === 'dark' ? [ 0, 0, 0 ] : tone === 'light' ? [ 255, 255, 255 ] : null;
	const ratios = px.map( ( p ) => contrastRatio( colorOver( [ ...( flat || p ), opacity ], bg ), bg ) ).sort( ( x, y ) => x - y );
	return ratios[ Math.min( ratios.length - 1, Math.floor( ratios.length * SHARE ) ) ] < MIN;
}

/**
 * @param {string[]} urls    The logos' image URLs.
 * @param {string}   surface The background they sit on (useSurface()).
 * @param {Object}   look    { tone, opacity } as render.php applies them.
 * @return {{ fading: number, unknown: number }} Logos that fade, and logos that couldn't be read.
 */
export function useFadingLogos( urls, surface, { tone, opacity } ) {
	const [ result, setResult ] = useState( { fading: 0, unknown: 0 } );
	const key = urls.join( '\n' );
	useEffect( () => {
		const rgba = colorRgba( surface );
		if ( ! rgba || ! urls.length ) {
			setResult( { fading: 0, unknown: 0 } );
			return undefined;
		}
		const bg = rgba[ 3 ] < 1 ? colorOver( rgba, [ 255, 255, 255, 1 ] ) : rgba;
		let live = true;
		Promise.all( urls.map( pixelsOf ) ).then( ( sets ) => {
			if ( ! live ) {
				return;
			}
			let fading = 0;
			let unknown = 0;
			sets.forEach( ( px ) => {
				if ( ! px ) {
					unknown++;
				} else if ( logoFades( px, bg, tone, opacity ) ) {
					fading++;
				}
			} );
			setResult( ( prev ) => ( prev.fading === fading && prev.unknown === unknown ? prev : { fading, unknown } ) );
		} );
		return () => {
			live = false;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ key, surface, tone, opacity ] );
	return result;
}
