import { __, _n, sprintf } from '@wordpress/i18n';
import { InspectorControls, PanelColorSettings, useBlockProps } from '@wordpress/block-editor';
import {
	Button,
	Disabled,
	Notice,
	PanelBody,
	Placeholder,
	RangeControl,
	SelectControl,
	TextareaControl,
	TextControl,
} from '@wordpress/components';
import { useRef, useState } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import ServerSideRender from '@wordpress/server-side-render';
import { Choice, ResponsiveColumns, Toggle } from '../shared/controls';
import { blockIcon } from '../shared/block-icons';
import { AA_TEXT, blockColors, contrastRatio, onColor, useContextBackground, useSurface } from '../shared/contrast';
import { ContrastAudit } from '../shared/a11y';
import { PROVIDERS, SLUG, effectiveSource, integrations } from './providers';

export const LAYOUTS = [
	[ 'grouped-list', __( 'Rows', 'werun-blocks-community' ) ],
	[ 'list', __( 'List', 'werun-blocks-community' ) ],
	[ 'cards', __( 'Cards', 'werun-blocks-community' ) ],
	[ 'table', __( 'Table', 'werun-blocks-community' ) ],
];

/** Largest number of jobs a block renders (Jobs::MAX). */
const MAX_JOBS = 300;

/**
 * The settings that decide what renders. Twin of Render::effective() in
 * includes/jobs/class-render.php: change both together.
 *
 * @param {Object} a Attributes.
 */
export function effective( a ) {
	const layout = LAYOUTS.some( ( [ key ] ) => key === a.layout ) ? a.layout : 'grouped-list';
	const max = Math.max( 0, Math.min( MAX_JOBS, Number( a.maxJobs ) || 0 ) );
	const grouped = ( layout === 'grouped-list' || layout === 'list' ) && a.groupBy !== false;
	let sort = [ 'date', 'title', 'department' ].includes( a.sort ) ? a.sort : 'date';
	// Inside a department group "by department" is "by title".
	if ( grouped && sort === 'department' ) {
		sort = 'title';
	}
	return {
		layout,
		grouped,
		description: layout !== 'table' && !! a.showDescription,
		reveal: layout !== 'table' && !! a.reveal,
		filters: !! a.showFilters,
		sort,
		max: max === 0 ? MAX_JOBS : max,
	};
}

/** Provider, board, region, API key notice, Test connection and Refresh now. */
function SourceFields( { attributes, setAttributes, onRefreshed } ) {
	const src = effectiveSource( attributes );
	const [ busy, setBusy ] = useState( '' );
	const [ result, setResult ] = useState( null );
	const typed = ( attributes.board || '' ).trim();
	const badSlug = typed !== '' && ! SLUG.test( typed );
	const missingKey = src.def.secret && ! src.hasSecret && ! src.def.optionalSecret;
	const canCall = ! badSlug && ! missingKey && ( src.def.noSlug || src.board !== '' );

	const call = ( route ) => {
		setBusy( route );
		setResult( null );
		apiFetch( {
			path: `/wrbc/v1/jobs/${ route }`,
			method: 'POST',
			data: { provider: src.provider, board: src.def.noSlug ? '' : src.board, region: src.region },
		} )
			.then( ( res ) => {
				setResult( res );
				if ( route === 'refresh' ) {
					onRefreshed?.();
				}
			} )
			.catch( ( err ) => setResult( { error: err?.message || __( 'The request failed.', 'werun-blocks-community' ) } ) )
			.finally( () => setBusy( '' ) );
	};

	const fallbackLabel = PROVIDERS[ src.fallback ]?.label || src.fallback;
	const defaultBoard = integrations().jobs?.board || '';

	return (
		<>
			<SelectControl
				__nextHasNoMarginBottom
				__next40pxDefaultSize
				label={ __( 'Provider', 'werun-blocks-community' ) }
				value={ attributes.provider || '' }
				options={ [
					/* translators: %s: provider name */
					{ value: '', label: sprintf( __( 'Site default (%s)', 'werun-blocks-community' ), fallbackLabel ) },
					...Object.entries( PROVIDERS ).map( ( [ value, def ] ) => ( { value, label: def.label } ) ),
				] }
				onChange={ ( provider ) => {
					setResult( null );
					setAttributes( { provider } );
				} }
			/>
			{ ! src.def.noSlug && (
				<TextControl
					__nextHasNoMarginBottom
					__next40pxDefaultSize
					label={ src.def.slugLabel }
					value={ attributes.board || '' }
					placeholder={ src.provider === src.fallback ? defaultBoard : '' }
					help={
						src.provider === src.fallback && defaultBoard && ! typed
							/* translators: %s: board slug */
							? sprintf( __( 'Empty uses the board set in Integrations: %s.', 'werun-blocks-community' ), defaultBoard )
							: src.def.slugHelp
					}
					onChange={ ( board ) => {
						setResult( null );
						setAttributes( { board: board.trim() } );
					} }
				/>
			) }
			{ badSlug && (
				<Notice status="error" isDismissible={ false }>
					{ __( 'Letters, digits, - and _ only (up to 64).', 'werun-blocks-community' ) }
				</Notice>
			) }
			{ src.def.regions && (
				<Choice
					label={ __( 'Region', 'werun-blocks-community' ) }
					value={ src.region }
					options={ src.def.regions }
					onChange={ ( region ) => {
						setResult( null );
						setAttributes( { region } );
					} }
				/>
			) }
			{ src.def.secret && ! src.hasSecret && (
				<Notice status={ src.def.optionalSecret ? 'info' : 'warning' } isDismissible={ false }>
					{ src.def.optionalSecret
						? __( 'Uses the public careers list. Add the BambooHR API key in Integrations to fall back to the API when the list is off.', 'werun-blocks-community' )
						: __( 'Teamtailor needs an API key in Integrations (Settings → werun.Blocks.Community → Integrations).', 'werun-blocks-community' ) }
				</Notice>
			) }
			<div className="wrbc-jobs-editor__actions">
				<Button variant="secondary" disabled={ ! canCall || !! busy } isBusy={ busy === 'test' } onClick={ () => call( 'test' ) }>
					{ __( 'Test connection', 'werun-blocks-community' ) }
				</Button>
				<Button variant="tertiary" disabled={ ! canCall || !! busy } isBusy={ busy === 'refresh' } onClick={ () => call( 'refresh' ) }>
					{ __( 'Refresh now', 'werun-blocks-community' ) }
				</Button>
			</div>
			{ result && (
				<div role="status">
					{ result.error ? (
						<Notice status="error" isDismissible={ false }>
							{ result.error }
						</Notice>
					) : (
						<Notice status="success" isDismissible={ false }>
							<p>
								{ sprintf(
									/* translators: %d: number of open positions */
									_n( 'Connected: %d open position.', 'Connected: %d open positions.', result.count, 'werun-blocks-community' ),
									result.count
								) }
							</p>
							{ result.departments?.length > 0 && (
								<p>
									<strong>{ __( 'Departments:', 'werun-blocks-community' ) }</strong> { result.departments.slice( 0, 12 ).join( ', ' ) }
									{ result.departments.length > 12 && '…' }
								</p>
							) }
							{ result.locations?.length > 0 && (
								<p>
									<strong>{ __( 'Locations:', 'werun-blocks-community' ) }</strong> { result.locations.slice( 0, 12 ).join( ', ' ) }
									{ result.locations.length > 12 && '…' }
								</p>
							) }
						</Notice>
					) }
				</div>
			) }
		</>
	);
}

export default function Edit( { attributes, setAttributes, clientId, name } ) {
	const a = attributes;
	const e = effective( a );
	const src = effectiveSource( a );
	// What the block sits on (its own Color panel background, or the nearest
	// painted parent's). The preview is rendered by PHP without the block
	// supports or the parents, so it gets them in the query (Render::colors()).
	const ref = useRef();
	const surface = useSurface( clientId, a, name );
	const around = useContextBackground( clientId );
	const ownText = blockColors( a ).text;
	const hasTextColor = !! ownText;
	// The one fix the warning can offer: a text colour chosen in the Color panel that doesn't read on the background.
	const textFails = hasTextColor && !! surface && contrastRatio( ownText, surface ) > 0 && contrastRatio( ownText, surface ) < AA_TEXT;
	// The header prints a title (twin of $has_title in Render::block()): then the
	// list's headings follow the title level, otherwise "Heading level" sets them.
	const hasTitle = !! a.showHeader && String( a.title || '' ).replace( /<[^>]*>/g, '' ).trim() !== '';
	const [ refreshKey, setRefreshKey ] = useState( 0 );
	const ready = src.def.noSlug ? src.hasSecret : src.board !== '' && SLUG.test( src.board );
	const blockProps = useBlockProps( { ref, className: 'wrbc-jobs-editor' } );
	const toggle = ( name, label, help ) => (
		<Toggle attributes={ a } setAttributes={ setAttributes } name={ name } label={ label } help={ help } />
	);

	return (
		<>
			<ContrastAudit
				blockRef={ ref }
				deps={ [ attributes, surface, around ] }
				checks={ [
					{ selector: '.wrbc-jobs__input, .wrbc-jobs__select', property: 'border-color', min: 3, label: __( 'Filter fields (border)', 'werun-blocks-community' ) },
					{ selector: '.wrbc-jobs__chip', property: 'border-color', min: 3, label: __( '"Remote only" button (border)', 'werun-blocks-community' ) },
				] }
				actions={
					textFails
						? [
							{
								label: __( 'Use a readable text colour', 'werun-blocks-community' ),
								onClick: () =>
									setAttributes( {
										textColor: undefined,
										style: { ...( a.style || {} ), color: { ...( a.style?.color || {} ), text: onColor( surface ) } },
									} ),
							},
						]
						: []
				}
				labels={ {
					'.wrbc-jobs__badge': __( '"Remote" badge', 'werun-blocks-community' ),
					'.wrbc-jobs__desc-toggle': __( '"Job description" toggle', 'werun-blocks-community' ),
					'.wrbc-jobs__desc-body': __( 'Job description', 'werun-blocks-community' ),
					'.wrbc-jobs__meta': __( 'Job details', 'werun-blocks-community' ),
					'.wrbc-jobs__link': __( 'Position titles', 'werun-blocks-community' ),
					'.wrbc-jobs__group-title': __( 'Department headings', 'werun-blocks-community' ),
					'.wrbc-jobs__count': __( 'Number of positions', 'werun-blocks-community' ),
					'.wrbc-jobs__th': __( 'Table headings', 'werun-blocks-community' ),
					'.wrbc-jobs__apply': __( 'Apply buttons', 'werun-blocks-community' ),
					'.wrbc-jobs__filters': __( 'Filters', 'werun-blocks-community' ),
				} }
			/>
			<InspectorControls>
				<PanelBody title={ __( 'Job board', 'werun-blocks-community' ) }>
					<SourceFields attributes={ a } setAttributes={ setAttributes } onRefreshed={ () => setRefreshKey( ( k ) => k + 1 ) } />
				</PanelBody>
				<PanelBody title={ __( 'Layout', 'werun-blocks-community' ) } initialOpen={ false }>
					<SelectControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Layout', 'werun-blocks-community' ) }
						value={ e.layout }
						options={ LAYOUTS.map( ( [ value, label ] ) => ( { value, label } ) ) }
						onChange={ ( layout ) => setAttributes( { layout } ) }
					/>
					{ ( e.layout === 'grouped-list' || e.layout === 'list' ) && toggle( 'groupBy', __( 'Group by department', 'werun-blocks-community' ) ) }
					{ e.layout === 'cards' && (
						<>
							<ResponsiveColumns attributes={ a } setAttributes={ setAttributes } max={ 4 } label={ __( 'Columns', 'werun-blocks-community' ) } />
							<RangeControl
								__nextHasNoMarginBottom
								__next40pxDefaultSize
								label={ __( 'Gap (px)', 'werun-blocks-community' ) }
								value={ a.gap }
								min={ 0 }
								max={ 64 }
								onChange={ ( gap ) => setAttributes( { gap } ) }
							/>
						</>
					) }
					<Choice
						label={ e.grouped ? __( 'Sort inside each department', 'werun-blocks-community' ) : __( 'Sort', 'werun-blocks-community' ) }
						value={ e.sort }
						options={ [
							[ 'date', __( 'Newest', 'werun-blocks-community' ) ],
							[ 'title', __( 'Title', 'werun-blocks-community' ) ],
							[ 'department', __( 'Department', 'werun-blocks-community' ) ],
						].filter( ( [ key ] ) => ! e.grouped || key !== 'department' ) }
						onChange={ ( sort ) => setAttributes( { sort } ) }
					/>
					<RangeControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Most positions shown', 'werun-blocks-community' ) }
						help={ __( '0 shows every position (up to 300).', 'werun-blocks-community' ) }
						value={ a.maxJobs }
						min={ 0 }
						max={ MAX_JOBS }
						onChange={ ( maxJobs ) => setAttributes( { maxJobs: maxJobs ?? 0 } ) }
					/>
					{ e.layout !== 'table' && toggle( 'reveal', __( 'Fade in on scroll', 'werun-blocks-community' ) ) }
				</PanelBody>
				<PanelBody title={ __( 'Details', 'werun-blocks-community' ) } initialOpen={ false }>
					{ /* Grouped lists name the department in the group heading (Render::items()). */ }
					{ ! e.grouped && toggle( 'showDepartment', __( 'Department', 'werun-blocks-community' ) ) }
					{ toggle( 'showLocation', __( 'Location', 'werun-blocks-community' ) ) }
					{ toggle( 'showRemote', __( 'Remote badge', 'werun-blocks-community' ) ) }
					{ toggle( 'showType', __( 'Employment type', 'werun-blocks-community' ) ) }
					{ toggle( 'showDate', __( 'Date posted', 'werun-blocks-community' ) ) }
					{ toggle( 'showCompensation', __( 'Compensation', 'werun-blocks-community' ), __( 'When the provider publishes it (Ashby, Lever, Teamtailor).', 'werun-blocks-community' ) ) }
					{ e.layout !== 'table' && toggle( 'showDescription', __( 'Job description', 'werun-blocks-community' ), __( 'In a disclosure under each position.', 'werun-blocks-community' ) ) }
					{ toggle( 'showCount', __( 'Number of positions', 'werun-blocks-community' ) ) }
					{ toggle( 'showApply', __( 'Apply button', 'werun-blocks-community' ) ) }
					{ a.showApply && (
						<TextControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							label={ __( 'Apply button label', 'werun-blocks-community' ) }
							value={ a.applyLabel }
							onChange={ ( applyLabel ) => setAttributes( { applyLabel } ) }
						/>
					) }
					{ toggle( 'newTab', __( 'Open positions in a new tab', 'werun-blocks-community' ) ) }
				</PanelBody>
				<PanelBody title={ __( 'Filters', 'werun-blocks-community' ) } initialOpen={ false }>
					{ toggle( 'showFilters', __( 'Show filters', 'werun-blocks-community' ), a.showFilters ? __( 'A select appears only when the board has two values or more for it.', 'werun-blocks-community' ) : undefined ) }
					{ e.filters && (
						<>
							{ toggle( 'filterSearch', __( 'Search field', 'werun-blocks-community' ) ) }
							{ a.filterSearch && (
								<TextControl
									__nextHasNoMarginBottom
									__next40pxDefaultSize
									label={ __( 'Search placeholder', 'werun-blocks-community' ) }
									value={ a.searchPlaceholder }
									onChange={ ( searchPlaceholder ) => setAttributes( { searchPlaceholder } ) }
								/>
							) }
							{ toggle( 'filterDepartment', __( 'Department', 'werun-blocks-community' ) ) }
							{ toggle( 'filterLocation', __( 'Location', 'werun-blocks-community' ) ) }
							{ toggle( 'filterType', __( 'Employment type', 'werun-blocks-community' ) ) }
							{ toggle( 'filterRemote', __( 'Remote only', 'werun-blocks-community' ), __( 'Shown when some positions are remote and some are not.', 'werun-blocks-community' ) ) }
							<TextareaControl
								__nextHasNoMarginBottom
								label={ __( 'No matches text', 'werun-blocks-community' ) }
								value={ a.noResults }
								rows={ 2 }
								onChange={ ( noResults ) => setAttributes( { noResults } ) }
							/>
						</>
					) }
				</PanelBody>
				<PanelBody title={ __( 'Section header', 'werun-blocks-community' ) } initialOpen={ false }>
					{ toggle( 'showHeader', __( 'Show the header', 'werun-blocks-community' ) ) }
					{ a.showHeader && (
						<>
							{ toggle( 'showEyebrow', __( 'Eyebrow', 'werun-blocks-community' ) ) }
							{ a.showEyebrow && (
								<TextControl __nextHasNoMarginBottom __next40pxDefaultSize label={ __( 'Eyebrow text', 'werun-blocks-community' ) } value={ a.eyebrow } onChange={ ( eyebrow ) => setAttributes( { eyebrow } ) } />
							) }
							<TextControl __nextHasNoMarginBottom __next40pxDefaultSize label={ __( 'Title', 'werun-blocks-community' ) } value={ a.title } onChange={ ( title ) => setAttributes( { title } ) } />
							{ toggle( 'showIntro', __( 'Intro', 'werun-blocks-community' ) ) }
							{ a.showIntro && (
								<TextareaControl __nextHasNoMarginBottom label={ __( 'Intro text', 'werun-blocks-community' ) } value={ a.intro } rows={ 3 } onChange={ ( intro ) => setAttributes( { intro } ) } />
							) }
							<Choice
								label={ __( 'Alignment', 'werun-blocks-community' ) }
								value={ a.headerAlign }
								options={ [
									[ 'left', __( 'Left', 'werun-blocks-community' ) ],
									[ 'center', __( 'Center', 'werun-blocks-community' ) ],
								] }
								onChange={ ( headerAlign ) => setAttributes( { headerAlign } ) }
							/>
							{ hasTitle && (
								<Choice
									label={ __( 'Title level', 'werun-blocks-community' ) }
									help={
										// Render::block() $levels.
										e.layout === 'table'
											? undefined
											: e.grouped
												? __( 'Department headings go one level below it, positions two.', 'werun-blocks-community' )
												: __( 'Position titles go one level below it.', 'werun-blocks-community' )
									}
									value={ String( a.titleLevel || 2 ) }
									options={ [
										[ '2', 'H2' ],
										[ '3', 'H3' ],
										[ '4', 'H4' ],
									] }
									onChange={ ( value ) => setAttributes( { titleLevel: Number( value ) } ) }
								/>
							) }
						</>
					) }
					{ /* Render::block() $first: without a title the list's own headings take this level; tables have none. */ }
					{ ! hasTitle && e.layout !== 'table' && (
						<Choice
							label={ __( 'Heading level', 'werun-blocks-community' ) }
							help={
								e.grouped
									? __( 'Of the department headings (positions go one level below). Pick the level under the heading that comes before this block.', 'werun-blocks-community' )
									: __( 'Of the position titles. Pick the level under the heading that comes before this block.', 'werun-blocks-community' )
							}
							value={ String( Math.max( 2, Math.min( 4, Number( a.headingLevel ) || 3 ) ) ) }
							options={ [
								[ '2', 'H2' ],
								[ '3', 'H3' ],
								[ '4', 'H4' ],
							] }
							onChange={ ( value ) => setAttributes( { headingLevel: Number( value ) } ) }
						/>
					) }
				</PanelBody>
				<PanelBody title={ __( 'Messages', 'werun-blocks-community' ) } initialOpen={ false }>
					<TextareaControl
						__nextHasNoMarginBottom
						label={ __( 'Text when there are no open positions', 'werun-blocks-community' ) }
						help={ __( 'Leave empty to show nothing.', 'werun-blocks-community' ) }
						value={ a.emptyText }
						rows={ 2 }
						onChange={ ( emptyText ) => setAttributes( { emptyText } ) }
					/>
				</PanelBody>
			</InspectorControls>
			<InspectorControls group="styles">
				<PanelColorSettings
					title={ __( 'Jobs colours', 'werun-blocks-community' ) }
					initialOpen={ false }
					colorSettings={ [
						{ label: __( 'Accent', 'werun-blocks-community' ), value: a.accentColor, onChange: ( accentColor ) => setAttributes( { accentColor } ) },
						...( e.layout === 'cards'
							? [ { label: __( 'Card background', 'werun-blocks-community' ), value: a.cardBg, onChange: ( cardBg ) => setAttributes( { cardBg } ) } ]
							: [] ),
					] }
				/>
				{ ( e.layout === 'cards' || e.filters ) && (
					<PanelBody title={ __( 'Corners', 'werun-blocks-community' ) } initialOpen={ false }>
						<RangeControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							label={ e.layout === 'cards' ? __( 'Card radius (px)', 'werun-blocks-community' ) : __( 'Filter field radius (px)', 'werun-blocks-community' ) }
							value={ a.radius }
							min={ 0 }
							max={ 32 }
							onChange={ ( radius ) => setAttributes( { radius } ) }
						/>
					</PanelBody>
				) }
			</InspectorControls>
			<div { ...blockProps }>
				{ ready ? (
					<Disabled>
						<ServerSideRender
							block="werun-community/jobs"
							attributes={ a }
							skipBlockSupportAttributes
							urlQueryArgs={ { wrbcRefresh: refreshKey, wrbcSurface: surface, wrbcAround: around, wrbcText: hasTextColor ? 1 : 0 } }
						/>
					</Disabled>
				) : (
					<Placeholder
						icon={ blockIcon( 'werun-community/jobs' )?.src }
						label={ __( 'Jobs', 'werun-blocks-community' ) }
						instructions={
							src.def.noSlug
								? __( 'Add the Teamtailor API key in Integrations to list its positions.', 'werun-blocks-community' )
								: __( 'Choose the applicant tracking system and the board to list its open positions.', 'werun-blocks-community' )
						}
					>
						<div className="wrbc-jobs-editor__setup">
							<SourceFields attributes={ a } setAttributes={ setAttributes } />
						</div>
					</Placeholder>
				) }
			</div>
		</>
	);
}
