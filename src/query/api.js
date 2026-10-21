/**
 * Editor requests to the wrbc/v1/query routes, cached for the session.
 */
import apiFetch from '@wordpress/api-fetch';
import { addQueryArgs } from '@wordpress/url';
import { useEffect, useState } from '@wordpress/element';

const cache = new Map();

/** One GET per path per session; failures are retried next time. */
export function cachedGet( path ) {
	if ( ! cache.has( path ) ) {
		cache.set(
			path,
			apiFetch( { path } ).catch( ( error ) => {
				cache.delete( path );
				throw error;
			} )
		);
	}
	return cache.get( path );
}

/** { data, error, loading } for a path (null = nothing to load). */
export function useGet( path ) {
	const [ state, setState ] = useState( { data: null, error: null, loading: !! path } );
	useEffect( () => {
		if ( ! path ) {
			setState( { data: null, error: null, loading: false } );
			return undefined;
		}
		let live = true;
		setState( ( s ) => ( { ...s, loading: true } ) );
		cachedGet( path ).then(
			( data ) => live && setState( { data, error: null, loading: false } ),
			( error ) => live && setState( { data: null, error, loading: false } )
		);
		return () => {
			live = false;
		};
	}, [ path ] );
	return state;
}

export const useSources = () => useGet( '/wrbc/v1/query/sources' );

export const useMetaKeys = ( type ) => useGet( type ? addQueryArgs( '/wrbc/v1/query/meta-keys', { type } ) : null );

export const getTerms = ( taxonomy, args = {} ) => cachedGet( addQueryArgs( '/wrbc/v1/query/terms', { taxonomy, ...args } ) );

export const getPosts = ( type, args = {} ) => cachedGet( addQueryArgs( '/wrbc/v1/query/posts', { type, ...args } ) );

export const getAuthors = () => cachedGet( '/wp/v2/users?per_page=100&_fields=id,name' );

/** The server's markup for the canvas; `uid` (the block's id in the editor) prefixes the ids it prints. */
export const preview = ( attributes, postId, uid = '' ) =>
	apiFetch( { path: '/wrbc/v1/query/preview', method: 'POST', data: { attributes, postId, uid } } );
