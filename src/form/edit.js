import { __, sprintf } from '@wordpress/i18n';
import { InspectorControls, MediaUpload, MediaUploadCheck, PanelColorSettings, RichText, useBlockProps } from '@wordpress/block-editor';
import { Button, Notice, PanelBody, RangeControl, SelectControl, Spinner, TextControl, TextareaControl, ToggleControl } from '@wordpress/components';
import { useEffect, useRef, useState } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import { Icon } from '../shared/icons';
import { ConsentControl } from '../shared/controls-extra';
import { Choice, cssVars, cx, px } from '../shared/controls';
import { ContrastAudit } from '../shared/a11y';
import { AA_TEXT, accentVars, blockColors, colorHex, contrastRatio, toneClass, useContextBackground, useSurface } from '../shared/contrast';
import { HEIGHTS, hasHeight, isValidFormId, normaliseFormId } from './providers';
import { legacyStyle } from './legacy';
import { formColors } from './colors';

/* One request per editor session: the sources rarely change while editing. */
let sourcesPromise = null;
const loadSources = () => {
	if ( ! sourcesPromise ) {
		sourcesPromise = apiFetch( { path: '/wrbc/v1/forms/sources' } ).catch( ( error ) => {
			sourcesPromise = null;
			throw error;
		} );
	}
	return sourcesPromise;
};

const integrations = () => window.wrbcSettings?.integrations || {};

/** The supports' style object without its text colour (and without what that leaves empty). */
function withoutTextColor( style ) {
	if ( ! style || typeof style !== 'object' || ! style.color ) {
		return style;
	}
	const { text, ...color } = style.color;
	const next = { ...style, color };
	if ( ! Object.keys( color ).length ) {
		delete next.color;
	}
	return Object.keys( next ).length ? next : undefined;
}

/** The Integrations default a provider needs and hasn't got (one message per provider). */
function missingDefault( meta, a ) {
	const d = meta?.defaults || {};
	switch ( meta?.id ) {
		case 'hubspot':
			return ! d.hubspot_portal && ! /^\d{3,12}$/.test( a.extra?.portal || '' ) ? __( 'Set the HubSpot portal ID here or under Settings › werun.Blocks.Community › Integrations.', 'werun-blocks-community' ) : '';
		case 'marketo':
			return ! d.marketo_base || ! d.marketo_munchkin ? __( 'Marketo needs its base URL and Munchkin ID under Settings › werun.Blocks.Community › Integrations.', 'werun-blocks-community' ) : '';
		case 'dynamics':
			return ! d.dynamics_org ? __( 'Dynamics 365 needs the organisation ID under Settings › werun.Blocks.Community › Integrations.', 'werun-blocks-community' ) : '';
		case 'activecampaign':
			return ! d.activecampaign ? __( 'ActiveCampaign needs the account name under Settings › werun.Blocks.Community › Integrations.', 'werun-blocks-community' ) : '';
		default:
			return '';
	}
}

export default function Edit( { attributes, setAttributes, clientId } ) {
	const a = attributes;
	const uid = `wrbc-form-${ clientId.slice( 0, 8 ) }`;
	const [ sources, setSources ] = useState( null );
	const [ error, setError ] = useState( '' );

	useEffect( () => {
		let live = true;
		loadSources()
			.then( ( data ) => live && setSources( data ) )
			.catch( ( e ) => live && setError( e?.message || __( 'Could not load the form sources.', 'werun-blocks-community' ) ) );
		return () => {
			live = false;
		};
	}, [] );

	const providers = sources?.providers || [];
	const meta = providers.find( ( p ) => p.id === a.provider );
	const extra = a.extra && typeof a.extra === 'object' && ! Array.isArray( a.extra ) ? a.extra : {};
	const setExtra = ( patch ) => setAttributes( { extra: { ...extra, ...patch } } );
	const gate = { enabled: false, resourceId: 0, label: '', ...( a.gate || {} ) };
	const setGate = ( patch ) => setAttributes( { gate: { ...gate, ...patch } } );

	// Twin of render.php: what the page will actually do.
	const isNative = meta?.kind === 'native';
	const isSaas = meta?.kind === 'saas';
	const valid = !! meta && isValidFormId( a.provider, a.formId, { pardotDomain: integrations().forms?.pardot_domain } );
	const missing = missingDefault( meta, a );
	const canGate = !! meta && meta.gating !== 'none';
	const gateOn = canGate && !! gate.enabled && Number( gate.resourceId ) > 0;
	const showsAfter = ( isSaas && meta.event ) || gateOn; // success message
	const showsRedirect = isSaas && meta.event && ! gateOn;
	const formTitle = meta?.forms?.find( ( f ) => String( f.id ) === String( a.formId ) )?.title || a.formTitle;
	const resources = sources?.resources || [];
	const resource = resources.find( ( r ) => r.id === Number( gate.resourceId ) );
	// Twin of Forms::consent_mode() / behind_consent(): no placeholder when the effective mode is "none".
	const siteConsent = integrations().privacy?.consent;
	const consentMode = [ 'click', 'cmp', 'none' ].includes( a.consent ) ? a.consent : [ 'click', 'cmp', 'none' ].includes( siteConsent ) ? siteConsent : 'click';
	const asksConsent = !! meta?.consent && consentMode !== 'none';
	// Zoho: a pasted permalink names its data centre (Zoho::validate()), so the region select would do nothing.
	const regionFromUrl = a.provider === 'zoho' && /^https:\/\//i.test( String( a.formId || '' ).trim() );
	// The look. Twin: render.php.
	const look = [ 'card', 'plain', 'inline' ].includes( a.formStyle ) ? a.formStyle : 'card';
	// --wrbc-radius rounds the card and our own fields (Mailchimp inputs) in every style.
	const usesRadius = look === 'card' || a.provider === 'mailchimp';

	// The look used to be stored in `style`, which is also the attribute of
	// the colour / spacing / typography supports. A value that still arrives
	// there (a saved style made with 2.0.0) moves to formStyle.
	useEffect( () => {
		const legacy = legacyStyle( a.style );
		if ( legacy ) {
			setAttributes( { formStyle: legacy.formStyle, style: legacy.style } );
		}
	}, [ a.style ] ); // eslint-disable-line react-hooks/exhaustive-deps

	// What the form sits on, and what keeps it readable there. Twin: render.php (wrbc_form_colors()).
	const surface = useSurface( clientId, a, 'werun-community/form' );
	const around = useContextBackground( clientId );
	// The author's colours as hex, as render.php prints them (the page's style attribute drops rgb()/hsl()/color-mix()).
	const picked = { ...a, accentColor: colorHex( a.accentColor ) || undefined, cardBg: colorHex( a.cardBg ) || undefined };
	const colors = formColors( picked, look, surface );
	// A text colour chosen for the block that doesn't read where it's used (the card's tone replaces it on the card).
	const chosenText = blockColors( a ).text;
	const textFails = !! chosenText && look !== 'card' && contrastRatio( chosenText, colors.background ) < AA_TEXT;

	const ref = useRef();
	const blockProps = useBlockProps( {
		ref,
		className: cx( 'wrbc-root wrbc-form', `wrbc-form--${ look }`, meta && `wrbc-form--${ meta.kind }`, a.provider && `wrbc-form--${ a.provider }`, toneClass( surface, around ) ),
		style: cssVars( {
			...accentVars( picked, colors.background ),
			'--wrbc-form-card-bg': look === 'card' ? picked.cardBg : undefined,
			'--wrbc-form-error': colors.error,
			'--wrbc-form-width': a.width > 0 ? px( Math.max( 280, Math.min( 1200, a.width ) ) ) : undefined,
			'--wrbc-radius': px( a.radius ),
		} ),
	} );
	// The Mailchimp fields are ours: the canvas shows them as the page will (inert), the other providers a card.
	const mcPreview = a.provider === 'mailchimp' && valid;
	const inert = ( node ) => node && node.setAttribute( 'inert', '' );

	const chooseProvider = ( provider ) => setAttributes( { provider, formId: '', formTitle: '', region: '', extra: {} } );
	const native = providers.filter( ( p ) => p.kind === 'native' );
	const saas = providers.filter( ( p ) => p.kind !== 'native' );

	let status = '';
	if ( ! a.provider ) {
		status = __( 'Choose where the form comes from in the sidebar.', 'werun-blocks-community' );
	} else if ( sources && ! meta ) {
		status = __( 'This provider isn’t available on this site any more (plugin deactivated?). Nothing is shown on the page.', 'werun-blocks-community' );
	} else if ( meta && ! a.formId ) {
		status = __( 'Pick or enter the form in the sidebar.', 'werun-blocks-community' );
	} else if ( meta && ! valid ) {
		status = __( 'That form ID isn’t valid for this provider: the page shows nothing until it is fixed.', 'werun-blocks-community' );
	} else if ( missing ) {
		status = missing;
	}

	const level = Math.max( 2, Math.min( 4, a.titleLevel || 2 ) );

	return (
		<>
			{ /* Texts are scanned; the fields' borders (Mailchimp preview) are the non-text check. The editor's own card isn't on the page. */ }
			<ContrastAudit
				blockRef={ ref }
				deps={ [ attributes, surface ] }
				ignore=".wrbc-form-editor__card"
				checks={ [ { selector: '.wrbc-form__input', property: 'border-color', min: 3, label: __( 'Field borders', 'werun-blocks-community' ) } ] }
				labels={ {
					'.wrbc-form__title': __( 'Title', 'werun-blocks-community' ),
					'.wrbc-form__intro': __( 'Intro', 'werun-blocks-community' ),
					'.wrbc-form__label': __( 'Field labels', 'werun-blocks-community' ),
					'.wrbc-form__submit': __( 'Button', 'werun-blocks-community' ),
				} }
				actions={
					textFails
						? [
								{
									label: __( 'Use the automatic text colour', 'werun-blocks-community' ),
									onClick: () => setAttributes( { textColor: undefined, style: withoutTextColor( a.style ) } ),
								},
						  ]
						: []
				}
			/>
			<InspectorControls>
				<PanelBody title={ __( 'Form', 'werun-blocks-community' ) }>
					{ ! sources && ! error && <Spinner /> }
					{ error && (
						<Notice status="error" isDismissible={ false }>
							{ error }
						</Notice>
					) }
					{ sources && (
						<SelectControl __nextHasNoMarginBottom __next40pxDefaultSize label={ __( 'Provider', 'werun-blocks-community' ) } value={ a.provider } onChange={ chooseProvider }>
							<option value="">{ __( 'Choose…', 'werun-blocks-community' ) }</option>
							{ native.length > 0 && (
								<optgroup label={ __( 'Form plugins on this site', 'werun-blocks-community' ) }>
									{ native.map( ( p ) => (
										<option key={ p.id } value={ p.id }>
											{ p.label }
										</option>
									) ) }
								</optgroup>
							) }
							<optgroup label={ __( 'Services', 'werun-blocks-community' ) }>
								{ saas.map( ( p ) => (
									<option key={ p.id } value={ p.id }>
										{ p.label }
									</option>
								) ) }
							</optgroup>
						</SelectControl>
					) }

					{ meta && meta.forms.length > 0 && (
						<SelectControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							label={ __( 'Form', 'werun-blocks-community' ) }
							value={ String( a.formId ) }
							options={ [ { value: '', label: __( 'Choose a form…', 'werun-blocks-community' ) }, ...meta.forms.map( ( f ) => ( { value: String( f.id ), label: f.title || `#${ f.id }` } ) ) ] }
							onChange={ ( formId ) => setAttributes( { formId, formTitle: meta.forms.find( ( f ) => String( f.id ) === formId )?.title || '' } ) }
						/>
					) }
					{ meta && isNative && meta.forms.length === 0 && (
						<Notice status="warning" isDismissible={ false }>
							{ sprintf( /* translators: %s: plugin name */ __( 'No published forms in %s yet. Create one there first.', 'werun-blocks-community' ), meta.label ) }
						</Notice>
					) }
					{ meta && isSaas && meta.forms.length === 0 && (
						<TextControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							label={ a.provider === 'mailchimp' ? __( 'Form action URL', 'werun-blocks-community' ) : __( 'Form ID or URL', 'werun-blocks-community' ) }
							help={ meta.hint }
							value={ a.formId }
							onChange={ ( value ) => setAttributes( { formId: normaliseFormId( a.provider, value ), formTitle: '' } ) }
						/>
					) }
					{ meta && a.formId && ! valid && (
						<Notice status="error" isDismissible={ false }>
							{ __( 'Not a valid value for this provider.', 'werun-blocks-community' ) }
						</Notice>
					) }
					{ missing && (
						<Notice status="warning" isDismissible={ false }>
							{ missing }
						</Notice>
					) }

					{ meta && meta.regions.length > 0 && ! regionFromUrl && (
						<SelectControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							label={ __( 'Region / data centre', 'werun-blocks-community' ) }
							value={ a.region }
							options={ [
								{
									value: '',
									label: sprintf(
										/* translators: %s: region name */
										__( 'Default (%s)', 'werun-blocks-community' ),
										meta.regions.find( ( r ) => r.value === meta.defaultRegion )?.label || meta.regions[ 0 ].label
									),
								},
								...meta.regions,
							] }
							onChange={ ( region ) => setAttributes( { region } ) }
						/>
					) }

					{ a.provider === 'hubspot' && meta && (
						<>
							<TextControl
								__nextHasNoMarginBottom
								__next40pxDefaultSize
								label={ __( 'Portal ID', 'werun-blocks-community' ) }
								help={ meta.defaults.hubspot_portal ? __( 'Empty: the portal set under Integrations.', 'werun-blocks-community' ) : __( 'Digits, from the embed code (portalId).', 'werun-blocks-community' ) }
								value={ extra.portal || '' }
								onChange={ ( portal ) => setExtra( { portal: portal.replace( /\D/g, '' ) } ) }
							/>
							<Choice
								label={ __( 'Embed', 'werun-blocks-community' ) }
								value={ extra.embed === 'v2' ? 'v2' : 'frame' }
								options={ [
									[ 'frame', __( 'New (hs-form-frame)', 'werun-blocks-community' ) ],
									[ 'v2', __( 'Legacy (v2)', 'werun-blocks-community' ) ],
								] }
								onChange={ ( embed ) => setExtra( { embed } ) }
							/>
							{ ! meta.defaults.hubspot_token && (
								<p className="wrbc-form-editor__help">{ __( 'Add a HubSpot private-app token under Integrations to pick forms from a list.', 'werun-blocks-community' ) }</p>
							) }
						</>
					) }

					{ a.provider === 'mailchimp' && (
						<>
							<ToggleControl __nextHasNoMarginBottom label={ __( 'First name field', 'werun-blocks-community' ) } checked={ !! extra.name } onChange={ ( name ) => setExtra( { name } ) } />
							<TextControl
								__nextHasNoMarginBottom
								__next40pxDefaultSize
								label={ __( 'Button label', 'werun-blocks-community' ) }
								placeholder={ __( 'Subscribe', 'werun-blocks-community' ) }
								value={ extra.button || '' }
								onChange={ ( button ) => setExtra( { button } ) }
							/>
						</>
					) }

					{ a.provider === 'calendly' && (
						<ToggleControl __nextHasNoMarginBottom label={ __( 'Hide the event details', 'werun-blocks-community' ) } checked={ !! extra.hideDetails } onChange={ ( hideDetails ) => setExtra( { hideDetails } ) } />
					) }

					{ hasHeight( a.provider ) && (
						<RangeControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							label={ __( 'Height (px)', 'werun-blocks-community' ) }
							value={ extra.height ?? HEIGHTS[ a.provider ] }
							min={ 200 }
							max={ 2000 }
							step={ 10 }
							onChange={ ( height ) => setExtra( { height } ) }
						/>
					) }
				</PanelBody>

				<PanelBody title={ __( 'Layout', 'werun-blocks-community' ) } initialOpen={ false }>
					<Choice
						label={ __( 'Style', 'werun-blocks-community' ) }
						value={ look }
						options={ [
							[ 'card', __( 'Card', 'werun-blocks-community' ) ],
							[ 'plain', __( 'Plain', 'werun-blocks-community' ) ],
							[ 'inline', __( 'Inline', 'werun-blocks-community' ) ],
						] }
						help={ look === 'inline' ? __( 'Title beside the form on wide screens: best for short forms (newsletter).', 'werun-blocks-community' ) : undefined }
						onChange={ ( formStyle ) => setAttributes( { formStyle } ) }
					/>
					<ToggleControl
						__nextHasNoMarginBottom
						label={ __( 'Limit the width', 'werun-blocks-community' ) }
						checked={ a.width > 0 }
						onChange={ ( on ) => setAttributes( { width: on ? 640 : 0 } ) }
					/>
					{ a.width > 0 && (
						<RangeControl __nextHasNoMarginBottom __next40pxDefaultSize label={ __( 'Maximum width (px)', 'werun-blocks-community' ) } value={ a.width } min={ 280 } max={ 1200 } step={ 10 } onChange={ ( width ) => setAttributes( { width } ) } />
					) }
					{ usesRadius && (
						<RangeControl __nextHasNoMarginBottom __next40pxDefaultSize label={ __( 'Corner radius (px)', 'werun-blocks-community' ) } value={ a.radius } min={ 0 } max={ 40 } onChange={ ( radius ) => setAttributes( { radius } ) } />
					) }
					<Choice
						label={ __( 'Title level', 'werun-blocks-community' ) }
						value={ String( level ) }
						options={ [
							[ '2', 'H2' ],
							[ '3', 'H3' ],
							[ '4', 'H4' ],
						] }
						onChange={ ( value ) => setAttributes( { titleLevel: Number( value ) } ) }
					/>
				</PanelBody>

				{ ( showsAfter || showsRedirect ) && (
					<PanelBody title={ __( 'After sending', 'werun-blocks-community' ) } initialOpen={ false }>
						<TextareaControl
							__nextHasNoMarginBottom
							label={ gateOn ? __( 'Text above the download link', 'werun-blocks-community' ) : __( 'Success message', 'werun-blocks-community' ) }
							value={ a.successMessage }
							onChange={ ( successMessage ) => setAttributes( { successMessage } ) }
						/>
						{ showsRedirect && (
							<TextControl
								__nextHasNoMarginBottom
								__next40pxDefaultSize
								type="url"
								label={ __( 'Or go to this page', 'werun-blocks-community' ) }
								help={ __( 'An https:// URL or a path on this site (/thanks). Empty: show the message.', 'werun-blocks-community' ) }
								value={ a.redirectUrl }
								onChange={ ( redirectUrl ) => setAttributes( { redirectUrl: redirectUrl.trim() } ) }
							/>
						) }
					</PanelBody>
				) }

				{ canGate && (
					<PanelBody title={ __( 'Gated download', 'werun-blocks-community' ) } initialOpen={ !! gate.enabled }>
						<ToggleControl
							__nextHasNoMarginBottom
							label={ __( 'Unlock a download with this form', 'werun-blocks-community' ) }
							checked={ !! gate.enabled }
							onChange={ ( enabled ) => setGate( { enabled } ) }
						/>
						{ gate.enabled && (
							<>
								<Notice status={ meta.gating === 'hard' ? 'success' : 'warning' } isDismissible={ false }>
									{ meta.gating === 'hard'
										? __( 'Verified gating: the link unlocks only after this site receives the submission.', 'werun-blocks-community' )
										: sprintf(
												/* translators: %s: provider name */
												__( 'Soft gating: %s reports success in the browser only, so this site can’t verify it. Good for lead capture, not for files that must stay private.', 'werun-blocks-community' ),
												meta.label
										  ) }
								</Notice>
								{ resources.length > 0 && (
									<SelectControl
										__nextHasNoMarginBottom
										__next40pxDefaultSize
										label={ __( 'Resource', 'werun-blocks-community' ) }
										value={ resource ? String( resource.id ) : '' }
										options={ [ { value: '', label: __( 'Choose…', 'werun-blocks-community' ) }, ...resources.map( ( r ) => ( { value: String( r.id ), label: `${ r.title } (${ r.type })` } ) ) ] }
										onChange={ ( id ) => setGate( { resourceId: Number( id ) || 0, fileTitle: '' } ) }
									/>
								) }
								<MediaUploadCheck>
									<MediaUpload
										onSelect={ ( media ) => setGate( { resourceId: media.id, fileTitle: media.title || media.filename || '' } ) }
										render={ ( { open } ) => (
											<Button variant="secondary" onClick={ open }>
												{ resources.length ? __( 'Or a file from the media library', 'werun-blocks-community' ) : __( 'Choose the file', 'werun-blocks-community' ) }
											</Button>
										) }
									/>
								</MediaUploadCheck>
								{ gate.resourceId > 0 && ! resource && (
									<p className="wrbc-form-editor__help">
										{ sprintf( /* translators: %s: file name or id */ __( 'File: %s', 'werun-blocks-community' ), gate.fileTitle || `#${ gate.resourceId }` ) }
									</p>
								) }
								<TextControl
									__nextHasNoMarginBottom
									__next40pxDefaultSize
									label={ __( 'Download button label', 'werun-blocks-community' ) }
									value={ gate.label }
									onChange={ ( label ) => setGate( { label } ) }
								/>
							</>
						) }
					</PanelBody>
				) }

				{ meta?.consent && (
					<PanelBody title={ __( 'Privacy', 'werun-blocks-community' ) } initialOpen={ false }>
						<ConsentControl value={ a.consent === 'inherit' ? '' : a.consent } onChange={ ( consent ) => setAttributes( { consent: consent || 'inherit' } ) } />
					</PanelBody>
				) }
			</InspectorControls>

			<InspectorControls group="color">
				<PanelColorSettings
					__experimentalIsRenderedInSidebar
					title={ __( 'Form colors', 'werun-blocks-community' ) }
					colorSettings={ [
						{ value: a.accentColor, onChange: ( accentColor ) => setAttributes( { accentColor } ), label: __( 'Accent (buttons)', 'werun-blocks-community' ) },
						// The card style only: its text follows it (white or ink) unless the block's text colour reads on it.
						look === 'card' && { value: a.cardBg, onChange: ( cardBg ) => setAttributes( { cardBg } ), label: __( 'Card background', 'werun-blocks-community' ) },
					].filter( Boolean ) }
				/>
			</InspectorControls>

			<section { ...blockProps }>
				<div className={ cx( 'wrbc-form__inner', colors.cardClass ) } style={ cssVars( colors.cardVars ) }>
					<header className="wrbc-form__header">
						<RichText
							tagName={ `h${ level }` }
							className="wrbc-form__title"
							id={ `${ uid }-title` }
							value={ a.title }
							onChange={ ( title ) => setAttributes( { title } ) }
							placeholder={ __( 'Form title', 'werun-blocks-community' ) }
						/>
						<RichText
							tagName="p"
							className="wrbc-form__intro"
							value={ a.intro }
							onChange={ ( intro ) => setAttributes( { intro } ) }
							placeholder={ __( 'A line that says what happens next.', 'werun-blocks-community' ) }
						/>
					</header>
					<div className="wrbc-form__body">
						{ mcPreview && (
							// Twin of Mailchimp::markup(): the same fields and classes, inert (nothing to fill in or send here).
							<form className="wrbc-form__native wrbc-form__mc" ref={ inert } onSubmit={ ( e ) => e.preventDefault() }>
								{ !! extra.name && (
									<div className="wrbc-form__field">
										<label className="wrbc-form__label" htmlFor={ `${ uid }-fname` }>
											{ __( 'First name', 'werun-blocks-community' ) }
										</label>
										<input className="wrbc-form__input" id={ `${ uid }-fname` } type="text" readOnly />
									</div>
								) }
								<div className="wrbc-form__field">
									<label className="wrbc-form__label" htmlFor={ `${ uid }-email` }>
										{ __( 'Email address', 'werun-blocks-community' ) }{ ' ' }
										<span className="wrbc-form__req" aria-hidden="true">
											{ __( '(required)', 'werun-blocks-community' ) }
										</span>
									</label>
									<input className="wrbc-form__input" id={ `${ uid }-email` } type="email" readOnly />
								</div>
								<p className="wrbc-form__actions">
									<button className="wrbc-btn wrbc-form__submit" type="submit">
										{ String( extra.button || '' ).trim() || __( 'Subscribe', 'werun-blocks-community' ) }
									</button>
								</p>
							</form>
						) }
						{ /* A card, never the live embed: third-party scripts don't run in the editor. */ }
						{ ! mcPreview && (
							<div className={ cx( 'wrbc-form-editor__card', status && 'is-incomplete' ) }>
								<Icon icon={ { name: a.provider === 'calendly' ? 'calendar-check' : 'clipboard-pen-line' } } />
								<div>
									<p className="wrbc-form-editor__provider">{ meta?.label || a.provider || __( 'Form', 'werun-blocks-community' ) }</p>
									{ valid && <p className="wrbc-form-editor__name">{ formTitle || a.formId }</p> }
									{ status && <p className="wrbc-form-editor__status">{ status }</p> }
									<p className="wrbc-form-editor__chips">
										{ gateOn && <span className="wrbc-form-editor__chip">{ meta.gating === 'hard' ? __( 'Gated (verified)', 'werun-blocks-community' ) : __( 'Gated (soft)', 'werun-blocks-community' ) }</span> }
										{ asksConsent && <span className="wrbc-form-editor__chip">{ sprintf( /* translators: %s: host */ __( 'Consent first · %s', 'werun-blocks-community' ), meta.host ) }</span> }
									</p>
								</div>
							</div>
						) }
					</div>
				</div>
			</section>
		</>
	);
}
