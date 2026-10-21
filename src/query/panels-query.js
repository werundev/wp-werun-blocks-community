/**
 * Query builder panels: source, filter by terms, filter by fields, order, limits.
 * Every control is shown only when Config::normalize() / Builder::args() use it.
 */
import { __, sprintf } from '@wordpress/i18n';
import {
	CheckboxControl,
	ComboboxControl,
	FormTokenField,
	Notice,
	PanelBody,
	RangeControl,
	SelectControl,
	TextControl,
	ToggleControl,
} from '@wordpress/components';
import { useEffect, useState } from '@wordpress/element';
import { Choice } from '../shared/controls';
import { getAuthors, getPosts } from './api';
import { MetaKeyControl, PostPicker, RuleRows, TermTokens } from './controls';
import {
	COMPARES,
	DATE_FORMATS,
	effectivePagination,
	guessType,
	LIST_VALUE,
	META_TYPES,
	NO_VALUE,
	NOW_TYPES,
	ORDER_BY,
	RANGE_VALUE,
	TAX_OPERATORS,
} from './constants';

const sel = ( props ) => <SelectControl __nextHasNoMarginBottom __next40pxDefaultSize { ...props } />;
const text = ( props ) => <TextControl __nextHasNoMarginBottom __next40pxDefaultSize { ...props } />;
const toggle = ( props ) => <ToggleControl __nextHasNoMarginBottom { ...props } />;

export function SourcePanel( { attributes, setAttributes, query, setQuery, types, source, typeName, loading } ) {
	return (
		<PanelBody title={ __( 'Source', 'werun-blocks-community' ) }>
			{ sel( {
				label: __( 'Show items from', 'werun-blocks-community' ),
				value: typeName,
				options: [
					// A placeholder while loading, with no type, or with a type that no longer exists (twin: Config::normalize() drops it).
					...( source ? [] : [ { value: typeName, label: loading ? __( 'Loading…', 'werun-blocks-community' ) : __( 'Choose a source', 'werun-blocks-community' ) } ] ),
					...types.map( ( t ) => ( {
						value: t.name,
						/* translators: 1: post type name, 2: number of published items */
						label: sprintf( __( '%1$s (%2$d)', 'werun-blocks-community' ), t.label, t.count ),
					} ) ),
				],
				// A new type: rules, keys and fields of the old one no longer apply.
				onChange: ( postType ) =>
					setQuery( {
						postType,
						include: [],
						taxQuery: { relation: 'AND', rules: [] },
						metaQuery: { relation: 'AND', rules: [] },
						orderMeta: { key: '', type: 'CHAR' },
						related: { taxonomies: [] },
						parent: 0,
					} ),
			} ) }
			<Choice
				label={ __( 'Which items', 'werun-blocks-community' ) }
				value={ query.mode }
				options={ [
					[ 'query', __( 'By rules', 'werun-blocks-community' ) ],
					[ 'handpicked', __( 'Pick by hand', 'werun-blocks-community' ) ],
				] }
				onChange={ ( mode ) => setQuery( { mode, orderBy: mode === 'handpicked' ? 'post__in' : 'date' } ) }
			/>
			{ query.mode === 'handpicked' && source && <PostPicker type={ source.name } value={ query.include } onChange={ ( include ) => setQuery( { include } ) } /> }
			{ text( {
				label: __( 'Text when nothing matches', 'werun-blocks-community' ),
				value: attributes.emptyText,
				onChange: ( emptyText ) => setAttributes( { emptyText } ),
			} ) }
		</PanelBody>
	);
}

export function TaxPanel( { query, setQuery, source } ) {
	const taxonomies = source?.taxonomies || [];
	if ( query.mode === 'handpicked' || ! taxonomies.length ) {
		return null;
	}
	const rules = query.taxQuery?.rules || [];
	const setRules = ( next ) => setQuery( { taxQuery: { ...query.taxQuery, rules: next } } );
	return (
		<PanelBody title={ __( 'Filter by terms', 'werun-blocks-community' ) } initialOpen={ rules.length > 0 }>
			<RuleRows
				rows={ rules }
				onChange={ setRules }
				max={ 5 }
				addLabel={ __( 'Add a term rule', 'werun-blocks-community' ) }
				newRow={ () => ( { taxonomy: taxonomies[ 0 ].name, operator: 'IN', terms: [], includeChildren: false } ) }
				renderRow={ ( rule, update ) => {
					const tax = taxonomies.find( ( t ) => t.name === rule.taxonomy );
					const needsTerms = ! NO_VALUE.includes( rule.operator );
					return (
						<>
							{ sel( {
								label: __( 'Taxonomy', 'werun-blocks-community' ),
								value: rule.taxonomy,
								options: taxonomies.map( ( t ) => ( { value: t.name, label: t.label } ) ),
								onChange: ( taxonomy ) => update( { taxonomy, terms: [] } ),
							} ) }
							{ sel( {
								label: __( 'Condition', 'werun-blocks-community' ),
								value: rule.operator,
								options: TAX_OPERATORS.map( ( [ value, label ] ) => ( { value, label } ) ),
								onChange: ( operator ) => update( { operator } ),
							} ) }
							{ needsTerms && <TermTokens taxonomy={ rule.taxonomy } value={ rule.terms } onChange={ ( terms ) => update( { terms } ) } /> }
							{ tax?.hierarchical && [ 'IN', 'AND' ].includes( rule.operator ) &&
								toggle( {
									label: __( 'Include child terms', 'werun-blocks-community' ),
									checked: !! rule.includeChildren,
									onChange: ( includeChildren ) => update( { includeChildren } ),
								} ) }
							{ needsTerms && ! ( rule.terms || [] ).length && (
								<p className="wrbc-query-help">{ __( 'Pick at least one term, or this rule is skipped.', 'werun-blocks-community' ) }</p>
							) }
						</>
					);
				} }
			/>
			{ rules.length >= 2 && (
				<Choice
					label={ __( 'Items must match', 'werun-blocks-community' ) }
					value={ query.taxQuery?.relation || 'AND' }
					options={ [
						[ 'AND', __( 'Every rule', 'werun-blocks-community' ) ],
						[ 'OR', __( 'Any rule', 'werun-blocks-community' ) ],
					] }
					onChange={ ( relation ) => setQuery( { taxQuery: { ...query.taxQuery, relation } } ) }
				/>
			) }
		</PanelBody>
	);
}

function MetaValue( { rule, update } ) {
	if ( NO_VALUE.includes( rule.compare ) || ( rule.valueMode && rule.valueMode !== 'fixed' && ! RANGE_VALUE.includes( rule.compare ) && ! LIST_VALUE.includes( rule.compare ) ) ) {
		return null;
	}
	const list = Array.isArray( rule.value ) ? rule.value : String( rule.value ?? '' ).split( ',' ).filter( Boolean );
	const inputType = { NUMERIC: 'number', DECIMAL: 'number', DATE: 'date', DATETIME: 'datetime-local', TIME: 'time' }[ rule.type ] || 'text';
	if ( RANGE_VALUE.includes( rule.compare ) ) {
		return (
			<div className="wrbc-query-pair">
				{ text( { label: __( 'From', 'werun-blocks-community' ), type: inputType, value: list[ 0 ] || '', onChange: ( v ) => update( { value: [ v, list[ 1 ] || '' ] } ) } ) }
				{ text( { label: __( 'To', 'werun-blocks-community' ), type: inputType, value: list[ 1 ] || '', onChange: ( v ) => update( { value: [ list[ 0 ] || '', v ] } ) } ) }
			</div>
		);
	}
	if ( LIST_VALUE.includes( rule.compare ) ) {
		return (
			<FormTokenField
				__nextHasNoMarginBottom
				__next40pxDefaultSize
				label={ __( 'Values', 'werun-blocks-community' ) }
				value={ list }
				maxLength={ 20 }
				onChange={ ( tokens ) => update( { value: tokens.map( ( t ) => ( typeof t === 'string' ? t : t.value ) ) } ) }
			/>
		);
	}
	return text( {
		label: __( 'Value', 'werun-blocks-community' ),
		type: inputType,
		value: Array.isArray( rule.value ) ? '' : rule.value ?? '',
		onChange: ( value ) => update( { value } ),
	} );
}

export function MetaPanel( { query, setQuery, metaKeys } ) {
	if ( query.mode === 'handpicked' ) {
		return null;
	}
	const rules = query.metaQuery?.rules || [];
	const setRules = ( next ) => setQuery( { metaQuery: { ...query.metaQuery, rules: next } } );
	return (
		<PanelBody title={ __( 'Filter by fields', 'werun-blocks-community' ) } initialOpen={ rules.length > 0 }>
			<RuleRows
				rows={ rules }
				onChange={ setRules }
				max={ 5 }
				addLabel={ __( 'Add a field rule', 'werun-blocks-community' ) }
				newRow={ () => ( { key: '', compare: '=', value: '', type: 'CHAR', valueMode: 'fixed' } ) }
				renderRow={ ( rule, update ) => (
					<>
						<MetaKeyControl
							metaKeys={ metaKeys }
							value={ rule.key }
							onChange={ ( key, entry ) => update( { key, ...( entry?.guess ? { type: guessType( entry.guess ) } : {} ) } ) }
						/>
						{ sel( {
							label: __( 'Condition', 'werun-blocks-community' ),
							value: rule.compare,
							options: COMPARES.map( ( [ value, label ] ) => ( { value, label } ) ),
							onChange: ( compare ) => update( { compare, value: RANGE_VALUE.includes( compare ) || LIST_VALUE.includes( compare ) ? [] : '' } ),
						} ) }
						{ ! NO_VALUE.includes( rule.compare ) && (
							<>
								{ sel( {
									label: __( 'Compare as', 'werun-blocks-community' ),
									value: rule.type,
									options: META_TYPES.map( ( [ value, label ] ) => ( { value, label } ) ),
									onChange: ( type ) => update( { type, valueMode: NOW_TYPES.includes( type ) ? rule.valueMode : 'fixed' } ),
								} ) }
								{ NOW_TYPES.includes( rule.type ) && ! RANGE_VALUE.includes( rule.compare ) && ! LIST_VALUE.includes( rule.compare ) &&
									sel( {
										label: __( 'Compare with', 'werun-blocks-community' ),
										value: rule.valueMode || 'fixed',
										options: [
											{ value: 'fixed', label: __( 'A value I type', 'werun-blocks-community' ) },
											{ value: 'today', label: __( 'Today', 'werun-blocks-community' ) },
											{ value: 'now', label: __( 'Now', 'werun-blocks-community' ) },
										],
										help: rule.type === 'NUMERIC' && rule.valueMode && rule.valueMode !== 'fixed' ? __( 'As a number, today is 20261231 (ACF dates) and now is a Unix timestamp.', 'werun-blocks-community' ) : undefined,
										onChange: ( valueMode ) => update( { valueMode } ),
									} ) }
								<MetaValue rule={ rule } update={ update } />
							</>
						) }
					</>
				) }
			/>
			{ rules.length >= 2 && (
				<Choice
					label={ __( 'Items must match', 'werun-blocks-community' ) }
					value={ query.metaQuery?.relation || 'AND' }
					options={ [
						[ 'AND', __( 'Every rule', 'werun-blocks-community' ) ],
						[ 'OR', __( 'Any rule', 'werun-blocks-community' ) ],
					] }
					onChange={ ( relation ) => setQuery( { metaQuery: { ...query.metaQuery, relation } } ) }
				/>
			) }
		</PanelBody>
	);
}

const isDateKey = ( e ) => ! e.guess || [ 'date', 'numeric' ].includes( e.guess );

export function OrderPanel( { query, setQuery, metaKeys } ) {
	const handpicked = query.mode === 'handpicked';
	const options = ORDER_BY.filter( ( [ v ] ) => ! handpicked || ! [ 'meta', 'upcoming' ].includes( v ) );
	if ( handpicked ) {
		options.unshift( [ 'post__in', __( 'The order picked', 'werun-blocks-community' ) ] );
	}
	const up = { startKey: '', endKey: '', format: 'Ymd', when: 'upcoming', includeOngoing: true, ...( query.upcoming || {} ) };
	const setUp = ( patch ) => setQuery( { upcoming: { ...up, ...patch } } );
	const om = { key: '', type: 'CHAR', ...( query.orderMeta || {} ) };
	return (
		<PanelBody title={ __( 'Order', 'werun-blocks-community' ) } initialOpen={ false }>
			{ sel( {
				label: __( 'Order by', 'werun-blocks-community' ),
				value: query.orderBy,
				options: options.map( ( [ value, label ] ) => ( { value, label } ) ),
				onChange: ( orderBy ) => setQuery( { orderBy, ...( orderBy === 'rand' ? { perPage: Math.min( query.perPage, 12 ) } : {} ) } ),
			} ) }
			{ ! [ 'rand', 'post__in', 'upcoming' ].includes( query.orderBy ) && (
				<Choice
					label={ __( 'Direction', 'werun-blocks-community' ) }
					value={ query.order }
					options={ [
						[ 'DESC', query.orderBy === 'title' ? __( 'Z to A', 'werun-blocks-community' ) : __( 'Highest / newest first', 'werun-blocks-community' ) ],
						[ 'ASC', query.orderBy === 'title' ? __( 'A to Z', 'werun-blocks-community' ) : __( 'Lowest / oldest first', 'werun-blocks-community' ) ],
					] }
					onChange={ ( order ) => setQuery( { order } ) }
				/>
			) }
			{ query.orderBy === 'rand' && <p className="wrbc-query-help">{ __( 'Random order shows up to 12 items and is never cached.', 'werun-blocks-community' ) }</p> }
			{ query.orderBy === 'meta' && (
				<>
					<MetaKeyControl
						metaKeys={ metaKeys }
						label={ __( 'Field to order by', 'werun-blocks-community' ) }
						value={ om.key }
						onChange={ ( key, entry ) => setQuery( { orderMeta: { key, type: entry?.guess ? guessType( entry.guess ) : om.type } } ) }
					/>
					{ sel( {
						label: __( 'Compare as', 'werun-blocks-community' ),
						value: om.type,
						options: META_TYPES.map( ( [ value, label ] ) => ( { value, label } ) ),
						onChange: ( type ) => setQuery( { orderMeta: { ...om, type } } ),
					} ) }
					<p className="wrbc-query-help">{ __( 'Items without this field are left out.', 'werun-blocks-community' ) }</p>
				</>
			) }
			{ query.orderBy === 'upcoming' && (
				<>
					<MetaKeyControl metaKeys={ metaKeys } filter={ isDateKey } label={ __( 'Start date field', 'werun-blocks-community' ) } value={ up.startKey } onChange={ ( startKey ) => setUp( { startKey } ) } />
					<MetaKeyControl metaKeys={ metaKeys } filter={ isDateKey } label={ __( 'End date field (optional)', 'werun-blocks-community' ) } value={ up.endKey } onChange={ ( endKey ) => setUp( { endKey } ) } />
					{ sel( {
						label: __( 'Dates are stored as', 'werun-blocks-community' ),
						value: up.format,
						options: DATE_FORMATS.map( ( [ value, label ] ) => ( { value, label } ) ),
						onChange: ( format ) => setUp( { format } ),
					} ) }
					<Choice
						label={ __( 'Show', 'werun-blocks-community' ) }
						value={ up.when }
						options={ [
							[ 'upcoming', __( 'Upcoming', 'werun-blocks-community' ) ],
							[ 'past', __( 'Past', 'werun-blocks-community' ) ],
							[ 'all', __( 'All', 'werun-blocks-community' ) ],
						] }
						onChange={ ( when ) => setUp( { when } ) }
					/>
					{ up.when === 'upcoming' && up.endKey &&
						toggle( {
							label: __( 'Include events already running', 'werun-blocks-community' ),
							checked: !! up.includeOngoing,
							onChange: ( includeOngoing ) => setUp( { includeOngoing } ),
						} ) }
					{ ! up.startKey && <Notice status="warning" isDismissible={ false }>{ __( 'Choose the start date field: until then items are ordered by publish date.', 'werun-blocks-community' ) }</Notice> }
					<p className="wrbc-query-help">
						{ up.when === 'past' ? __( 'Most recent first. Today is the site’s date (Settings → General → Timezone).', 'werun-blocks-community' ) : __( 'Soonest first. Today is the site’s date (Settings → General → Timezone).', 'werun-blocks-community' ) }
					</p>
				</>
			) }
		</PanelBody>
	);
}

/** Authors as tokens (ids). */
function AuthorTokens( { value, onChange } ) {
	const [ users, setUsers ] = useState( [] );
	useEffect( () => {
		getAuthors().then( setUsers, () => {} );
	}, [] );
	const ids = Array.isArray( value ) ? value : [];
	const name = ( id ) => users.find( ( u ) => u.id === id )?.name || `#${ id }`;
	return (
		<FormTokenField
			__nextHasNoMarginBottom
			__next40pxDefaultSize
			label={ __( 'Authors', 'werun-blocks-community' ) }
			value={ ids.map( name ) }
			suggestions={ users.map( ( u ) => u.name ) }
			__experimentalExpandOnFocus
			__experimentalValidateInput={ ( t ) => users.some( ( u ) => u.name === t ) }
			onChange={ ( tokens ) => onChange( tokens.map( ( t ) => users.find( ( u ) => u.name === ( typeof t === 'string' ? t : t.value ) )?.id ).filter( Boolean ) ) }
		/>
	);
}

/** A single post of the type (for "child of"). */
function ParentPicker( { type, value, onChange } ) {
	const [ options, setOptions ] = useState( [] );
	useEffect( () => {
		if ( type ) {
			getPosts( type, value ? { include: String( value ) } : {} ).then( ( selected ) =>
				getPosts( type ).then( ( list ) => setOptions( [ ...selected, ...list.filter( ( p ) => ! selected.some( ( s ) => s.id === p.id ) ) ] ) )
			, () => {} );
		}
	}, [ type, value ] );
	return (
		<ComboboxControl
			__nextHasNoMarginBottom
			__next40pxDefaultSize
			label={ __( 'Parent item', 'werun-blocks-community' ) }
			value={ value ? String( value ) : null }
			options={ options.map( ( p ) => ( { value: String( p.id ), label: p.title || `#${ p.id }` } ) ) }
			onFilterValueChange={ ( search ) => type && search.length > 1 && getPosts( type, { search } ).then( setOptions, () => {} ) }
			onChange={ ( id ) => onChange( id ? Number( id ) : 0 ) }
		/>
	);
}

export function LimitsPanel( { attributes, query, setQuery, source } ) {
	const handpicked = query.mode === 'handpicked';
	const pagination = effectivePagination( attributes );
	const taxonomies = source?.taxonomies || [];
	const related = query.related?.taxonomies || [];
	const author = { mode: 'any', ids: [], ...( query.author || {} ) };
	const parentMode = query.parent === 'current' ? 'current' : Number( query.parent ) > 0 ? 'id' : 'any';
	const [ pickParent, setPickParent ] = useState( parentMode === 'id' );
	return (
		<PanelBody title={ __( 'Limits', 'werun-blocks-community' ) } initialOpen={ false }>
			{ ! handpicked && (
				<RangeControl
					__nextHasNoMarginBottom
					__next40pxDefaultSize
					label={ pagination === 'none' ? __( 'Items to show', 'werun-blocks-community' ) : __( 'Items per page', 'werun-blocks-community' ) }
					value={ query.perPage }
					min={ 1 }
					max={ query.orderBy === 'rand' ? 12 : 24 }
					onChange={ ( perPage ) => setQuery( { perPage } ) }
				/>
			) }
			{ ! handpicked && pagination !== 'numbers' && (
				<RangeControl __nextHasNoMarginBottom __next40pxDefaultSize label={ __( 'Skip the first', 'werun-blocks-community' ) } value={ query.offset } min={ 0 } max={ 50 } onChange={ ( offset ) => setQuery( { offset } ) } />
			) }
			{ pagination !== 'none' && (
				<RangeControl __nextHasNoMarginBottom __next40pxDefaultSize label={ __( 'Most pages', 'werun-blocks-community' ) } value={ query.maxPages } min={ 1 } max={ 50 } onChange={ ( maxPages ) => setQuery( { maxPages } ) } />
			) }
			{ toggle( {
				label: __( 'Leave out the post being viewed', 'werun-blocks-community' ),
				checked: !! query.excludeCurrent,
				onChange: ( excludeCurrent ) => setQuery( { excludeCurrent } ),
			} ) }
			{ ! handpicked && taxonomies.length > 0 && (
				<fieldset className="wrbc-query-fieldset">
					<legend>{ __( 'Related: share terms with the post being viewed', 'werun-blocks-community' ) }</legend>
					{ taxonomies.map( ( t ) => (
						<CheckboxControl
							__nextHasNoMarginBottom
							key={ t.name }
							label={ t.label }
							checked={ related.includes( t.name ) }
							disabled={ ! related.includes( t.name ) && related.length >= 3 }
							onChange={ ( on ) => setQuery( { related: { taxonomies: on ? [ ...related, t.name ] : related.filter( ( n ) => n !== t.name ) } } ) }
						/>
					) ) }
				</fieldset>
			) }
			{ ! handpicked && (
				<>
					{ sel( {
						label: __( 'Author', 'werun-blocks-community' ),
						value: author.mode,
						options: [
							{ value: 'any', label: __( 'Anyone', 'werun-blocks-community' ) },
							{ value: 'current', label: __( 'Author of the post being viewed', 'werun-blocks-community' ) },
							{ value: 'ids', label: __( 'These authors', 'werun-blocks-community' ) },
						],
						onChange: ( mode ) => setQuery( { author: { ...author, mode } } ),
					} ) }
					{ author.mode === 'ids' && <AuthorTokens value={ author.ids } onChange={ ( ids ) => setQuery( { author: { ...author, ids } } ) } /> }
				</>
			) }
			{ ! handpicked && source?.name === 'post' &&
				sel( {
					label: __( 'Sticky posts', 'werun-blocks-community' ),
					value: query.sticky,
					options: [
						{ value: 'include', label: __( 'Include them in order', 'werun-blocks-community' ) },
						{ value: 'exclude', label: __( 'Leave them out', 'werun-blocks-community' ) },
						{ value: 'only', label: __( 'Only sticky posts', 'werun-blocks-community' ) },
					],
					onChange: ( sticky ) => setQuery( { sticky } ),
				} ) }
			{ ! handpicked && source?.supports?.thumbnail &&
				toggle( {
					label: __( 'Only items with a featured image', 'werun-blocks-community' ),
					checked: !! query.hasImage,
					onChange: ( hasImage ) => setQuery( { hasImage } ),
				} ) }
			{ sel( {
				label: __( 'Password-protected items', 'werun-blocks-community' ),
				value: query.passwordPosts,
				options: [
					{ value: 'exclude', label: __( 'Leave them out', 'werun-blocks-community' ) },
					{ value: 'titleOnly', label: __( 'Show title and link only', 'werun-blocks-community' ) },
				],
				onChange: ( passwordPosts ) => setQuery( { passwordPosts } ),
			} ) }
			{ ! handpicked && source?.hierarchical && (
				<>
					{ sel( {
						label: __( 'Child of', 'werun-blocks-community' ),
						value: pickParent ? 'id' : parentMode,
						options: [
							{ value: 'any', label: __( 'Any parent', 'werun-blocks-community' ) },
							{ value: 'current', label: __( 'The item being viewed', 'werun-blocks-community' ) },
							{ value: 'id', label: __( 'A specific item', 'werun-blocks-community' ) },
						],
						onChange: ( mode ) => {
							setPickParent( mode === 'id' );
							setQuery( { parent: mode === 'current' ? 'current' : 0 } );
						},
					} ) }
					{ ( pickParent || parentMode === 'id' ) && <ParentPicker type={ source.name } value={ Number( query.parent ) || 0 } onChange={ ( parent ) => setQuery( { parent } ) } /> }
				</>
			) }
			{ ! handpicked &&
				text( {
					label: __( 'Only items matching the words', 'werun-blocks-community' ),
					value: query.search,
					maxLength: 100,
					onChange: ( search ) => setQuery( { search: search.slice( 0, 100 ) } ),
				} ) }
			{ ! handpicked && source && (
				<fieldset className="wrbc-query-fieldset">
					<legend>{ __( 'Always leave out', 'werun-blocks-community' ) }</legend>
					<PostPicker type={ source.name } value={ query.exclude } onChange={ ( exclude ) => setQuery( { exclude } ) } />
				</fieldset>
			) }
		</PanelBody>
	);
}
