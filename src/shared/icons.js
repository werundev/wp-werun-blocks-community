/**
 * Icons in the editor: the same Lucide data render.php prints, fetched once
 * per editor session from /wp-json/wrbc/v1/icons and shared by every block
 * (the promise lives on window, because each block ships its own bundle).
 */
import apiFetch from '@wordpress/api-fetch';
import { useEffect, useState } from '@wordpress/element';

export const LUCIDE_URL = 'https://lucide.dev/icons/';
export const ANIMATED_URL = 'https://lucide-animated.com/icons/';

export const ANIMATIONS = [
	'none',
	'draw',
	'wiggle',
	'nudge-x',
	'nudge-y',
	'bounce',
	'pulse',
	'spin',
	'pop',
	'float',
	'shake',
	'tilt',
];
export const TRIGGERS = [ 'hover', 'inview', 'loop' ];

export function loadIcons() {
	if ( ! window.wrbcIconsPromise ) {
		const path = window.wrbcSettings?.iconsPath || '/wrbc/v1/icons';
		window.wrbcIconsPromise = apiFetch( { path } ).then( ( data ) => {
			window.wrbcIconsData = data;
			return data;
		} );
	}
	return window.wrbcIconsPromise;
}

export function useIconData() {
	const [ data, setData ] = useState( window.wrbcIconsData || null );
	useEffect( () => {
		if ( data ) {
			return undefined;
		}
		let live = true;
		loadIcons()
			.then( ( loaded ) => live && setData( loaded ) )
			.catch( () => {
				window.wrbcIconsPromise = null;
			} );
		return () => {
			live = false;
		};
	}, [ data ] );
	return data;
}

/** The preset an icon animates with: the same rule as wrbc_icon() in PHP. */
export function resolveAnim( icon, data ) {
	if ( ! icon ) {
		return 'none';
	}
	let anim = icon.anim || 'none';
	if ( anim === 'auto' || ( icon.lib === 'animated' && anim === 'none' ) ) {
		anim = data?.animated?.[ icon.name ] || 'draw';
	}
	return ANIMATIONS.includes( anim ) ? anim : 'none';
}

/** One Lucide icon. In the editor an "in view" icon is shown finished. */
export function Icon( { icon, className = '', label } ) {
	const data = useIconData();
	// Own keys only: a name like "__proto__" or "constructor" isn't an icon.
	if (
		typeof icon?.name !== 'string' ||
		! data?.icons ||
		! Object.prototype.hasOwnProperty.call( data.icons, icon.name ) ||
		typeof data.icons[ icon.name ] !== 'string'
	) {
		return null;
	}
	const anim = resolveAnim( icon, data );
	const trigger = TRIGGERS.includes( icon.trigger ) ? icon.trigger : 'hover';
	let html = data.icons[ icon.name ];
	if ( anim === 'draw' ) {
		html = html.replace( /<(path|line|polyline|polygon|circle|ellipse|rect)\b/g, '<$1 pathLength="1"' );
	}
	const classes = [ 'wrbc-icon', `wrbc-icon--${ icon.name }` ];
	if ( anim !== 'none' ) {
		classes.push( 'wrbc-anim', `wrbc-anim--${ anim }`, `wrbc-anim-t--${ trigger }`, 'is-inview' );
	}
	if ( className ) {
		classes.push( className );
	}
	const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true, focusable: 'false' };
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			className={ classes.join( ' ' ) }
			width="24"
			height="24"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			{ ...a11y }
			// Markup generated from lucide-static by the plugin, never user input.
			dangerouslySetInnerHTML={ { __html: html } }
		/>
	);
}

/** An icon in its holder: plain, circle, square or outline. */
export function IconWrap( { icon, style = 'none', className = '' } ) {
	const data = useIconData();
	// No holder for a name Lucide does not have (render.php prints none either).
	if ( ! icon?.name || ( data && ! data.icons?.[ icon.name ] ) ) {
		return null;
	}
	return (
		<span className={ `wrbc-icon-wrap wrbc-icon-wrap--${ style } ${ className }`.trim() }>
			<Icon icon={ icon } />
		</span>
	);
}
