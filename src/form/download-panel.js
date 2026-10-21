/**
 * Document sidebar panel: the file a post downloads when it is used as a
 * gated resource (post meta _wrbc_download_id, includes/gate/class-gate.php).
 * Shown only where the meta is exposed (post types with custom fields).
 */
import { __ } from '@wordpress/i18n';
import { Button } from '@wordpress/components';
import { MediaUpload, MediaUploadCheck } from '@wordpress/block-editor';
import { useDispatch, useSelect } from '@wordpress/data';
import { PluginDocumentSettingPanel } from '@wordpress/editor';

const KEY = '_wrbc_download_id';

export default function DownloadPanel() {
	const { meta, file } = useSelect( ( select ) => {
		const m = select( 'core/editor' ).getEditedPostAttribute( 'meta' );
		const id = m && Number( m[ KEY ] );
		return { meta: m, file: id ? select( 'core' ).getMedia( id ) : null };
	}, [] );
	const { editPost } = useDispatch( 'core/editor' );
	if ( ! meta || ! ( KEY in meta ) ) {
		return null;
	}
	const id = Number( meta[ KEY ] ) || 0;
	const set = ( value ) => editPost( { meta: { [ KEY ]: value } } );
	return (
		<PluginDocumentSettingPanel name="wrbc-gated-download" title={ __( 'Gated download', 'werun-blocks-community' ) }>
			<p>{ __( 'The file this post unlocks when a form block or a resource card gates it.', 'werun-blocks-community' ) }</p>
			{ id > 0 && <p><strong>{ file?.title?.rendered || file?.source_url?.split( '/' ).pop() || `#${ id }` }</strong></p> }
			<MediaUploadCheck>
				<MediaUpload
					onSelect={ ( media ) => set( media.id ) }
					value={ id || undefined }
					render={ ( { open } ) => (
						<Button variant="secondary" onClick={ open }>
							{ id ? __( 'Replace the file', 'werun-blocks-community' ) : __( 'Choose the file', 'werun-blocks-community' ) }
						</Button>
					) }
				/>
			</MediaUploadCheck>
			{ id > 0 && (
				<Button variant="link" isDestructive onClick={ () => set( 0 ) }>
					{ __( 'Remove', 'werun-blocks-community' ) }
				</Button>
			) }
		</PluginDocumentSettingPanel>
	);
}
