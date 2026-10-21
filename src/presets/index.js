/**
 * Saved styles: a "Saved styles" panel on every werun.Blocks.Community parent block (supports()).
 * Saves the block's styles and options (every attribute except content:
 * "role": "content" in block.json, and anchor/metadata/lock) with a name, and
 * applies a saved one to the same block on any page. The page's own texts,
 * images and links stay. Storage and validation: includes/presets/class-presets.php.
 */
import apiFetch from '@wordpress/api-fetch';
import { getBlockType } from '@wordpress/blocks';
import { InspectorControls } from '@wordpress/block-editor';
import { Button, Flex, PanelBody, SelectControl, TextControl } from '@wordpress/components';
import { createHigherOrderComponent } from '@wordpress/compose';
import { useDispatch } from '@wordpress/data';
import { useEffect, useState } from '@wordpress/element';
import { addFilter } from '@wordpress/hooks';
import { __, sprintf } from '@wordpress/i18n';
import { store as noticesStore } from '@wordpress/notices';
// Editor-wide hooks every werun block needs (this panel loads in every editor).
import '../shared/editor-hooks';

/**
 * Whether a block offers presets: every werun-community/* block that isn't a child,
 * unless block.json opts out with "supports": { "wrbcPresets": false }.
 * Twin: Presets::supports().
 */
function supports( name ) {
	const type = getBlockType( name );
	return !! type && name.startsWith( 'werun-community/' ) && ! type.parent?.length && ! type.ancestor?.length && type.supports?.wrbcPresets !== false;
}

/** Same list as Presets::SKIP. */
const SKIP = [ 'anchor', 'metadata', 'lock' ];

/** Presets already loaded, per block name: one request per block per session. */
const cache = new Map();

/** The attributes a preset holds for a block (Presets::style_keys()). */
function styleKeys( name ) {
	const attributes = getBlockType( name )?.attributes || {};
	return Object.keys( attributes ).filter( ( key ) => {
		const schema = attributes[ key ] || {};
		return ( schema.role ?? schema.__experimentalRole ) !== 'content' && ! SKIP.includes( key );
	} );
}

/** The block's current styles and options. */
function currentStyle( name, attributes ) {
	const out = {};
	styleKeys( name ).forEach( ( key ) => {
		if ( attributes[ key ] !== undefined ) {
			out[ key ] = attributes[ key ];
		}
	} );
	return out;
}

function SavedStyles( { name, attributes, setAttributes } ) {
	const [ presets, setPresets ] = useState( cache.get( name ) || null );
	const [ selected, setSelected ] = useState( '' );
	const [ newName, setNewName ] = useState( '' );
	const [ busy, setBusy ] = useState( false );
	const [ confirmDelete, setConfirmDelete ] = useState( false );
	const { createSuccessNotice, createErrorNotice } = useDispatch( noticesStore );

	const remember = ( list ) => {
		cache.set( name, list );
		setPresets( list );
	};

	useEffect( () => {
		if ( cache.has( name ) ) {
			return;
		}
		apiFetch( { path: `/wrbc/v1/presets?block=${ encodeURIComponent( name ) }` } )
			.then( remember )
			.catch( () => remember( [] ) );
	}, [ name ] );

	const preset = ( presets || [] ).find( ( item ) => String( item.id ) === selected );
	const fail = ( error ) => createErrorNotice( error?.message || __( 'Something went wrong. Try again.', 'werun-blocks-community' ), { type: 'snackbar' } );
	const run = ( promise ) => {
		setBusy( true );
		return promise.catch( fail ).finally( () => setBusy( false ) );
	};

	const apply = () => {
		if ( ! preset ) {
			return;
		}
		// Every style key: the preset's value, or undefined so the block's
		// default comes back for what the preset didn't set.
		const next = {};
		styleKeys( name ).forEach( ( key ) => {
			next[ key ] = preset.attributes[ key ];
		} );
		setAttributes( next );
		/* translators: %s: saved style name. */
		createSuccessNotice( sprintf( __( '“%s” applied. The content of the block didn’t change.', 'werun-blocks-community' ), preset.name ), { type: 'snackbar' } );
	};

	const save = () =>
		run(
			apiFetch( {
				path: '/wrbc/v1/presets',
				method: 'POST',
				data: { block: name, name: newName.trim(), attributes: currentStyle( name, attributes ) },
			} ).then( ( created ) => {
				remember( [ ...( presets || [] ), created ].sort( ( a, b ) => a.name.localeCompare( b.name ) ) );
				setSelected( String( created.id ) );
				setNewName( '' );
				/* translators: %s: saved style name. */
				createSuccessNotice( sprintf( __( 'Style “%s” saved. Choose it in this block on any page.', 'werun-blocks-community' ), created.name ), { type: 'snackbar' } );
			} )
		);

	const overwrite = () =>
		run(
			apiFetch( {
				path: `/wrbc/v1/presets/${ preset.id }`,
				method: 'PUT',
				data: { attributes: currentStyle( name, attributes ) },
			} ).then( ( updated ) => {
				remember( presets.map( ( item ) => ( item.id === updated.id ? updated : item ) ) );
				/* translators: %s: saved style name. */
				createSuccessNotice( sprintf( __( '“%s” now has this block’s settings.', 'werun-blocks-community' ), updated.name ), { type: 'snackbar' } );
			} )
		);

	const remove = () =>
		run(
			apiFetch( { path: `/wrbc/v1/presets/${ preset.id }`, method: 'DELETE' } ).then( () => {
				remember( presets.filter( ( item ) => item.id !== preset.id ) );
				setSelected( '' );
				setConfirmDelete( false );
				createSuccessNotice( __( 'Saved style deleted. Blocks that used it keep their settings.', 'werun-blocks-community' ), { type: 'snackbar' } );
			} )
		);

	return (
		<PanelBody title={ __( 'Saved styles', 'werun-blocks-community' ) } initialOpen={ false }>
			<p className="wrbc-presets__help">
				{ __( 'Save this block’s styles and options to use them on another page. Texts, images and links aren’t saved.', 'werun-blocks-community' ) }
			</p>

			{ presets === null && <p>{ __( 'Loading…', 'werun-blocks-community' ) }</p> }

			{ presets && presets.length > 0 && (
				<>
					<SelectControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Saved style', 'werun-blocks-community' ) }
						value={ selected }
						options={ [
							{ value: '', label: __( 'Choose a style…', 'werun-blocks-community' ) },
							...presets.map( ( item ) => ( { value: String( item.id ), label: item.name } ) ),
						] }
						onChange={ ( value ) => {
							setSelected( value );
							setConfirmDelete( false );
						} }
					/>
					{ preset && (
						<Flex className="wrbc-presets__actions" wrap justify="flex-start" gap={ 2 }>
							<Button variant="primary" size="compact" onClick={ apply } disabled={ busy }>
								{ __( 'Apply', 'werun-blocks-community' ) }
							</Button>
							{ preset.canEdit && ! confirmDelete && (
								<>
									<Button variant="secondary" size="compact" onClick={ overwrite } disabled={ busy }>
										{ __( 'Update with this block', 'werun-blocks-community' ) }
									</Button>
									<Button variant="tertiary" size="compact" isDestructive onClick={ () => setConfirmDelete( true ) } disabled={ busy }>
										{ __( 'Delete', 'werun-blocks-community' ) }
									</Button>
								</>
							) }
							{ preset.canEdit && confirmDelete && (
								<>
									<Button variant="primary" size="compact" isDestructive onClick={ remove } disabled={ busy }>
										{ __( 'Delete for good', 'werun-blocks-community' ) }
									</Button>
									<Button variant="tertiary" size="compact" onClick={ () => setConfirmDelete( false ) }>
										{ __( 'Cancel', 'werun-blocks-community' ) }
									</Button>
								</>
							) }
						</Flex>
					) }
				</>
			) }

			{ presets && presets.length === 0 && <p>{ __( 'No saved styles for this block yet.', 'werun-blocks-community' ) }</p> }

			<TextControl
				__nextHasNoMarginBottom
				__next40pxDefaultSize
				label={ __( 'Save the current settings as', 'werun-blocks-community' ) }
				placeholder={ __( 'Style name, e.g. Dark hero', 'werun-blocks-community' ) }
				value={ newName }
				maxLength={ 80 }
				onChange={ setNewName }
			/>
			<Button variant="secondary" size="compact" className="wrbc-presets__save" onClick={ save } disabled={ busy || ! newName.trim() }>
				{ __( 'Save style', 'werun-blocks-community' ) }
			</Button>
		</PanelBody>
	);
}

const withSavedStyles = createHigherOrderComponent(
	( BlockEdit ) => ( props ) => {
		if ( ! props.isSelected || ! supports( props.name ) ) {
			return <BlockEdit { ...props } />;
		}
		return (
			<>
				<BlockEdit { ...props } />
				<InspectorControls>
					<SavedStyles name={ props.name } attributes={ props.attributes } setAttributes={ props.setAttributes } />
				</InspectorControls>
			</>
		);
	},
	'withSavedStyles'
);

addFilter( 'editor.BlockEdit', 'werun-blocks-community/saved-styles', withSavedStyles );
