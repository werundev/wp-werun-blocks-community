/*
 * werun.Blocks.Community a11y harness: in-page library (window.__wrbcA11y).
 * Injected with context.addInitScript() into every page the harness opens.
 * Everything here runs in the browser and returns plain JSON.
 *
 * Scope: "werun element" = inside [class*="wp-block-werun-community-"] or .wrbc-root.
 */
( () => {
	if ( window.__wrbcA11y ) {
		return;
	}
	const W = ( window.__wrbcA11y = {} );
	const WERUN = '[class*="wp-block-werun-community-"], .wrbc-root';
	W.WERUN = WERUN;

	const FOCUSABLE =
		'a[href], area[href], button, input:not([type="hidden"]), select, textarea, summary, iframe, audio[controls], video[controls], [contenteditable]:not([contenteditable="false"]), [tabindex]';
	const INTERACTIVE =
		'a[href], area[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"], [role="link"], [role="tab"], [role="checkbox"], [role="radio"], [role="switch"], [role="menuitem"], [role="option"], [role="slider"], [role="spinbutton"], [tabindex]:not([tabindex="-1"])';
	W.FOCUSABLE = FOCUSABLE;

	/* ── Motion recorder (installed before page scripts) ──────────────── */
	W.t0 = performance.now();
	W.scrollLog = [];
	const ids = new WeakMap();
	let nextId = 1;
	/** A stable number per element (tracks, carousels) for matching across snapshots. */
	W.idOf = ( el ) => {
		if ( ! el ) {
			return null;
		}
		if ( ! ids.has( el ) ) {
			ids.set( el, nextId++ );
		}
		return ids.get( el );
	};
	/** The carousel a node belongs to: its closest [data-wrbc-carousel] (the module root), else .wrbc-carousel. */
	W.carouselOf = ( el ) => ( el && el.closest ? el.closest( '[data-wrbc-carousel]' ) || el.closest( '.wrbc-carousel' ) : null );
	document.addEventListener(
		'scroll',
		( e ) => {
			const t = e.target;
			if ( t && t.nodeType === 1 && t.closest && t.closest( WERUN ) && W.scrollLog.length < 500 ) {
				W.scrollLog.push( { t: Math.round( performance.now() ), id: W.idOf( t ), track: t.matches( '[data-wrbc-track]' ), sel: W.selector( t ), left: Math.round( t.scrollLeft ), top: Math.round( t.scrollTop ) } );
			}
		},
		{ capture: true, passive: true }
	);
	// When each carousel track is first on screen (autoplay only runs on screen):
	// the 2.2.2 window of a track starts there, not at navigation.
	W.trackSeen = new Map();
	const watchTracks = () => {
		if ( ! ( 'IntersectionObserver' in window ) ) {
			return;
		}
		const io = new IntersectionObserver( ( entries ) =>
			entries.forEach( ( en ) => {
				const id = W.idOf( en.target );
				if ( en.isIntersecting && ! W.trackSeen.has( id ) ) {
					W.trackSeen.set( id, { t: Math.round( performance.now() ), left: Math.round( en.target.scrollLeft ), top: Math.round( en.target.scrollTop ) } );
				}
			} )
		);
		document.querySelectorAll( '[data-wrbc-track]' ).forEach( ( el ) => io.observe( el ) );
	};
	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', watchTracks );
	} else {
		watchTracks();
	}
	W.userScrolling = false;

	/* ── Basics ──────────────────────────────────────────────────────── */
	W.inWerun = ( el ) => !! ( el && el.nodeType === 1 && el.closest( WERUN ) );
	W.roots = () => Array.from( document.querySelectorAll( WERUN ) ).filter( ( el ) => ! ( el.parentElement && el.parentElement.closest( WERUN ) ) );
	W.blockOf = ( el ) => {
		const b = el && el.closest ? el.closest( '[class*="wp-block-werun-community-"]' ) : null;
		if ( ! b ) {
			return '';
		}
		const m = ( b.getAttribute( 'class' ) || '' ).match( /wp-block-werun-community-[a-z0-9-]+/ );
		return m ? m[ 0 ].replace( 'wp-block-werun-community-', 'werun-community/' ) : '';
	};

	const cssEsc = ( s ) => ( window.CSS && CSS.escape ? CSS.escape( s ) : s.replace( /[^a-zA-Z0-9_-]/g, '\\$&' ) );
	/** A short unique CSS selector (wrbc- classes first). */
	W.selector = ( el ) => {
		if ( ! el || el.nodeType !== 1 ) {
			return '';
		}
		const unique = ( sel ) => {
			try {
				return document.querySelectorAll( sel ).length === 1;
			} catch ( e ) {
				return false;
			}
		};
		const part = ( node ) => {
			if ( node.id && /^[A-Za-z][\w:.-]*$/.test( node.id ) && unique( '#' + cssEsc( node.id ) ) ) {
				return { sel: '#' + cssEsc( node.id ), done: true };
			}
			let s = node.tagName.toLowerCase();
			const cls = Array.from( node.classList ).filter( ( c ) => ! /^(is-inview|is-ready|is-playing|has-[a-z-]+-color|wp-elements-|wrbc-hero-\d|wrbc-cta-\d|wrbc-[a-z-]+-\d+$)/.test( c ) );
			const pref = cls.filter( ( c ) => c.startsWith( 'wrbc-' ) || c.startsWith( 'wp-block-werun-community-' ) );
			const use = ( pref.length ? pref : cls ).slice( 0, 2 );
			if ( use.length ) {
				s += '.' + use.map( cssEsc ).join( '.' );
			}
			const parent = node.parentElement;
			if ( parent ) {
				const same = Array.from( parent.children ).filter( ( c ) => c.tagName === node.tagName && ( ! use.length || use.every( ( u ) => c.classList.contains( u ) ) ) );
				if ( same.length > 1 ) {
					s += ':nth-of-type(' + ( Array.from( parent.children ).filter( ( c ) => c.tagName === node.tagName ).indexOf( node ) + 1 ) + ')';
				}
			}
			return { sel: s, done: false };
		};
		const parts = [];
		let node = el;
		for ( let depth = 0; node && node.nodeType === 1 && depth < 7; depth++ ) {
			const p = part( node );
			parts.unshift( p.sel );
			const sel = parts.join( ' > ' );
			if ( p.done || ( depth >= 1 && unique( sel ) ) ) {
				return sel;
			}
			if ( node.matches( '[class*="wp-block-werun-community-"]' ) && unique( sel ) ) {
				return sel;
			}
			node = node.parentElement;
		}
		return parts.join( ' > ' );
	};
	W.snippet = ( el, max = 160 ) => {
		if ( ! el || el.nodeType !== 1 ) {
			return '';
		}
		const open = el.outerHTML.slice( 0, el.outerHTML.indexOf( '>' ) + 1 ).replace( /\s+/g, ' ' );
		const text = ( el.textContent || '' ).replace( /\s+/g, ' ' ).trim();
		const s = open.length > max ? open.slice( 0, max ) + '…' : open;
		return text ? s + ' “' + ( text.length > 60 ? text.slice( 0, 60 ) + '…' : text ) + '”' : s;
	};
	W.text = ( el ) => ( el.textContent || '' ).replace( /\s+/g, ' ' ).trim();
	W.isSrOnly = ( el ) => {
		for ( let n = el; n && n.nodeType === 1; n = n.parentElement ) {
			const cs = getComputedStyle( n );
			if ( cs.position === 'absolute' && ( cs.clip === 'rect(0px, 0px, 0px, 0px)' || cs.clipPath === 'inset(50%)' ) ) {
				return true;
			}
			if ( n.classList.contains( 'wrbc-sr-only' ) || n.classList.contains( 'screen-reader-text' ) ) {
				return true;
			}
		}
		return false;
	};
	W.isVisible = ( el ) => {
		if ( ! el || ! el.isConnected ) {
			return false;
		}
		if ( el.checkVisibility && ! el.checkVisibility( { opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true } ) ) {
			return false;
		}
		const r = el.getBoundingClientRect();
		return r.width > 0 && r.height > 0;
	};

	/**
	 * The box an overflow ancestor clips its content to: its padding box,
	 * grown by overflow-clip-margin on the axes it clips with "clip".
	 */
	W.clipBox = ( n ) => {
		const cs = getComputedStyle( n );
		const r = n.getBoundingClientRect();
		const px = ( v ) => parseFloat( v ) || 0;
		let box = { left: r.left + px( cs.borderLeftWidth ), right: r.right - px( cs.borderRightWidth ), top: r.top + px( cs.borderTopWidth ), bottom: r.bottom - px( cs.borderBottomWidth ) };
		const ocm = String( cs.overflowClipMargin || '' );
		const clipX = cs.overflowX === 'clip';
		const clipY = cs.overflowY === 'clip';
		if ( ( clipX || clipY ) && ocm && ocm !== '0px' ) {
			if ( /content-box/.test( ocm ) ) {
				box = { left: box.left + px( cs.paddingLeft ), right: box.right - px( cs.paddingRight ), top: box.top + px( cs.paddingTop ), bottom: box.bottom - px( cs.paddingBottom ) };
			} else if ( /border-box/.test( ocm ) ) {
				box = { left: r.left, right: r.right, top: r.top, bottom: r.bottom };
			}
			const m = ocm.match( /(-?[\d.]+)px/ );
			const grow = m ? parseFloat( m[ 1 ] ) : 0;
			if ( clipX ) {
				box.left -= grow;
				box.right += grow;
			}
			if ( clipY ) {
				box.top -= grow;
				box.bottom += grow;
			}
		}
		return box;
	};
	/** Whether the element shows inside every clipping / scrolling ancestor (a slide scrolled out of its track doesn't). */
	W.inClip = ( el ) => {
		const r = el.getBoundingClientRect();
		for ( let n = el.parentElement; n && n !== document.body && n !== document.documentElement; n = n.parentElement ) {
			const cs = getComputedStyle( n );
			const cx = cs.overflowX !== 'visible';
			const cy = cs.overflowY !== 'visible';
			if ( ! cx && ! cy ) {
				continue;
			}
			const b = W.clipBox( n );
			if ( ( cx && ( r.right <= b.left + 1 || r.left >= b.right - 1 ) ) || ( cy && ( r.bottom <= b.top + 1 || r.top >= b.bottom - 1 ) ) ) {
				return false;
			}
		}
		return true;
	};
	/**
	 * Brings an element into view before measuring it (its scrollers too, as
	 * axe does) and returns a function that puts those scrollers back.
	 */
	W.reveal = ( el ) => {
		const saved = [];
		for ( let n = el.parentElement; n && n !== document.body && n !== document.documentElement; n = n.parentElement ) {
			if ( n.scrollWidth > n.clientWidth + 1 || n.scrollHeight > n.clientHeight + 1 ) {
				const cs = getComputedStyle( n );
				if ( cs.overflowX !== 'visible' || cs.overflowY !== 'visible' ) {
					saved.push( [ n, n.scrollLeft, n.scrollTop ] );
				}
			}
		}
		const go = ( node, opts ) => {
			try {
				node.scrollIntoView( { ...opts, behavior: 'instant' } );
			} catch ( e ) {
				node.scrollIntoView();
			}
		};
		// Innermost scroller first: bring the child that holds the element (a slide) to the
		// scroller's start, which is a snap position, so scroll snapping doesn't pull it back.
		saved.forEach( ( [ n ] ) => {
			const r = el.getBoundingClientRect();
			const b = W.clipBox( n );
			if ( r.left >= b.left - 1 && r.right <= b.right + 1 && r.top >= b.top - 1 && r.bottom <= b.bottom + 1 ) {
				return;
			}
			let child = el;
			while ( child.parentElement && child.parentElement !== n ) {
				child = child.parentElement;
			}
			go( child, { block: 'nearest', inline: 'start' } );
		} );
		go( el, { block: 'center', inline: 'nearest' } );
		return () =>
			saved.forEach( ( [ n, l, t ] ) => {
				n.scrollLeft = l;
				n.scrollTop = t;
			} );
	};

	/* ── Colour ──────────────────────────────────────────────────────── */
	const canvas = document.createElement( 'canvas' );
	canvas.width = canvas.height = 1;
	let ctx2d = null;
	const num = ( v, max ) => ( String( v ).endsWith( '%' ) ? ( parseFloat( v ) / 100 ) * max : parseFloat( v ) );
	/** CSS colour → [r,g,b,a] (0–255, a 0–1) or null. */
	W.parseColor = ( str ) => {
		if ( ! str ) {
			return null;
		}
		str = String( str ).trim().toLowerCase();
		if ( str === 'transparent' || str === 'none' ) {
			return [ 0, 0, 0, 0 ];
		}
		let m = str.match( /^rgba?\(\s*([\d.]+%?)[\s,]+([\d.]+%?)[\s,]+([\d.]+%?)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/ );
		if ( m ) {
			return [ num( m[ 1 ], 255 ), num( m[ 2 ], 255 ), num( m[ 3 ], 255 ), m[ 4 ] === undefined ? 1 : num( m[ 4 ], 1 ) ];
		}
		m = str.match( /^color\(srgb\s+([-\d.e]+%?)\s+([-\d.e]+%?)\s+([-\d.e]+%?)(?:\s*\/\s*([\d.e]+%?))?\s*\)$/ );
		if ( m ) {
			const c = ( v ) => Math.max( 0, Math.min( 255, num( v, 1 ) * 255 ) );
			return [ c( m[ 1 ] ), c( m[ 2 ] ), c( m[ 3 ] ), m[ 4 ] === undefined ? 1 : num( m[ 4 ], 1 ) ];
		}
		m = str.match( /^#([0-9a-f]{3,8})$/ );
		if ( m ) {
			let h = m[ 1 ];
			if ( h.length <= 4 ) {
				h = h.split( '' ).map( ( x ) => x + x ).join( '' );
			}
			const n = ( i ) => parseInt( h.slice( i, i + 2 ), 16 );
			return [ n( 0 ), n( 2 ), n( 4 ), h.length === 8 ? n( 6 ) / 255 : 1 ];
		}
		if ( /^(url|linear|radial|conic|repeating|var|inherit|initial|unset|currentcolor|context)/.test( str ) ) {
			return null;
		}
		// Anything else (oklch, lab, hsl…): let the canvas convert it.
		try {
			ctx2d = ctx2d || canvas.getContext( '2d', { willReadFrequently: true } );
			ctx2d.clearRect( 0, 0, 1, 1 );
			ctx2d.fillStyle = 'rgba(0,0,0,0)';
			ctx2d.fillStyle = str;
			ctx2d.fillRect( 0, 0, 1, 1 );
			const d = ctx2d.getImageData( 0, 0, 1, 1 ).data;
			return [ d[ 0 ], d[ 1 ], d[ 2 ], d[ 3 ] / 255 ];
		} catch ( e ) {
			return null;
		}
	};
	const lin = ( v ) => {
		v /= 255;
		return v <= 0.04045 ? v / 12.92 : Math.pow( ( v + 0.055 ) / 1.055, 2.4 );
	};
	W.lum = ( c ) => 0.2126 * lin( c[ 0 ] ) + 0.7152 * lin( c[ 1 ] ) + 0.0722 * lin( c[ 2 ] );
	W.ratio = ( a, b ) => {
		const l1 = W.lum( a );
		const l2 = W.lum( b );
		return ( Math.max( l1, l2 ) + 0.05 ) / ( Math.min( l1, l2 ) + 0.05 );
	};
	W.over = ( top, under ) => {
		const a = top[ 3 ] === undefined ? 1 : top[ 3 ];
		return [ 0, 1, 2 ].map( ( i ) => top[ i ] * a + under[ i ] * ( 1 - a ) ).concat( 1 );
	};
	W.hex = ( c ) =>
		c
			? '#' +
			  c
					.slice( 0, 3 )
					.map( ( v ) => Math.round( v ).toString( 16 ).padStart( 2, '0' ) )
					.join( '' ) +
			  ( c[ 3 ] !== undefined && c[ 3 ] < 0.999 ? Math.round( c[ 3 ] * 255 ).toString( 16 ).padStart( 2, '0' ) : '' )
			: null;
	W.round = ( r ) => Math.round( r * 100 ) / 100;
	W.opacity = ( el ) => {
		let o = 1;
		for ( let n = el; n && n.nodeType === 1; n = n.parentElement ) {
			o *= parseFloat( getComputedStyle( n ).opacity ) || 0;
			if ( o === 0 ) {
				break;
			}
		}
		return o;
	};
	W.gradientStops = ( bgi ) => ( String( bgi ).match( /(rgba?\([^)]*\)|color\([^)]*\)|#[0-9a-f]{3,8}\b|transparent)/gi ) || [] ).map( W.parseColor ).filter( Boolean );

	/* ── Hit testing for colours: every element counts (pointer-events) ── */
	let hitDepth = 0;
	let hitStyle = null;
	W.hitAll = ( fn ) => {
		if ( ! hitDepth++ ) {
			hitStyle = document.createElement( 'style' );
			hitStyle.textContent = '*, *::before, *::after { pointer-events: auto !important; }';
			document.documentElement.appendChild( hitStyle );
		}
		try {
			return fn();
		} finally {
			if ( ! --hitDepth ) {
				hitStyle.remove();
				hitStyle = null;
			}
		}
	};

	const MEDIA = /^(IMG|VIDEO|CANVAS|IFRAME|OBJECT|EMBED)$/;
	/**
	 * What is painted under (x, y): the layers top to bottom, starting at
	 * `from` (its own background included) or the topmost element, skipping
	 * `exclude` and its subtree. Returns the possible opaque backgrounds:
	 * one colour, the stops of a gradient, or white and black under any
	 * overlay when an image / video is underneath ("over image").
	 */
	W.bgAt = ( x, y, opts = {} ) =>
		W.hitAll( () => {
			const vw = document.documentElement.clientWidth;
			const vh = document.documentElement.clientHeight;
			x = Math.max( 0, Math.min( vw - 1, x ) );
			y = Math.max( 0, Math.min( vh - 1, y ) );
			const stack = document.elementsFromPoint( x, y );
			let start = 0;
			if ( opts.from ) {
				let i = stack.indexOf( opts.from );
				for ( let a = opts.from.parentElement; i < 0 && a; a = a.parentElement ) {
					i = stack.indexOf( a );
				}
				start = Math.max( 0, i );
			}
			const layers = [];
			let bottom = null; // 'color' | 'image' | null (canvas)
			for ( let i = start; i < stack.length; i++ ) {
				const el = stack[ i ];
				if ( opts.exclude && ( opts.exclude === el || opts.exclude.contains( el ) ) ) {
					continue;
				}
				const op = W.opacity( el );
				if ( op <= 0.01 ) {
					continue;
				}
				const cs = getComputedStyle( el );
				if ( cs.visibility !== 'visible' ) {
					continue;
				}
				const sel = W.selector( el );
				if ( MEDIA.test( el.tagName ) || ( el instanceof SVGImageElement ) ) {
					const loaded = el.tagName !== 'IMG' || ( el.complete && el.naturalWidth > 0 );
					const vid = el.tagName !== 'VIDEO' || el.readyState >= 2 || el.poster;
					if ( loaded && vid ) {
						layers.push( { kind: 'image', sel, opacity: op, what: el.tagName.toLowerCase() } );
						if ( op >= 0.99 ) {
							bottom = 'image';
							break;
						}
					}
				}
				const bgi = cs.backgroundImage;
				if ( bgi && bgi !== 'none' ) {
					if ( /url\(/.test( bgi ) ) {
						layers.push( { kind: 'image', sel, opacity: op, what: 'background-image' } );
						if ( op >= 0.99 ) {
							bottom = 'image';
							break;
						}
					} else if ( /gradient\(/.test( bgi ) ) {
						const stops = W.gradientStops( bgi ).map( ( c ) => [ c[ 0 ], c[ 1 ], c[ 2 ], c[ 3 ] * op ] );
						if ( stops.length ) {
							layers.push( { kind: 'gradient', sel, stops } );
						}
					}
				}
				const bg = W.parseColor( cs.backgroundColor );
				if ( bg && bg[ 3 ] > 0 ) {
					const c = [ bg[ 0 ], bg[ 1 ], bg[ 2 ], bg[ 3 ] * op ];
					layers.push( { kind: 'color', sel, color: c } );
					if ( c[ 3 ] >= 0.995 ) {
						bottom = 'color';
						break;
					}
				}
				const last = layers[ layers.length - 1 ];
				if ( last && last.kind === 'gradient' && last.stops.every( ( s ) => s[ 3 ] >= 0.995 ) ) {
					bottom = 'gradient';
					break;
				}
			}
			// Bottom up.
			let cands;
			let kind = 'solid';
			const lastLayer = layers[ layers.length - 1 ];
			if ( bottom === 'image' ) {
				cands = [ [ 255, 255, 255, 1 ], [ 0, 0, 0, 1 ] ];
				kind = 'image';
			} else if ( bottom === 'color' ) {
				cands = [ lastLayer.color.slice( 0, 3 ).concat( 1 ) ];
			} else if ( bottom === 'gradient' ) {
				cands = lastLayer.stops.map( ( s ) => s.slice( 0, 3 ).concat( 1 ) );
				kind = 'gradient';
			} else {
				cands = [ [ 255, 255, 255, 1 ] ]; // the canvas
			}
			const upTo = bottom ? layers.length - 1 : layers.length;
			for ( let i = upTo - 1; i >= 0; i-- ) {
				const L = layers[ i ];
				if ( L.kind === 'color' ) {
					cands = cands.map( ( c ) => W.over( L.color, c ) );
				} else if ( L.kind === 'gradient' ) {
					kind = kind === 'image' ? 'image' : 'gradient';
					const next = [];
					cands.forEach( ( c ) => L.stops.forEach( ( s ) => next.push( W.over( s, c ) ) ) );
					cands = next;
				} else if ( L.kind === 'image' ) {
					kind = 'image';
					const next = [];
					cands.forEach( ( c ) => {
						next.push( W.over( [ 255, 255, 255, L.opacity ], c ) );
						next.push( W.over( [ 0, 0, 0, L.opacity ], c ) );
					} );
					cands = next;
				}
				if ( cands.length > 24 ) {
					// Keep the extremes only.
					cands.sort( ( a, b ) => W.lum( a ) - W.lum( b ) );
					cands = [ cands[ 0 ], cands[ cands.length - 1 ] ];
				}
			}
			return {
				kind,
				cands,
				layers: layers.map( ( L ) => ( {
					kind: L.kind,
					sel: L.sel,
					color: L.color ? W.hex( L.color ) : undefined,
					stops: L.stops ? L.stops.map( W.hex ) : undefined,
					opacity: L.opacity !== undefined ? W.round( L.opacity ) : undefined,
					what: L.what,
				} ) ),
			};
		} );

	/** Contrast of a colour (with alpha) over each possible background: {min, max, worstBg}. */
	W.contrastOver = ( fg, bgInfo ) => {
		let min = Infinity;
		let max = 0;
		let worst = null;
		bgInfo.cands.forEach( ( b ) => {
			const f = W.over( fg, b );
			const r = W.ratio( f, b );
			if ( r < min ) {
				min = r;
				worst = b;
			}
			max = Math.max( max, r );
		} );
		return { min: W.round( min ), max: W.round( max ), worstBg: W.hex( worst ) };
	};
	W.textColor = ( el ) => {
		const c = W.parseColor( getComputedStyle( el ).color ) || [ 0, 0, 0, 1 ];
		return [ c[ 0 ], c[ 1 ], c[ 2 ], c[ 3 ] * W.opacity( el ) ];
	};
	/** A point inside the element's first text run (else its centre). */
	W.textPoint = ( el ) => {
		const walker = document.createTreeWalker( el, NodeFilter.SHOW_TEXT );
		for ( let n = walker.nextNode(); n; n = walker.nextNode() ) {
			if ( n.textContent.trim() ) {
				const range = document.createRange();
				range.selectNodeContents( n );
				const r = Array.from( range.getClientRects() ).find( ( q ) => q.width > 1 && q.height > 1 );
				if ( r ) {
					return { x: r.left + Math.min( r.width / 2, 8 ), y: r.top + r.height / 2, owner: n.parentElement };
				}
			}
		}
		const r = el.getBoundingClientRect();
		return { x: r.left + r.width / 2, y: r.top + r.height / 2, owner: el };
	};
	W.isLargeText = ( el ) => {
		const cs = getComputedStyle( el );
		const px = parseFloat( cs.fontSize );
		const bold = parseInt( cs.fontWeight, 10 ) >= 700;
		return px >= 24 || ( bold && px >= 18.66 );
	};
	/** Text contrast of an element (its first text run) over what is painted under it. */
	W.textContrast = ( el ) => {
		const restore = W.reveal( el );
		try {
			const p = W.textPoint( el );
			const bg = W.bgAt( p.x, p.y, { from: p.owner } );
			const fg = W.textColor( p.owner );
			const c = W.contrastOver( fg, bg );
			const large = W.isLargeText( p.owner );
			return { fg: W.hex( fg ), bgKind: bg.kind, bgs: bg.cands.map( W.hex ).slice( 0, 6 ), layers: bg.layers, min: c.min, max: c.max, worstBg: c.worstBg, large, need: large ? 3 : 4.5, hidden: ! W.inClip( p.owner ) };
		} finally {
			restore();
		}
	};

	/* ── Reveal / settle ─────────────────────────────────────────────── */
	/** Jumps every finite running animation / transition to its end (entrance reveals, in-view icons). */
	W.settle = async () => {
		const frame = () => new Promise( ( r ) => requestAnimationFrame( () => requestAnimationFrame( r ) ) );
		for ( let round = 0; round < 2; round++ ) {
			document.getAnimations().forEach( ( a ) => {
				const t = a.effect && a.effect.getComputedTiming ? a.effect.getComputedTiming() : null;
				if ( t && t.iterations !== Infinity && t.endTime !== Infinity && ( a.playState === 'running' || a.playState === 'paused' ) ) {
					try {
						a.finish();
					} catch ( e ) {}
				}
			} );
			await frame();
			await new Promise( ( r ) => setTimeout( r, 60 ) );
		}
	};
	W.scrollThrough = async () => {
		const step = Math.max( 200, Math.floor( window.innerHeight * 0.7 ) );
		const h = () => document.documentElement.scrollHeight;
		for ( let y = 0; y < h(); y += step ) {
			window.scrollTo( 0, y );
			await new Promise( ( r ) => requestAnimationFrame( () => requestAnimationFrame( r ) ) );
		}
		window.scrollTo( 0, h() );
		await new Promise( ( r ) => setTimeout( r, 60 ) );
		window.scrollTo( 0, 0 );
		await new Promise( ( r ) => requestAnimationFrame( () => requestAnimationFrame( r ) ) );
	};

	/* ── Headings and roots ──────────────────────────────────────────── */
	W.headings = () =>
		Array.from( document.querySelectorAll( 'h1, h2, h3, h4, h5, h6, [role="heading"]' ) )
			.filter( ( h ) => h.checkVisibility ? h.checkVisibility( { visibilityProperty: true } ) || W.isSrOnly( h ) : true )
			.map( ( h ) => ( {
				level: h.getAttribute( 'role' ) === 'heading' ? parseInt( h.getAttribute( 'aria-level' ) || '2', 10 ) : parseInt( h.tagName.slice( 1 ), 10 ),
				text: W.text( h ).slice( 0, 120 ),
				werun: W.inWerun( h ),
				block: W.blockOf( h ),
				hidden: W.isSrOnly( h ),
				selector: W.inWerun( h ) ? W.selector( h ) : '',
			} ) );
	W.markRoots = () =>
		W.roots().map( ( el, i ) => {
			el.setAttribute( 'data-wrbc-a11y-root', String( i ) );
			return { i, block: W.blockOf( el ) || el.className.split( ' ' )[ 0 ], selector: W.selector( el ) };
		} );

	/* ── Target size 2.5.8 ───────────────────────────────────────────── */
	const inSentence = ( el ) => {
		let block = el;
		while ( block.parentElement && getComputedStyle( block ).display.startsWith( 'inline' ) && getComputedStyle( block ).display !== 'inline-block' && getComputedStyle( block ).display !== 'inline-flex' ) {
			block = block.parentElement;
		}
		if ( block === el ) {
			return false;
		}
		const other = W.text( block ).replace( W.text( el ), '' ).replace( /[\s.,;:!?()–—-]/g, '' );
		return other.length >= 2;
	};
	W.targets = () => {
		// Targets in a slide scrolled out of its track are measured when they show (same markup as the visible ones).
		const els = Array.from( document.querySelectorAll( INTERACTIVE ) ).filter( ( el ) => W.inWerun( el ) && ! el.disabled && W.isVisible( el ) && ! W.isSrOnly( el ) && W.inClip( el ) );
		const items = els.map( ( el ) => {
			const r = el.getBoundingClientRect();
			const cs = getComputedStyle( el );
			const inline = cs.display === 'inline' && ( el.getClientRects().length > 1 || inSentence( el ) );
			return { el, r, inline, small: ! inline && ( r.width < 23.99 || r.height < 23.99 ) };
		} );
		const out = [];
		const circleRect = ( cx, cy, rad, r ) => {
			const nx = Math.max( r.left, Math.min( cx, r.right ) );
			const ny = Math.max( r.top, Math.min( cy, r.bottom ) );
			return ( nx - cx ) ** 2 + ( ny - cy ) ** 2 < rad * rad - 0.01;
		};
		items.forEach( ( it ) => {
			if ( ! it.small ) {
				return;
			}
			const cx = it.r.left + it.r.width / 2;
			const cy = it.r.top + it.r.height / 2;
			const clash = [];
			items.forEach( ( o ) => {
				if ( o === it || o.el.contains( it.el ) || it.el.contains( o.el ) ) {
					return;
				}
				const hitRect = circleRect( cx, cy, 12, o.r );
				let hitCircle = false;
				if ( o.small ) {
					const ox = o.r.left + o.r.width / 2;
					const oy = o.r.top + o.r.height / 2;
					hitCircle = Math.hypot( ox - cx, oy - cy ) < 24 - 0.01;
				}
				if ( hitRect || hitCircle ) {
					clash.push( W.selector( o.el ) );
				}
			} );
			out.push( {
				selector: W.selector( it.el ),
				snippet: W.snippet( it.el ),
				block: W.blockOf( it.el ),
				width: W.round( it.r.width ),
				height: W.round( it.r.height ),
				spacingOk: clash.length === 0,
				clashes: clash.slice( 0, 5 ),
			} );
		} );
		return { count: items.length, inline: items.filter( ( i ) => i.inline ).length, undersized: out };
	};

	/* ── Reflow 1.4.10 ───────────────────────────────────────────────── */
	const scrollerOf = ( el ) => {
		for ( let n = el.parentElement; n && n !== document.body && n !== document.documentElement; n = n.parentElement ) {
			const ox = getComputedStyle( n ).overflowX;
			if ( ox !== 'visible' ) {
				return { el: n, ox };
			}
		}
		return null;
	};
	const hasFocusable = ( el ) => Array.from( el.querySelectorAll( FOCUSABLE ) ).some( ( f ) => f.tabIndex >= 0 && W.isVisible( f ) );
	W.reflow = () => {
		const doc = document.documentElement;
		const vw = doc.clientWidth;
		const res = { viewport: vw, scrollWidth: doc.scrollWidth, bodyScrollWidth: document.body.scrollWidth, pageOverflow: doc.scrollWidth > vw + 1, offenders: [], clipped: [], scrollers: [] };
		const offenders = new Set();
		const seenScrollers = new Set();
		W.roots().forEach( ( root ) => {
			[ root, ...root.querySelectorAll( '*' ) ].forEach( ( el ) => {
				if ( el.closest( 'script, style, template, noscript' ) || W.isSrOnly( el ) ) {
					return;
				}
				const r = el.getBoundingClientRect();
				if ( r.width === 0 && r.height === 0 ) {
					return;
				}
				const cs = getComputedStyle( el );
				if ( cs.display === 'none' || cs.visibility !== 'visible' ) {
					return;
				}
				// Scroll containers inside the block.
				if ( ( cs.overflowX === 'auto' || cs.overflowX === 'scroll' ) && el.scrollWidth > el.clientWidth + 1 && ! seenScrollers.has( el ) ) {
					seenScrollers.add( el );
					res.scrollers.push( {
						selector: W.selector( el ),
						block: W.blockOf( el ),
						scrollWidth: el.scrollWidth,
						clientWidth: el.clientWidth,
						focusable: el.tabIndex >= 0,
						containsFocusable: hasFocusable( el ),
						role: el.getAttribute( 'role' ) || '',
						label: el.getAttribute( 'aria-label' ) || ( el.getAttribute( 'aria-labelledby' ) ? 'labelledby' : '' ),
						keyboardReachable: el.tabIndex >= 0 || hasFocusable( el ),
					} );
				}
				const sc = scrollerOf( el );
				if ( sc && ( sc.ox === 'auto' || sc.ox === 'scroll' ) ) {
					return; // content of a scroller
				}
				const hasText = /\S/.test( Array.from( el.childNodes ).filter( ( n ) => n.nodeType === 3 ).map( ( n ) => n.textContent ).join( '' ) );
				const meaningful = hasText || el.matches( FOCUSABLE ) || el.matches( 'img, svg, video, canvas, iframe, input, select, textarea' );
				if ( sc && ( sc.ox === 'hidden' || sc.ox === 'clip' ) ) {
					// Its padding box, plus overflow-clip-margin (painted on purpose: shadows, focus rings).
					const s = W.clipBox( sc.el );
					if ( meaningful && ( r.right > s.right + 1 || r.left < s.left - 1 ) && r.right > s.left && r.left < s.right && ! el.closest( '[aria-hidden="true"]' ) ) {
						res.clipped.push( { selector: W.selector( el ), block: W.blockOf( el ), snippet: W.snippet( el ), left: Math.round( r.left ), right: Math.round( r.right ), clipBy: W.selector( sc.el ), clipLeft: Math.round( s.left ), clipRight: Math.round( s.right ) } );
					}
					return;
				}
				if ( r.right > vw + 1 || ( r.left < -1 && r.right > 0 && meaningful ) ) {
					offenders.add( el );
				}
			} );
		} );
		offenders.forEach( ( el ) => {
			if ( el.parentElement && offenders.has( el.parentElement ) ) {
				return; // report the outermost
			}
			const r = el.getBoundingClientRect();
			res.offenders.push( { selector: W.selector( el ), block: W.blockOf( el ), snippet: W.snippet( el ), left: Math.round( r.left ), right: Math.round( r.right ), width: Math.round( r.width ), minWidth: getComputedStyle( el ).minWidth, whiteSpace: getComputedStyle( el ).whiteSpace } );
		} );
		// Text cut by a clipping box: a block child keeps its box, its text overflows it.
		const clippers = new Set();
		W.roots().forEach( ( root ) =>
			[ root, ...root.querySelectorAll( '*' ) ].forEach( ( n ) => {
				const cs = getComputedStyle( n );
				if ( ( cs.overflowX === 'hidden' || cs.overflowX === 'clip' ) && n.scrollWidth > n.clientWidth + 1 ) {
					clippers.add( n );
				}
			} )
		);
		clippers.forEach( ( n ) => {
			if ( res.clipped.some( ( c ) => c.clipBy === W.selector( n ) ) ) {
				return;
			}
			const b = W.clipBox( n );
			const walker = document.createTreeWalker( n, NodeFilter.SHOW_TEXT );
			let count = 0;
			for ( let t = walker.nextNode(); t && count < 300; t = walker.nextNode() ) {
				if ( ! t.textContent.trim() || ! t.parentElement || t.parentElement.closest( '[aria-hidden="true"]' ) || W.isSrOnly( t.parentElement ) ) {
					continue;
				}
				count++;
				// Text inside a scroller of its own is reachable by scrolling it.
				const sc = scrollerOf( t.parentElement === n ? n : t.parentElement );
				if ( sc && sc.el !== n && n.contains( sc.el ) && ( sc.ox === 'auto' || sc.ox === 'scroll' ) ) {
					continue;
				}
				const range = document.createRange();
				range.selectNodeContents( t );
				const cut = Array.from( range.getClientRects() ).find( ( q ) => q.width > 0 && ( q.right > b.right + 1 || q.left < b.left - 1 ) );
				if ( cut ) {
					const el = t.parentElement;
					res.clipped.push( { selector: W.selector( el ), block: W.blockOf( el ), snippet: W.snippet( el ), left: Math.round( cut.left ), right: Math.round( cut.right ), clipBy: W.selector( n ), clipLeft: Math.round( b.left ), clipRight: Math.round( b.right ), text: true } );
					break;
				}
			}
		} );
		res.clipped = res.clipped.filter( ( c, i, a ) => a.findIndex( ( d ) => d.clipBy === c.clipBy ) === i || a.length < 6 ).slice( 0, 10 );
		return res;
	};

	/* ── Text spacing 1.4.12 ─────────────────────────────────────────── */
	const SPACING_CSS = '* { line-height: 1.5 !important; letter-spacing: 0.12em !important; word-spacing: 0.16em !important; } p { margin-bottom: 2em !important; }';
	const clipState = ( el ) => {
		const cs = getComputedStyle( el );
		const clipsX = cs.overflowX === 'hidden' || cs.overflowX === 'clip';
		const clipsY = cs.overflowY === 'hidden' || cs.overflowY === 'clip';
		const clamp = cs.webkitLineClamp && cs.webkitLineClamp !== 'none';
		const ellipsis = cs.textOverflow === 'ellipsis';
		return {
			clipsX,
			clipsY,
			clamp,
			ellipsis,
			overX: el.scrollWidth - el.clientWidth,
			overY: el.scrollHeight - el.clientHeight,
		};
	};
	W.textSpacing = async () => {
		const els = [];
		W.roots().forEach( ( root ) => {
			[ root, ...root.querySelectorAll( '*' ) ].forEach( ( el ) => {
				if ( el.matches( 'img, svg, svg *, video, iframe, canvas, script, style, template, br, hr' ) || W.isSrOnly( el ) || ! W.text( el ) || ! W.isVisible( el ) ) {
					return;
				}
				els.push( el );
			} );
		} );
		const before = new Map( els.map( ( el ) => [ el, clipState( el ) ] ) );
		const style = document.createElement( 'style' );
		style.id = 'wrbc-a11y-spacing';
		style.textContent = SPACING_CSS;
		document.documentElement.appendChild( style );
		await new Promise( ( r ) => requestAnimationFrame( () => requestAnimationFrame( r ) ) );
		const out = [];
		els.forEach( ( el ) => {
			const b = before.get( el );
			const a = clipState( el );
			const clippedX = a.clipsX && a.overX > 1;
			const clippedY = a.clipsY && a.overY > 1;
			const truncated = ( a.clamp || a.ellipsis ) && ( a.overY > 1 || a.overX > 1 );
			if ( ! ( clippedX || clippedY || truncated ) ) {
				return;
			}
			const grew = a.overX > b.overX + 1 || a.overY > b.overY + 1;
			if ( ! grew ) {
				return;
			}
			// Skip a parent when a child is the one clipped with the same box (report the innermost).
			out.push( {
				el,
				selector: W.selector( el ),
				block: W.blockOf( el ),
				snippet: W.snippet( el ),
				axis: [ clippedX ? 'x' : '', clippedY ? 'y' : '', truncated ? 'clamp' : '' ].filter( Boolean ).join( '+' ),
				overflowBefore: { x: b.overX, y: b.overY },
				overflowAfter: { x: a.overX, y: a.overY },
				height: getComputedStyle( el ).height,
			} );
		} );
		style.remove();
		await new Promise( ( r ) => requestAnimationFrame( r ) );
		// Innermost first, max 15.
		return out
			.filter( ( o ) => ! out.some( ( p ) => p !== o && o.el.contains( p.el ) && p.axis === o.axis ) )
			.slice( 0, 15 )
			.map( ( o ) => {
				delete o.el;
				return o;
			} );
	};

	/* ── Motion 2.2.2 ────────────────────────────────────────────────── */
	const carouselInfo = ( c ) => {
		if ( ! c ) {
			return null;
		}
		let o = {};
		try {
			o = JSON.parse( c.getAttribute( 'data-wrbc-carousel' ) || '{}' );
		} catch ( e ) {}
		// Its own buttons only (a carousel inside a slide keeps its own).
		const btns = Array.from( c.querySelectorAll( '[data-wrbc-play], button, [role="button"]' ) ).filter( ( b ) => W.carouselOf( b ) === c );
		const play = btns.find( ( b ) => b.matches( '[data-wrbc-play]' ) ) || btns.find( ( b ) => /pause|stop|play|detener|pausa/i.test( ( b.getAttribute( 'aria-label' ) || '' ) + ' ' + W.text( b ) ) );
		return {
			id: W.idOf( c ),
			selector: W.selector( c ),
			block: W.blockOf( c ),
			autoplay: !! o.autoplay,
			interval: o.interval,
			playing: c.classList.contains( 'is-playing' ),
			pauseButton: play ? { selector: W.selector( play ), visible: W.isVisible( play ), label: play.getAttribute( 'aria-label' ) || W.text( play ) } : null,
		};
	};
	W.motion = () => {
		const now = performance.now();
		const anims = document
			.getAnimations()
			.filter( ( a ) => a.playState === 'running' && a.effect && a.effect.target )
			.map( ( a ) => {
				const t = a.effect.getComputedTiming();
				const tgt = a.effect.target;
				const delay = typeof t.delay === 'number' ? t.delay : 0;
				const active = typeof t.activeDuration === 'number' ? t.activeDuration : Infinity;
				return {
					type: a.constructor.name,
					name: a.animationName || a.transitionProperty || a.id || '',
					selector: W.selector( tgt ),
					block: W.blockOf( tgt ),
					werun: W.inWerun( tgt ),
					pseudo: a.effect.pseudoElement || '',
					iterations: t.iterations === Infinity ? 'infinite' : t.iterations,
					duration: typeof t.duration === 'number' ? Math.round( t.duration ) : t.duration,
					delay: Math.round( delay ),
					// The animation's own length: iterations × duration + delay (not the time since load).
					total: t.iterations === Infinity || active === Infinity ? 'infinite' : Math.round( active + delay ),
					startedAt: a.startTime === null ? null : Math.round( a.startTime ),
					visible: W.isVisible( tgt ),
				};
			} )
			.filter( ( a ) => a.werun );
		const videos = Array.from( document.querySelectorAll( 'video' ) )
			.filter( W.inWerun )
			.map( ( v ) => ( { selector: W.selector( v ), block: W.blockOf( v ), paused: v.paused, muted: v.muted, loop: v.loop, autoplay: v.autoplay, controls: v.controls, src: !! ( v.currentSrc || v.src ), time: Math.round( v.currentTime * 10 ) / 10, visible: W.isVisible( v ) } ) );
		const tracks = Array.from( document.querySelectorAll( '[data-wrbc-track]' ) )
			.filter( W.inWerun )
			.map( ( t ) => {
				const seen = W.trackSeen.get( W.idOf( t ) ) || null;
				return {
					id: W.idOf( t ),
					selector: W.selector( t ),
					left: Math.round( t.scrollLeft ),
					top: Math.round( t.scrollTop ),
					width: t.clientWidth,
					visibleAt: seen ? seen.t : null,
					leftAtVisible: seen ? seen.left : null,
					topAtVisible: seen ? seen.top : null,
					carousel: carouselInfo( W.carouselOf( t ) ),
				};
			} );
		const roots = new Set();
		document.querySelectorAll( '[data-wrbc-carousel], .wrbc-carousel' ).forEach( ( c ) => {
			if ( W.inWerun( c ) ) {
				roots.add( c.matches( '[data-wrbc-carousel]' ) ? c : W.carouselOf( c ) );
			}
		} );
		const carousels = Array.from( roots ).filter( Boolean ).map( carouselInfo );
		// Controls that look like a pause / stop for anything that moves.
		const pauses = Array.from( document.querySelectorAll( 'button, [role="button"]' ) )
			.filter( ( b ) => W.inWerun( b ) && /pause|stop|play|detener|pausa/i.test( ( b.getAttribute( 'aria-label' ) || '' ) + ' ' + W.text( b ) + ' ' + ( b.className || '' ) ) )
			.map( ( b ) => ( { selector: W.selector( b ), block: W.blockOf( b ), visible: W.isVisible( b ), label: b.getAttribute( 'aria-label' ) || W.text( b ) } ) );
		return { at: Math.round( now ), anims, videos, tracks, carousels, pauses, scrollLog: W.scrollLog.slice( -120 ) };
	};

	/* ── Non-text contrast 1.4.11 (+ placeholders 1.4.3) ─────────────── */
	const outsideBg = ( el, gap = 2 ) => {
		const r = el.getBoundingClientRect();
		const pts = [
			[ r.left - gap, r.top + r.height / 2 ],
			[ r.right + gap, r.top + r.height / 2 ],
			[ r.left + r.width / 2, r.top - gap ],
			[ r.left + r.width / 2, r.bottom + gap ],
		];
		const all = { kind: 'solid', cands: [], layers: [] };
		pts.forEach( ( [ x, y ] ) => {
			const b = W.bgAt( x, y, { exclude: el } );
			all.cands.push( ...b.cands );
			if ( b.kind !== 'solid' ) {
				all.kind = b.kind;
			}
			if ( ! all.layers.length ) {
				all.layers = b.layers;
			}
		} );
		// Unique.
		const seen = new Set();
		all.cands = all.cands.filter( ( c ) => {
			const k = W.hex( c );
			return seen.has( k ) ? false : seen.add( k );
		} );
		return all;
	};
	W.outsideBg = outsideBg;
	const insideBg = ( el ) => {
		const r = el.getBoundingClientRect();
		return W.bgAt( r.left + r.width / 2, r.top + r.height / 2, { from: el } );
	};
	W.controls = () => {
		const out = [];
		const sel = 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]):not([type="range"]):not([type="color"]):not([type="file"]), select, textarea';
		document.querySelectorAll( sel ).forEach( ( el ) => {
			if ( ! W.inWerun( el ) || ! W.isVisible( el ) || W.isSrOnly( el ) || el.disabled ) {
				return;
			}
			const restore = W.reveal( el );
			try {
			if ( ! W.inClip( el ) ) {
				return; // still outside its scroller's visible box
			}
			const cs = getComputedStyle( el );
			const type = ( el.getAttribute( 'type' ) || el.tagName ).toLowerCase();
			if ( ( type === 'checkbox' || type === 'radio' ) && cs.appearance !== 'none' ) {
				return; // native control: the browser draws it
			}
			const outside = outsideBg( el );
			const inside = insideBg( el );
			const sides = [ 'Top', 'Right', 'Bottom', 'Left' ]
				.map( ( s ) => ( { side: s.toLowerCase(), w: parseFloat( cs[ 'border' + s + 'Width' ] ), style: cs[ 'border' + s + 'Style' ], color: W.parseColor( cs[ 'border' + s + 'Color' ] ) } ) )
				.filter( ( s ) => s.w > 0 && s.style !== 'none' && s.style !== 'hidden' && s.color && s.color[ 3 ] > 0 );
			let borderMin = null;
			sides.forEach( ( s ) => {
				const c = W.contrastOver( [ s.color[ 0 ], s.color[ 1 ], s.color[ 2 ], s.color[ 3 ] * W.opacity( el ) ], outside );
				borderMin = borderMin === null ? c.min : Math.min( borderMin, c.min );
			} );
			// Fill vs surroundings (a filled control needs no border).
			let fillMin = Infinity;
			inside.cands.forEach( ( fi ) => outside.cands.forEach( ( ou ) => ( fillMin = Math.min( fillMin, W.ratio( fi, ou ) ) ) ) );
			fillMin = W.round( fillMin );
			const best = Math.max( borderMin === null ? 0 : borderMin, fillMin );
			const item = {
				selector: W.selector( el ),
				block: W.blockOf( el ),
				snippet: W.snippet( el ),
				type,
				border: sides.length ? sides.map( ( s ) => s.side + ' ' + s.w + 'px ' + W.hex( s.color ) ).join( ', ' ) : 'none',
				borderRatio: borderMin,
				fill: inside.cands.map( W.hex ).join( ' / ' ),
				fillRatio: fillMin,
				outside: outside.cands.map( W.hex ).slice( 0, 4 ).join( ' / ' ),
				outsideKind: outside.kind,
				ratio: W.round( best ),
				ok: best >= 3,
			};
			// Placeholder text (1.4.3).
			if ( el.getAttribute( 'placeholder' ) && ! el.value ) {
				const pc = W.parseColor( getComputedStyle( el, '::placeholder' ).color );
				if ( pc ) {
					const c = W.contrastOver( [ pc[ 0 ], pc[ 1 ], pc[ 2 ], pc[ 3 ] * W.opacity( el ) ], inside );
					item.placeholder = { color: W.hex( pc ), ratio: c.min, ok: c.min >= 4.5 };
				}
			}
			out.push( item );
			} finally {
				restore();
			}
		} );
		return out;
	};
	/** Fixture rules: { selector, pseudo, property, min, against, label }. */
	W.nonText = ( rules ) => {
		const out = [];
		( rules || [] ).forEach( ( rule ) => {
			let els = [];
			try {
				els = Array.from( document.querySelectorAll( rule.selector ) ).filter( W.inWerun );
			} catch ( e ) {
				out.push( { rule, error: 'bad selector' } );
				return;
			}
			if ( ! els.length ) {
				out.push( { rule, error: 'no element matches' } );
				return;
			}
			els.slice( 0, 12 ).forEach( ( el ) => {
				if ( ! W.isVisible( el ) && ! rule.pseudo ) {
					return;
				}
				const restore = W.reveal( el );
				try {
				if ( ! W.inClip( el ) ) {
					return; // a slide scrolled out of its track: measured where it shows, never against the page behind
				}
				const cs = getComputedStyle( el, rule.pseudo || null );
				const prop = rule.property || 'background-color';
				const raw = cs.getPropertyValue( prop );
				const col = W.parseColor( raw );
				if ( ! col ) {
					out.push( { rule, selector: W.selector( el ), error: 'no colour in ' + prop + ': ' + raw } );
					return;
				}
				let against;
				const r = el.getBoundingClientRect();
				if ( rule.against && /^self:/.test( rule.against ) ) {
					const other = W.parseColor( cs.getPropertyValue( rule.against.slice( 5 ) ) ) || [ 255, 255, 255, 1 ];
					const base = W.bgAt( r.left + r.width / 2, r.top + r.height / 2, { exclude: el } );
					against = { kind: base.kind, cands: base.cands.map( ( b ) => W.over( other, b ) ), layers: base.layers };
				} else if ( rule.against && rule.against !== 'parent' ) {
					const fixed = W.parseColor( rule.against );
					against = { kind: 'solid', cands: [ fixed ? fixed.slice( 0, 3 ).concat( 1 ) : [ 255, 255, 255, 1 ] ], layers: [] };
				} else {
					against = W.bgAt( r.left + r.width / 2, r.top + r.height / 2, { exclude: el } );
				}
				const c = W.contrastOver( [ col[ 0 ], col[ 1 ], col[ 2 ], col[ 3 ] * W.opacity( el ) ], against );
				const min = rule.min || 3;
				out.push( {
					label: rule.label || '',
					selector: W.selector( el ) + ( rule.pseudo || '' ),
					block: W.blockOf( el ),
					property: prop,
					color: W.hex( col ),
					against: against.cands.map( W.hex ).slice( 0, 4 ).join( ' / ' ),
					againstKind: against.kind,
					ratio: c.min,
					max: c.max,
					min,
					ok: c.min >= min,
				} );
				} finally {
					restore();
				}
			} );
		} );
		return out;
	};

	/* ── Focus walk helpers ──────────────────────────────────────────── */
	const WALK_CSS =
		'*, *::before, *::after { transition: none !important; animation: none !important; caret-color: transparent !important; scroll-behavior: auto !important; } html { scroll-behavior: auto !important; }';
	W.walkStart = () => {
		if ( ! document.getElementById( 'wrbc-a11y-walk' ) ) {
			const s = document.createElement( 'style' );
			s.id = 'wrbc-a11y-walk';
			s.textContent = WALK_CSS;
			document.documentElement.appendChild( s );
		}
		if ( document.activeElement && document.activeElement !== document.body ) {
			document.activeElement.blur();
		}
		// Earlier checks (scrollIntoView…) move the browser's "sequential focus navigation
		// starting point": park focus on a temporary, untabbable first element of the body,
		// so the first Tab reaches the first focusable element of the page.
		let start = document.getElementById( 'wrbc-a11y-walk-start' );
		if ( ! start ) {
			start = document.createElement( 'span' );
			start.id = 'wrbc-a11y-walk-start';
			start.tabIndex = -1;
			document.body.prepend( start );
		}
		start.focus( { preventScroll: true } );
		window.scrollTo( 0, 0 );
		W.walkSeen = new Set();
		W.walkLast = null;
	};
	W.walkEnd = () => {
		[ 'wrbc-a11y-walk', 'wrbc-a11y-walk-start' ].forEach( ( id ) => {
			const s = document.getElementById( id );
			if ( s ) {
				s.remove();
			}
		} );
	};
	const ringStyle = ( el ) => {
		const cs = getComputedStyle( el );
		return {
			outline: cs.outlineStyle !== 'none' && parseFloat( cs.outlineWidth ) > 0 ? cs.outlineWidth + ' ' + cs.outlineStyle + ' ' + cs.outlineColor + ' offset ' + cs.outlineOffset : 'none',
			outlineColor: cs.outlineColor,
			outlineWidth: parseFloat( cs.outlineWidth ) || 0,
			outlineStyle: cs.outlineStyle,
			outlineOffset: parseFloat( cs.outlineOffset ) || 0,
			boxShadow: cs.boxShadow,
			border: cs.borderTopColor + ' ' + cs.borderTopWidth,
			background: cs.backgroundColor,
			color: cs.color,
			textDecoration: cs.textDecorationLine,
		};
	};
	/**
	 * A visually hidden control (opacity 0, sr-only, < 4 px: custom radios,
	 * checkboxes, switches) shows its focus on something else: its label
	 * (label[for] / the wrapping label), else its next or previous sibling,
	 * else its parent. Null when the element itself is visible.
	 */
	W.focusProxy = ( el ) => {
		const r = el.getBoundingClientRect();
		const hidden = ! W.isVisible( el ) || W.isSrOnly( el ) || r.width < 4 || r.height < 4 || W.opacity( el ) < 0.05;
		if ( ! hidden ) {
			return null;
		}
		const cands = [];
		if ( el.labels ) {
			cands.push( ...el.labels );
		}
		cands.push( el.closest( 'label' ), el.nextElementSibling, el.previousElementSibling, el.parentElement );
		return (
			cands.find( ( c ) => {
				if ( ! c || c === el || ! W.isVisible( c ) || W.isSrOnly( c ) ) {
					return false;
				}
				const q = c.getBoundingClientRect();
				return q.width >= 4 && q.height >= 4;
			} ) || null
		);
	};
	/** Rings drawn by box-shadow: [{ color, d }] (d = distance of the ring's middle outside the box). */
	const shadowRings = ( boxShadow ) => {
		if ( ! boxShadow || boxShadow === 'none' ) {
			return [];
		}
		const out = [];
		// Split on commas outside parentheses.
		let depth = 0;
		let cur = '';
		const parts = [];
		for ( const ch of boxShadow ) {
			depth += ch === '(' ? 1 : ch === ')' ? -1 : 0;
			if ( ch === ',' && depth === 0 ) {
				parts.push( cur );
				cur = '';
			} else {
				cur += ch;
			}
		}
		parts.push( cur );
		parts.forEach( ( part ) => {
			if ( /\binset\b/.test( part ) ) {
				return;
			}
			const color = ( part.match( /(rgba?\([^)]*\)|color\([^)]*\)|#[0-9a-f]{3,8})/i ) || [] )[ 0 ];
			const lens = ( part.replace( /(rgba?\([^)]*\)|color\([^)]*\))/gi, '' ).match( /-?[\d.]+px/g ) || [] ).map( parseFloat );
			const [ x = 0, y = 0, blur = 0, spread = 0 ] = lens;
			if ( color && spread > 0 && Math.abs( x ) < 1 && Math.abs( y ) < 1 && blur <= spread ) {
				out.push( { color: W.parseColor( color ), d: spread / 2 } );
			}
		} );
		return out.filter( ( r ) => r.color && r.color[ 3 ] > 0 );
	};
	/**
	 * After a Tab (or a blur / refocus): wait `frames` animation frames, then, when the
	 * page or a scroller around the focused element is still moving (a carousel scrolling
	 * to the focused slide), until nothing moved for two frames or `maxMs` passed.
	 */
	W.afterTab = async ( frames = 2, maxMs = 500 ) => {
		const raf = () => new Promise( ( r ) => requestAnimationFrame( () => r() ) );
		const el = document.activeElement && document.activeElement !== document.body ? document.activeElement : W.focused;
		const nodes = [];
		for ( let n = el && el.parentElement; n && n !== document.body && n !== document.documentElement; n = n.parentElement ) {
			if ( n.scrollWidth > n.clientWidth + 1 || n.scrollHeight > n.clientHeight + 1 ) {
				nodes.push( n );
			}
		}
		const pos = () => [ window.scrollX, window.scrollY ].concat( ...nodes.map( ( n ) => [ n.scrollLeft, n.scrollTop ] ) ).join( ',' );
		let last = pos();
		let moved = false;
		for ( let i = 0; i < frames; i++ ) {
			await raf();
			const now = pos();
			moved = moved || now !== last;
			last = now;
		}
		if ( ! moved && ! nodes.length ) {
			return 0;
		}
		const t0 = performance.now();
		let stable = 0;
		while ( stable < 2 && performance.now() - t0 < maxMs ) {
			await raf();
			const now = pos();
			stable = now === last ? stable + 1 : 0;
			last = now;
		}
		return Math.round( performance.now() - t0 );
	};
	/** The focused element after a Tab: where it is and what it looks like. */
	W.focusInfo = () => {
		const el = document.activeElement;
		if ( ! el || el === document.body || el === document.documentElement || el.id === 'wrbc-a11y-walk-start' ) {
			return { none: true };
		}
		const repeat = W.walkLast === el;
		const seen = W.walkSeen.has( el );
		W.walkSeen.add( el );
		W.walkLast = el;
		W.focused = el;
		W.focusTarget = el;
		const werun = W.inWerun( el );
		const info = { tag: el.tagName.toLowerCase(), werun, repeat, seen, iframe: el.tagName === 'IFRAME' };
		if ( ! werun ) {
			return info;
		}
		// What shows the focus: the element, or the label / sibling of a hidden control.
		const proxy = W.focusProxy( el );
		const t = proxy || el;
		W.focusTarget = t;
		const r = t.getBoundingClientRect();
		const vw = document.documentElement.clientWidth;
		const vh = document.documentElement.clientHeight;
		Object.assign( info, {
			selector: W.selector( el ),
			snippet: W.snippet( el ),
			block: W.blockOf( el ),
			via: proxy ? W.selector( proxy ) : '',
			rect: { x: r.left, y: r.top, w: r.width, h: r.height },
			viewport: { w: vw, h: vh },
			focusVisible: el.matches( ':focus-visible' ),
			tabindex: el.getAttribute( 'tabindex' ),
			style: ringStyle( t ),
		} );
		// 2.4.11: what is painted on top of it (sticky / fixed bars, overlays), on a 5 × 5 grid.
		// Only points on the element's own shape count (rounded corners hit what is behind),
		// and only layers above it in paint order that paint something cover it.
		const pts = [];
		for ( let i = 0; i < 5; i++ ) {
			for ( let j = 0; j < 5; j++ ) {
				pts.push( [ r.left + ( r.width * ( i + 0.5 ) ) / 5, r.top + ( r.height * ( j + 0.5 ) ) / 5 ] );
			}
		}
		let inView = 0;
		let covered = 0;
		let onScreen = 0;
		const by = new Set();
		const mine = ( n ) => n === el || el.contains( n ) || n === t || t.contains( n ) || ( el.labels && Array.from( el.labels ).some( ( l ) => l.contains( n ) ) );
		const paints = ( n ) => {
			const cs = getComputedStyle( n );
			if ( cs.visibility !== 'visible' || W.opacity( n ) < 0.05 ) {
				return false;
			}
			const bg = W.parseColor( cs.backgroundColor );
			return ( bg && bg[ 3 ] > 0.05 ) || cs.backgroundImage !== 'none' || MEDIA.test( n.tagName ) || n instanceof SVGElement || /\S/.test( Array.from( n.childNodes ).filter( ( c ) => c.nodeType === 3 ).map( ( c ) => c.textContent ).join( '' ) );
		};
		W.hitAll( () =>
			pts.forEach( ( [ x, y ] ) => {
				if ( x < 0 || y < 0 || x >= vw || y >= vh ) {
					return;
				}
				onScreen++;
				const stack = document.elementsFromPoint( x, y );
				const idx = stack.findIndex( mine );
				if ( idx < 0 ) {
					return; // not on the element's painted shape
				}
				inView++;
				const above = stack.slice( 0, idx ).filter( ( n ) => ! mine( n ) && ! n.contains( el ) && paints( n ) );
				if ( ! above.length ) {
					return;
				}
				covered++;
				let top = above[ 0 ];
				for ( let n = above[ 0 ]; n && n !== document.body; n = n.parentElement ) {
					const pos = getComputedStyle( n ).position;
					if ( pos === 'fixed' || pos === 'sticky' ) {
						top = n;
						break;
					}
				}
				by.add( W.selector( top ) );
			} )
		);
		info.obscured = { points: pts.length, inView, covered, by: Array.from( by ).slice( 0, 4 ), hidden: onScreen === 0 || ( inView > 0 && covered >= inView ), partial: covered > 0 && covered < inView };
		info.opacity = W.round( W.opacity( t ) );
		info.inactive = el.getAttribute( 'aria-disabled' ) === 'true' || !! el.disabled;
		// Ring colour (outline, else a box-shadow ring) vs what surrounds it.
		const s = info.style;
		let rings = [];
		if ( s.outlineStyle !== 'none' && s.outlineWidth > 0 ) {
			rings = [ { color: W.parseColor( s.outlineColor ), d: s.outlineOffset + s.outlineWidth / 2, kind: 'outline' } ];
		} else {
			rings = shadowRings( s.boxShadow ).map( ( q ) => ( { ...q, kind: 'box-shadow' } ) );
		}
		// A translucent element (opacity) paints its ring translucent too.
		rings.forEach( ( q ) => {
			if ( q.color ) {
				q.color = [ q.color[ 0 ], q.color[ 1 ], q.color[ 2 ], q.color[ 3 ] * info.opacity ];
			}
		} );
		if ( rings.length && rings[ 0 ].color ) {
			let min = Infinity;
			let worst = null;
			let color = null;
			const bgs = new Set();
			const sides = ( d ) => [
				[ r.left - d, r.top + r.height / 2 ],
				[ r.right + d, r.top + r.height / 2 ],
				[ r.left + r.width / 2, r.top - d ],
				[ r.left + r.width / 2, r.bottom + d ],
			];
			// Per side: the best of the rings (a double ring is made for any background), then the worst side.
			[ 0, 1, 2, 3 ].forEach( ( side ) => {
				let best = 0;
				let bestBg = null;
				let bestColor = null;
				rings.forEach( ( ring ) => {
					const [ x, y ] = sides( ring.d )[ side ];
					const b = ring.d >= 0 ? W.bgAt( x, y, { exclude: t } ) : W.bgAt( x, y, { from: t } );
					b.cands.forEach( ( q ) => bgs.add( W.hex( q ) ) );
					const c = W.contrastOver( ring.color, b );
					if ( c.min > best ) {
						best = c.min;
						bestBg = c.worstBg;
						bestColor = ring.color;
					}
				} );
				if ( best < min ) {
					min = best;
					worst = bestBg;
					color = bestColor;
				}
			} );
			info.ring = { kind: rings[ 0 ].kind, color: W.hex( color || rings[ 0 ].color ), ratio: min, against: worst, bgs: Array.from( bgs ).slice( 0, 4 ) };
		}
		return info;
	};
	W.styleNow = () => ( W.focusTarget ? ringStyle( W.focusTarget ) : null );
	W.blurFocused = () => {
		if ( W.focused ) {
			W.focused.blur();
		}
	};
	W.refocus = () => {
		if ( W.focused ) {
			try {
				W.focused.focus( { preventScroll: true, focusVisible: true } );
			} catch ( e ) {
				W.focused.focus( { preventScroll: true } );
			}
			return W.focused.matches( ':focus-visible' );
		}
		return false;
	};
	W.positiveTabindex = () =>
		Array.from( document.querySelectorAll( '[tabindex]' ) )
			.filter( ( el ) => W.inWerun( el ) && parseInt( el.getAttribute( 'tabindex' ), 10 ) > 0 )
			.map( ( el ) => ( { selector: W.selector( el ), tabindex: el.getAttribute( 'tabindex' ) } ) );

	/* ── Text drawn by ::before / ::after / ::marker (1.4.3) ─────────── */
	const pseudoIsText = ( content ) => {
		if ( ! content || content === 'none' || content === 'normal' ) {
			return false;
		}
		if ( /(^|\s)(counters?|attr)\(/.test( content ) ) {
			return true;
		}
		const strings = content.match( /"((?:[^"\\]|\\.)*)"/g ) || [];
		const text = strings
			.map( ( q ) => q.slice( 1, -1 ) )
			.join( '' )
			.replace( /\\[0-9a-f]{1,6}\s?/gi, 'x' )
			.replace( /\\(.)/g, '$1' );
		return text.replace( /\s+/g, '' ).length > 0;
	};
	const pseudoPoint = ( el, ps, pseudo ) => {
		const r = el.getBoundingClientRect();
		const cs = getComputedStyle( el );
		if ( ps.position === 'absolute' || ps.position === 'fixed' ) {
			const w = parseFloat( ps.width ) || 0;
			const h = parseFloat( ps.height ) || 0;
			const L = parseFloat( ps.left );
			const T = parseFloat( ps.top );
			const R = parseFloat( ps.right );
			const B = parseFloat( ps.bottom );
			let x = r.left + r.width / 2;
			let y = r.top + r.height / 2;
			if ( ! isNaN( L ) ) {
				x = r.left + L + w / 2;
			} else if ( ! isNaN( R ) ) {
				x = r.right - R - w / 2;
			}
			if ( ! isNaN( T ) ) {
				y = r.top + T + h / 2;
			} else if ( ! isNaN( B ) ) {
				y = r.bottom - B - h / 2;
			}
			return { x, y, approx: getComputedStyle( el ).position === 'static' };
		}
		const lh = parseFloat( cs.lineHeight ) || parseFloat( cs.fontSize ) * 1.2 || 16;
		if ( pseudo === '::marker' ) {
			return { x: r.left - 8, y: r.top + Math.min( r.height, lh ) / 2, approx: true };
		}
		if ( pseudo === '::before' ) {
			return { x: r.left + ( parseFloat( cs.paddingLeft ) || 0 ) + ( parseFloat( cs.borderLeftWidth ) || 0 ) + 3, y: r.top + ( parseFloat( cs.paddingTop ) || 0 ) + ( parseFloat( cs.borderTopWidth ) || 0 ) + Math.min( r.height, lh ) / 2, approx: false };
		}
		return { x: r.right - ( parseFloat( cs.paddingRight ) || 0 ) - ( parseFloat( cs.borderRightWidth ) || 0 ) - 3, y: r.bottom - ( parseFloat( cs.paddingBottom ) || 0 ) - ( parseFloat( cs.borderBottomWidth ) || 0 ) - Math.min( r.height, lh ) / 2, approx: true };
	};
	W.pseudoText = () => {
		const out = [];
		W.roots().forEach( ( root ) => {
			[ root, ...root.querySelectorAll( '*' ) ].forEach( ( el ) => {
				if ( el.matches( 'script, style, template, svg, svg *, img, input, select, textarea, video, audio, iframe, canvas, br, hr' ) || W.isSrOnly( el ) || ! W.isVisible( el ) ) {
					return;
				}
				[ '::before', '::after', '::marker' ].forEach( ( pseudo ) => {
					const ps = getComputedStyle( el, pseudo );
					let content = ps.content;
					if ( pseudo === '::marker' ) {
						const lst = getComputedStyle( el ).listStyleType;
						if ( getComputedStyle( el ).display !== 'list-item' || ! lst || lst === 'none' || /^(disc|circle|square|disclosure)/.test( lst ) ) {
							return;
						}
						content = 'counter(list-item) /* ' + lst + ' */';
					}
					if ( ! pseudoIsText( content ) || ps.display === 'none' || ps.visibility === 'hidden' || parseFloat( ps.fontSize ) < 1 ) {
						return;
					}
					const op = ( parseFloat( ps.opacity ) || 0 ) * W.opacity( el );
					const fg = W.parseColor( ps.color );
					if ( op < 0.05 || ! fg || fg[ 3 ] === 0 ) {
						return;
					}
					const restore = W.reveal( el );
					let pt;
					let base;
					try {
						if ( ! W.inClip( el ) ) {
							return; // scrolled out of its scroller: not measured against the page behind
						}
						pt = pseudoPoint( el, ps, pseudo );
						base = W.bgAt( pt.x, pt.y, { from: el } );
					} finally {
						restore();
					}
					let cands = base.cands;
					let kind = base.kind;
					const own = W.parseColor( ps.backgroundColor );
					if ( own && own[ 3 ] > 0 ) {
						const c = [ own[ 0 ], own[ 1 ], own[ 2 ], own[ 3 ] * op ];
						cands = cands.map( ( b ) => W.over( c, b ) );
						if ( c[ 3 ] >= 0.995 ) {
							kind = 'solid';
							cands = [ c.slice( 0, 3 ).concat( 1 ) ];
						}
					}
					const ownImg = ps.backgroundImage && ps.backgroundImage !== 'none' && /gradient\(/.test( ps.backgroundImage ) ? W.gradientStops( ps.backgroundImage ) : [];
					if ( ownImg.length ) {
						const next = [];
						cands.forEach( ( b ) => ownImg.forEach( ( g ) => next.push( W.over( [ g[ 0 ], g[ 1 ], g[ 2 ], g[ 3 ] * op ], b ) ) ) );
						cands = next;
						kind = kind === 'image' ? 'image' : 'gradient';
					}
					const fgA = [ fg[ 0 ], fg[ 1 ], fg[ 2 ], fg[ 3 ] * op ];
					const c = W.contrastOver( fgA, { cands } );
					const px = parseFloat( ps.fontSize );
					const large = px >= 24 || ( parseInt( ps.fontWeight, 10 ) >= 700 && px >= 18.66 );
					const need = large ? 3 : 4.5;
					out.push( {
						selector: W.selector( el ) + pseudo,
						block: W.blockOf( el ),
						content: content.slice( 0, 60 ),
						fg: W.hex( fgA ),
						bg: cands.map( W.hex ).slice( 0, 4 ).join( ' / ' ),
						kind,
						ratio: c.min,
						best: c.max,
						need,
						large,
						fontSize: ps.fontSize,
						approx: pt.approx,
						ok: c.min >= need,
					} );
				} );
			} );
		} );
		window.scrollTo( 0, 0 );
		return out;
	};

	/* ── axe in the page, nodes filtered to werun blocks ─────────────── */
	W.axe = async ( tags, opts = {} ) => {
		if ( ! window.axe ) {
			return { error: 'axe not loaded' };
		}
		const res = await window.axe.run( document, {
			runOnly: { type: 'tag', values: tags },
			resultTypes: [ 'violations', 'incomplete' ],
			elementRef: true,
			iframes: false,
			rules: opts.rules || {},
		} );
		const map = ( list, kind ) =>
			list
				.map( ( r ) => ( {
					id: r.id,
					impact: r.impact,
					help: r.help,
					helpUrl: r.helpUrl,
					tags: r.tags.filter( ( t ) => /^wcag\d|best-practice|^cat\./.test( t ) ),
					nodes: r.nodes
						.filter( ( n ) => n.element && W.inWerun( n.element ) )
						.map( ( n ) => {
							const data = ( n.any[ 0 ] && n.any[ 0 ].data ) || ( n.all[ 0 ] && n.all[ 0 ].data ) || ( n.none[ 0 ] && n.none[ 0 ].data ) || null;
							const node = {
								selector: W.selector( n.element ),
								block: W.blockOf( n.element ),
								snippet: W.snippet( n.element ),
								impact: n.impact,
								message: ( n.any.concat( n.all, n.none ).map( ( c ) => c.message ).filter( Boolean )[ 0 ] || n.failureSummary || '' ).slice( 0, 300 ),
								data: data && typeof data === 'object' ? JSON.parse( JSON.stringify( data ) ) : data,
							};
							if ( r.id === 'color-contrast' || r.id === 'color-contrast-enhanced' ) {
								try {
									node.computed = W.textContrast( n.element );
								} catch ( e ) {
									node.computed = { error: String( e ) };
								}
							}
							return node;
						} ),
				} ) )
				.filter( ( r ) => r.nodes.length );
		window.scrollTo( 0, 0 );
		return { violations: map( res.violations, 'violation' ), incomplete: map( res.incomplete, 'incomplete' ) };
	};
} )();
