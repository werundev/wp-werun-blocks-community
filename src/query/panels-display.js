/**
 * Display panels: card fields, layout, map, visitor filters, pagination,
 * colours. Conditions mirror View::from_attributes() and Renderer.
 */
import { __, sprintf } from '@wordpress/i18n';
import {
	CheckboxControl,
	ColorPalette,
	PanelBody,
	RangeControl,
	SelectControl,
	TextControl,
	ToggleControl,
} from '@wordpress/components';
import { PanelColorSettings } from '@wordpress/block-editor';
import { useSelect } from '@wordpress/data';
import { useState } from '@wordpress/element';
import { Choice, ResponsiveColumns } from '../shared/controls';
import { MetaKeyControl, RuleRows } from './controls';
import { effectivePagination, FIELD_TYPES, FORMATS, guessFormat, MAX_FIELDS, RATIOS, SORTS } from './constants';
import { markerShown } from './colors';

const sel = ( props ) => <SelectControl __nextHasNoMarginBottom __next40pxDefaultSize { ...props } />;
const text = ( props ) => <TextControl __nextHasNoMarginBottom __next40pxDefaultSize { ...props } />;
const toggle = ( props ) => <ToggleControl __nextHasNoMarginBottom { ...props } />;
const range = ( props ) => <RangeControl __nextHasNoMarginBottom __next40pxDefaultSize { ...props } />;

const fieldName = ( type ) => FIELD_TYPES.find( ( [ v ] ) => v === type )?.[ 1 ] || type;

/**
 * Level of the section title the block prints, or 0 (twin of
 * Renderer::header_level()): card titles then sit one level below it.
 */
export function headerTitleLevel( attributes ) {
	const title = String( attributes.title || '' ).replace( /<[^>]*>/g, '' ).trim();
	if ( attributes.showHeader === false || ! title ) {
		return 0;
	}
	return Math.max( 2, Math.min( 4, Number( attributes.titleLevel ) || 2 ) );
}

/** Defaults of a new field (View::fields()). */
function newField( type, source ) {
	switch ( type ) {
		case 'title':
			return { type, level: 3 };
		case 'date':
			return { type, source: 'published', dateFormat: '' };
		case 'excerpt':
			return { type, words: 20 };
		case 'terms':
			return { type, taxonomy: source?.taxonomies?.[ 0 ]?.name || '', max: 3, link: false };
		case 'author':
			return { type, avatar: false };
		case 'meta':
			return { type, key: '', format: 'text', label: '', prefix: '', suffix: '', decimals: 0, dateFormat: '' };
		case 'readingTime':
			return { type, wpm: 200 };
		default:
			return { type };
	}
}

function FieldOptions( { field, update, source, metaKeys, attributes, setAttributes } ) {
	// A protected download prints the gate button instead of the file link (Renderer::meta()).
	const gated = field.format === 'download' && !! attributes.gate?.enabled;
	switch ( field.type ) {
		case 'title': {
			// With a section title the level follows it (Renderer::title_levels()).
			const headerLevel = headerTitleLevel( attributes );
			if ( headerLevel ) {
				return (
					<p className="wrbc-query-help">
						{ sprintf(
							/* translators: 1: card heading level, e.g. 3; 2: section title level, e.g. 2 */
							__( 'Heading level H%1$d: one below the section title (H%2$d), so the page outline stays in order.', 'werun-blocks-community' ),
							headerLevel + 1,
							headerLevel
						) }
					</p>
				);
			}
			return sel( {
				label: __( 'Heading level', 'werun-blocks-community' ),
				value: String( field.level || 3 ),
				options: [ 2, 3, 4, 5, 6 ].map( ( n ) => ( { value: String( n ), label: `H${ n }` } ) ),
				onChange: ( v ) => update( { level: Number( v ) } ),
			} );
		}
		case 'date':
			return (
				<>
					<Choice
						label={ __( 'Date', 'werun-blocks-community' ) }
						value={ field.source || 'published' }
						options={ [
							[ 'published', __( 'Published', 'werun-blocks-community' ) ],
							[ 'modified', __( 'Updated', 'werun-blocks-community' ) ],
						] }
						onChange={ ( v ) => update( { source: v } ) }
					/>
					{ text( { label: __( 'Format (PHP date, empty = site format)', 'werun-blocks-community' ), value: field.dateFormat || '', placeholder: 'j F Y', onChange: ( v ) => update( { dateFormat: v } ) } ) }
				</>
			);
		case 'excerpt':
			return range( { label: __( 'Words', 'werun-blocks-community' ), value: field.words || 20, min: 5, max: 80, onChange: ( v ) => update( { words: v } ) } );
		case 'terms':
			return (
				<>
					{ sel( {
						label: __( 'Taxonomy', 'werun-blocks-community' ),
						value: field.taxonomy,
						options: ( source?.taxonomies || [] ).map( ( t ) => ( { value: t.name, label: t.label } ) ),
						onChange: ( v ) => update( { taxonomy: v } ),
					} ) }
					{ range( { label: __( 'Most terms', 'werun-blocks-community' ), value: field.max || 3, min: 1, max: 10, onChange: ( v ) => update( { max: v } ) } ) }
					{ toggle( { label: __( 'Link each term to its archive', 'werun-blocks-community' ), checked: !! field.link, onChange: ( v ) => update( { link: v } ) } ) }
				</>
			);
		case 'author':
			return toggle( { label: __( 'Show the avatar', 'werun-blocks-community' ), checked: !! field.avatar, onChange: ( v ) => update( { avatar: v } ) } );
		case 'readingTime':
			return range( { label: __( 'Words per minute', 'werun-blocks-community' ), value: field.wpm || 200, min: 100, max: 400, step: 10, onChange: ( v ) => update( { wpm: v } ) } );
		case 'button':
			return text( { label: __( 'Button text', 'werun-blocks-community' ), value: attributes.buttonText, onChange: ( buttonText ) => setAttributes( { buttonText } ) } );
		case 'meta': {
			const format = field.format || 'text';
			return (
				<>
					<MetaKeyControl
						metaKeys={ metaKeys }
						value={ field.key }
						onChange={ ( key, entry ) => update( { key, ...( entry?.guess ? { format: guessFormat( entry.guess ) } : {} ) } ) }
					/>
					{ sel( {
						label: __( 'Show as', 'werun-blocks-community' ),
						value: format,
						options: FORMATS.map( ( [ value, label ] ) => ( { value, label } ) ),
						onChange: ( v ) => update( { format: v, decimals: v === 'currency' ? 2 : field.decimals || 0 } ),
					} ) }
					{ text( { label: __( 'Label (optional)', 'werun-blocks-community' ), value: field.label || '', onChange: ( v ) => update( { label: v } ) } ) }
					{ format !== 'image' && ! gated && (
						<div className="wrbc-query-pair">
							{ text( { label: __( 'Before', 'werun-blocks-community' ), value: field.prefix || '', placeholder: format === 'currency' ? '$' : '', onChange: ( v ) => update( { prefix: v } ) } ) }
							{ text( { label: __( 'After', 'werun-blocks-community' ), value: field.suffix || '', onChange: ( v ) => update( { suffix: v } ) } ) }
						</div>
					) }
					{ [ 'number', 'currency' ].includes( format ) && range( { label: __( 'Decimals', 'werun-blocks-community' ), value: field.decimals ?? 0, min: 0, max: 4, onChange: ( v ) => update( { decimals: v } ) } ) }
					{ format === 'date' && text( { label: __( 'Format (PHP date, empty = site format)', 'werun-blocks-community' ), value: field.dateFormat || '', placeholder: 'j F Y', onChange: ( v ) => update( { dateFormat: v } ) } ) }
				</>
			);
		}
	}
	return null;
}

export function CardPanel( { attributes, setAttributes, source, metaKeys, query } ) {
	const card = attributes.card || {};
	const fields = Array.isArray( card.fields ) ? card.fields : [];
	const setCard = ( patch ) => setAttributes( { card: { ...card, ...patch } } );
	const sizes = useSelect( ( select ) => select( 'core/block-editor' ).getSettings().imageSizes || [], [] );
	const hasImage = fields.some( ( f ) => f.type === 'image' );
	const hasDownload = fields.some( ( f ) => f.type === 'meta' && f.format === 'download' );
	const gate = { enabled: false, mode: 'soft', ...( attributes.gate || {} ) };
	return (
		<PanelBody title={ __( 'Card', 'werun-blocks-community' ) } initialOpen={ false }>
			<RuleRows
				rows={ fields }
				onChange={ ( next ) => setCard( { fields: next } ) }
				max={ MAX_FIELDS }
				rowLabel={ ( f ) => ( f.type === 'meta' && f.key ? `${ fieldName( f.type ) }: ${ f.key }` : fieldName( f.type ) ) }
				renderRow={ ( field, update ) => (
					<FieldOptions field={ field } update={ update } source={ source } metaKeys={ metaKeys } attributes={ attributes } setAttributes={ setAttributes } />
				) }
			/>
			{ fields.length < MAX_FIELDS &&
				sel( {
					label: __( 'Add a field', 'werun-blocks-community' ),
					value: '',
					options: [ { value: '', label: __( 'Choose…', 'werun-blocks-community' ) }, ...FIELD_TYPES.filter( ( [ v ] ) => v !== 'terms' || source?.taxonomies?.length ).map( ( [ value, label ] ) => ( { value, label } ) ) ],
					onChange: ( type ) => type && setCard( { fields: [ ...fields, newField( type, source ) ] } ),
				} ) }
			<Choice
				label={ __( 'Card style', 'werun-blocks-community' ) }
				value={ card.style || 'bordered' }
				options={ [
					[ 'plain', __( 'Plain', 'werun-blocks-community' ) ],
					[ 'bordered', __( 'Border', 'werun-blocks-community' ) ],
					[ 'filled', __( 'Filled', 'werun-blocks-community' ) ],
					[ 'shadow', __( 'Shadow', 'werun-blocks-community' ) ],
				] }
				onChange={ ( style ) => setCard( { style } ) }
			/>
			{ sel( {
				label: __( 'Link', 'werun-blocks-community' ),
				value: card.link || 'card',
				options: [
					{ value: 'card', label: __( 'The whole card', 'werun-blocks-community' ) },
					{ value: 'title', label: __( 'The title', 'werun-blocks-community' ) },
					{ value: 'button', label: __( 'Only the button', 'werun-blocks-community' ) },
					{ value: 'none', label: __( 'No link', 'werun-blocks-community' ) },
				],
				help: card.link === 'button' && ! fields.some( ( f ) => f.type === 'button' ) ? __( 'Add a Button field, or the cards have no link.', 'werun-blocks-community' ) : undefined,
				onChange: ( link ) => setCard( { link } ),
			} ) }
			{ hasImage && (
				<>
					{ sel( {
						label: __( 'Image shape', 'werun-blocks-community' ),
						value: card.imageRatio || '3/2',
						options: RATIOS.map( ( r ) => ( { value: r, label: r === 'auto' ? __( 'Original', 'werun-blocks-community' ) : r.replace( '/', ':' ) } ) ),
						onChange: ( imageRatio ) => setCard( { imageRatio } ),
					} ) }
					{ sel( {
						label: __( 'Image size', 'werun-blocks-community' ),
						value: card.imageSize || 'medium_large',
						options: [ ...sizes.map( ( s ) => ( { value: s.slug, label: s.name } ) ), ...( sizes.some( ( s ) => s.slug === 'medium_large' ) ? [] : [ { value: 'medium_large', label: __( 'Medium large', 'werun-blocks-community' ) } ] ) ],
						onChange: ( imageSize ) => setCard( { imageSize } ),
					} ) }
				</>
			) }
			{ /* Renderer::event(): events listed by their date field show it, and their state in words. */ }
			{ query?.orderBy === 'upcoming' && query?.upcoming?.startKey && (
				<p className="wrbc-query-help">{ __( 'Each event shows its date and, in words, whether it is upcoming, happening now or past.', 'werun-blocks-community' ) }</p>
			) }
			{ hasDownload && (
				<>
					{ toggle( {
						label: __( 'Protect download links', 'werun-blocks-community' ),
						help: __( 'The file address isn’t printed: each click gets a short-lived signed link. To ask for the visitor’s details first, use the Form block’s “Gated download” variation.', 'werun-blocks-community' ),
						checked: gate.enabled,
						onChange: ( enabled ) => setAttributes( { gate: { ...gate, enabled } } ),
					} ) }
				</>
			) }
		</PanelBody>
	);
}

export function LayoutPanel( { attributes, setAttributes } ) {
	const { layout } = attributes;
	const map = attributes.map || {};
	// Columns apply to the grid, the carousel (slides in view) and the list under a map.
	const showColumns = layout === 'grid' || layout === 'carousel' || ( layout === 'map' && ( map.listPosition || 'below' ) === 'below' );
	const fields = attributes.card?.fields || [];
	const usesRadius = attributes.card?.style !== 'plain' || layout === 'map' || fields.some( ( f ) => f.type === 'image' || ( f.type === 'meta' && f.format === 'image' ) );
	return (
		<PanelBody title={ __( 'Layout', 'werun-blocks-community' ) } initialOpen={ false }>
			<Choice
				label={ __( 'Show as', 'werun-blocks-community' ) }
				value={ layout }
				options={ [
					[ 'grid', __( 'Grid', 'werun-blocks-community' ) ],
					[ 'list', __( 'List', 'werun-blocks-community' ) ],
					[ 'carousel', __( 'Carousel', 'werun-blocks-community' ) ],
					[ 'map', __( 'Map', 'werun-blocks-community' ) ],
				] }
				onChange={ ( next ) => setAttributes( { layout: next } ) }
			/>
			{ showColumns && (
				<ResponsiveColumns attributes={ attributes } setAttributes={ setAttributes } max={ 4 } label={ layout === 'carousel' ? __( 'Slides in view', 'werun-blocks-community' ) : __( 'Columns', 'werun-blocks-community' ) } />
			) }
			{ range( { label: __( 'Gap (px)', 'werun-blocks-community' ), value: attributes.gap, min: 0, max: 64, onChange: ( gap ) => setAttributes( { gap } ) } ) }
			{ /* --wrbc-radius: card corners, and on plain cards the image, meta images and the map (style.scss). */ }
			{ usesRadius && range( { label: __( 'Corner radius (px)', 'werun-blocks-community' ), value: attributes.cardRadius, min: 0, max: 40, onChange: ( cardRadius ) => setAttributes( { cardRadius } ) } ) }
		</PanelBody>
	);
}

const isCoord = ( e ) => ! e.guess || [ 'numeric', 'latlng', 'text' ].includes( e.guess );

export function MapPanel( { attributes, setAttributes, metaKeys } ) {
	const map = { provider: 'default', latKey: '', lngKey: '', combinedKey: '', addressKey: '', height: 420, zoom: 12, fitBounds: true, cluster: true, markerColor: '', listPosition: 'below', ...( attributes.map || {} ) };
	const setMap = ( patch ) => setAttributes( { map: { ...map, ...patch } } );
	const [ combined, setCombined ] = useState( !! map.combinedKey );
	// Effective provider, as Renderer::map_markup() decides it.
	const maps = window.wrbcSettings?.integrations?.maps || {};
	let provider = map.provider === 'default' ? maps.provider || 'leaflet' : map.provider;
	if ( provider === 'google' && ! maps.google_key ) {
		provider = 'leaflet';
	}
	return (
		<PanelBody title={ __( 'Map', 'werun-blocks-community' ) } initialOpen={ false }>
			{ sel( {
				label: __( 'Map provider', 'werun-blocks-community' ),
				value: map.provider,
				options: [
					{ value: 'default', label: __( 'As in Settings → werun.Blocks.Community → Integrations', 'werun-blocks-community' ) },
					{ value: 'leaflet', label: __( 'OpenStreetMap (Leaflet)', 'werun-blocks-community' ) },
					{ value: 'google', label: __( 'Google Maps (needs a key)', 'werun-blocks-community' ) },
				],
				onChange: ( provider ) => setMap( { provider } ),
			} ) }
			<Choice
				label={ __( 'Coordinates are in', 'werun-blocks-community' ) }
				value={ combined ? 'combined' : 'separate' }
				options={ [
					[ 'separate', __( 'Two fields', 'werun-blocks-community' ) ],
					[ 'combined', __( 'One field', 'werun-blocks-community' ) ],
				] }
				onChange={ ( v ) => {
					setCombined( v === 'combined' );
					setMap( v === 'combined' ? { latKey: '', lngKey: '' } : { combinedKey: '' } );
				} }
			/>
			{ combined ? (
				<MetaKeyControl metaKeys={ metaKeys } filter={ isCoord } label={ __( 'Location field', 'werun-blocks-community' ) } help={ __( '"lat,lng" text or an ACF Google Map field.', 'werun-blocks-community' ) } value={ map.combinedKey } onChange={ ( combinedKey ) => setMap( { combinedKey } ) } />
			) : (
				<>
					<MetaKeyControl metaKeys={ metaKeys } filter={ isCoord } label={ __( 'Latitude field', 'werun-blocks-community' ) } value={ map.latKey } onChange={ ( latKey ) => setMap( { latKey } ) } />
					<MetaKeyControl metaKeys={ metaKeys } filter={ isCoord } label={ __( 'Longitude field', 'werun-blocks-community' ) } value={ map.lngKey } onChange={ ( lngKey ) => setMap( { lngKey } ) } />
				</>
			) }
			<MetaKeyControl metaKeys={ metaKeys } label={ __( 'Address field (optional)', 'werun-blocks-community' ) } value={ map.addressKey } onChange={ ( addressKey ) => setMap( { addressKey } ) } />
			{ sel( {
				label: __( 'List of locations', 'werun-blocks-community' ),
				value: map.listPosition,
				options: [
					{ value: 'below', label: __( 'Below the map', 'werun-blocks-community' ) },
					{ value: 'side', label: __( 'Beside the map', 'werun-blocks-community' ) },
					{ value: 'none', label: __( 'Hidden (screen readers only)', 'werun-blocks-community' ) },
				],
				onChange: ( listPosition ) => setMap( { listPosition } ),
			} ) }
			{ range( { label: __( 'Height (px)', 'werun-blocks-community' ), value: map.height, min: 200, max: 900, step: 10, onChange: ( height ) => setMap( { height } ) } ) }
			{ toggle( { label: __( 'Zoom to fit every location', 'werun-blocks-community' ), checked: !! map.fitBounds, onChange: ( fitBounds ) => setMap( { fitBounds } ) } ) }
			{ /* wrbc-map uses the zoom when fitting too: as the closest zoom, for a single location and for "Show on the map". */ }
			{ range( {
				label: map.fitBounds ? __( 'Closest zoom', 'werun-blocks-community' ) : __( 'Zoom', 'werun-blocks-community' ),
				help: map.fitBounds ? __( 'Also the zoom of a single location and of “Show on the map”.', 'werun-blocks-community' ) : undefined,
				value: map.zoom,
				min: 1,
				max: 20,
				onChange: ( zoom ) => setMap( { zoom } ),
			} ) }
			{ /* Twin of Renderer::map_markup(): on Google (with a key) wrbc-map has no clustering. */ }
			{ provider !== 'google' && toggle( { label: __( 'Group nearby markers', 'werun-blocks-community' ), checked: !! map.cluster, onChange: ( cluster ) => setMap( { cluster } ) } ) }
			<p className="wrbc-control-label">{ __( 'Marker colour', 'werun-blocks-community' ) }</p>
			<ColorPalette value={ map.markerColor || undefined } onChange={ ( markerColor ) => setMap( { markerColor: markerColor || '' } ) } disableCustomColors={ false } clearable />
			{ /* Renderer::map_markup(): a pin carries meaning, so the map draws it 3:1 against the land colour (WCAG 1.4.11). */ }
			{ map.markerColor && markerShown( map.markerColor ).toLowerCase() !== map.markerColor.toLowerCase() && (
				<p className="wrbc-query-help">
					{ sprintf(
						/* translators: %s: a colour, e.g. #a16207 */
						__( 'The map draws the pins a little darker (%s) so they stay visible on it.', 'werun-blocks-community' ),
						markerShown( map.markerColor )
					) }
				</p>
			) }
		</PanelBody>
	);
}

export function FiltersPanel( { attributes, setAttributes, query, source } ) {
	if ( query.mode === 'handpicked' ) {
		return null;
	}
	const filters = { taxonomy: '', showAll: true, search: false, sort: [], ...( attributes.filters || {} ) };
	const setFilters = ( patch ) => setAttributes( { filters: { ...filters, ...patch } } );
	const taxonomies = source?.taxonomies || [];
	return (
		<PanelBody title={ __( 'Visitor filters', 'werun-blocks-community' ) } initialOpen={ false }>
			{ taxonomies.length > 0 &&
				sel( {
					label: __( 'Buttons to filter by', 'werun-blocks-community' ),
					value: filters.taxonomy,
					options: [ { value: '', label: __( 'None', 'werun-blocks-community' ) }, ...taxonomies.map( ( t ) => ( { value: t.name, label: t.label } ) ) ],
					help: filters.taxonomy ? __( 'With a term rule on the same taxonomy ("is any of"), only those terms get a button.', 'werun-blocks-community' ) : undefined,
					onChange: ( taxonomy ) => setFilters( { taxonomy } ),
				} ) }
			{ filters.taxonomy && (
				<>
					{ toggle( { label: __( 'An "All" button first', 'werun-blocks-community' ), checked: !! filters.showAll, onChange: ( showAll ) => setFilters( { showAll } ) } ) }
					{ filters.showAll && text( { label: __( '"All" button text', 'werun-blocks-community' ), value: attributes.allLabel, onChange: ( allLabel ) => setAttributes( { allLabel } ) } ) }
				</>
			) }
			{ toggle( { label: __( 'Search box', 'werun-blocks-community' ), checked: !! filters.search, onChange: ( search ) => setFilters( { search } ) } ) }
			<fieldset className="wrbc-query-fieldset">
				<legend>{ __( 'Sort options for visitors', 'werun-blocks-community' ) }</legend>
				{ SORTS.map( ( [ value, label ] ) => (
					<CheckboxControl
						__nextHasNoMarginBottom
						key={ value }
						label={ label }
						checked={ filters.sort.includes( value ) }
						onChange={ ( on ) => setFilters( { sort: on ? [ ...filters.sort, value ] : filters.sort.filter( ( s ) => s !== value ) } ) }
					/>
				) ) }
			</fieldset>
		</PanelBody>
	);
}

export function PaginationPanel( { attributes, setAttributes } ) {
	if ( attributes.layout === 'carousel' || attributes.query?.mode === 'handpicked' ) {
		return null;
	}
	const pagination = effectivePagination( attributes );
	return (
		<PanelBody title={ __( 'Pagination', 'werun-blocks-community' ) } initialOpen={ false }>
			{ sel( {
				label: __( 'More items', 'werun-blocks-community' ),
				value: pagination,
				options: [
					{ value: 'none', label: __( 'None', 'werun-blocks-community' ) },
					{ value: 'numbers', label: __( 'Page numbers', 'werun-blocks-community' ) },
					{ value: 'prevNext', label: __( 'Previous / next', 'werun-blocks-community' ) },
					...( attributes.layout === 'map' ? [] : [ { value: 'loadMore', label: __( '"Load more" button', 'werun-blocks-community' ) } ] ),
				],
				onChange: ( next ) => setAttributes( { pagination: next } ),
			} ) }
			{ pagination === 'loadMore' && text( { label: __( 'Button text', 'werun-blocks-community' ), value: attributes.loadMoreText, onChange: ( loadMoreText ) => setAttributes( { loadMoreText } ) } ) }
			{ pagination !== 'none' && <p className="wrbc-query-help">{ __( 'Pages work without JavaScript too: each one has its own link.', 'werun-blocks-community' ) }</p> }
		</PanelBody>
	);
}

export function ColorsPanel( { attributes, setAttributes } ) {
	const style = attributes.card?.style || 'bordered';
	const settings = [ { label: __( 'Accent', 'werun-blocks-community' ), value: attributes.accentColor, onChange: ( accentColor ) => setAttributes( { accentColor } ) } ];
	if ( style !== 'plain' ) {
		settings.push( { label: __( 'Card background', 'werun-blocks-community' ), value: attributes.cardBg, onChange: ( cardBg ) => setAttributes( { cardBg } ) } );
	}
	if ( style === 'bordered' ) {
		settings.push( { label: __( 'Card border', 'werun-blocks-community' ), value: attributes.cardBorderColor, onChange: ( cardBorderColor ) => setAttributes( { cardBorderColor } ) } );
	}
	return <PanelColorSettings title={ __( 'Card colours', 'werun-blocks-community' ) } initialOpen={ false } colorSettings={ settings } />;
}
