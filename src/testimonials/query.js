/**
 * Testimonials from a post type, editor side: the field map, the limits the
 * block uses and the server preview of the cards.
 * Twins: src/testimonials/query.php (wrbc_testimonials_map(), the cards) and
 * includes/query/class-config.php (meta keys, limits).
 */
import { __, sprintf } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';
import { addQueryArgs } from '@wordpress/url';
import { PanelBody, RangeControl, SelectControl, ToggleControl } from '@wordpress/components';
import { useEffect, useMemo, useRef, useState } from '@wordpress/element';
import { MetaKeyControl, PostPicker } from '../query/controls';
import { META_KEY_RE } from '../query/constants';

/** Defaults of the "map" attribute (block.json). */
export const MAP_DEFAULTS = { quote: 'excerpt', name: 'title', role: '', avatar: 'featured', rating: '', words: 40 };

/** part → [ fixed choices, value when the custom field is refused ] (wrbc_testimonials_map()). */
const PARTS = {
	quote: [ [ 'excerpt', 'content' ], 'excerpt' ],
	name: [ [ 'title' ], 'title' ],
	role: [ [ '' ], '' ],
	avatar: [ [ 'featured', '' ], '' ],
	rating: [ [ '' ], '' ],
};

/** Config::SENSITIVE_RE. */
const SENSITIVE_RE = /pass|token|secret|api[_-]?key|private[_-]?key|auth[_-]?key|salt|nonce|session|credential/i;

/**
 * Whether the server will read a key (Config::meta_key_ok(), as far as the editor can tell:
 * a "_" key only when it is registered for the REST API).
 */
export function keyOk( key, metaKeys ) {
	if ( ! key || ! META_KEY_RE.test( key ) ) {
		return false;
	}
	if ( ( metaKeys?.registered || [] ).some( ( e ) => e.key === key ) ) {
		return true;
	}
	return ! key.startsWith( '_' ) && ! SENSITIVE_RE.test( key );
}

const metaKey = ( value ) => ( typeof value === 'string' && value.startsWith( 'meta:' ) ? value.slice( 5 ) : '' );

/** The effective map (twin of wrbc_testimonials_map()). */
export function normalizeMap( raw, metaKeys ) {
	const map = raw && typeof raw === 'object' ? raw : {};
	const out = {};
	Object.entries( PARTS ).forEach( ( [ part, [ fixed, refused ] ] ) => {
		const value = typeof map[ part ] === 'string' ? map[ part ] : MAP_DEFAULTS[ part ];
		if ( value.startsWith( 'meta:' ) ) {
			out[ part ] = keyOk( metaKey( value ), metaKeys ) ? value : refused;
		} else {
			out[ part ] = fixed.includes( value ) ? value : MAP_DEFAULTS[ part ];
		}
	} );
	const words = Number( map.words );
	out.words = Math.max( 5, Math.min( 80, Number.isFinite( words ) ? Math.trunc( words ) : 40 ) );
	return out;
}

/** The map without its custom fields (they belonged to another post type). */
export function resetMapKeys( raw ) {
	const map = { ...MAP_DEFAULTS, ...( raw && typeof raw === 'object' ? raw : {} ) };
	Object.keys( PARTS ).forEach( ( part ) => {
		if ( metaKey( map[ part ] ) || map[ part ] === 'meta:' ) {
			map[ part ] = MAP_DEFAULTS[ part ];
		}
	} );
	return map;
}

/** A post type with published items named like testimonials or reviews, or ''. */
export function suggestTestimonialType( types = [] ) {
	const found = types.find( ( t ) => t.count > 0 && /testimonial|review|quote/i.test( `${ t.name } ${ t.label || '' }` ) );
	return found ? found.name : '';
}

/** Attributes the cards depend on (the rest is the section around them, drawn by edit.js). */
const PREVIEW_KEYS = [ 'source', 'query', 'map', 'showRating', 'showAvatar', 'showRole', 'showQuoteIcon', 'quoteIcon', 'layout', 'reveal' ];

/**
 * The cards render.php prints, through the core block renderer
 * (/wp/v2/block-renderer, edit_posts / edit_post), debounced.
 *
 * @return {{html:string,count:number|null,busy:boolean,error:string}}
 */
export function useCardsPreview( enabled, attributes, postId ) {
	const key = useMemo( () => {
		if ( ! enabled ) {
			return '';
		}
		const keep = {};
		PREVIEW_KEYS.forEach( ( k ) => {
			if ( attributes[ k ] !== undefined ) {
				keep[ k ] = attributes[ k ];
			}
		} );
		return JSON.stringify( keep );
	}, [ enabled, attributes ] );
	const [ state, setState ] = useState( { html: '', count: null, busy: false, error: '' } );
	const request = useRef( 0 );
	useEffect( () => {
		if ( ! key ) {
			setState( { html: '', count: null, busy: false, error: '' } );
			return undefined;
		}
		const id = ++request.current;
		setState( ( s ) => ( { ...s, busy: true } ) );
		const timer = setTimeout( () => {
			apiFetch( {
				path: addQueryArgs( '/wp/v2/block-renderer/werun-community/testimonials', { context: 'edit', ...( postId ? { post_id: postId } : {} ) } ),
				method: 'POST',
				data: { attributes: JSON.parse( key ) },
			} ).then(
				( res ) => {
					if ( id !== request.current ) {
						return;
					}
					const doc = new window.DOMParser().parseFromString( res?.rendered || '', 'text/html' );
					const track = doc.querySelector( '.wrbc-testimonials__track' );
					setState( { html: track ? track.innerHTML : '', count: track ? track.children.length : 0, busy: false, error: '' } );
				},
				( err ) => {
					if ( id === request.current ) {
						setState( { html: '', count: null, busy: false, error: err?.message || __( 'The preview could not be loaded.', 'werun-blocks-community' ) } );
					}
				}
			);
		}, 350 );
		return () => clearTimeout( timer );
	}, [ key, postId ] );
	return state;
}

const sel = ( props ) => <SelectControl __nextHasNoMarginBottom __next40pxDefaultSize { ...props } />;

/** How many, and which to leave out (the parts of Builder::args() a testimonials block uses). */
export function CountPanel( { query, setQuery, source } ) {
	const handpicked = query.mode === 'handpicked';
	return (
		<PanelBody title={ __( 'Limits', 'werun-blocks-community' ) } initialOpen={ false }>
			{ ! handpicked && (
				<RangeControl
					__nextHasNoMarginBottom
					__next40pxDefaultSize
					label={ __( 'Testimonials to show', 'werun-blocks-community' ) }
					value={ query.perPage }
					min={ 1 }
					max={ query.orderBy === 'rand' ? 12 : 24 }
					onChange={ ( perPage ) => setQuery( { perPage } ) }
				/>
			) }
			{ ! handpicked && (
				<RangeControl __nextHasNoMarginBottom __next40pxDefaultSize label={ __( 'Skip the first', 'werun-blocks-community' ) } value={ query.offset } min={ 0 } max={ 50 } onChange={ ( offset ) => setQuery( { offset } ) } />
			) }
			<ToggleControl
				__nextHasNoMarginBottom
				label={ __( 'Leave out the post being viewed', 'werun-blocks-community' ) }
				checked={ !! query.excludeCurrent }
				onChange={ ( excludeCurrent ) => setQuery( { excludeCurrent } ) }
			/>
			{ ! handpicked && source && (
				<fieldset className="wrbc-query-fieldset">
					<legend>{ __( 'Always leave out', 'werun-blocks-community' ) }</legend>
					<PostPicker type={ source.name } value={ query.exclude } onChange={ ( exclude ) => setQuery( { exclude } ) } />
				</fieldset>
			) }
			<p className="wrbc-query-help">{ __( 'Password-protected items never show.', 'werun-blocks-community' ) }</p>
		</PanelBody>
	);
}

/** One part of the card: fixed choices plus "a custom field" with its key picker. */
function PartControl( { label, value, choices, onChange, metaKeys, filter, help } ) {
	const isMeta = typeof value === 'string' && value.startsWith( 'meta:' );
	const key = isMeta ? value.slice( 5 ) : '';
	return (
		<>
			{ sel( {
				label,
				value: isMeta ? 'meta' : value,
				options: [ ...choices.map( ( [ v, l ] ) => ( { value: v, label: l } ) ), { value: 'meta', label: __( 'A custom field', 'werun-blocks-community' ) } ],
				help: isMeta ? undefined : help,
				onChange: ( v ) => onChange( v === 'meta' ? 'meta:' : v ),
			} ) }
			{ isMeta && (
				<MetaKeyControl
					metaKeys={ metaKeys }
					filter={ filter }
					value={ key }
					label={ sprintf( /* translators: %s: part of the card, e.g. "Quote" */ __( '%s: custom field', 'werun-blocks-community' ), label ) }
					onChange={ ( k ) => onChange( `meta:${ k }` ) }
				/>
			) }
			{ isMeta && ! keyOk( key, metaKeys ) && (
				<p className="wrbc-query-help">
					{ key
						? __( 'This field can’t be shown (hidden or sensitive): the default is used.', 'werun-blocks-community' )
						: __( 'Pick a field; until then the default is used.', 'werun-blocks-community' ) }
				</p>
			) }
		</>
	);
}

const isNumber = ( e ) => ! e.guess || e.guess === 'numeric';
const isAttachment = ( e ) => ! e.guess || [ 'attachment', 'numeric' ].includes( e.guess );

/** Which post data fills each part of the card. Parts the cards don't show are hidden. */
export function FieldsPanel( { attributes: a, setAttributes, map, metaKeys, source } ) {
	const raw = { ...MAP_DEFAULTS, ...( a.map && typeof a.map === 'object' ? a.map : {} ) };
	const set = ( patch ) => setAttributes( { map: { ...raw, ...patch } } );
	return (
		<PanelBody title={ __( 'Fields', 'werun-blocks-community' ) } initialOpen={ false }>
			<PartControl
				label={ __( 'Quote', 'werun-blocks-community' ) }
				value={ raw.quote }
				choices={ [
					[ 'excerpt', __( 'Excerpt (or the start of the text)', 'werun-blocks-community' ) ],
					[ 'content', __( 'The text', 'werun-blocks-community' ) ],
				] }
				metaKeys={ metaKeys }
				onChange={ ( quote ) => set( { quote } ) }
			/>
			{ [ 'excerpt', 'content' ].includes( map.quote ) && (
				<RangeControl
					__nextHasNoMarginBottom
					__next40pxDefaultSize
					label={ __( 'Most words', 'werun-blocks-community' ) }
					value={ map.words }
					min={ 5 }
					max={ 80 }
					onChange={ ( words ) => set( { words } ) }
				/>
			) }
			<PartControl label={ __( 'Name', 'werun-blocks-community' ) } value={ raw.name } choices={ [ [ 'title', __( 'Title', 'werun-blocks-community' ) ] ] } metaKeys={ metaKeys } onChange={ ( name ) => set( { name } ) } />
			{ a.showRole && (
				<PartControl label={ __( 'Role and company', 'werun-blocks-community' ) } value={ raw.role } choices={ [ [ '', __( 'None', 'werun-blocks-community' ) ] ] } metaKeys={ metaKeys } onChange={ ( role ) => set( { role } ) } />
			) }
			{ a.showAvatar && (
				<PartControl
					label={ __( 'Photo', 'werun-blocks-community' ) }
					value={ raw.avatar }
					choices={ [
						[ 'featured', __( 'Featured image', 'werun-blocks-community' ) ],
						[ '', __( 'None', 'werun-blocks-community' ) ],
					] }
					help={ raw.avatar === 'featured' && source && ! source.supports?.thumbnail ? __( 'This post type has no featured image.', 'werun-blocks-community' ) : undefined }
					filter={ isAttachment }
					metaKeys={ metaKeys }
					onChange={ ( avatar ) => set( { avatar } ) }
				/>
			) }
			{ a.showRating && (
				<PartControl
					label={ __( 'Stars', 'werun-blocks-community' ) }
					value={ raw.rating }
					choices={ [ [ '', __( 'None', 'werun-blocks-community' ) ] ] }
					help={ __( 'A number field from 0 to 5.', 'werun-blocks-community' ) }
					filter={ isNumber }
					metaKeys={ metaKeys }
					onChange={ ( rating ) => set( { rating } ) }
				/>
			) }
		</PanelBody>
	);
}
