/**
 * The logos list in the sidebar: add several from the media library at once,
 * reorder, replace, remove, and edit each logo's alt text, name and link.
 */
import { __, sprintf } from '@wordpress/i18n';
import { MediaUpload, MediaUploadCheck } from '@wordpress/block-editor';
import { Button, Flex, FlexItem, PanelBody, TextControl, ToggleControl } from '@wordpress/components';
import { useState } from '@wordpress/element';

/** A stored field as trimmed text: block JSON can hold any type there. */
const text = ( value ) => ( typeof value === 'string' ? value.trim() : '' );

/** What the block keeps of a media library item. */
export function fromMedia( media ) {
	return {
		id: media.id,
		url: media.sizes?.medium?.url || media.url,
		alt: media.alt || '',
		// Not the media title: it is often a file name, and the name is a visible caption.
		name: '',
	};
}

/** Add the chosen items, skipping those already in the list. */
export function addMedia( logos, items ) {
	const have = new Set( logos.map( ( logo ) => logo.id ).filter( Boolean ) );
	const added = ( Array.isArray( items ) ? items : [ items ] ).filter( ( media ) => media?.id && ! have.has( media.id ) ).map( fromMedia );
	return [ ...logos, ...added ];
}

/** A button that opens the media library for several images. */
export function AddLogosButton( { logos, onChange, variant = 'secondary', label } ) {
	return (
		<MediaUploadCheck>
			<MediaUpload
				allowedTypes={ [ 'image' ] }
				multiple
				onSelect={ ( items ) => onChange( addMedia( logos, items ) ) }
				render={ ( { open } ) => (
					<Button variant={ variant } onClick={ open } icon="plus-alt2">
						{ label || __( 'Add logos', 'werun-blocks-community' ) }
					</Button>
				) }
			/>
		</MediaUploadCheck>
	);
}

export function LogoList( { logos, onChange, showNames } ) {
	const [ open, setOpen ] = useState( null );
	const update = ( index, changes ) => onChange( logos.map( ( logo, i ) => ( i === index ? { ...logo, ...changes } : logo ) ) );
	const move = ( index, to ) => {
		const next = [ ...logos ];
		const [ item ] = next.splice( index, 1 );
		next.splice( to, 0, item );
		onChange( next );
		setOpen( open === index ? to : open );
	};
	const remove = ( index ) => {
		onChange( logos.filter( ( _, i ) => i !== index ) );
		setOpen( null );
	};

	return (
		<PanelBody title={ __( 'Logos', 'werun-blocks-community' ) }>
			{ ! logos.length && <p className="wrbc-logos-edit__empty">{ __( 'No logos yet. Pick one or several from the media library.', 'werun-blocks-community' ) }</p> }
			<ul className="wrbc-logos-edit__list">
				{ logos.map( ( logo, index ) => {
					const title = logo.name || logo.alt || sprintf( /* translators: %d: logo number */ __( 'Logo %d', 'werun-blocks-community' ), index + 1 );
					const isOpen = open === index;
					return (
						<li key={ `${ logo.id || logo.url }-${ index }` } className="wrbc-logos-edit__row">
							<Flex align="center" gap={ 2 }>
								<FlexItem className="wrbc-logos-edit__thumb">{ logo.url ? <img src={ logo.url } alt="" /> : null }</FlexItem>
								<FlexItem isBlock>
									<Button
										variant="link"
										className="wrbc-logos-edit__name"
										aria-expanded={ isOpen }
										onClick={ () => setOpen( isOpen ? null : index ) }
									>
										{ title }
									</Button>
									{ /* render.php falls back to the name (shown or not), then to the media library's alt text. */ }
									{ ! text( logo.alt ) && ! text( logo.name ) && (
										<span className="wrbc-logos-edit__warn">
											{ text( logo.link )
												? __( 'No alt text: the link is read as its address', 'werun-blocks-community' )
												: __( 'No alt text: screen readers skip this logo', 'werun-blocks-community' ) }
										</span>
									) }
								</FlexItem>
								<FlexItem>
									<Button
										size="small"
										icon="arrow-up-alt2"
										disabled={ index === 0 }
										label={ sprintf( /* translators: %s: logo name */ __( 'Move %s up', 'werun-blocks-community' ), title ) }
										onClick={ () => move( index, index - 1 ) }
									/>
									<Button
										size="small"
										icon="arrow-down-alt2"
										disabled={ index === logos.length - 1 }
										label={ sprintf( /* translators: %s: logo name */ __( 'Move %s down', 'werun-blocks-community' ), title ) }
										onClick={ () => move( index, index + 1 ) }
									/>
									<Button
										size="small"
										icon="no-alt"
										isDestructive
										label={ sprintf( /* translators: %s: logo name */ __( 'Remove %s', 'werun-blocks-community' ), title ) }
										onClick={ () => remove( index ) }
									/>
								</FlexItem>
							</Flex>
							{ isOpen && (
								<div className="wrbc-logos-edit__fields">
									<TextControl
										__nextHasNoMarginBottom
										__next40pxDefaultSize
										label={ __( 'Alt text', 'werun-blocks-community' ) }
										help={ __( 'Usually the company name. Left empty: the name below, then the alt text of the image in the media library.', 'werun-blocks-community' ) }
										value={ logo.alt || '' }
										onChange={ ( alt ) => update( index, { alt } ) }
									/>
									<TextControl
										__nextHasNoMarginBottom
										__next40pxDefaultSize
										label={ __( 'Name', 'werun-blocks-community' ) }
										help={ showNames ? __( 'Shown under the logo.', 'werun-blocks-community' ) : __( 'Shown under the logo when "Names under the logos" is on.', 'werun-blocks-community' ) }
										value={ logo.name || '' }
										onChange={ ( name ) => update( index, { name } ) }
									/>
									<TextControl
										__nextHasNoMarginBottom
										__next40pxDefaultSize
										label={ __( 'Link', 'werun-blocks-community' ) }
										type="url"
										placeholder="https://"
										value={ logo.link || '' }
										onChange={ ( link ) => update( index, { link } ) }
									/>
									{ !! logo.link && (
										<ToggleControl
											__nextHasNoMarginBottom
											label={ __( 'Open in a new tab', 'werun-blocks-community' ) }
											checked={ !! logo.newTab }
											onChange={ ( newTab ) => update( index, { newTab } ) }
										/>
									) }
									<MediaUploadCheck>
										<MediaUpload
											allowedTypes={ [ 'image' ] }
											value={ logo.id }
											onSelect={ ( media ) => {
												const next = fromMedia( media );
												// A new image brings its own alt text; the name and link stay.
												update( index, { id: next.id, url: next.url, alt: next.alt } );
											} }
											render={ ( { open: openMedia } ) => (
												<Button variant="secondary" size="compact" onClick={ openMedia }>
													{ __( 'Replace image', 'werun-blocks-community' ) }
												</Button>
											) }
										/>
									</MediaUploadCheck>
								</div>
							) }
						</li>
					);
				} ) }
			</ul>
			<AddLogosButton logos={ logos } onChange={ onChange } />
		</PanelBody>
	);
}
