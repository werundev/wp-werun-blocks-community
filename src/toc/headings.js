/**
 * Table of contents, editor side: the headings of the blocks being edited
 * and the same options / tree rules as the page.
 * Twins: includes/toc/class-toc.php (collect, ids) and src/toc/render.php
 * (effective options, nested list).
 */
import { getBlockType } from '@wordpress/blocks';
import { decodeEntities } from '@wordpress/html-entities';

const SKIP_CLASS = 'wrbc-toc-skip';
const clamp = ( value, min, max, fallback ) => {
	const n = parseInt( value, 10 );
	return Number.isFinite( n ) ? Math.min( max, Math.max( min, n ) ) : fallback;
};

/** Effective options (render.php does the same above its markup). */
export function effective( a ) {
	const minLevel = clamp( a.minLevel, 2, 6, 2 );
	const maxLevel = clamp( a.maxLevel, minLevel, 6, Math.max( minLevel, 3 ) );
	const tocStyle = [ 'list', 'numbered', 'pills' ].includes( a.tocStyle ) ? a.tocStyle : 'list';
	const numberStyle = [ 'decimal', 'nested', 'leading-zero' ].includes( a.numberStyle ) ? a.numberStyle : 'nested';
	const depthLimit = maxLevel - minLevel + 1;
	const depth = tocStyle === 'pills' ? 1 : clamp( a.maxDepth, 1, depthLimit, Math.min( 2, depthLimit ) );
	const sticky = !! a.sticky;
	const offset = sticky ? clamp( a.stickyOffset, 0, 200, 32 ) : 0;
	const collapsible = !! a.collapsible;
	return { minLevel, maxLevel, tocStyle, numberStyle, depthLimit, depth, sticky, offset, collapsible };
}

const plain = ( html ) =>
	decodeEntities( String( html ?? '' ).replace( /<[^>]*>/g, '' ) )
		.replace( /\s+/g, ' ' )
		.trim();

/** Close to sanitize_title(): accents off, lower case, dashes. */
export function slug( text ) {
	return (
		text
			.normalize( 'NFD' )
			.replace( /[̀-ͯ]/g, '' )
			.toLowerCase()
			.replace( /[\s.]+/g, '-' )
			.replace( /[^a-z0-9_-]/g, '' )
			.replace( /-+/g, '-' )
			.replace( /^-|-$/g, '' ) || 'section'
	);
}

const hasSkip = ( className ) => String( className || '' ).split( /\s+/ ).includes( SKIP_CLASS );
const cleanAnchor = ( value ) => String( value || '' ).replace( /[^A-Za-z0-9_:.-]/g, '' );

function attr( block, key ) {
	if ( block.attributes[ key ] !== undefined ) {
		return block.attributes[ key ];
	}
	return getBlockType( block.name )?.attributes?.[ key ]?.default;
}

function walk( blocks, found ) {
	blocks.forEach( ( block ) => {
		if ( block.name === 'core/heading' ) {
			const text = plain( block.attributes.content );
			if ( text ) {
				found.push( {
					level: clamp( block.attributes.level, 1, 6, 2 ),
					text,
					id: cleanAnchor( block.attributes.anchor ),
					skip: hasSkip( block.attributes.className ),
					clientId: block.clientId,
				} );
			}
		} else if ( block.name.startsWith( 'werun-community/' ) && cleanAnchor( block.attributes.anchor ) ) {
			// Section header titles and the hero heading, when the block has an anchor (Toc::werun_heading()).
			const anchor = cleanAnchor( block.attributes.anchor );
			const type = getBlockType( block.name );
			let heading = null;
			if ( type?.attributes?.showHeader && type?.attributes?.title ) {
				if ( attr( block, 'showHeader' ) ) {
					heading = { text: plain( attr( block, 'title' ) ), level: clamp( attr( block, 'titleLevel' ), 2, 4, 2 ), id: `${ anchor }-title` };
				}
			} else if ( block.name === 'werun-community/hero' ) {
				heading = { text: plain( attr( block, 'heading' ) ), level: clamp( attr( block, 'headingLevel' ), 1, 3, 1 ), id: `${ anchor }-heading` };
			}
			if ( heading?.text ) {
				found.push( { ...heading, skip: hasSkip( block.attributes.className ), clientId: block.clientId } );
			}
		}
		if ( block.innerBlocks?.length ) {
			walk( block.innerBlocks, found );
		}
	} );
}

/** Headings of the editor's blocks with their ids (own anchor, or a unique slug). */
export function collect( blocks ) {
	const found = [];
	walk( blocks, found );
	const used = new Set( found.filter( ( h ) => h.id ).map( ( h ) => h.id ) );
	found.forEach( ( h ) => {
		if ( h.id ) {
			return;
		}
		const base = slug( h.text );
		let id = base;
		for ( let n = 2; used.has( id ); n++ ) {
			id = `${ base }-${ n }`;
		}
		used.add( id );
		h.id = id;
	} );
	return found;
}

/** The headings a TOC lists, each with its relative level (0 … depth-1). */
export function pick( headings, e ) {
	return headings
		.filter( ( h ) => ! h.skip && h.level >= e.minLevel && h.level <= e.maxLevel )
		.map( ( h ) => ( { ...h, rel: Math.min( e.depth - 1, h.level - e.minLevel ) } ) );
}

/**
 * Items as a tree; a heading opens at most one level at a time.
 * Twin of the loop in render.php.
 */
export function buildTree( items ) {
	const root = [];
	const stack = [ root ]; // stack[ n ] = the list at depth n
	items.forEach( ( item ) => {
		const level = Math.min( item.rel, stack.length - 1 );
		stack.length = level + 1;
		const node = { ...item, children: [] };
		stack[ level ].push( node );
		stack[ level + 1 ] = node.children;
	} );
	return root;
}
