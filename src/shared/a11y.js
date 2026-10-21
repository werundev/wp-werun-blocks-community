/**
 * Contrast audit in the editor (WCAG 2.2, 1.4.3 and 1.4.11): reads the
 * colours the canvas really paints for one block — computed styles,
 * translucent layers, opacity, overlays over images — and lists the texts
 * under 4.5:1 (3:1 for large text) and the controls, focus rings and
 * meaningful icons under 3:1. The page renders the same classes and custom
 * properties, so what passes here passes there.
 *
 * <ContrastAudit blockRef={ ref } deps={ [ attributes ] } checks={ […] } actions={ […] } />
 * goes first inside the block's edit output; it renders nothing while
 * everything passes. Contract: docs/accessibility.md.
 */
import { __, sprintf } from '@wordpress/i18n';
import { useEffect, useState } from '@wordpress/element';
import { Notice } from '@wordpress/components';
import { InspectorControls } from '@wordpress/block-editor';
import { AA_LARGE, AA_TEXT, AA_UI, colorOver, colorRgba, contrastRatio, pageColors } from './contrast';

const WHITE = [ 255, 255, 255, 1 ];
const BLACK = [ 0, 0, 0, 1 ];

/** Editor UI inside a block's canvas that isn't part of the page. */
const EDITOR_UI = [
	'.block-list-appender',
	'.block-editor-inserter',
	'.block-editor-block-list__insertion-point',
	'.block-editor-default-block-appender',
	'.block-editor-warning',
	'.components-placeholder',
	'.components-button',
	'.components-popover',
	'[data-wrbc-a11y-skip]',
	'.wrbc-sr-only',
	'.screen-reader-text',
].join( ',' );

/** Children painted under an element's content: the plugin's own backdrops and core/cover's. */
const BACKDROPS = ':scope > [data-wrbc-backdrop], :scope > .wp-block-cover__background, :scope > .wp-block-cover__image-background, :scope > .wp-block-cover__video-background, :scope > .wp-block-cover__gradient-background';

function isOverlay( el ) {
	return el.dataset.wrbcBackdrop === 'overlay' || el.classList.contains( 'wp-block-cover__background' ) || el.classList.contains( 'wp-block-cover__gradient-background' );
}

/** Large text: 24 px, or 18.66 px from weight 700 (WCAG's 18 pt / 14 pt bold). */
function isLarge( style ) {
	const size = parseFloat( style.fontSize ) || 16;
	return size >= 24 || ( size >= 18.66 && ( parseInt( style.fontWeight, 10 ) || 400 ) >= 700 );
}

function visible( el, win ) {
	if ( el.checkVisibility && ! el.checkVisibility( { checkOpacity: true, checkVisibilityCSS: true, opacityProperty: true, visibilityProperty: true } ) ) {
		return false;
	}
	const rect = el.getBoundingClientRect();
	if ( rect.width < 2 || rect.height < 2 ) {
		return false;
	}
	const style = win.getComputedStyle( el );
	return style.visibility !== 'hidden' && style.display !== 'none';
}

/** Colours in a background-image gradient, [] for none, null for an image (url()). */
function gradientStops( value ) {
	if ( ! value || value === 'none' ) {
		return [];
	}
	if ( /url\(/i.test( value ) ) {
		return null;
	}
	const stops = ( value.match( /(?:rgba?|hsla?|color|oklch|oklab|lab|lch)\([^()]*\)|#[0-9a-f]{3,8}\b/gi ) || [] ).map( ( c ) => colorRgba( c, true ) ).filter( Boolean );
	return stops.length ? stops : null;
}

/**
 * What an element's text is painted on: an array of candidate opaque
 * colours — one for flat backgrounds, the stops of a gradient, or the
 * overlay over a white and a black pixel when there's an image under it.
 *
 * @param {Element} start First element whose background counts (the text's own).
 * @param {Window}  win   Canvas window.
 */
export function backdropColors( start, win ) {
	const layers = [];
	let bases = null;
	// A <caption> is drawn outside its table's box: the table's own background isn't behind it.
	const caption = start.closest ? start.closest( 'caption' ) : null;
	for ( let n = start; n && n.nodeType === 1; n = n.parentElement ) {
		if ( caption && n.tagName === 'TABLE' && n.contains( caption ) ) {
			continue;
		}
		const style = win.getComputedStyle( n );
		// Overlays and images inside this element, under its content.
		const backdrops = Array.from( n.querySelectorAll( BACKDROPS ) ).filter( ( b ) => b !== start && ! b.contains( start ) && visible( b, win ) );
		let image = false;
		// Later siblings paint over earlier ones: walk from the top one down.
		backdrops.reverse().forEach( ( b ) => {
			if ( image ) {
				return;
			}
			if ( isOverlay( b ) ) {
				const s = win.getComputedStyle( b );
				const stops = gradientStops( s.backgroundImage );
				const color = colorRgba( s.backgroundColor, true );
				const alpha = parseFloat( s.opacity );
				if ( stops && stops.length ) {
					layers.push( { stops: stops.map( ( c ) => [ c[ 0 ], c[ 1 ], c[ 2 ], c[ 3 ] * alpha ] ) } );
				} else if ( color && color[ 3 ] > 0 ) {
					layers.push( { stops: [ [ color[ 0 ], color[ 1 ], color[ 2 ], color[ 3 ] * alpha ] ] } );
				}
			} else {
				image = true;
			}
		} );
		if ( image ) {
			bases = [ WHITE, BLACK ];
			break;
		}
		const stops = gradientStops( style.backgroundImage );
		if ( stops === null ) {
			bases = [ WHITE, BLACK ];
			break;
		}
		if ( stops.length ) {
			layers.push( { stops } );
			if ( stops.every( ( c ) => c[ 3 ] >= 1 ) ) {
				bases = [];
				break;
			}
		}
		const color = colorRgba( style.backgroundColor, true );
		if ( color && color[ 3 ] > 0 ) {
			layers.push( { stops: [ color ] } );
			if ( color[ 3 ] >= 1 ) {
				bases = [];
				break;
			}
		}
	}
	if ( bases === null ) {
		bases = [ colorRgba( pageColors().background ) || WHITE ];
	}
	// Paint the layers from the bottom one up, over each base.
	let candidates = bases.length ? bases : [ null ];
	for ( let i = layers.length - 1; i >= 0; i-- ) {
		const next = [];
		candidates.forEach( ( under ) => {
			layers[ i ].stops.forEach( ( stop ) => next.push( under ? colorOver( stop, under ) : colorOver( stop, WHITE ) ) );
		} );
		candidates = next;
	}
	return candidates.filter( Boolean );
}

/** A short name for the element: its block-specific class (wrbc-cta__eyebrow → "eyebrow"), or its tag. */
function labelFor( el, labels ) {
	for ( const [ selector, label ] of Object.entries( labels || {} ) ) {
		if ( el.closest( selector ) ) {
			return label;
		}
	}
	for ( let n = el; n && n.nodeType === 1; n = n.parentElement ) {
		const cls = Array.from( n.classList ).find( ( c ) => /^wrbc-[a-z0-9-]+__[a-z0-9-]+$/.test( c ) );
		if ( cls ) {
			return cls.split( '__' )[ 1 ].replace( /-/g, ' ' );
		}
		if ( n.classList.contains( 'wrbc-root' ) ) {
			break;
		}
	}
	return el.tagName.toLowerCase();
}

/** Opacity of an element and its ancestors up to (not including) `stop`. */
function opacityUpTo( el, stop, win ) {
	let alpha = 1;
	for ( let n = el; n && n !== stop && n.nodeType === 1; n = n.parentElement ) {
		alpha *= parseFloat( win.getComputedStyle( n ).opacity );
	}
	return alpha;
}

function worst( fg, candidates ) {
	let ratio = Infinity;
	let bg = null;
	candidates.forEach( ( c ) => {
		const r = contrastRatio( fg, c );
		if ( r < ratio ) {
			ratio = r;
			bg = c;
		}
	} );
	return { ratio, bg };
}

/**
 * Scans a block's canvas element.
 *
 * @param {Element} root            The block's element in the canvas.
 * @param {Object}  options
 * @param {Array}   options.checks  Extra checks: { selector, property ('border-color' | 'background-color' | 'color' | 'stroke' | 'fill' | 'outline-color' | 'box-shadow' (its first colour)), pseudo ('::before'…), min (3 for non-text, 4.5 for text a pseudo-element draws), label, against: 'parent' (default: what's around the element) | 'self' (the element's own background) | 'pseudo' (the pseudo-element's own background over the element's) }.
 * @param {string}  options.ignore  Selector of parts to leave out (decorative text, logos).
 * @param {Object}  options.labels  Selector → name for the list.
 * @return {Array} Issues, worst first: { key, label, ratio, min, sample, kind }.
 */
export function scanContrast( root, { checks = [], ignore = '', labels = {} } = {} ) {
	const doc = root.ownerDocument;
	const win = doc.defaultView;
	const issues = new Map();
	const add = ( issue ) => {
		const found = issues.get( issue.key );
		if ( ! found || issue.ratio < found.ratio ) {
			issues.set( issue.key, { ...issue, count: ( found ? found.count : 0 ) + 1 } );
		} else {
			found.count++;
		}
	};

	const seen = new Set();
	const walker = doc.createTreeWalker( root, win.NodeFilter.SHOW_TEXT, {
		acceptNode: ( node ) => ( node.nodeValue.trim() ? win.NodeFilter.FILTER_ACCEPT : win.NodeFilter.FILTER_REJECT ),
	} );
	for ( let node = walker.nextNode(); node; node = walker.nextNode() ) {
		const el = node.parentElement;
		if ( ! el || seen.has( el ) ) {
			continue;
		}
		seen.add( el );
		if ( el.closest( EDITOR_UI ) || ( ignore && el.closest( ignore ) ) || ! visible( el, win ) ) {
			continue;
		}
		const style = win.getComputedStyle( el );
		const fg = colorRgba( style.color, true );
		if ( ! fg ) {
			continue;
		}
		const candidates = backdropColors( el, win );
		const alpha = opacityUpTo( el, root.parentElement, win );
		const { ratio } = worst( [ fg[ 0 ], fg[ 1 ], fg[ 2 ], fg[ 3 ] * alpha ], candidates );
		const min = isLarge( style ) ? AA_LARGE : AA_TEXT;
		if ( ratio < min ) {
			const label = labelFor( el, labels );
			add( { key: 'text|' + label + '|' + min, kind: 'text', label, ratio, min, sample: node.nodeValue.trim().replace( /\s+/g, ' ' ).slice( 0, 40 ), overImage: candidates.length > 1 } );
		}
	}

	checks.forEach( ( check ) => {
		root.querySelectorAll( check.selector ).forEach( ( el ) => {
			if ( el.closest( EDITOR_UI ) || ! visible( el, win ) ) {
				return;
			}
			const style = win.getComputedStyle( el, check.pseudo || null );
			const prop = check.property || 'border-color';
			let value = prop === 'border-color' ? style.borderTopColor : style.getPropertyValue( prop );
			if ( prop === 'box-shadow' ) {
				// The first colour of the shadow list (a ring drawn with a spread shadow).
				const found = String( value ).match( /(?:rgba?|color|oklch|oklab|lab|lch|hsla?)\([^()]*\)|#[0-9a-f]{3,8}\b/i );
				value = found ? found[ 0 ] : '';
			}
			const color = colorRgba( value, true );
			if ( ! color || color[ 3 ] === 0 ) {
				return;
			}
			const alpha = parseFloat( style.opacity ) * opacityUpTo( el.parentElement, root.parentElement, win );
			let candidates = backdropColors( check.against === 'self' || check.against === 'pseudo' ? el : el.parentElement, win );
			if ( check.against === 'pseudo' && check.pseudo ) {
				// Text drawn by a pseudo-element on its own background (a counter in a marker).
				const own = colorRgba( style.backgroundColor, true );
				if ( own && own[ 3 ] > 0 ) {
					candidates = candidates.map( ( under ) => colorOver( own, under ) );
				}
			}
			const { ratio } = worst( [ color[ 0 ], color[ 1 ], color[ 2 ], color[ 3 ] * alpha ], candidates );
			const min = check.min || AA_UI;
			if ( ratio < min ) {
				const label = check.label || labelFor( el, labels );
				add( { key: 'ui|' + label, kind: 'ui', label, ratio, min, sample: '' } );
			}
		} );
	} );

	return Array.from( issues.values() ).sort( ( a, b ) => a.ratio - b.ratio );
}

/**
 * Re-scans a block when its attributes change or its canvas DOM does
 * (inner blocks, typing), debounced.
 *
 * @param {Object} blockRef Ref to the block's element (useBlockProps( { ref } )).
 * @param {Array}  deps     Usually [ attributes ].
 * @param {Object} options  scanContrast() options.
 */
export function useContrastIssues( blockRef, deps, options ) {
	const [ issues, setIssues ] = useState( [] );
	useEffect( () => {
		const root = blockRef && blockRef.current;
		if ( ! root || ! root.ownerDocument || ! root.ownerDocument.defaultView ) {
			return undefined;
		}
		const win = root.ownerDocument.defaultView;
		let timer = 0;
		const run = () => {
			win.clearTimeout( timer );
			timer = win.setTimeout( () => {
				try {
					const found = scanContrast( root, options );
					setIssues( ( prev ) => ( JSON.stringify( prev ) === JSON.stringify( found ) ? prev : found ) );
				} catch ( e ) {
					setIssues( [] );
				}
			}, 350 );
		};
		run();
		const observer = new win.MutationObserver( run );
		observer.observe( root, { subtree: true, childList: true, attributes: true, attributeFilter: [ 'class', 'style', 'hidden' ], characterData: true } );
		return () => {
			win.clearTimeout( timer );
			observer.disconnect();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, deps );
	return issues;
}

/**
 * The warning in the block's sidebar: nothing while everything passes.
 *
 * @param {Object} props
 * @param {Object} props.blockRef Ref to the block's element.
 * @param {Array}  props.deps     Re-scan when these change (usually [ attributes ]).
 * @param {Array}  props.checks   Non-text checks (scanContrast()).
 * @param {string} props.ignore   Selector of parts to leave out.
 * @param {Object} props.labels   Selector → name.
 * @param {Array}  props.actions  One-click fixes: { label, onClick } (shown only with issues).
 */
export function ContrastAudit( { blockRef, deps = [], checks = [], ignore = '', labels = {}, actions = [] } ) {
	const issues = useContrastIssues( blockRef, deps, { checks, ignore, labels } );
	if ( ! issues.length ) {
		return null;
	}
	const shown = issues.slice( 0, 6 );
	return (
		<InspectorControls>
			<div className="wrbc-contrast-audit">
				<Notice
					status="warning"
					isDismissible={ false }
					actions={ actions.filter( Boolean ).map( ( action ) => ( { variant: 'secondary', ...action } ) ) }
				>
					<p className="wrbc-contrast-audit__title">{ __( 'Low contrast (WCAG AA)', 'werun-blocks-community' ) }</p>
					<ul className="wrbc-contrast-audit__list">
						{ shown.map( ( issue ) => (
							<li key={ issue.key }>
								{ sprintf(
									/* translators: 1: part of the block (e.g. "eyebrow"), 2: contrast ratio, 3: required ratio. */
									__( '%1$s: %2$s:1, needs %3$s:1', 'werun-blocks-community' ),
									issue.label,
									( Math.floor( issue.ratio * 100 ) / 100 ).toFixed( 2 ),
									issue.min
								) }
								{ issue.sample && <span className="wrbc-contrast-audit__sample">{ ` “${ issue.sample }”` }</span> }
								{ issue.overImage && <span className="wrbc-contrast-audit__sample">{ ' ' + __( '(over an image: checked against its lightest and darkest pixels)', 'werun-blocks-community' ) }</span> }
							</li>
						) ) }
					</ul>
					{ issues.length > shown.length && (
						<p className="wrbc-contrast-audit__more">
							{ sprintf(
								/* translators: %d: number of other low-contrast parts. */
								__( 'And %d more.', 'werun-blocks-community' ),
								issues.length - shown.length
							) }
						</p>
					) }
				</Notice>
			</div>
		</InspectorControls>
	);
}
