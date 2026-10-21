/**
 * Local stand-in for ConsentControl( { value, onChange } ) from
 * src/shared/controls-extra.js (modules owner, docs/shared-modules.md).
 * Same props and values (inherit | click | cmp | none): swap the import in
 * edit.js once the shared one ships, then delete this file.
 */
import { __ } from '@wordpress/i18n';
import { SelectControl } from '@wordpress/components';

export function ConsentControl( { value, onChange, help } ) {
	return (
		<SelectControl
			__nextHasNoMarginBottom
			__next40pxDefaultSize
			label={ __( 'Consent before loading', 'werun-blocks-community' ) }
			help={ help }
			value={ value || 'inherit' }
			options={ [
				{
					value: 'inherit',
					label: __(
						'Site setting (Integrations → Privacy)',
						'werun-blocks-community'
					),
				},
				{
					value: 'click',
					label: __( 'Load on click', 'werun-blocks-community' ),
				},
				{
					value: 'cmp',
					label: __( 'Follow the cookie banner', 'werun-blocks-community' ),
				},
				{
					value: 'none',
					label: __( 'Don’t ask (load when played)', 'werun-blocks-community' ),
				},
			] }
			onChange={ onChange }
		/>
	);
}
