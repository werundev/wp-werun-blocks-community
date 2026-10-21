/**
 * Editor controls of the query builder. RuleRows and CarouselPanel are local
 * copies of the contract in docs/shared-modules.md (src/shared/controls-extra.js
 * did not exist yet when this block was built): swap the imports once it does.
 */
import { __, sprintf } from '@wordpress/i18n';
import {
	Button,
	ComboboxControl,
	FormTokenField,
	PanelBody,
	RangeControl,
} from '@wordpress/components';
import { useEffect, useMemo, useRef, useState } from '@wordpress/element';
import { IconControl } from '../shared/IconControl';
import { Choice, Toggle } from '../shared/controls';
import { getPosts, getTerms } from './api';
import { META_KEY_RE } from './constants';

/**
 * Add / remove / reorder a list of rule rows.
 *
 * @param {Object}   props
 * @param {Array}    props.rows      Rows.
 * @param {Function} props.onChange  New rows.
 * @param {Function} props.renderRow ( row, update( patch ), index ) => element.
 * @param {string}   props.addLabel  Add button text.
 * @param {number}   props.max       Most rows.
 * @param {Function} props.newRow    () => a new row (omit to hide the add button).
 * @param {Function} props.rowLabel  ( row, index ) => heading of a row.
 */
export function RuleRows( { rows = [], onChange, renderRow, addLabel, max = 5, newRow, rowLabel } ) {
	const list = Array.isArray( rows ) ? rows : [];
	const update = ( index, patch ) => onChange( list.map( ( row, i ) => ( i === index ? { ...row, ...patch } : row ) ) );
	const move = ( index, by ) => {
		const next = [ ...list ];
		const [ row ] = next.splice( index, 1 );
		next.splice( index + by, 0, row );
		onChange( next );
	};
	return (
		<div className="wrbc-query-rules">
			{ list.map( ( row, index ) => (
				<div className="wrbc-query-rules__row" key={ index }>
					<div className="wrbc-query-rules__head">
						<strong>{ rowLabel ? rowLabel( row, index ) : sprintf( /* translators: %d: rule number */ __( 'Rule %d', 'werun-blocks-community' ), index + 1 ) }</strong>
						<span>
							<Button size="small" icon="arrow-up-alt2" label={ __( 'Move up', 'werun-blocks-community' ) } disabled={ index === 0 } onClick={ () => move( index, -1 ) } />
							<Button size="small" icon="arrow-down-alt2" label={ __( 'Move down', 'werun-blocks-community' ) } disabled={ index === list.length - 1 } onClick={ () => move( index, 1 ) } />
							<Button size="small" icon="no-alt" isDestructive label={ __( 'Remove', 'werun-blocks-community' ) } onClick={ () => onChange( list.filter( ( _, i ) => i !== index ) ) } />
						</span>
					</div>
					{ renderRow( row, ( patch ) => update( index, patch ), index ) }
				</div>
			) ) }
			{ newRow && list.length < max && (
				<Button variant="secondary" size="compact" onClick={ () => onChange( [ ...list, newRow() ] ) }>
					{ addLabel }
				</Button>
			) }
			{ newRow && list.length >= max && (
				<p className="wrbc-query-help">{ sprintf( /* translators: %d: maximum */ __( 'Up to %d.', 'werun-blocks-community' ), max ) }</p>
			) }
		</div>
	);
}

/** Carousel options, same attribute names as the testimonials block. */
export function CarouselPanel( { attributes: a, setAttributes } ) {
	const hasControls = a.showArrows || a.showDots || a.autoplay;
	return (
		<PanelBody title={ __( 'Carousel', 'werun-blocks-community' ) } initialOpen={ false }>
			<Toggle attributes={ a } setAttributes={ setAttributes } name="showArrows" label={ __( 'Arrows', 'werun-blocks-community' ) } />
			<Toggle attributes={ a } setAttributes={ setAttributes } name="showDots" label={ __( 'Dots', 'werun-blocks-community' ) } />
			{ hasControls && (
				<Choice
					label={ __( 'Controls', 'werun-blocks-community' ) }
					value={ a.controlsPosition }
					options={ [
						[ 'top', __( 'Above', 'werun-blocks-community' ) ],
						[ 'bottom', __( 'Below', 'werun-blocks-community' ) ],
					] }
					onChange={ ( controlsPosition ) => setAttributes( { controlsPosition } ) }
				/>
			) }
			<Toggle
				attributes={ a }
				setAttributes={ setAttributes }
				name="loop"
				label={ __( 'Loop back to the start', 'werun-blocks-community' ) }
				help={ a.loop ? undefined : __( 'The arrows and the keyboard stop at the ends, and autoplay stops at the last slide.', 'werun-blocks-community' ) }
			/>
			<Toggle
				attributes={ a }
				setAttributes={ setAttributes }
				name="autoplay"
				label={ __( 'Autoplay', 'werun-blocks-community' ) }
				help={ __( 'Adds a pause button, and never plays for visitors who ask for reduced motion.', 'werun-blocks-community' ) }
			/>
			{ a.autoplay && (
				<>
					<RangeControl __nextHasNoMarginBottom __next40pxDefaultSize label={ __( 'Seconds per slide', 'werun-blocks-community' ) } value={ a.interval } min={ 2 } max={ 20 } onChange={ ( interval ) => setAttributes( { interval } ) } />
					<Toggle attributes={ a } setAttributes={ setAttributes } name="pauseOnHover" label={ __( 'Pause on hover', 'werun-blocks-community' ) } />
				</>
			) }
			{ a.showArrows && (
				<>
					<IconControl label={ __( 'Previous arrow', 'werun-blocks-community' ) } value={ a.prevIcon } allowRemove={ false } onChange={ ( prevIcon ) => setAttributes( { prevIcon } ) } />
					<IconControl label={ __( 'Next arrow', 'werun-blocks-community' ) } value={ a.nextIcon } allowRemove={ false } onChange={ ( nextIcon ) => setAttributes( { nextIcon } ) } />
				</>
			) }
		</PanelBody>
	);
}

/** A debounced callback. */
function useDebounced( fn, wait = 250 ) {
	const timer = useRef();
	const latest = useRef( fn );
	latest.current = fn;
	useEffect( () => () => clearTimeout( timer.current ), [] );
	return ( ...args ) => {
		clearTimeout( timer.current );
		timer.current = setTimeout( () => latest.current( ...args ), wait );
	};
}

/** Token label for a term or post, unique even when two share a name. */
const tokenLabel = ( name, id, all ) => ( Object.values( all ).filter( ( n ) => n === name ).length > 1 ? `${ name } #${ id }` : name );

/**
 * Terms of a taxonomy as tokens, searched as you type. Value: term ids.
 */
export function TermTokens( { taxonomy, value, onChange, label } ) {
	const ids = Array.isArray( value ) ? value : [];
	const [ names, setNames ] = useState( {} );
	const [ suggestions, setSuggestions ] = useState( [] );
	const remember = ( list ) => setNames( ( n ) => ( { ...n, ...Object.fromEntries( list.map( ( t ) => [ t.id, t.name ] ) ) } ) );

	useEffect( () => {
		if ( ! taxonomy ) {
			return;
		}
		getTerms( taxonomy ).then( ( list ) => {
			remember( list );
			setSuggestions( list.map( ( t ) => t.id ) );
		}, () => {} );
	}, [ taxonomy ] );
	useEffect( () => {
		const missing = ids.filter( ( id ) => ! names[ id ] );
		if ( taxonomy && missing.length ) {
			getTerms( taxonomy, { include: missing.join( ',' ) } ).then( remember, () => {} );
		}
	}, [ taxonomy, ids.join( ',' ) ] ); // eslint-disable-line react-hooks/exhaustive-deps

	const search = useDebounced( ( text ) => {
		if ( taxonomy && text.length > 1 ) {
			getTerms( taxonomy, { search: text } ).then( ( list ) => {
				remember( list );
				setSuggestions( list.map( ( t ) => t.id ) );
			}, () => {} );
		}
	} );

	const byLabel = {};
	Object.keys( names ).forEach( ( id ) => {
		byLabel[ tokenLabel( names[ id ], id, names ) ] = Number( id );
	} );
	return (
		<FormTokenField
			__nextHasNoMarginBottom
			__next40pxDefaultSize
			label={ label || __( 'Terms', 'werun-blocks-community' ) }
			value={ ids.map( ( id ) => ( names[ id ] ? tokenLabel( names[ id ], id, names ) : `#${ id }` ) ) }
			suggestions={ suggestions.map( ( id ) => tokenLabel( names[ id ], id, names ) ).filter( Boolean ) }
			onInputChange={ search }
			__experimentalValidateInput={ ( token ) => token in byLabel }
			__experimentalExpandOnFocus
			maxLength={ 50 }
			onChange={ ( tokens ) =>
				onChange(
					tokens
						.map( ( t ) => ( typeof t === 'string' ? t : t.value ) )
						.map( ( t ) => byLabel[ t ] ?? ( /^#\d+$/.test( t ) ? Number( t.slice( 1 ) ) : null ) )
						.filter( ( id ) => id )
				)
			}
		/>
	);
}

/**
 * Handpicked posts: search to add, then reorder or remove. Value: post ids.
 */
export function PostPicker( { type, value, onChange, max = 50 } ) {
	const ids = Array.isArray( value ) ? value : [];
	const [ titles, setTitles ] = useState( {} );
	const [ options, setOptions ] = useState( [] );
	const remember = ( list ) => setTitles( ( n ) => ( { ...n, ...Object.fromEntries( list.map( ( p ) => [ p.id, p.title || __( '(no title)', 'werun-blocks-community' ) ] ) ) } ) );

	useEffect( () => {
		const missing = ids.filter( ( id ) => ! titles[ id ] );
		if ( type && missing.length ) {
			getPosts( type, { include: missing.join( ',' ) } ).then( remember, () => {} );
		}
	}, [ type, ids.join( ',' ) ] ); // eslint-disable-line react-hooks/exhaustive-deps
	useEffect( () => {
		if ( type ) {
			getPosts( type ).then( ( list ) => {
				remember( list );
				setOptions( list );
			}, () => {} );
		}
	}, [ type ] );

	const search = useDebounced( ( text ) => {
		if ( type ) {
			getPosts( type, { search: text } ).then( ( list ) => {
				remember( list );
				setOptions( list );
			}, () => {} );
		}
	} );
	const move = ( index, by ) => {
		const next = [ ...ids ];
		const [ id ] = next.splice( index, 1 );
		next.splice( index + by, 0, id );
		onChange( next );
	};

	return (
		<div className="wrbc-query-picker">
			{ ids.length < max && (
				<ComboboxControl
					__nextHasNoMarginBottom
					__next40pxDefaultSize
					label={ __( 'Add an item', 'werun-blocks-community' ) }
					value={ null }
					options={ options.filter( ( p ) => ! ids.includes( p.id ) ).map( ( p ) => ( { value: String( p.id ), label: `${ p.title || __( '(no title)', 'werun-blocks-community' ) } · ${ p.date }` } ) ) }
					onFilterValueChange={ search }
					onChange={ ( id ) => id && onChange( [ ...ids, Number( id ) ] ) }
				/>
			) }
			{ ids.length > 0 ? (
				<ol className="wrbc-query-picker__list">
					{ ids.map( ( id, index ) => (
						<li key={ id }>
							<span>{ titles[ id ] || `#${ id }` }</span>
							<Button size="small" icon="arrow-up-alt2" label={ __( 'Move up', 'werun-blocks-community' ) } disabled={ index === 0 } onClick={ () => move( index, -1 ) } />
							<Button size="small" icon="arrow-down-alt2" label={ __( 'Move down', 'werun-blocks-community' ) } disabled={ index === ids.length - 1 } onClick={ () => move( index, 1 ) } />
							<Button size="small" icon="no-alt" isDestructive label={ __( 'Remove', 'werun-blocks-community' ) } onClick={ () => onChange( ids.filter( ( x ) => x !== id ) ) } />
						</li>
					) ) }
				</ol>
			) : (
				<p className="wrbc-query-help">{ __( 'Nothing picked yet: search above and pick items in the order they should show.', 'werun-blocks-community' ) }</p>
			) }
		</div>
	);
}

const GUESS_LABELS = {
	numeric: __( 'number', 'werun-blocks-community' ),
	date: __( 'date', 'werun-blocks-community' ),
	url: __( 'link', 'werun-blocks-community' ),
	email: __( 'email', 'werun-blocks-community' ),
	attachment: __( 'file', 'werun-blocks-community' ),
	latlng: __( 'coordinates', 'werun-blocks-community' ),
	text: __( 'text', 'werun-blocks-community' ),
};

/**
 * A custom field picker: registered keys first, then the ones found in the
 * latest posts, with what their values look like and a few samples. Any
 * other valid key can be typed.
 *
 * @param {Object}   props
 * @param {Object}   props.metaKeys { registered, detected } from /query/meta-keys.
 * @param {string}   props.value    Key.
 * @param {Function} props.onChange ( key, entry ) with the picked entry (or undefined).
 * @param {Function} props.filter   ( entry ) => bool, to narrow the list (e.g. dates only).
 */
export function MetaKeyControl( { metaKeys, value, onChange, label, help, filter } ) {
	const [ typed, setTyped ] = useState( '' );
	const entries = useMemo( () => {
		const registered = ( metaKeys?.registered || [] ).map( ( e ) => ( { ...e, source: 'registered' } ) );
		const detected = ( metaKeys?.detected || [] ).map( ( e ) => ( { ...e, source: 'detected' } ) );
		return [ ...registered, ...detected ];
	}, [ metaKeys ] );
	const shown = filter ? entries.filter( filter ) : entries;
	const options = shown.map( ( e ) => ( { value: e.key, label: e.key, entry: e } ) );
	if ( value && ! options.some( ( o ) => o.value === value ) ) {
		options.unshift( { value, label: value } );
	}
	if ( typed && META_KEY_RE.test( typed ) && ! options.some( ( o ) => o.value === typed ) ) {
		/* translators: %s: typed meta key */
		options.push( { value: typed, label: sprintf( __( 'Use “%s”', 'werun-blocks-community' ), typed ) } );
	}
	return (
		<ComboboxControl
			__nextHasNoMarginBottom
			__next40pxDefaultSize
			label={ label || __( 'Custom field', 'werun-blocks-community' ) }
			help={ help || __( 'Hidden fields (starting with _) only when registered for the REST API; fields that look like passwords, tokens or keys never.', 'werun-blocks-community' ) }
			value={ value || null }
			options={ options }
			onFilterValueChange={ setTyped }
			onChange={ ( key ) => onChange( key || '', entries.find( ( e ) => e.key === key ) ) }
			__experimentalRenderItem={ ( { item } ) => (
				<div className="wrbc-query-key">
					<span className="wrbc-query-key__name">{ item.label }</span>
					{ item.entry && (
						<span className="wrbc-query-key__badges">
							<span className={ `wrbc-query-badge wrbc-query-badge--${ item.entry.source }` }>
								{ item.entry.source === 'registered' ? __( 'registered', 'werun-blocks-community' ) : __( 'found in posts', 'werun-blocks-community' ) }
							</span>
							{ item.entry.guess && <span className="wrbc-query-badge">{ GUESS_LABELS[ item.entry.guess ] || item.entry.guess }</span> }
							{ item.entry.count > 0 && (
								/* translators: %d: number of posts */
								<span className="wrbc-query-badge">{ sprintf( __( '%d posts', 'werun-blocks-community' ), item.entry.count ) }</span>
							) }
						</span>
					) }
					{ item.entry?.samples?.length > 0 && <span className="wrbc-query-key__samples">{ item.entry.samples.join( ' · ' ) }</span> }
				</div>
			) }
		/>
	);
}
