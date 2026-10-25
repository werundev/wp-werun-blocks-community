/**
 * Shared front-end module wrbc-map. Contract: docs/shared-modules.md.
 *
 *   <div data-wrbc-map='{"provider":"leaflet|google","zoom":12,"fitBounds":true,"cluster":true,
 *        "height":420,"markerColor":"#…","labels":{"map":"Map of our offices","error":"…"}}'>
 *     <script type="application/json" data-wrbc-map-points>[{"lat":…,"lng":…,"title":"…","address":"…","url":"…"}]</script>
 *     <!-- wrbc_consent_placeholder( 'maps', … ) -->
 *   </div>
 *
 * Nothing loads until the "maps" consent is given (wrbc-consent decides by
 * mode). Then:
 *   - leaflet (default): Leaflet and Leaflet.markercluster, vendored in
 *     assets/vendor/leaflet/ and injected from window.wrbcModules.leaflet;
 *     tiles and attribution from wrbcModules.integrations.maps.
 *   - google: the Maps JavaScript API with the browser key and Map ID from
 *     the same settings, markers as AdvancedMarkerElement (a missing key
 *     falls back to Leaflet). No clustering on Google: that needs Google's
 *     own clusterer library, which isn't bundled.
 * The view fits every point (fitBounds) or centres on the first at `zoom`.
 * Popups are built with DOM nodes and textContent, never HTML from data.
 * The list of locations is printed by the block, so the map itself is an
 * extra: buttons with data-wrbc-map-focus="<index>" in the block move the
 * map to that point and open its popup.
 *
 * Keyboard and screen readers (Leaflet): the map is a focusable region
 * named by labels.map; markers are buttons named by the point's title (or
 * address, or "Location n"), clusters "n locations, zoom in"; Enter opens a
 * popup and moves focus into it, Escape (or its close button) closes it and
 * focus goes back to the marker. After the consent button, focus moves to
 * the map; if it can't load, the placeholder says so and its button retries.
 *
 * API: window.wrbc.map.setup( root ). Event wrbc:map-ready on the root.
 */
import { __ } from '@wordpress/i18n';
import { el, format, load, ns, options as readOptions, ready, roots, safeUrl } from './lib';

const OSM = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const settings = () => ( window.wrbcModules && window.wrbcModules.integrations && window.wrbcModules.integrations.maps ) || {};
const vendor = () => ( window.wrbcModules && window.wrbcModules.leaflet ) || {};
const COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

const label = ( o, key, fallback ) => ( o.labels && typeof o.labels[ key ] === 'string' && o.labels[ key ] ) || fallback;

function points( root ) {
	const script = root.querySelector( 'script[data-wrbc-map-points]' );
	let list = [];
	try {
		list = JSON.parse( script ? script.textContent : '[]' );
	} catch ( e ) {}
	return ( Array.isArray( list ) ? list : [] )
		.map( ( p ) => ( {
			lat: Number( p && p.lat ),
			lng: Number( p && p.lng ),
			title: p && typeof p.title === 'string' ? p.title : '',
			address: p && typeof p.address === 'string' ? p.address : '',
			url: safeUrl( p && p.url ),
		} ) )
		.filter( ( p ) => Number.isFinite( p.lat ) && Number.isFinite( p.lng ) && Math.abs( p.lat ) <= 90 && Math.abs( p.lng ) <= 180 );
}

/** A marker's accessible name: its title, else its address, else "Location n". */
const pointName = ( point, i, o ) => point.title || point.address || format( label( o, 'point', __( 'Location %d', 'werun-blocks-community' ) ), i + 1 );

/** A popup's content: title (a link when there is a URL) and address. */
function popup( point, o ) {
	const box = el( 'div', 'wrbc-map__popup' );
	if ( point.title ) {
		const title = el( 'p', 'wrbc-map__popup-title' );
		if ( point.url ) {
			const link = el( 'a', '', point.title );
			link.href = point.url;
			title.appendChild( link );
		} else {
			title.textContent = point.title;
		}
		box.appendChild( title );
	}
	if ( point.address ) {
		box.appendChild( el( 'p', 'wrbc-map__popup-address', point.address ) );
	}
	if ( point.url && ! point.title ) {
		const link = el( 'a', '', ( o.labels && o.labels.link ) || point.url );
		link.href = point.url;
		box.appendChild( el( 'p', 'wrbc-map__popup-link' ) ).appendChild( link );
	}
	return box;
}

/**
 * A map pin in the chosen colour, drawn with SVG nodes. Its outline (dark
 * outside, white inside) keeps 3:1 against light and dark tiles whatever
 * the colour (WCAG 1.4.11).
 */
const PIN = 'M12 0C5.4 0 0 5.3 0 11.9 0 20.8 12 32 12 32s12-11.2 12-20.1C24 5.3 18.6 0 12 0z';
function pin( color ) {
	const NS = 'http://www.w3.org/2000/svg';
	const svg = document.createElementNS( NS, 'svg' );
	svg.setAttribute( 'viewBox', '-2 -2 28 36' );
	svg.setAttribute( 'width', '28' );
	svg.setAttribute( 'height', '36' );
	svg.setAttribute( 'aria-hidden', 'true' );
	const halo = document.createElementNS( NS, 'path' );
	halo.setAttribute( 'd', PIN );
	halo.setAttribute( 'fill', 'none' );
	halo.setAttribute( 'stroke', '#0f172a' );
	halo.setAttribute( 'stroke-opacity', '0.8' );
	halo.setAttribute( 'stroke-width', '4' );
	halo.setAttribute( 'stroke-linejoin', 'round' );
	const path = document.createElementNS( NS, 'path' );
	path.setAttribute( 'd', PIN );
	path.setAttribute( 'fill', color );
	path.setAttribute( 'stroke', '#fff' );
	path.setAttribute( 'stroke-width', '1.5' );
	path.setAttribute( 'stroke-linejoin', 'round' );
	const dot = document.createElementNS( NS, 'circle' );
	dot.setAttribute( 'cx', '12' );
	dot.setAttribute( 'cy', '12' );
	dot.setAttribute( 'r', '4.5' );
	dot.setAttribute( 'fill', '#fff' );
	svg.append( halo, path, dot );
	const wrap = el( 'span', 'wrbc-map__pin' );
	wrap.appendChild( svg );
	return wrap;
}

/** Leaflet sets attribution as HTML: escape the admin's text first. */
const escapeHtml = ( text ) =>
	String( text ).replace( /[&<>"']/g, ( c ) => ( { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } )[ c ] );

/* ── Leaflet ─────────────────────────────────────────────────────────── */

function loadLeaflet( cluster ) {
	const v = vendor();
	const assets = [ load( v.css, 'style' ), load( v.js ) ];
	if ( cluster && v.clusterJs ) {
		// Default theme of the clusters, next to MarkerCluster.css.
		const defaultCss = v.clusterDefaultCss || ( v.clusterCss ? v.clusterCss.replace( /MarkerCluster\.css$/, 'MarkerCluster.Default.css' ) : '' );
		assets.push( load( v.clusterCss, 'style' ), load( defaultCss, 'style' ), load( v.clusterJs ) );
	}
	// leaflet.js has async=false, so markercluster runs after it.
	return Promise.all( assets ).then( () => window.L );
}

function drawLeaflet( root, canvas, list, o ) {
	return loadLeaflet( o.cluster !== false && list.length > 1 ).then( ( L ) => {
		if ( vendor().images ) {
			L.Icon.Default.imagePath = vendor().images;
		}
		const s = settings();
		const tiles = typeof s.tiles === 'string' && /^https:\/\/[^\s"'<>]+$/.test( s.tiles ) ? s.tiles : OSM;
		const map = L.map( canvas, {
			scrollWheelZoom: false, // the page keeps scrolling over the map
			keyboard: true,
		} );
		L.tileLayer( tiles, {
			maxZoom: 19,
			attribution: escapeHtml( typeof s.attribution === 'string' && s.attribution ? s.attribution : '© OpenStreetMap contributors' ),
		} ).addTo( map );
		// The wheel zooms once the visitor chose the map.
		map.once( 'focus click', () => map.scrollWheelZoom.enable() );

		const color = COLOR.test( o.markerColor || '' ) ? o.markerColor : '';
		// One icon per marker: a divIcon holding a DOM node moves that node.
		// The pin's tip is at (14, 34) in its 28 × 36 box.
		const icon = () => L.divIcon( { html: pin( color ), className: 'wrbc-map__marker', iconSize: [ 28, 36 ], iconAnchor: [ 14, 34 ], popupAnchor: [ 0, -32 ] } );
		// Clusters are buttons too (Enter zooms in): "3 locations, zoom in", not just "3".
		const clusterIcon = ( cluster ) => {
			const n = cluster.getChildCount();
			const inner = el( 'div' );
			const count = inner.appendChild( el( 'span' ) );
			count.appendChild( el( 'span', '', n ) ).setAttribute( 'aria-hidden', 'true' );
			count.appendChild( el( 'span', 'wrbc-sr-only', format( label( o, 'cluster', __( '%d locations, zoom in', 'werun-blocks-community' ) ), n ) ) );
			return L.divIcon( { html: inner, className: 'marker-cluster marker-cluster-' + ( n < 10 ? 'small' : n < 100 ? 'medium' : 'large' ), iconSize: L.point( 40, 40 ) } );
		};
		const group =
			o.cluster !== false && list.length > 1 && L.markerClusterGroup ? L.markerClusterGroup( { showCoverageOnHover: false, iconCreateFunction: clusterIcon } ) : L.featureGroup();
		const markers = list.map( ( point, i ) => {
			const name = pointName( point, i, o );
			const marker = L.marker( [ point.lat, point.lng ], { title: name, alt: name, keyboard: true, ...( color ? { icon: icon() } : {} ) } );
			if ( point.title || point.address || point.url ) {
				marker.bindPopup( popup( point, o ) );
			}
			group.addLayer( marker );
			return marker;
		} );
		group.addTo( map );

		// A popup opened from its marker with the keyboard takes the focus (its
		// link, or its close button); closing it gives the focus back.
		map.on( 'popupopen', ( event ) => {
			const box = event.popup.getElement();
			const source = event.popup._source && event.popup._source.getElement && event.popup._source.getElement();
			event.popup.wrbcSource = source || null;
			event.popup.wrbcFocusIn = false;
			if ( ! box ) {
				return;
			}
			// Leaflet reuses a popup's box: listen once, for whichever popup it holds.
			box.wrbcPopup = event.popup;
			if ( ! box.wrbcFocusWatch ) {
				box.wrbcFocusWatch = true;
				box.addEventListener( 'focusin', () => ( box.wrbcPopup.wrbcFocusIn = true ) );
				box.addEventListener( 'focusout', ( e ) => {
					if ( e.relatedTarget && ! box.contains( e.relatedTarget ) ) {
						box.wrbcPopup.wrbcFocusIn = false;
					}
				} );
			}
			if ( source && document.activeElement === source ) {
				( box.querySelector( '.leaflet-popup-content a[href]' ) || box.querySelector( '.leaflet-popup-close-button' ) || source ).focus();
			}
		} );
		map.on( 'popupclose', ( event ) => {
			const source = event.popup.wrbcSource;
			if ( event.popup.wrbcFocusIn && source && source.isConnected ) {
				source.focus();
			}
		} );
		// Leaflet only hears Escape while the map box itself has focus: here it
		// also closes a popup from inside it or from its marker.
		canvas.addEventListener( 'keydown', ( event ) => {
			if ( event.key === 'Escape' && map._popup && map.hasLayer( map._popup ) ) {
				const popupEl = map._popup.getElement();
				const inside = popupEl && popupEl.contains( document.activeElement );
				if ( inside ) {
					map._popup.wrbcFocusIn = true;
				}
				map.closePopup();
				event.stopPropagation();
			}
		} );

		const zoom = Math.max( 1, Math.min( 19, parseInt( o.zoom, 10 ) || 12 ) );
		if ( list.length > 1 && o.fitBounds !== false ) {
			map.fitBounds( L.latLngBounds( list.map( ( p ) => [ p.lat, p.lng ] ) ), { padding: [ 32, 32 ], maxZoom: zoom } );
		} else {
			map.setView( [ list[ 0 ].lat, list[ 0 ].lng ], zoom );
		}
		return {
			focus( i ) {
				const marker = markers[ i ];
				if ( ! marker ) {
					return;
				}
				const open = () => marker.openPopup();
				if ( group.zoomToShowLayer ) {
					group.zoomToShowLayer( marker, open ); // out of its cluster first
				} else {
					map.setView( marker.getLatLng(), Math.max( map.getZoom(), zoom ) );
					open();
				}
			},
		};
	} );
}

/* ── Google Maps ─────────────────────────────────────────────────────── */

let googleReady = null;
function loadGoogle( key ) {
	if ( ! googleReady ) {
		googleReady = new Promise( ( resolve, reject ) => {
			window.wrbcGoogleMapsReady = () => resolve( window.google );
			load( `https://maps.googleapis.com/maps/api/js?key=${ encodeURIComponent( key ) }&v=weekly&loading=async&libraries=marker&callback=wrbcGoogleMapsReady` ).catch( ( error ) => {
				googleReady = null;
				reject( error );
			} );
		} );
	}
	return googleReady;
}

function drawGoogle( root, canvas, list, o, key ) {
	const s = settings();
	return loadGoogle( key ).then( async ( google ) => {
		const { Map, InfoWindow, LatLngBounds } = await google.maps.importLibrary( 'maps' );
		const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary( 'marker' );
		const zoom = Math.max( 1, Math.min( 21, parseInt( o.zoom, 10 ) || 12 ) );
		const map = new Map( canvas, {
			center: { lat: list[ 0 ].lat, lng: list[ 0 ].lng },
			zoom,
			// Advanced markers need a Map ID; Google's demo one works until the site sets its own.
			mapId: /^[A-Za-z0-9_-]{4,64}$/.test( s.google_map_id || '' ) ? s.google_map_id : 'DEMO_MAP_ID',
			gestureHandling: 'cooperative',
		} );
		const info = new InfoWindow();
		const color = COLOR.test( o.markerColor || '' ) ? o.markerColor : '';
		const markers = list.map( ( point, i ) => {
			const marker = new AdvancedMarkerElement( {
				map,
				position: { lat: point.lat, lng: point.lng },
				title: pointName( point, i, o ),
				gmpClickable: true,
				// A dark border keeps any pin colour 3:1 against Google's light tiles.
				...( color ? { content: new PinElement( { background: color, borderColor: '#0f172a', glyphColor: '#ffffff' } ).element } : {} ),
			} );
			const open = () => {
				info.setContent( popup( point, o ) );
				info.open( { map, anchor: marker } );
			};
			if ( point.title || point.address || point.url ) {
				marker.addListener( 'click', open );
			}
			return { marker, open, point };
		} );
		if ( list.length > 1 && o.fitBounds !== false ) {
			const bounds = new LatLngBounds();
			list.forEach( ( p ) => bounds.extend( { lat: p.lat, lng: p.lng } ) );
			map.fitBounds( bounds, 32 );
			google.maps.event.addListenerOnce( map, 'idle', () => map.getZoom() > zoom && map.setZoom( zoom ) );
		}
		return {
			focus( i ) {
				const m = markers[ i ];
				if ( m ) {
					map.panTo( { lat: m.point.lat, lng: m.point.lng } );
					m.open();
				}
			},
		};
	} );
}

/* ── Setup ───────────────────────────────────────────────────────────── */

function setup( root ) {
	if ( root.wrbcMap ) {
		return;
	}
	root.wrbcMap = true;
	const o = readOptions( root, 'data-wrbc-map' );
	const list = points( root );
	if ( ! list.length ) {
		return;
	}
	// On the root, so the placeholder and the map share it (CSS --wrbc-map-h).
	if ( parseInt( o.height, 10 ) ) {
		root.style.setProperty( '--wrbc-map-h', Math.max( 200, Math.min( 1200, parseInt( o.height, 10 ) ) ) + 'px' );
	}
	const consent = window.wrbc && window.wrbc.consent;
	const box = root.querySelector( '[data-wrbc-consent]' );
	let focusBound = false;

	const draw = () => {
		let canvas = root.querySelector( '[data-wrbc-map-canvas]' );
		if ( ! canvas ) {
			canvas = el( 'div', 'wrbc-map__canvas' );
			canvas.setAttribute( 'data-wrbc-map-canvas', '' );
			// Where the placeholder is, so the map takes its place.
			if ( box ) {
				box.before( canvas );
			} else {
				root.appendChild( canvas );
			}
		}
		canvas.setAttribute( 'role', 'region' );
		canvas.setAttribute( 'aria-label', label( o, 'map', __( 'Map', 'werun-blocks-community' ) ) );
		root.classList.add( 'is-loading' );

		const s = settings();
		const provider = o.provider || s.provider || 'leaflet';
		const key = typeof s.google_key === 'string' && /^[A-Za-z0-9_-]{20,60}$/.test( s.google_key ) ? s.google_key : '';
		const drawn = provider === 'google' && key ? drawGoogle( root, canvas, list, o, key ) : drawLeaflet( root, canvas, list, o );

		drawn
			.then( ( map ) => {
				if ( box ) {
					// Focus follows the visitor from the consent button to the map.
					if ( ! canvas.hasAttribute( 'tabindex' ) ) {
						canvas.setAttribute( 'tabindex', '-1' );
					}
					if ( consent && consent.loaded ) {
						consent.loaded( box, canvas );
					}
					box.remove();
				}
				root.classList.remove( 'is-loading' );
				root.classList.add( 'is-ready' );
				if ( ! focusBound ) {
					focusBound = true;
					root.querySelectorAll( '[data-wrbc-map-focus]' ).forEach( ( button ) =>
						button.addEventListener( 'click', () => {
							map.focus( parseInt( button.getAttribute( 'data-wrbc-map-focus' ), 10 ) );
							canvas.scrollIntoView( { block: 'nearest' } );
						} )
					);
				}
				root.dispatchEvent( new CustomEvent( 'wrbc:map-ready', { detail: { map } } ) );
			} )
			.catch( () => {
				root.classList.remove( 'is-loading' );
				root.classList.add( 'is-error' );
				canvas.remove();
				const message = label( o, 'error', __( 'The map could not be loaded.', 'werun-blocks-community' ) );
				if ( box && consent && consent.failed ) {
					// Said in the placeholder's live region; its button tries again.
					consent.failed( box, message );
					ask();
				} else if ( box ) {
					box.classList.remove( 'is-loading' );
					const note = el( 'p', 'wrbc-consent__error', message );
					note.setAttribute( 'role', 'status' );
					box.appendChild( note );
				}
			} );
	};

	function ask() {
		const asked = consent ? consent.request( 'maps', box || root ) : Promise.resolve();
		asked.then( () => {
			root.classList.remove( 'is-error' );
			draw();
		} );
	}
	ask();
}

function setupAll( scope ) {
	roots( scope, '[data-wrbc-map]' ).forEach( setup );
}

ns( 'map', { setup: setupAll } );

ready( () => setupAll( document ) );
