/**
 * Query block, editor. The canvas shows the server's own markup
 * (POST wrbc/v1/query/preview → Renderer), so it matches the page exactly;
 * the sidebar is the visual query builder.
 */
import { __, sprintf } from '@wordpress/i18n';
import { InspectorControls, useBlockProps } from '@wordpress/block-editor';
import { Button, Notice, Spinner } from '@wordpress/components';
import { getBlockVariations } from '@wordpress/blocks';
import { useDispatch, useSelect } from '@wordpress/data';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { RawHTML, useEffect, useMemo, useRef, useState } from '@wordpress/element';
import { cssVars, cx, px, SectionHeader, SectionHeaderPanel } from '../shared/controls';
import { accentVars, blockColors, toneClass, useContextBackground, useSurface } from '../shared/contrast';
import { ContrastAudit } from '../shared/a11y';
import { preview, useMetaKeys, useSources } from './api';
import { auditLabels, cardColors, withoutTextColor } from './colors';
import { CarouselPanel } from './controls';
import { effectiveType, suggestType, SUGGEST, withDefaults } from './constants';
import { LimitsPanel, MetaPanel, OrderPanel, SourcePanel, TaxPanel } from './panels-query';
import { CardPanel, ColorsPanel, FiltersPanel, headerTitleLevel, LayoutPanel, MapPanel, PaginationPanel } from './panels-display';

/**
 * The items the editor picked (the block's content): a transform to another
 * variation keeps them while the source stays the same type. The variation
 * owns the type, order, upcoming window, number of items and related terms.
 */
const KEEP_ON_TRANSFORM = [ 'mode', 'include', 'taxQuery', 'metaQuery', 'exclude', 'excludeCurrent', 'author', 'sticky', 'hasImage', 'parent', 'search', 'passwordPosts' ];

/** Attributes the preview doesn't depend on (the header is edited in the canvas). */
const HEADER_KEYS = [ 'showHeader', 'showEyebrow', 'showIntro', 'eyebrow', 'title', 'intro', 'headerAlign', 'titleLevel' ];

const all = ( metaKeys ) => [ ...( metaKeys?.registered || [] ), ...( metaKeys?.detected || [] ) ];
const findKey = ( metaKeys, re, guesses ) => all( metaKeys ).find( ( e ) => re.test( e.key ) && ( ! guesses || guesses.includes( e.guess ) ) )?.key || '';

/** The stored date format from samples like 20261231, 2026-12-31 or a timestamp. */
function sampleFormat( metaKeys, key ) {
	const sample = all( metaKeys ).find( ( e ) => e.key === key )?.samples?.[ 0 ] || '';
	if ( /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test( sample ) ) {
		return 'Y-m-d H:i:s';
	}
	if ( /^\d{4}-\d{2}-\d{2}$/.test( sample ) ) {
		return 'Y-m-d';
	}
	if ( /^\d{9,11}$/.test( sample ) ) {
		return 'timestamp';
	}
	return 'Ymd';
}

export default function Edit( { attributes, setAttributes, clientId, name } ) {
	const a = attributes;
	const uid = `wrbc-query-${ clientId.slice( 0, 8 ) }`;
	const query = withDefaults( a.query );
	const setQuery = ( patch ) => setAttributes( { query: { ...( a.query || {} ), ...patch } } );

	const sources = useSources();
	const types = sources.data?.types || [];
	const typeName = effectiveType( a.query, a.variant, types );
	const source = types.find( ( t ) => t.name === typeName );
	const metaKeys = useMetaKeys( source?.name ).data;
	const postId = useSelect( ( select ) => select( 'core/editor' )?.getCurrentPostId?.() || 0, [] );

	// Transform to variation (WordPress replaces the whole query attribute):
	// put back the picked items and rules when the source type didn't change.
	const { __unstableMarkNextChangeAsNotPersistent: notPersistent } = useDispatch( blockEditorStore );
	const previous = useRef( null );
	useEffect( () => {
		const prev = previous.current;
		previous.current = { variant: a.variant, query: a.query, type: sources.data ? typeName : '' };
		// A transform to another variation changes the variant (only variations set it).
		const variation = getBlockVariations( 'werun-community/query', 'transform' )?.find( ( v ) => v.name === a.variant );
		const transformed = prev && prev.variant !== a.variant;
		if ( ! transformed || ! sources.data || ! prev.type ) {
			return;
		}
		// "Custom query" keeps the whole query: pin the type the block was showing,
		// or an empty postType would fall back to posts (no suggestion for custom).
		if ( ! variation?.attributes?.query && ! a.query?.postType && prev.type !== typeName ) {
			if ( notPersistent ) {
				notPersistent();
			}
			setAttributes( { query: { ...( a.query || {} ), postType: prev.type } } );
			return;
		}
		if ( prev.type !== typeName ) {
			return;
		}
		const keep = {};
		KEEP_ON_TRANSFORM.forEach( ( k ) => {
			if ( prev.query && prev.query[ k ] !== undefined && JSON.stringify( prev.query[ k ] ) !== JSON.stringify( a.query?.[ k ] ) ) {
				keep[ k ] = prev.query[ k ];
			}
		} );
		if ( Object.keys( keep ).length ) {
			if ( keep.mode === 'handpicked' ) {
				keep.orderBy = 'post__in';
			}
			if ( notPersistent ) {
				notPersistent();
			}
			setAttributes( { query: { ...( a.query || {} ), ...keep } } );
		}
	}, [ a.variant, a.query, typeName, sources.data ] ); // eslint-disable-line react-hooks/exhaustive-deps

	// A variation's keys, picked once from the fields the type really has.
	useEffect( () => {
		if ( ! metaKeys ) {
			return;
		}
		if ( a.variant === 'events' && query.orderBy === 'upcoming' && ! query.upcoming?.startKey ) {
			const startKey = findKey( metaKeys, /start|begin|(^|_)date$/i, [ 'date', 'numeric' ] );
			if ( startKey ) {
				const endKey = findKey( metaKeys, /end|finish/i, [ 'date', 'numeric' ] );
				setQuery( { upcoming: { ...query.upcoming, startKey, endKey, format: sampleFormat( metaKeys, startKey ) } } );
			}
		}
		const map = a.map || {};
		if ( a.layout === 'map' && ! map.combinedKey && ! map.latKey ) {
			const combinedKey = all( metaKeys ).find( ( e ) => e.guess === 'latlng' )?.key || '';
			const latKey = findKey( metaKeys, /^(lat|latitude)$|_lat(itude)?$/i );
			const lngKey = findKey( metaKeys, /^(lng|lon|long|longitude)$|_(lng|lon|longitude)$/i );
			const addressKey = map.addressKey || findKey( metaKeys, /address/i, [ 'text' ] );
			if ( latKey && lngKey ) {
				setAttributes( { map: { ...map, latKey, lngKey, addressKey } } );
			} else if ( combinedKey ) {
				setAttributes( { map: { ...map, combinedKey, addressKey } } );
			}
		}
		const fields = a.card?.fields || [];
		if ( a.variant === 'resources' && ! fields.some( ( f ) => f.type === 'meta' && [ 'file', 'download' ].includes( f.format ) ) ) {
			// The gate's own field first: includes/gate unlocks the file it names.
			const key = all( metaKeys ).find( ( e ) => e.key === '_wrbc_download_id' && e.count > 0 )?.key || all( metaKeys ).find( ( e ) => e.guess === 'attachment' )?.key;
			if ( key ) {
				setAttributes( { card: { ...a.card, fields: [ ...fields, { type: 'meta', key, format: 'download', label: '', prefix: '', suffix: '', decimals: 0, dateFormat: '' } ] } } );
			}
		}
	}, [ metaKeys ] ); // eslint-disable-line react-hooks/exhaustive-deps

	// Server preview, debounced. The header's texts don't change the cards, only
	// whether it has a title and its level do (card heading levels follow it).
	const previewKey = useMemo( () => {
		const keep = { ...a };
		HEADER_KEYS.forEach( ( k ) => delete keep[ k ] );
		const level = headerTitleLevel( a );
		Object.assign( keep, { showHeader: level > 0, title: level ? '-' : '', titleLevel: level || 2 } );
		return JSON.stringify( keep );
	}, [ a ] );
	const [ html, setHtml ] = useState( '' );
	const [ total, setTotal ] = useState( null );
	const [ busy, setBusy ] = useState( true );
	const [ error, setError ] = useState( '' );
	const request = useRef( 0 );
	useEffect( () => {
		const id = ++request.current;
		setBusy( true );
		const timer = setTimeout( () => {
			preview( JSON.parse( previewKey ), postId, uid ).then(
				( res ) => {
					if ( id === request.current ) {
						setHtml( res.html || '' );
						setTotal( res.total );
						setError( '' );
						setBusy( false );
					}
				},
				( err ) => {
					if ( id === request.current ) {
						setError( err?.message || __( 'The preview could not be loaded.', 'werun-blocks-community' ) );
						setBusy( false );
					}
				}
			);
		}, 350 );
		return () => clearTimeout( timer );
	}, [ previewKey, postId ] ); // eslint-disable-line react-hooks/exhaustive-deps

	// Same classes and custom properties as render.php: what the block sits on
	// (its own background or the one around it), its accent made readable
	// there, and the cards' own colours (cardColors() = Renderer::card_colors()).
	const card = a.card || {};
	const cardStyle = [ 'plain', 'bordered', 'filled', 'shadow' ].includes( card.style ) ? card.style : 'bordered';
	const surface = useSurface( clientId, a, name );
	const around = useContextBackground( clientId );
	const cards = cardColors( a, cardStyle, surface );
	const ref = useRef();
	const blockProps = useBlockProps( {
		ref,
		className: cx(
			'wrbc-root wrbc-query',
			`wrbc-query--${ a.layout || 'grid' }`,
			`wrbc-query--${ cardStyle }`,
			`wrbc-query--variant-${ a.variant || 'posts' }`,
			`wrbc-query--link-${ card.link || 'card' }`,
			toneClass( surface, around ),
			cards.className,
			busy && 'is-loading'
		),
		style: cssVars( {
			...accentVars( a, surface ),
			'--wrbc-cols-d': Math.max( 1, Math.min( 4, a.columnsDesktop || 3 ) ),
			'--wrbc-cols-t': Math.max( 1, Math.min( 4, a.columnsTablet || 2 ) ),
			'--wrbc-cols-m': Math.max( 1, Math.min( 2, a.columnsMobile || 1 ) ),
			'--wrbc-gap': px( Math.max( 0, Math.min( 64, a.gap ?? 24 ) ) ),
			'--wrbc-card-bg': a.cardBg,
			'--wrbc-card-border': a.cardBorderColor,
			'--wrbc-radius': px( Math.max( 0, Math.min( 40, a.cardRadius ?? 14 ) ) ),
			'--wrbc-marker': a.map?.markerColor,
			...cards.vars,
		} ),
	} );

	// Empty or missing type: suggest one by name.
	let notice = null;
	if ( sources.data ) {
		const variantSuggestion = SUGGEST[ a.variant ] ? suggestType( a.variant, types.filter( ( t ) => t.count > 0 ) ) : '';
		const better = types.find( ( t ) => t.name === variantSuggestion && t.name !== typeName );
		if ( ! source ) {
			// The chosen type is gone (or not public any more): the page shows nothing
			// (Config::normalize() drops it). Offer the variant's suggestion when there is one.
			const fallback = types.find( ( t ) => t.name === suggestType( a.variant, types ) );
			let message = __( 'Choose a source in the sidebar.', 'werun-blocks-community' );
			if ( typeName ) {
				/* translators: %s: post type name */
				message = sprintf( __( 'The source “%s” isn’t available on this site any more: nothing is shown. Choose another one in the sidebar.', 'werun-blocks-community' ), typeName );
			} else if ( SUGGEST[ a.variant ] ) {
				/* translators: %s: words looked for, e.g. "team, staff, people, member" */
				message = sprintf( __( 'No post type named like %s was found on this site. Choose a source in the sidebar.', 'werun-blocks-community' ), SUGGEST[ a.variant ].join( ', ' ) );
			}
			notice = (
				<Notice status="warning" isDismissible={ false }>
					{ message }{ ' ' }
					{ typeName && fallback && (
						<Button variant="link" onClick={ () => setQuery( { postType: fallback.name } ) }>
							{ /* translators: %s: post type name */ sprintf( __( 'Use %s', 'werun-blocks-community' ), fallback.label ) }
						</Button>
					) }
				</Notice>
			);
		} else if ( source.count === 0 ) {
			notice = (
				<Notice status="info" isDismissible={ false }>
					{ /* translators: %s: post type name */ sprintf( __( '%s has no published items yet.', 'werun-blocks-community' ), source.label ) }{ ' ' }
					{ better && (
						<Button variant="link" onClick={ () => setQuery( { postType: better.name } ) }>
							{ /* translators: %s: post type name */ sprintf( __( 'Use %s instead', 'werun-blocks-community' ), better.label ) }
						</Button>
					) }
				</Notice>
			);
		}
	}

	const stop = ( event ) => {
		if ( event.target.closest( 'a, button, input, select, form' ) ) {
			event.preventDefault();
		}
	};
	const shared = { attributes: a, setAttributes, query, setQuery, types, source, typeName, metaKeys, loading: sources.loading };

	return (
		<>
			<ContrastAudit
				blockRef={ ref }
				deps={ [ attributes, html, surface ] }
				ignore=".wrbc-query__editor-count, .components-notice"
				labels={ auditLabels() }
				checks={ [
					// Control boundaries and the "current" state, against what they sit on (WCAG 1.4.11).
					{ selector: '.wrbc-query__tools input', property: 'border-color', min: 3, label: __( 'Search field border', 'werun-blocks-community' ) },
					{ selector: '.wrbc-query__tools select', property: 'border-color', min: 3, label: __( 'Sort menu border', 'werun-blocks-community' ) },
					{ selector: '.wrbc-query__chip[aria-current="true"]', property: 'border-color', min: 3, label: __( 'Selected filter', 'werun-blocks-community' ) },
					{ selector: '.wrbc-query__page.is-current', property: 'border-color', min: 3, label: __( 'Current page', 'werun-blocks-community' ) },
				] }
				actions={ blockColors( a ).text ? [ { label: __( 'Use the automatic text colour', 'werun-blocks-community' ), onClick: () => setAttributes( withoutTextColor( a ) ) } ] : [] }
			/>
			<InspectorControls>
				<SourcePanel { ...shared } />
				<TaxPanel { ...shared } />
				<MetaPanel { ...shared } />
				<OrderPanel { ...shared } />
				<LimitsPanel { ...shared } />
				<CardPanel { ...shared } />
				<LayoutPanel { ...shared } />
				{ a.layout === 'carousel' && <CarouselPanel attributes={ a } setAttributes={ setAttributes } /> }
				{ a.layout === 'map' && <MapPanel { ...shared } /> }
				<FiltersPanel { ...shared } />
				<PaginationPanel { ...shared } />
				<SectionHeaderPanel attributes={ a } setAttributes={ setAttributes } />
			</InspectorControls>
			<InspectorControls group="styles">
				<ColorsPanel attributes={ a } setAttributes={ setAttributes } />
			</InspectorControls>
			<section { ...blockProps }>
				<SectionHeader attributes={ a } setAttributes={ setAttributes } uid={ uid } />
				{ notice }
				{ error && <Notice status="error" isDismissible={ false }>{ error }</Notice> }
				{ busy && ! html && <Spinner /> }
				{ /* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- only stops links in the preview */ }
				<div className="wrbc-query__preview" onClickCapture={ stop } onSubmitCapture={ stop } aria-busy={ busy }>
					<RawHTML>{ html }</RawHTML>
				</div>
				{ total !== null && ! busy && (
					<p className="wrbc-query__editor-count">
						{ /* translators: %d: number of matching items */ sprintf( __( '%d matching items (editor only)', 'werun-blocks-community' ), total ) }
					</p>
				) }
			</section>
		</>
	);
}
