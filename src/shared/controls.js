/**
 * Small editor pieces every block reuses: responsive columns, the section
 * header (edit and settings), button settings, and CSS custom properties.
 */
import { __, sprintf } from '@wordpress/i18n';
import {
	__experimentalToggleGroupControl as ToggleGroupControl,
	__experimentalToggleGroupControlOption as ToggleGroupControlOption,
	PanelBody,
	RangeControl,
	TextControl,
	ToggleControl,
} from '@wordpress/components';
import { RichText } from '@wordpress/block-editor';
import { AA_LARGE, AA_TEXT, minOverlayOpacity, onColor, overlayOpacity } from './contrast';

export const cx = ( ...names ) => names.filter( Boolean ).join( ' ' );

/** CSS functions a value may use: colors and math, nothing that loads a resource (same list as wrbc_css_value()). */
const CSS_FUNCTIONS = [ 'rgb', 'rgba', 'hsl', 'hsla', 'hwb', 'lab', 'lch', 'oklab', 'oklch', 'color-mix', 'var', 'calc', 'min', 'max', 'clamp' ];

/** Whether a value is safe for a custom property, as wrbc_css_value() decides on the page. */
export function safeCssValue( value ) {
	if ( typeof value === 'number' ) {
		return Number.isFinite( value );
	}
	if ( typeof value !== 'string' ) {
		return false;
	}
	const v = value.trim();
	if ( ! v || v.length > 200 || ! /^[A-Za-z0-9#.,%()+\-*/\s]+$/.test( v ) || v.includes( '//' ) ) {
		return false;
	}
	const calls = v.match( /[A-Za-z-]+\s*\(/g ) || [];
	return calls.every( ( call ) => CSS_FUNCTIONS.includes( call.replace( /[\s(]/g, '' ).toLowerCase() ) );
}

/** A style object of custom properties; empty and unsafe values are left out. */
export function cssVars( vars ) {
	const style = {};
	Object.entries( vars ).forEach( ( [ key, value ] ) => {
		if ( value !== undefined && value !== null && value !== '' && value !== false && safeCssValue( value ) ) {
			style[ key ] = value;
		}
	} );
	return style;
}

export const px = ( value, unit = 'px' ) => ( value === undefined || value === null || value === '' ? undefined : `${ value }${ unit }` );

/** Columns at three widths. The block's CSS switches them with container
 *  queries, so they follow the space the block has, not the window. */
export function ResponsiveColumns( { attributes, setAttributes, max = 6, label } ) {
	const { columnsDesktop, columnsTablet, columnsMobile } = attributes;
	return (
		<>
			{ label && <p className="wrbc-control-label">{ label }</p> }
			<RangeControl
				__nextHasNoMarginBottom
				__next40pxDefaultSize
				label={ __( 'Desktop (960 px and wider)', 'werun-blocks-community' ) }
				value={ columnsDesktop }
				min={ 1 }
				max={ max }
				onChange={ ( value ) => setAttributes( { columnsDesktop: value } ) }
			/>
			<RangeControl
				__nextHasNoMarginBottom
				__next40pxDefaultSize
				label={ __( 'Tablet (600 to 959 px)', 'werun-blocks-community' ) }
				value={ columnsTablet }
				min={ 1 }
				max={ Math.min( max, 4 ) }
				onChange={ ( value ) => setAttributes( { columnsTablet: value } ) }
			/>
			<RangeControl
				__nextHasNoMarginBottom
				__next40pxDefaultSize
				label={ __( 'Phone (under 600 px)', 'werun-blocks-community' ) }
				value={ columnsMobile }
				min={ 1 }
				max={ 2 }
				onChange={ ( value ) => setAttributes( { columnsMobile: value } ) }
			/>
		</>
	);
}

/** A segmented choice. */
export function Choice( { label, value, options, onChange, help } ) {
	return (
		<ToggleGroupControl
			__nextHasNoMarginBottom
			__next40pxDefaultSize
			isBlock
			label={ label }
			help={ help }
			value={ value }
			onChange={ onChange }
		>
			{ options.map( ( [ key, text ] ) => (
				<ToggleGroupControlOption key={ key } value={ key } label={ text } />
			) ) }
		</ToggleGroupControl>
	);
}

/** A toggle bound to one boolean attribute. */
export function Toggle( { attributes, setAttributes, name, label, help } ) {
	return (
		<ToggleControl
			__nextHasNoMarginBottom
			label={ label }
			help={ help }
			checked={ !! attributes[ name ] }
			onChange={ ( value ) => setAttributes( { [ name ]: value } ) }
		/>
	);
}

/** The optional header above a section: eyebrow, title, intro. */
export function SectionHeader( { attributes, setAttributes, uid } ) {
	const { showHeader, showEyebrow, showIntro, eyebrow, title, intro, headerAlign, titleLevel } = attributes;
	if ( ! showHeader ) {
		return null;
	}
	return (
		<div className={ cx( 'wrbc-header', headerAlign === 'center' && 'wrbc-header--center' ) }>
			{ showEyebrow && (
				<RichText
					tagName="p"
					className="wrbc-header__eyebrow"
					value={ eyebrow }
					onChange={ ( value ) => setAttributes( { eyebrow: value } ) }
					placeholder={ __( 'Eyebrow', 'werun-blocks-community' ) }
					allowedFormats={ [ 'core/bold', 'core/italic' ] }
				/>
			) }
			<RichText
				tagName={ `h${ titleLevel || 2 }` }
				className="wrbc-header__title"
				id={ uid ? `${ uid }-title` : undefined }
				value={ title }
				onChange={ ( value ) => setAttributes( { title: value } ) }
				placeholder={ __( 'Section title', 'werun-blocks-community' ) }
			/>
			{ showIntro && (
				<RichText
					tagName="p"
					className="wrbc-header__intro"
					value={ intro }
					onChange={ ( value ) => setAttributes( { intro: value } ) }
					placeholder={ __( 'A line that introduces the section.', 'werun-blocks-community' ) }
				/>
			) }
		</div>
	);
}

export function SectionHeaderPanel( { attributes, setAttributes, initialOpen = false } ) {
	return (
		<PanelBody title={ __( 'Section header', 'werun-blocks-community' ) } initialOpen={ initialOpen }>
			<Toggle attributes={ attributes } setAttributes={ setAttributes } name="showHeader" label={ __( 'Show the header', 'werun-blocks-community' ) } />
			{ attributes.showHeader && (
				<>
					<Toggle attributes={ attributes } setAttributes={ setAttributes } name="showEyebrow" label={ __( 'Eyebrow', 'werun-blocks-community' ) } />
					<Toggle attributes={ attributes } setAttributes={ setAttributes } name="showIntro" label={ __( 'Intro', 'werun-blocks-community' ) } />
					<Choice
						label={ __( 'Alignment', 'werun-blocks-community' ) }
						value={ attributes.headerAlign }
						options={ [
							[ 'left', __( 'Left', 'werun-blocks-community' ) ],
							[ 'center', __( 'Center', 'werun-blocks-community' ) ],
						] }
						onChange={ ( value ) => setAttributes( { headerAlign: value } ) }
					/>
					<Choice
						label={ __( 'Title level', 'werun-blocks-community' ) }
						value={ String( attributes.titleLevel || 2 ) }
						options={ [
							[ '2', 'H2' ],
							[ '3', 'H3' ],
							[ '4', 'H4' ],
						] }
						onChange={ ( value ) => setAttributes( { titleLevel: Number( value ) } ) }
					/>
				</>
			) }
		</PanelBody>
	);
}

/** Label, URL and "new tab" for one link. */
export function LinkFields( { label, url, newTab, onChange, labelName = 'Label' } ) {
	return (
		<>
			{ label !== undefined && (
				<TextControl
					__nextHasNoMarginBottom
					__next40pxDefaultSize
					label={ labelName }
					value={ label || '' }
					onChange={ ( value ) => onChange( { label: value } ) }
				/>
			) }
			<TextControl
				__nextHasNoMarginBottom
				__next40pxDefaultSize
				label={ __( 'URL', 'werun-blocks-community' ) }
				type="url"
				value={ url || '' }
				placeholder="https://"
				onChange={ ( value ) => onChange( { url: value } ) }
			/>
			<ToggleControl
				__nextHasNoMarginBottom
				label={ __( 'Open in a new tab', 'werun-blocks-community' ) }
				checked={ !! newTab }
				onChange={ ( value ) => onChange( { newTab: value } ) }
			/>
		</>
	);
}

/** Size and stroke of every icon in a block. */
export function IconSizeControls( { attributes, setAttributes, maxSize = 64 } ) {
	return (
		<>
			<RangeControl
				__nextHasNoMarginBottom
				__next40pxDefaultSize
				label={ __( 'Icon size (px)', 'werun-blocks-community' ) }
				value={ attributes.iconSize }
				min={ 12 }
				max={ maxSize }
				onChange={ ( value ) => setAttributes( { iconSize: value } ) }
			/>
			<RangeControl
				__nextHasNoMarginBottom
				__next40pxDefaultSize
				label={ __( 'Icon stroke', 'werun-blocks-community' ) }
				value={ attributes.iconStroke }
				min={ 1 }
				max={ 3 }
				step={ 0.25 }
				onChange={ ( value ) => setAttributes( { iconStroke: value } ) }
			/>
		</>
	);
}

/**
 * Overlay opacity over a background image. The range starts at the minimum
 * that keeps the text on it readable over any image (WCAG 1.4.3: the
 * lightest and darkest pixel under the overlay), for the chosen overlay and
 * text colours; render.php applies the same floor (wrbc_overlay_opacity()),
 * so a lower stored value never reaches the page. `largeOnly` when every
 * text on the image is large (24 px, or 18.66 px bold): 3:1 instead of 4.5:1.
 */
export function OverlayOpacityControl( { value, onChange, overlayColor, textColor = '', max = 95, largeOnly = false, label } ) {
	// No text colour: the one that reads on the overlay colour (white on dark, ink on light).
	const floor = minOverlayOpacity( textColor || onColor( overlayColor || '#000000' ), overlayColor || '#000000', largeOnly ? AA_LARGE : AA_TEXT );
	const shown = overlayOpacity( value, textColor, overlayColor, largeOnly ? AA_LARGE : AA_TEXT, max );
	return (
		<RangeControl
			__nextHasNoMarginBottom
			__next40pxDefaultSize
			label={ label || __( 'Overlay opacity (%)', 'werun-blocks-community' ) }
			value={ shown }
			min={ Math.min( floor, max ) }
			max={ max }
			onChange={ onChange }
			help={
				floor > max
					? __( 'With these overlay and text colours the text can’t reach WCAG AA contrast over a light image: pick a darker overlay or another text colour.', 'werun-blocks-community' )
					: sprintf(
							/* translators: %d: overlay opacity in percent. */
							__( 'From %d %%: the text stays readable over any image (WCAG AA).', 'werun-blocks-community' ),
							floor
					  )
			}
		/>
	);
}
