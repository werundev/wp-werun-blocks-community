import { __, _x, sprintf } from '@wordpress/i18n';
import { InspectorControls, MediaUpload, MediaUploadCheck, RichText, useBlockProps } from '@wordpress/block-editor';
import { Button, PanelBody, RangeControl } from '@wordpress/components';
import { useRef } from '@wordpress/element';
import { Icon } from '../shared/icons';
import { cssVars, cx, Toggle } from '../shared/controls';
import { ContrastAudit } from '../shared/a11y';
import { blockColors, useContextBackground } from '../shared/contrast';
import { cardColors } from '../testimonials/colors';

export default function Edit( { attributes, setAttributes, context, clientId } ) {
	const a = attributes;
	const get = ( key, fallback ) => context[ `werun-community/testimonials/${ key }` ] ?? fallback;
	const parentRating = get( 'showRating', true );
	const parentAvatar = get( 'showAvatar', true );
	const showRating = parentRating && ! a.hideRating;
	const showAvatar = parentAvatar && ! a.hideAvatar;
	const onSelectPhoto = ( media ) => setAttributes( { avatarId: media.id, avatarUrl: media.sizes?.thumbnail?.url || media.url } );
	// A card with a background of its own (shadow style, card background, its Color panel):
	// tone class, accent, focus and stars for it, as card.php prints them.
	const ref = useRef();
	const around = useContextBackground( clientId );
	const own = blockColors( a );
	const colors = cardColors(
		{ cardStyle: get( 'cardStyle', 'bordered' ), cardBg: get( 'cardBg', '' ), starColor: get( 'starColor', '' ), accentColor: get( 'accentColor', '' ), surface: around },
		own.background,
		own.text
	);
	const blockProps = useBlockProps( { ref, className: cx( 'wrbc-testi wrbc-anim-host', colors.tone, colors.painted && 'wrbc-testi--painted' ), style: cssVars( colors.vars ) } );

	return (
		<>
			<ContrastAudit blockRef={ ref } deps={ [ attributes, context, around ] } checks={ [ { selector: '.wrbc-testi__star', property: 'color', min: 3, label: __( 'Stars', 'werun-blocks-community' ) } ] } />
			<InspectorControls>
				{ ( showRating || showAvatar ) && (
					<PanelBody title={ __( 'Testimonial', 'werun-blocks-community' ) }>
						{ showRating && (
							<RangeControl
								__nextHasNoMarginBottom
								__next40pxDefaultSize
								label={ __( 'Stars', 'werun-blocks-community' ) }
								help={ a.rating ? undefined : __( 'With 0 stars, this card shows no rating.', 'werun-blocks-community' ) }
								value={ a.rating }
								min={ 0 }
								max={ 5 }
								onChange={ ( rating ) => setAttributes( { rating } ) }
							/>
						) }
						{ showAvatar && (
							<>
								<MediaUploadCheck>
									<MediaUpload
										allowedTypes={ [ 'image' ] }
										value={ a.avatarId }
										onSelect={ onSelectPhoto }
										render={ ( { open } ) => (
											<Button variant="secondary" onClick={ open }>
												{ a.avatarUrl ? __( 'Replace photo', 'werun-blocks-community' ) : __( 'Add a photo', 'werun-blocks-community' ) }
											</Button>
										) }
									/>
								</MediaUploadCheck>
								{ a.avatarUrl && (
									<Button variant="tertiary" isDestructive onClick={ () => setAttributes( { avatarId: undefined, avatarUrl: undefined } ) }>
										{ __( 'Remove photo', 'werun-blocks-community' ) }
									</Button>
								) }
							</>
						) }
					</PanelBody>
				) }
				{ /* Hiding per card only means something for what the testimonials block shows on every card. */ }
				{ ( parentRating || parentAvatar ) && (
					<PanelBody title={ __( 'Hide in this card', 'werun-blocks-community' ) } initialOpen={ false }>
						{ parentRating && <Toggle attributes={ a } setAttributes={ setAttributes } name="hideRating" label={ __( 'Stars', 'werun-blocks-community' ) } /> }
						{ parentAvatar && <Toggle attributes={ a } setAttributes={ setAttributes } name="hideAvatar" label={ __( 'Photo', 'werun-blocks-community' ) } /> }
					</PanelBody>
				) }
			</InspectorControls>

			<figure { ...blockProps }>
				{ ( get( 'showQuoteIcon', true ) || showRating ) && (
					<div className="wrbc-testi__top">
						{ get( 'showQuoteIcon', true ) && <Icon icon={ get( 'quoteIcon', { name: 'quote' } ) } className="wrbc-testi__mark" /> }
						{ showRating && (
							// The page prints these stars as one image labelled "Rated n out of 5" (card.php); here each is a button.
							<span className="wrbc-testi__rating wrbc-testi__rating-edit" role="group" aria-label={ __( 'Stars', 'werun-blocks-community' ) }>
								{ [ 1, 2, 3, 4, 5 ].map( ( n ) => (
									<button
										key={ n }
										type="button"
										onClick={ () => setAttributes( { rating: n === a.rating ? n - 1 : n } ) }
										aria-label={ sprintf( /* translators: %d: stars */ __( '%d stars', 'werun-blocks-community' ), n ) }
										aria-pressed={ n === a.rating }
									>
										<Icon icon={ { name: 'star' } } className={ `wrbc-testi__star${ n <= a.rating ? ' is-on' : '' }` } />
									</button>
								) ) }
							</span>
						) }
					</div>
				) }
				<blockquote className="wrbc-testi__quote">
					<RichText
						tagName="p"
						value={ a.quote }
						onChange={ ( quote ) => setAttributes( { quote } ) }
						placeholder={ __( 'What they said.', 'werun-blocks-community' ) }
						allowedFormats={ [ 'core/bold', 'core/italic' ] }
					/>
				</blockquote>
				<figcaption className="wrbc-testi__author">
					{ showAvatar && (
						<MediaUploadCheck>
							<MediaUpload
								allowedTypes={ [ 'image' ] }
								value={ a.avatarId }
								onSelect={ onSelectPhoto }
								render={ ( { open } ) => (
									<button type="button" className="wrbc-testi__avatar-btn" onClick={ open } aria-label={ __( 'Choose a photo', 'werun-blocks-community' ) }>
										{ a.avatarUrl ? (
											<img className="wrbc-testi__avatar" src={ a.avatarUrl } alt="" />
										) : (
											<span className="wrbc-testi__avatar-empty">
												<Icon icon={ { name: 'user-round' } } />
											</span>
										) }
									</button>
								) }
							/>
						</MediaUploadCheck>
					) }
					<span className="wrbc-testi__meta">
						<RichText
							tagName="cite"
							className="wrbc-testi__name"
							value={ a.name }
							onChange={ ( name ) => setAttributes( { name } ) }
							placeholder={ __( 'Name', 'werun-blocks-community' ) }
							allowedFormats={ [] }
						/>
						{ /* As card.php: read aloud, a comma between the name and the role. */ }
						{ get( 'showRole', true ) && <span className="wrbc-sr-only">{ _x( ',', "spoken between a person's name and their role", 'werun-blocks-community' ) + ' ' }</span> }
						{ get( 'showRole', true ) && (
							<RichText
								tagName="span"
								className="wrbc-testi__role"
								value={ a.role }
								onChange={ ( role ) => setAttributes( { role } ) }
								placeholder={ __( 'Role, company', 'werun-blocks-community' ) }
								allowedFormats={ [ 'core/link' ] }
							/>
						) }
					</span>
				</figcaption>
			</figure>
		</>
	);
}
