import { __, _n, sprintf } from '@wordpress/i18n';
import {
	InspectorControls,
	PanelColorSettings,
	RichText,
	useBlockProps,
} from '@wordpress/block-editor';
import {
	Button,
	DropdownMenu,
	Notice,
	PanelBody,
	RangeControl,
	SelectControl,
	TextControl,
} from '@wordpress/components';
import { useRef, useState } from '@wordpress/element';
import { ContrastAudit } from '../shared/a11y';
import {
	AA_TEXT,
	blockColors,
	contrastRatio,
	useContextBackground,
	useSurface,
} from '../shared/contrast';
import { Icon } from '../shared/icons';
import { IconControl } from '../shared/IconControl';
import {
	Choice,
	cssVars,
	cx,
	IconSizeControls,
	LinkFields,
	px,
	SectionHeader,
	SectionHeaderPanel,
	Toggle,
} from '../shared/controls';
import {
	cellValue,
	effective,
	filled,
	isNumeric,
	MAX_PLANS,
	MAX_ROWS,
	newId,
	normalizePlans,
	str,
} from './model';
import { comparisonColors, withoutTextColor } from './colors';

const STATUS = {
	check: __( 'Included', 'werun-blocks-community' ),
	cross: __( 'Not included', 'werun-blocks-community' ),
	partial: __( 'Partially included', 'werun-blocks-community' ),
	text: __( 'Text', 'werun-blocks-community' ),
};

/*
 * Tool icons are Lucide SVGs: dashicons (a font) aren't loaded in the
 * editor canvas iframe.
 */
const TOOL_ICONS = {
	'arrow-up-alt2': 'chevron-up',
	'arrow-down-alt2': 'chevron-down',
	'arrow-left-alt2': 'chevron-left',
	'arrow-right-alt2': 'chevron-right',
	'info-outline': 'info',
	'star-filled': 'star',
	'star-empty': 'star',
};
const lucide = ( name ) => (
	<Icon icon={ { name } } className="wrbc-comparison__tool-icon" />
);

/**
 * Plans as stored: without the position normalizePlans() adds.
 *
 * @param {Array} list Normalised plans.
 */
const stripPlans = ( list ) =>
	list.map( ( plan ) => {
		const out = { ...plan };
		delete out.index;
		return out;
	} );

/**
 * Rich text as plain text (wp_strip_all_tags + trim).
 *
 * @param {*} value Raw value.
 */
const plain = ( value ) =>
	str( value )
		.replace( /<[^>]*>/g, '' )
		.trim();

/**
 * A plan's name as plain text, "Plan N" without one: twin of $plain_name in render.php.
 *
 * @param {Object} plan Normalised plan.
 */
const plainName = ( plan ) =>
	filled( str( plan.name ) )
		? plain( plan.name )
		: sprintf(
				/* translators: %d: column number. */
				__( 'Plan %d', 'werun-blocks-community' ),
				plan.index + 1
		  );

/**
 * A button URL that is no link on the page: '', '#' or a refused scheme
 * (render.php's $has_url()).
 *
 * @param {*} url The plan's button URL.
 */
const noUrl = ( url ) => {
	const u = typeof url === 'string' ? url.trim() : '';
	return ! u || u === '#' || /^(javascript|data|vbscript):/i.test( u );
};

/**
 * The tone class and custom properties of a part of the table (colors.js
 * areaColors()), as props for its element.
 *
 * @param {Object|null} area      The part, or null when it inherits.
 * @param {string}      className Its own classes.
 */
const partProps = ( area, className = '' ) => ( {
	className: cx( className, area && area.className ) || undefined,
	style: area ? cssVars( area.vars ) : undefined,
} );

export default function Edit( { attributes, setAttributes, clientId } ) {
	const a = attributes;
	const uid = `wrbc-comparison-${ clientId.slice( 0, 8 ) }`;
	const [ preview, setPreview ] = useState( null );
	const [ openDesc, setOpenDesc ] = useState( [] );

	const plans = normalizePlans( a.plans );
	const rawRows = Array.isArray( a.rows ) ? a.rows.slice( 0, MAX_ROWS ) : [];
	// Ids for React keys and the description editor; stored as they are.
	const rows = rawRows.map( ( row, i ) =>
		row && typeof row === 'object'
			? { ...row, id: str( row.id ) || `r${ i }` }
			: { id: `r${ i }`, type: 'feature' }
	);
	const e = effective( a, plans );
	const period = ( e.toggle && preview ) || e.period;
	const icons = {
		check: a.includedIcon,
		cross: a.excludedIcon,
		partial: a.partialIcon,
	};
	const hasGroups = rows.some( ( row ) => row.type === 'group' );
	const hasDescriptions = rows.some(
		( row ) => row.type !== 'group' && filled( row.description )
	);
	// Which value types the table uses: an icon control only for an icon that shows.
	const hasType = ( type ) =>
		rows.some(
			( row ) =>
				row.type !== 'group' &&
				plans.some( ( plan ) => cellValue( row, plan ).type === type )
		);
	const hasCheck = hasType( 'check' );
	const hasCross = hasType( 'cross' );
	const hasPartial = hasType( 'partial' );
	const visibleRows = rows.filter(
		( row ) => row.type !== 'group' || a.showGroups
	);
	// The section title as render.php prints it (the phone cards' heading levels follow it).
	const hasTitle = !! a.showHeader && filled( str( a.title ) );

	// ── Colours: what the table sits on, its tone and the readable colours of
	// each part (twin of render.php, src/comparison/colors.js). ───────────
	const ref = useRef();
	const surface = useSurface( clientId, a, 'werun-community/comparison' );
	const around = useContextBackground( clientId );
	const colors = comparisonColors( a, surface, around, {
		featured: !! e.featured,
		zebra: !! a.zebra,
		toggle: e.toggle,
	} );
	const headPart = colors.head || colors.table;
	// The Color panel's text colour is never changed: the warning offers the
	// automatic one when it doesn't read on the block's background.
	const chosenText = blockColors( a ).text;
	const textFails =
		!! chosenText && !! surface && contrastRatio( chosenText, surface ) < AA_TEXT;
	// Plans whose button has a label but no URL: the page prints the label as text.
	const missingUrls = e.showCta
		? plans.filter(
				( plan ) => filled( str( plan.ctaLabel ) ) && noUrl( plan.ctaUrl )
		  ).length
		: 0;

	// ── Writes ────────────────────────────────────────────────────────────
	/**
	 * Every row's values keyed by plan id (a positional list is converted).
	 * @param list
	 * @param planList
	 */
	const keyedRows = ( list = rows, planList = plans ) =>
		list.map( ( row ) => {
			if ( row.type === 'group' ) {
				return row;
			}
			const values = {};
			planList.forEach( ( plan ) => {
				values[ plan.id ] = cellValue( row, plan );
			} );
			return { ...row, values };
		} );
	const saveRows = ( list ) => setAttributes( { rows: list } );
	const setPlan = ( index, patch ) =>
		setAttributes( {
			plans: stripPlans(
				plans.map( ( plan, i ) =>
					i === index ? { ...plan, ...patch } : plan
				)
			),
		} );
	const addPlan = () => {
		if ( plans.length >= MAX_PLANS ) {
			return;
		}
		const id = newId(
			'p',
			plans.map( ( plan ) => plan.id )
		);
		const plan = {
			id,
			name: '',
			price: '',
			period: '',
			priceYearly: '',
			periodYearly: '',
			ctaLabel: '',
			ctaUrl: '',
			ctaNewTab: false,
			badge: '',
			index: plans.length,
		};
		const list = [ ...plans, plan ];
		setAttributes( {
			plans: stripPlans( list ),
			rows: keyedRows( rows, list ).map( ( row ) =>
				row.type === 'group'
					? row
					: {
							...row,
							values: {
								...row.values,
								[ id ]: { type: 'check', text: '' },
							},
						}
			),
		} );
	};
	const removePlan = ( index ) => {
		const gone = plans[ index ];
		const list = plans.filter( ( _, i ) => i !== index );
		// The featured column follows its plan, or goes with it.
		let featured = e.featured;
		if ( featured === index + 1 ) {
			featured = 0;
		} else if ( featured > index + 1 ) {
			featured -= 1;
		}
		setAttributes( {
			plans: stripPlans( list ),
			rows: keyedRows().map( ( row ) => {
				if ( row.type === 'group' ) {
					return row;
				}
				const values = { ...row.values };
				delete values[ gone.id ];
				return { ...row, values };
			} ),
			featuredColumn: featured,
		} );
	};
	const movePlan = ( index, step ) => {
		const to = index + step;
		if ( to < 0 || to >= plans.length ) {
			return;
		}
		const list = [ ...plans ];
		[ list[ index ], list[ to ] ] = [ list[ to ], list[ index ] ];
		// The featured column follows its plan.
		let featured = e.featured;
		if ( featured === index + 1 ) {
			featured = to + 1;
		} else if ( featured === to + 1 ) {
			featured = index + 1;
		}
		setAttributes( {
			plans: stripPlans( list ),
			rows: keyedRows(),
			featuredColumn: featured,
		} );
	};
	const setRow = ( index, patch ) =>
		saveRows(
			rows.map( ( row, i ) =>
				i === index ? { ...row, ...patch } : row
			)
		);
	const setCell = ( index, plan, patch ) => {
		const row = keyedRows( [ rows[ index ] ] )[ 0 ];
		setRow( index, {
			values: {
				...row.values,
				[ plan.id ]: { ...cellValue( row, plan ), ...patch },
			},
		} );
	};
	const addRow = ( type, at = rows.length ) => {
		if ( rows.length >= MAX_ROWS ) {
			return;
		}
		const values = {};
		if ( type !== 'group' ) {
			plans.forEach( ( plan ) => {
				values[ plan.id ] = { type: 'check', text: '' };
			} );
		}
		const row = {
			id: newId(
				type === 'group' ? 'g' : 'r',
				rows.map( ( r ) => r.id )
			),
			type,
			label: '',
			description: '',
			values,
		};
		const list = [ ...rows.slice( 0, at ), row, ...rows.slice( at ) ];
		setAttributes( {
			rows: list,
			...( type === 'group' && { showGroups: true } ),
		} );
	};
	const removeRow = ( index ) =>
		saveRows( rows.filter( ( _, i ) => i !== index ) );
	const moveRow = ( index, step ) => {
		const to = index + step;
		if ( to < 0 || to >= rows.length ) {
			return;
		}
		const list = [ ...rows ];
		[ list[ index ], list[ to ] ] = [ list[ to ], list[ index ] ];
		saveRows( list );
	};

	// ── Pieces ────────────────────────────────────────────────────────────
	const priceEdit = ( plan, key, periodKey, cls, fallback ) => {
		const value = str( plan[ key ] );
		const shown = value || fallback;
		const numeric = isNumeric( shown );
		const after = a.currencyPosition === 'after';
		return (
			<span className={ `wrbc-comparison__amount ${ cls }` }>
				{ numeric && ! after && a.currency && (
					<span className="wrbc-comparison__currency">
						{ a.currency }
					</span>
				) }
				<RichText
					tagName="span"
					className="wrbc-comparison__value"
					value={ value }
					onChange={ ( v ) => setPlan( plan.index, { [ key ]: v } ) }
					placeholder={ fallback || '0' }
					allowedFormats={ [] }
					aria-label={ __( 'Price', 'werun-blocks-community' ) }
				/>
				{ numeric && after && a.currency && (
					<span className="wrbc-comparison__currency">
						{ a.currency }
					</span>
				) }
				{ numeric && (
					<RichText
						tagName="span"
						className="wrbc-comparison__period"
						value={ str( plan[ periodKey ] ) }
						onChange={ ( v ) =>
							setPlan( plan.index, { [ periodKey ]: v } )
						}
						placeholder="/month"
						allowedFormats={ [] }
					/>
				) }
			</span>
		);
	};

	// Twin of $details_html in render.php.
	const details = ( plan ) => {
		const isFeatured = e.featured === plan.index + 1;
		const btnClass =
			a.buttonStyle === 'fill' ||
			( a.buttonStyle !== 'outline' && isFeatured )
				? 'wrbc-btn'
				: 'wrbc-btn wrbc-btn--outline';
		return (
			<>
				{ e.showPrices && (
					<p className="wrbc-comparison__price">
						{ priceEdit(
							plan,
							'price',
							'period',
							'wrbc-comparison__amount--monthly',
							str( plan.priceYearly )
						) }
						{ e.toggle &&
							priceEdit(
								plan,
								'priceYearly',
								'periodYearly',
								'wrbc-comparison__amount--yearly',
								str( plan.price )
							) }
					</p>
				) }
				{ e.showCta && (
					<span
						className={ cx(
							btnClass,
							'wrbc-comparison__cta',
							// No URL: the page prints the label as text (render.php).
							noUrl( plan.ctaUrl ) && 'is-static'
						) }
					>
						<RichText
							tagName="span"
							value={ str( plan.ctaLabel ) }
							onChange={ ( ctaLabel ) =>
								setPlan( plan.index, { ctaLabel } )
							}
							placeholder={ __(
								'Button (optional)',
								'werun-blocks-community'
							) }
							allowedFormats={ [] }
						/>
					</span>
				) }
			</>
		);
	};

	const tool = ( icon, label, onClick, disabled = false, extra = {} ) => (
		<Button
			size="small"
			icon={ lucide( TOOL_ICONS[ icon ] || icon ) }
			label={ label }
			showTooltip
			onClick={ onClick }
			disabled={ disabled }
			className="wrbc-comparison__tool"
			{ ...extra }
		/>
	);

	const cellEdit = ( row, index, plan, isAlt = false ) => {
		const value = cellValue( row, plan );
		const types = [ 'check', 'cross', 'partial', 'text' ];
		const featuredCell = e.featured === plan.index + 1;
		// The featured column paints its own background, on a stripe or not.
		const part = featuredCell ? ( isAlt ? colors.featAlt : colors.feat ) : null;
		return (
			<td
				key={ plan.id }
				{ ...partProps(
					part,
					cx(
						'wrbc-comparison__cell',
						value.type && `is-${ value.type }`,
						featuredCell && 'is-featured'
					)
				) }
			>
				<span className="wrbc-comparison__cell-edit">
					<DropdownMenu
						icon={
							value.type && value.type !== 'text' ? (
								<Icon
									icon={ icons[ value.type ] }
									className="wrbc-comparison__icon"
								/>
							) : (
								lucide( 'type' )
							)
						}
						label={ sprintf(
							/* translators: %s: current value type. */
							__( 'Value: %s. Change', 'werun-blocks-community' ),
							value.type
								? STATUS[ value.type ]
								: __( 'empty', 'werun-blocks-community' )
						) }
						toggleProps={ {
							size: 'small',
							className: 'wrbc-comparison__type',
						} }
						controls={ types.map( ( type ) => ( {
							title: STATUS[ type ],
							icon: {
								check: 'yes',
								cross: 'no-alt',
								partial: 'minus',
								text: 'editor-textcolor',
							}[ type ],
							isActive: value.type === type,
							onClick: () => setCell( index, plan, { type } ),
						} ) ) }
					/>
					{ ( value.type === 'text' ||
						value.type === 'partial' ||
						value.type === '' ) && (
						<RichText
							tagName="span"
							className="wrbc-comparison__text"
							value={ value.text }
							onChange={ ( text ) =>
								setCell( index, plan, {
									text,
									...( value.type === '' && {
										type: 'text',
									} ),
								} )
							}
							placeholder={
								value.type === 'partial'
									? __( 'Note', 'werun-blocks-community' )
									: __( 'Value', 'werun-blocks-community' )
							}
							allowedFormats={ [
								'core/bold',
								'core/italic',
								'core/link',
							] }
						/>
					) }
				</span>
			</td>
		);
	};

	// ── Table body, one <tbody> per group (twin of render.php) ────────────
	const bodies = [];
	let current = null;
	let alt = false;
	rows.forEach( ( row, index ) => {
		if ( row.type === 'group' && ! a.showGroups ) {
			return;
		}
		if ( row.type === 'group' || ! current ) {
			current = { key: row.id, rows: [] };
			bodies.push( current );
			alt = false;
		}
		const rowTools = (
			<span className="wrbc-comparison__row-tools">
				{ tool(
					'arrow-up-alt2',
					__( 'Move up', 'werun-blocks-community' ),
					() => moveRow( index, -1 ),
					index === 0
				) }
				{ tool(
					'arrow-down-alt2',
					__( 'Move down', 'werun-blocks-community' ),
					() => moveRow( index, 1 ),
					index === rows.length - 1
				) }
				{ row.type !== 'group' &&
					tool(
						'info-outline',
						__( 'Description', 'werun-blocks-community' ),
						() =>
							setOpenDesc(
								openDesc.includes( row.id )
									? openDesc.filter( ( id ) => id !== row.id )
									: [ ...openDesc, row.id ]
							),
						false,
						{
							isPressed:
								filled( row.description ) ||
								openDesc.includes( row.id ),
						}
					) }
				{ tool(
					'plus',
					__( 'Add a row below', 'werun-blocks-community' ),
					() => addRow( 'feature', index + 1 ),
					rows.length >= MAX_ROWS
				) }
				{ tool(
					'trash',
					__( 'Remove this row', 'werun-blocks-community' ),
					() => removeRow( index ),
					false,
					{ isDestructive: true }
				) }
			</span>
		);
		if ( row.type === 'group' ) {
			current.rows.push(
				<tr key={ row.id } className="wrbc-comparison__group">
					<th scope="rowgroup" colSpan={ plans.length + 1 }>
						<span className="wrbc-comparison__group-label">
							<RichText
								tagName="span"
								value={ str( row.label ) }
								onChange={ ( label ) =>
									setRow( index, { label } )
								}
								placeholder={ __(
									'Group heading',
									'werun-blocks-community'
								) }
								allowedFormats={ [
									'core/bold',
									'core/italic',
								] }
							/>
						</span>
						{ rowTools }
					</th>
				</tr>
			);
			return;
		}
		const hasDesc = filled( row.description );
		current.rows.push(
			<tr
				key={ row.id }
				{ ...partProps(
					a.zebra && alt ? colors.alt : null,
					cx( 'wrbc-comparison__row', a.zebra && alt && 'is-alt' )
				) }
			>
				<th
					scope="row"
					className="wrbc-comparison__label"
					abbr={
						hasDesc && filled( str( row.label ) )
							? plain( row.label )
							: undefined
					}
				>
					<span className="wrbc-comparison__label-row">
						<RichText
							tagName="span"
							className="wrbc-comparison__label-text"
							value={ str( row.label ) }
							onChange={ ( label ) => setRow( index, { label } ) }
							placeholder={ __( 'Feature', 'werun-blocks-community' ) }
							allowedFormats={ [
								'core/bold',
								'core/italic',
								'core/link',
							] }
						/>
						{ hasDesc && e.descToggle && (
							<span
								className="wrbc-comparison__tip"
								aria-hidden="true"
							>
								<Icon icon={ { name: 'info' } } />
							</span>
						) }
					</span>
					{ ( hasDesc || openDesc.includes( row.id ) ) && (
						<RichText
							tagName="span"
							className="wrbc-comparison__desc"
							value={ str( row.description ) }
							onChange={ ( description ) =>
								setRow( index, { description } )
							}
							placeholder={ __(
								'A line that explains the feature (optional)',
								'werun-blocks-community'
							) }
							allowedFormats={ [
								'core/bold',
								'core/italic',
								'core/link',
							] }
						/>
					) }
					{ rowTools }
				</th>
				{ plans.map( ( plan ) =>
					cellEdit( row, index, plan, !! a.zebra && alt )
				) }
			</tr>
		);
		alt = ! alt;
	} );

	// ── Wrapper (twin of render.php) ──────────────────────────────────────
	const blockProps = useBlockProps( {
		ref,
		className: cx(
			'wrbc-root wrbc-comparison',
			`wrbc-comparison--mobile-${ e.mobile }`,
			`wrbc-comparison--${ a.density === 'compact' ? 'compact' : 'comfortable' }`,
			a.stickyHeader && 'has-sticky-head',
			e.mobile === 'scroll' && a.stickyFirstColumn && 'has-sticky-col',
			e.featured && 'has-featured',
			colors.rootClass
		),
		'data-period': period,
		style: cssVars( {
			'--wrbc-plans': plans.length,
			'--wrbc-label-col': `${ Math.max( 20, Math.min( 50, a.labelWidth || 32 ) ) }%`,
			'--wrbc-sticky-top': a.stickyHeader
				? px( Math.max( 0, Math.min( 200, a.stickyOffset || 0 ) ) )
				: undefined,
			'--wrbc-featured-bg': e.featured ? a.featuredBg : undefined,
			'--wrbc-head-bg': a.headBg,
			'--wrbc-line': a.lineColor,
			'--wrbc-zebra': a.zebra ? a.zebraColor : undefined,
			'--wrbc-radius': px(
				Math.max( 0, Math.min( 32, a.tableRadius ?? 14 ) )
			),
			'--wrbc-icon-size': px(
				Math.max( 12, Math.min( 32, a.iconSize || 20 ) )
			),
			'--wrbc-icon-stroke': Math.max(
				1,
				Math.min( 3, a.iconStroke || 2.25 )
			),
			// Accent, its on-colour and readable text colour, the "Save" note's
			// colour, the table's background (twin of render.php).
			...colors.rootVars,
		} ),
	} );

	const planOptions = [
		{ value: '0', label: __( 'None', 'werun-blocks-community' ) },
	].concat(
		plans.map( ( plan ) => ( {
			value: String( plan.index + 1 ),
			label: filled( str( plan.name ) )
				? str( plan.name ).replace( /<[^>]*>/g, '' )
				: sprintf(
						/* translators: %d: column number. */ __(
							'Plan %d',
							'werun-blocks-community'
						),
						plan.index + 1
					),
		} ) )
	);

	return (
		<>
			<ContrastAudit
				blockRef={ ref }
				deps={ [ attributes, surface ] }
				checks={ [
					{
						selector:
							'.wrbc-comparison__radio:checked + .wrbc-comparison__option',
						property: 'border-color',
						min: 3,
						label: __( 'Selected billing period', 'werun-blocks-community' ),
					},
					{
						selector: '.wrbc-comparison__table thead th.is-featured',
						property: 'box-shadow',
						against: 'self',
						min: 3,
						label: __( 'Featured column bar', 'werun-blocks-community' ),
					},
					{
						selector: '.wrbc-comparison__card.is-featured',
						property: 'border-color',
						min: 3,
						label: __( 'Featured plan outline', 'werun-blocks-community' ),
					},
					{
						selector:
							'.wrbc-comparison__card-item.is-check .wrbc-comparison__icon',
						property: 'color',
						min: 3,
						label: __( 'Included icons', 'werun-blocks-community' ),
					},
					{
						selector:
							'.wrbc-comparison__card-item.is-cross .wrbc-comparison__icon',
						property: 'color',
						min: 3,
						label: __( 'Not-included icons', 'werun-blocks-community' ),
					},
					{
						selector:
							'.wrbc-comparison__card-item.is-partial .wrbc-comparison__icon',
						property: 'color',
						min: 3,
						label: __( 'Partly-included icons', 'werun-blocks-community' ),
					},
				] }
				// Editor-only parts, and the caption shown for editing while the page hides it.
				ignore=".wrbc-comparison__editor-bar, .wrbc-comparison__editor-note, .wrbc-comparison__plan-tools, .wrbc-comparison__row-tools, .wrbc-comparison__caption.is-editor-hidden"
				labels={ {
					'.wrbc-comparison__save': __( 'Saving note', 'werun-blocks-community' ),
					'.wrbc-comparison__option': __(
						'Billing switch',
						'werun-blocks-community'
					),
					'.wrbc-comparison__badge': __( 'Badge', 'werun-blocks-community' ),
					'.wrbc-comparison__cta': __( 'Plan buttons', 'werun-blocks-community' ),
					'.wrbc-comparison__name': __( 'Plan names', 'werun-blocks-community' ),
					'.wrbc-comparison__period': __(
						'Price periods',
						'werun-blocks-community'
					),
					'.wrbc-comparison__group-label': __(
						'Group headings',
						'werun-blocks-community'
					),
					'.wrbc-comparison__desc': __(
						'Feature descriptions',
						'werun-blocks-community'
					),
					'.wrbc-comparison__label': __(
						'Feature names',
						'werun-blocks-community'
					),
					'.wrbc-comparison__cell': __( 'Values', 'werun-blocks-community' ),
					'.wrbc-comparison__caption': __( 'Caption', 'werun-blocks-community' ),
				} }
				actions={
					textFails
						? [
								{
									label: __(
										'Use the automatic text colour',
										'werun-blocks-community'
									),
									onClick: () =>
										setAttributes( {
											textColor: undefined,
											style: withoutTextColor( a.style ),
										} ),
								},
						  ]
						: []
				}
			/>
			<InspectorControls>
				{ missingUrls > 0 && (
					<div className="wrbc-comparison__notice">
						<Notice status="warning" isDismissible={ false }>
							{ sprintf(
								/* translators: %d: number of plans whose button has no URL. */
								_n(
									'%d plan button has no URL: add one in the plan’s panel, or the page shows its label as plain text.',
									'%d plan buttons have no URL: add them in the plans’ panels, or the page shows their labels as plain text.',
									missingUrls,
									'werun-blocks-community'
								),
								missingUrls
							) }
						</Notice>
					</div>
				) }
				<PanelBody title={ __( 'Table', 'werun-blocks-community' ) }>
					<SelectControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Featured plan', 'werun-blocks-community' ) }
						help={ __(
							'Its column is highlighted, with the badge and a filled button.',
							'werun-blocks-community'
						) }
						value={ String( e.featured ) }
						options={ planOptions }
						onChange={ ( v ) =>
							setAttributes( { featuredColumn: Number( v ) } )
						}
					/>
					{ !! e.featured && (
						<Toggle
							attributes={ a }
							setAttributes={ setAttributes }
							name="showBadge"
							label={ __(
								'Badge on the featured plan',
								'werun-blocks-community'
							) }
						/>
					) }
					<Toggle
						attributes={ a }
						setAttributes={ setAttributes }
						name="showPrices"
						label={ __( 'Prices', 'werun-blocks-community' ) }
					/>
					<Toggle
						attributes={ a }
						setAttributes={ setAttributes }
						name="showCta"
						label={ __( 'Buttons', 'werun-blocks-community' ) }
					/>
					{ ( a.showPrices || a.showCta ) && (
						<Toggle
							attributes={ a }
							setAttributes={ setAttributes }
							name="pricesOnTop"
							label={ __(
								'Prices and buttons in the header row',
								'werun-blocks-community'
							) }
							help={
								a.pricesOnTop
									? __(
											'They stick with the header when it is sticky.',
											'werun-blocks-community'
										)
									: __(
											'Off: in a row under the table.',
											'werun-blocks-community'
										)
							}
						/>
					) }
					{ a.showCta && (
						<Choice
							label={ __( 'Button style', 'werun-blocks-community' ) }
							value={ a.buttonStyle }
							options={ [
								[
									'auto',
									e.featured
										? __(
												'Featured filled',
												'werun-blocks-community'
											)
										: __( 'Outline', 'werun-blocks-community' ),
								],
								[ 'fill', __( 'All filled', 'werun-blocks-community' ) ],
								[
									'outline',
									__( 'All outline', 'werun-blocks-community' ),
								],
							] }
							onChange={ ( buttonStyle ) =>
								setAttributes( { buttonStyle } )
							}
						/>
					) }
					{ hasGroups && (
						<Toggle
							attributes={ a }
							setAttributes={ setAttributes }
							name="showGroups"
							label={ __( 'Group headings', 'werun-blocks-community' ) }
						/>
					) }
					{ hasDescriptions && (
						<Choice
							label={ __(
								'Feature descriptions',
								'werun-blocks-community'
							) }
							value={ a.descriptionDisplay }
							options={ [
								[
									'toggle',
									__(
										'Behind an info button',
										'werun-blocks-community'
									),
								],
								[
									'below',
									__( 'Under the name', 'werun-blocks-community' ),
								],
							] }
							onChange={ ( descriptionDisplay ) =>
								setAttributes( { descriptionDisplay } )
							}
						/>
					) }
					<Toggle
						attributes={ a }
						setAttributes={ setAttributes }
						name="zebra"
						label={ __( 'Zebra stripes', 'werun-blocks-community' ) }
					/>
					<Choice
						label={ __( 'Density', 'werun-blocks-community' ) }
						value={ a.density }
						options={ [
							[
								'comfortable',
								__( 'Comfortable', 'werun-blocks-community' ),
							],
							[ 'compact', __( 'Compact', 'werun-blocks-community' ) ],
						] }
						onChange={ ( density ) => setAttributes( { density } ) }
					/>
					<RangeControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __(
							'Feature column width (%)',
							'werun-blocks-community'
						) }
						value={ a.labelWidth }
						min={ 20 }
						max={ 50 }
						onChange={ ( labelWidth ) =>
							setAttributes( { labelWidth } )
						}
					/>
					<RangeControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Corner radius (px)', 'werun-blocks-community' ) }
						value={ a.tableRadius }
						min={ 0 }
						max={ 32 }
						onChange={ ( tableRadius ) =>
							setAttributes( { tableRadius } )
						}
					/>
					<TextControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Table caption', 'werun-blocks-community' ) }
						help={ __(
							'Names the table for screen readers.',
							'werun-blocks-community'
						) }
						value={ str( a.caption ) }
						onChange={ ( caption ) => setAttributes( { caption } ) }
					/>
					<Toggle
						attributes={ a }
						setAttributes={ setAttributes }
						name="showCaption"
						label={ __( 'Show the caption', 'werun-blocks-community' ) }
					/>
					<Toggle
						attributes={ a }
						setAttributes={ setAttributes }
						name="reveal"
						label={ __(
							'Fade in when it scrolls into view',
							'werun-blocks-community'
						) }
					/>
				</PanelBody>

				{ a.showPrices && (
					<PanelBody
						title={ __(
							'Prices and billing switch',
							'werun-blocks-community'
						) }
						initialOpen={ false }
					>
						<Toggle
							attributes={ a }
							setAttributes={ setAttributes }
							name="showToggle"
							label={ __(
								'Monthly / yearly switch',
								'werun-blocks-community'
							) }
							help={
								a.showToggle && ! e.hasYearly
									? __(
											'Shown once a plan has a yearly price (Plans panels).',
											'werun-blocks-community'
										)
									: undefined
							}
						/>
						{ /* render.php prints the switch only with a yearly price (e.toggle). */ }
						{ e.toggle && (
							<>
								<Choice
									label={ __(
										'Shown first',
										'werun-blocks-community'
									) }
									value={ a.defaultPeriod }
									options={ [
										[
											'monthly',
											__( 'Monthly', 'werun-blocks-community' ),
										],
										[
											'yearly',
											__( 'Yearly', 'werun-blocks-community' ),
										],
									] }
									onChange={ ( defaultPeriod ) => {
										setAttributes( { defaultPeriod } );
										setPreview( null );
									} }
								/>
								<TextControl
									__nextHasNoMarginBottom
									__next40pxDefaultSize
									label={ __(
										'Monthly label',
										'werun-blocks-community'
									) }
									value={ a.monthlyLabel }
									onChange={ ( monthlyLabel ) =>
										setAttributes( { monthlyLabel } )
									}
								/>
								<TextControl
									__nextHasNoMarginBottom
									__next40pxDefaultSize
									label={ __(
										'Yearly label',
										'werun-blocks-community'
									) }
									value={ a.yearlyLabel }
									onChange={ ( yearlyLabel ) =>
										setAttributes( { yearlyLabel } )
									}
								/>
								<Toggle
									attributes={ a }
									setAttributes={ setAttributes }
									name="showYearlyNote"
									label={ __(
										'Saving note on yearly',
										'werun-blocks-community'
									) }
								/>
								{ a.showYearlyNote && (
									<TextControl
										__nextHasNoMarginBottom
										__next40pxDefaultSize
										label={ __(
											'Saving note',
											'werun-blocks-community'
										) }
										value={ a.yearlyNote }
										onChange={ ( yearlyNote ) =>
											setAttributes( { yearlyNote } )
										}
									/>
								) }
								{ ! a.showHeader && (
									<Choice
										label={ __(
											'Switch alignment',
											'werun-blocks-community'
										) }
										value={ a.headerAlign }
										options={ [
											[
												'left',
												__( 'Left', 'werun-blocks-community' ),
											],
											[
												'center',
												__( 'Center', 'werun-blocks-community' ),
											],
										] }
										onChange={ ( headerAlign ) =>
											setAttributes( { headerAlign } )
										}
									/>
								) }
							</>
						) }
						<div className="wrbc-panel-row">
							<TextControl
								__nextHasNoMarginBottom
								__next40pxDefaultSize
								label={ __( 'Currency', 'werun-blocks-community' ) }
								value={ a.currency }
								onChange={ ( currency ) =>
									setAttributes( { currency } )
								}
							/>
							{ !! a.currency && (
								<Choice
									label={ __( 'Position', 'werun-blocks-community' ) }
									value={ a.currencyPosition }
									options={ [
										[
											'before',
											__( 'Before', 'werun-blocks-community' ),
										],
										[
											'after',
											__( 'After', 'werun-blocks-community' ),
										],
									] }
									onChange={ ( currencyPosition ) =>
										setAttributes( { currencyPosition } )
									}
								/>
							) }
						</div>
					</PanelBody>
				) }

				{ plans.map( ( plan ) => {
					const isFeatured = e.featured === plan.index + 1;
					const name = filled( str( plan.name ) )
						? str( plan.name ).replace( /<[^>]*>/g, '' )
						: sprintf(
								/* translators: %d: column number. */ __(
									'Plan %d',
									'werun-blocks-community'
								),
								plan.index + 1
							);
					return (
						<PanelBody
							key={ plan.id }
							title={ sprintf(
								/* translators: %s: plan name. */ __(
									'Plan: %s',
									'werun-blocks-community'
								),
								name
							) }
							initialOpen={ false }
						>
							<TextControl
								__nextHasNoMarginBottom
								__next40pxDefaultSize
								label={ __( 'Name', 'werun-blocks-community' ) }
								value={ str( plan.name ) }
								onChange={ ( v ) =>
									setPlan( plan.index, { name: v } )
								}
							/>
							<Toggle
								attributes={ { featured: isFeatured } }
								setAttributes={ ( { featured } ) =>
									setAttributes( {
										featuredColumn: featured
											? plan.index + 1
											: 0,
									} )
								}
								name="featured"
								label={ __( 'Featured plan', 'werun-blocks-community' ) }
							/>
							{ isFeatured && a.showBadge && (
								<TextControl
									__nextHasNoMarginBottom
									__next40pxDefaultSize
									label={ __( 'Badge', 'werun-blocks-community' ) }
									value={ str( plan.badge ) }
									onChange={ ( v ) =>
										setPlan( plan.index, { badge: v } )
									}
								/>
							) }
							{ a.showPrices && (
								<>
									<TextControl
										__nextHasNoMarginBottom
										__next40pxDefaultSize
										label={
											a.showToggle
												? __(
														'Monthly price',
														'werun-blocks-community'
													)
												: __( 'Price', 'werun-blocks-community' )
										}
										help={ __(
											'A number gets the currency and the period. Text such as "Custom" stands alone.',
											'werun-blocks-community'
										) }
										value={ str( plan.price ) }
										onChange={ ( v ) =>
											setPlan( plan.index, { price: v } )
										}
									/>
									{ isNumeric( plan.price ) && (
										<TextControl
											__nextHasNoMarginBottom
											__next40pxDefaultSize
											label={
												a.showToggle
													? __(
															'Monthly period',
															'werun-blocks-community'
														)
													: __(
															'Period',
															'werun-blocks-community'
														)
											}
											placeholder="/month"
											value={ str( plan.period ) }
											onChange={ ( v ) =>
												setPlan( plan.index, {
													period: v,
												} )
											}
										/>
									) }
									{ a.showToggle && (
										<>
											<TextControl
												__nextHasNoMarginBottom
												__next40pxDefaultSize
												label={ __(
													'Yearly price',
													'werun-blocks-community'
												) }
												help={ __(
													'Empty: the monthly price is shown for yearly too.',
													'werun-blocks-community'
												) }
												value={ str(
													plan.priceYearly
												) }
												onChange={ ( v ) =>
													setPlan( plan.index, {
														priceYearly: v,
													} )
												}
											/>
											{ isNumeric( plan.priceYearly ) && (
												<TextControl
													__nextHasNoMarginBottom
													__next40pxDefaultSize
													label={ __(
														'Yearly period',
														'werun-blocks-community'
													) }
													placeholder="/month, billed yearly"
													value={ str(
														plan.periodYearly
													) }
													onChange={ ( v ) =>
														setPlan( plan.index, {
															periodYearly: v,
														} )
													}
												/>
											) }
										</>
									) }
								</>
							) }
							{ a.showCta && (
								<>
									<TextControl
										__nextHasNoMarginBottom
										__next40pxDefaultSize
										label={ __(
											'Button label',
											'werun-blocks-community'
										) }
										help={ __(
											'Empty: no button for this plan.',
											'werun-blocks-community'
										) }
										value={ str( plan.ctaLabel ) }
										onChange={ ( v ) =>
											setPlan( plan.index, {
												ctaLabel: v,
											} )
										}
									/>
									{ filled( str( plan.ctaLabel ) ) && (
										<LinkFields
											url={ str( plan.ctaUrl ) }
											newTab={ !! plan.ctaNewTab }
											onChange={ ( v ) =>
												setPlan( plan.index, {
													...( 'url' in v && {
														ctaUrl: v.url,
													} ),
													...( 'newTab' in v && {
														ctaNewTab: v.newTab,
													} ),
												} )
											}
										/>
									) }
									{ filled( str( plan.ctaLabel ) ) &&
										noUrl( plan.ctaUrl ) && (
											<p className="wrbc-comparison__panel-note">
												{ __(
													'No link yet: on the page this button shows as text, not as a link.',
													'werun-blocks-community'
												) }
											</p>
										) }
								</>
							) }
						</PanelBody>
					);
				} ) }

				<PanelBody
					title={ __( 'Scrolling and phones', 'werun-blocks-community' ) }
					initialOpen={ false }
				>
					<Toggle
						attributes={ a }
						setAttributes={ setAttributes }
						name="stickyHeader"
						label={ __( 'Sticky header row', 'werun-blocks-community' ) }
						help={ __(
							'The plan names stay on screen while the table scrolls by. Not while the phone layout scrolls sideways.',
							'werun-blocks-community'
						) }
					/>
					{ a.stickyHeader && (
						<RangeControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							label={ __(
								'Space above the sticky row (px)',
								'werun-blocks-community'
							) }
							help={ __(
								'For a sticky site header. The admin bar is added on its own.',
								'werun-blocks-community'
							) }
							value={ a.stickyOffset }
							min={ 0 }
							max={ 200 }
							onChange={ ( stickyOffset ) =>
								setAttributes( { stickyOffset } )
							}
						/>
					) }
					<Choice
						label={ __(
							'On narrow screens (under 720 px)',
							'werun-blocks-community'
						) }
						value={ a.mobileLayout }
						options={ [
							[
								'scroll',
								__( 'Scroll sideways', 'werun-blocks-community' ),
							],
							[
								'stacked',
								__( 'A card per plan', 'werun-blocks-community' ),
							],
						] }
						onChange={ ( mobileLayout ) =>
							setAttributes( { mobileLayout } )
						}
					/>
					{ e.mobile === 'scroll' && (
						<Toggle
							attributes={ a }
							setAttributes={ setAttributes }
							name="stickyFirstColumn"
							label={ __(
								'Feature names stay while scrolling sideways',
								'werun-blocks-community'
							) }
						/>
					) }
					{ e.mobile === 'stacked' && (
						<Toggle
							attributes={ a }
							setAttributes={ setAttributes }
							name="stackedHideExcluded"
							label={ __(
								'Leave out what a plan does not include',
								'werun-blocks-community'
							) }
						/>
					) }
					{ e.mobile === 'stacked' && ! hasTitle && (
						// With a title, the cards' plan names are one level under it (Section header → Title level).
						<Choice
							label={ __( 'Plan name level', 'werun-blocks-community' ) }
							help={ __(
								'The table has no title, so the plan names are the top headings of the phone cards.',
								'werun-blocks-community'
							) }
							value={ String( a.titleLevel || 2 ) }
							options={ [
								[ '2', 'H2' ],
								[ '3', 'H3' ],
								[ '4', 'H4' ],
							] }
							onChange={ ( value ) =>
								setAttributes( { titleLevel: Number( value ) } )
							}
						/>
					) }
				</PanelBody>

				{ ( hasCheck || hasCross || hasPartial ) && (
					<PanelBody
						title={ __( 'Icons', 'werun-blocks-community' ) }
						initialOpen={ false }
					>
						{ hasCheck && (
							<IconControl
								label={ __( 'Included', 'werun-blocks-community' ) }
								value={ a.includedIcon }
								allowRemove={ false }
								onChange={ ( includedIcon ) =>
									setAttributes( { includedIcon } )
								}
							/>
						) }
						{ hasCross && (
							<IconControl
								label={ __( 'Not included', 'werun-blocks-community' ) }
								value={ a.excludedIcon }
								allowRemove={ false }
								onChange={ ( excludedIcon ) =>
									setAttributes( { excludedIcon } )
								}
							/>
						) }
						{ hasPartial && (
							<IconControl
								label={ __(
									'Partially included',
									'werun-blocks-community'
								) }
								value={ a.partialIcon }
								allowRemove={ false }
								onChange={ ( partialIcon ) =>
									setAttributes( { partialIcon } )
								}
							/>
						) }
						<IconSizeControls
							attributes={ a }
							setAttributes={ setAttributes }
							maxSize={ 32 }
						/>
					</PanelBody>
				) }

				<SectionHeaderPanel
					attributes={ a }
					setAttributes={ setAttributes }
				/>

				<PanelColorSettings
					title={ __( 'Table colors', 'werun-blocks-community' ) }
					initialOpen={ false }
					colorSettings={ [
						{
							value: a.accentColor,
							onChange: ( accentColor ) =>
								setAttributes( { accentColor } ),
							label: __(
								'Accent (icons, featured, buttons)',
								'werun-blocks-community'
							),
						},
						// Only filled buttons, the badge and the switch draw text on the accent.
						( a.showCta || e.showBadge || e.toggle ) && {
							value: a.onAccentColor,
							onChange: ( onAccentColor ) =>
								setAttributes( { onAccentColor } ),
							label: __( 'Text on the accent', 'werun-blocks-community' ),
						},
						!! e.featured && {
							value: a.featuredBg,
							onChange: ( featuredBg ) =>
								setAttributes( { featuredBg } ),
							label: __( 'Featured column', 'werun-blocks-community' ),
						},
						{
							value: a.tableBg,
							onChange: ( tableBg ) =>
								setAttributes( { tableBg } ),
							label: __( 'Table background', 'werun-blocks-community' ),
						},
						{
							value: a.headBg,
							onChange: ( headBg ) => setAttributes( { headBg } ),
							label: __( 'Header row', 'werun-blocks-community' ),
						},
						{
							value: a.lineColor,
							onChange: ( lineColor ) =>
								setAttributes( { lineColor } ),
							label: __( 'Lines', 'werun-blocks-community' ),
						},
						a.zebra && {
							value: a.zebraColor,
							onChange: ( zebraColor ) =>
								setAttributes( { zebraColor } ),
							label: __( 'Stripes', 'werun-blocks-community' ),
						},
					].filter( Boolean ) }
				/>
			</InspectorControls>

			<section { ...blockProps }>
				<SectionHeader
					attributes={ a }
					setAttributes={ setAttributes }
					uid={ uid }
				/>
				{ e.toggle && (
					<div
						className={ cx(
							'wrbc-comparison__switch-wrap',
							a.headerAlign === 'center' && 'is-center'
						) }
					>
						{ /* Twin of render.php: a native radio group; here it switches the preview. */ }
						<div
							className="wrbc-comparison__switch"
							role="radiogroup"
							aria-label={ __(
								'Billing period (preview)',
								'werun-blocks-community'
							) }
						>
							{ [ 'monthly', 'yearly' ].map( ( p ) => (
								<label key={ p } className="wrbc-comparison__choice">
									<input
										type="radio"
										className="wrbc-comparison__radio"
										name={ `${ uid }-period` }
										value={ p }
										checked={ period === p }
										onChange={ () => setPreview( p ) }
									/>
									<span className="wrbc-comparison__option">
										{ ( p === 'monthly'
											? str( a.monthlyLabel )
											: str( a.yearlyLabel )
										).trim() ||
											( p === 'monthly'
												? __( 'Monthly', 'werun-blocks-community' )
												: __( 'Yearly', 'werun-blocks-community' ) ) }
										{ p === 'yearly' &&
											a.showYearlyNote &&
											filled( a.yearlyNote ) && (
												<span className="wrbc-comparison__save">
													{ a.yearlyNote }
												</span>
											) }
									</span>
								</label>
							) ) }
						</div>
					</div>
				) }
				<div className="wrbc-comparison__body">
					<div className="wrbc-comparison__scroll">
						<table className="wrbc-comparison__table">
							<RichText
								tagName="caption"
								id={ `${ uid }-caption` }
								className={ cx(
									'wrbc-comparison__caption',
									! a.showCaption && 'is-editor-hidden'
								) }
								value={ str( a.caption ) }
								onChange={ ( caption ) =>
									setAttributes( { caption } )
								}
								placeholder={ __(
									'Plan comparison',
									'werun-blocks-community'
								) }
								allowedFormats={ [] }
							/>
							<colgroup>
								<col className="wrbc-comparison__col-label" />
								{ plans.map( ( plan ) => (
									<col
										key={ plan.id }
										className={ cx(
											'wrbc-comparison__col-plan',
											e.featured === plan.index + 1 &&
												'is-featured'
										) }
									/>
								) ) }
							</colgroup>
							<thead { ...partProps( headPart ) }>
								<tr>
									<td className="wrbc-comparison__corner">
										<RichText
											tagName="span"
											value={ str( a.cornerLabel ) }
											onChange={ ( cornerLabel ) =>
												setAttributes( { cornerLabel } )
											}
											placeholder={ __(
												'Corner label (optional)',
												'werun-blocks-community'
											) }
											allowedFormats={ [
												'core/bold',
												'core/italic',
											] }
										/>
									</td>
									{ plans.map( ( plan ) => {
										const isFeatured =
											e.featured === plan.index + 1;
										const hasBadge =
											isFeatured &&
											e.showBadge &&
											filled( str( plan.badge ) );
										// Twin of render.php: abbr is the bare name when the cell holds more.
										const headAbbr =
											isFeatured ||
											( e.onTop &&
												( e.showPrices || e.showCta ) )
												? plainName( plan )
												: undefined;
										return (
											<th
												key={ plan.id }
												scope="col"
												{ ...partProps(
													isFeatured
														? colors.featHead
														: null,
													cx(
														'wrbc-comparison__plan',
														isFeatured &&
															'is-featured'
													)
												) }
												abbr={ headAbbr }
											>
												<span className="wrbc-comparison__plan-tools">
													{ tool(
														'arrow-left-alt2',
														__(
															'Move left',
															'werun-blocks-community'
														),
														() =>
															movePlan(
																plan.index,
																-1
															),
														plan.index === 0
													) }
													{ tool(
														'arrow-right-alt2',
														__(
															'Move right',
															'werun-blocks-community'
														),
														() =>
															movePlan(
																plan.index,
																1
															),
														plan.index ===
															plans.length - 1
													) }
													{ tool(
														isFeatured
															? 'star-filled'
															: 'star-empty',
														isFeatured
															? __(
																	'Featured plan: click to unset',
																	'werun-blocks-community'
																)
															: __(
																	'Make this the featured plan',
																	'werun-blocks-community'
																),
														() =>
															setAttributes( {
																featuredColumn:
																	isFeatured
																		? 0
																		: plan.index +
																			1,
															} ),
														false,
														{
															isPressed:
																isFeatured,
														}
													) }
													{ tool(
														'trash',
														__(
															'Remove this plan',
															'werun-blocks-community'
														),
														() =>
															removePlan(
																plan.index
															),
														false,
														{ isDestructive: true }
													) }
												</span>
												{ isFeatured && e.showBadge && (
													<RichText
														tagName="span"
														className="wrbc-comparison__badge"
														value={ str(
															plan.badge
														) }
														onChange={ ( badge ) =>
															setPlan(
																plan.index,
																{ badge }
															)
														}
														placeholder={ __(
															'Badge',
															'werun-blocks-community'
														) }
														allowedFormats={ [] }
													/>
												) }
												<RichText
													tagName="span"
													className="wrbc-comparison__name"
													value={ str( plan.name ) }
													onChange={ ( name ) =>
														setPlan( plan.index, {
															name,
														} )
													}
													placeholder={ __(
														'Plan name',
														'werun-blocks-community'
													) }
													allowedFormats={ [] }
												/>
												{ isFeatured && ! hasBadge && (
													<span className="wrbc-sr-only">
														{ `(${ __(
															'Featured plan',
															'werun-blocks-community'
														) })` }
													</span>
												) }
												{ e.onTop &&
													( e.showPrices ||
														e.showCta ) && (
														<div className="wrbc-comparison__details">
															{ details( plan ) }
														</div>
													) }
											</th>
										);
									} ) }
								</tr>
							</thead>
							{ bodies.map( ( body ) => (
								<tbody
									key={ body.key }
									{ ...partProps( colors.table ) }
								>
									{ body.rows }
								</tbody>
							) ) }
							{ e.foot && (
								<tfoot { ...partProps( colors.table ) }>
									<tr>
										<th
											scope="row"
											className="wrbc-comparison__corner"
										>
											<span className="wrbc-sr-only">
												{ e.showPrices
													? __(
															'Price',
															'werun-blocks-community'
														)
													: __(
															'Choose a plan',
															'werun-blocks-community'
														) }
											</span>
										</th>
										{ plans.map( ( plan ) => (
											<td
												key={ plan.id }
												{ ...partProps(
													e.featured ===
														plan.index + 1
														? colors.feat
														: null,
													cx(
														'wrbc-comparison__cell wrbc-comparison__foot',
														e.featured ===
															plan.index + 1 &&
															'is-featured'
													)
												) }
											>
												{ details( plan ) }
											</td>
										) ) }
									</tr>
								</tfoot>
							) }
						</table>
					</div>
					{ e.mobile === 'stacked' && (
						<Cards
							a={ a }
							e={ e }
							plans={ plans }
							rows={ visibleRows }
							icons={ icons }
							uid={ uid }
							colors={ colors }
							hasTitle={ hasTitle }
						/>
					) }
				</div>
				<div className="wrbc-comparison__editor-bar">
					<Button
						variant="secondary"
						size="small"
						icon={ lucide( 'plus' ) }
						onClick={ () => addRow( 'feature' ) }
						disabled={ rows.length >= MAX_ROWS }
					>
						{ __( 'Feature row', 'werun-blocks-community' ) }
					</Button>
					<Button
						variant="secondary"
						size="small"
						icon={ lucide( 'plus' ) }
						onClick={ () => addRow( 'group' ) }
						disabled={ rows.length >= MAX_ROWS }
					>
						{ __( 'Group heading', 'werun-blocks-community' ) }
					</Button>
					<Button
						variant="secondary"
						size="small"
						icon={ lucide( 'plus' ) }
						onClick={ addPlan }
						disabled={ plans.length >= MAX_PLANS }
					>
						{ __( 'Plan column', 'werun-blocks-community' ) }
					</Button>
					<span className="wrbc-comparison__editor-count">
						{ sprintf(
							/* translators: 1: plans, 2: max plans, 3: rows, 4: max rows. */
							__(
								'%1$d of %2$d plans · %3$d of %4$d rows',
								'werun-blocks-community'
							),
							plans.length,
							MAX_PLANS,
							rows.length,
							MAX_ROWS
						) }
					</span>
				</div>
			</section>
		</>
	);
}

/**
 * Phone cards (stacked layout), a read-only preview: twin of the cards in render.php
 * (headings for the plan and its groups, descriptions, the caption's copy).
 *
 * @param {Object} props       Props.
 * @param {Object} props.a     Attributes.
 * @param {Object} props.e     Effective options (model.js).
 * @param {Array}  props.plans Normalised plans.
 * @param {Array}  props.rows  Rows shown (groups only when on).
 * @param {Object}  props.icons    Icons per value type.
 * @param {string}  props.uid      Instance id.
 * @param {Object}  props.colors   The table's colours (colors.js comparisonColors()).
 * @param {boolean} props.hasTitle Whether the section title is printed.
 */
function Cards( { a, e, plans, rows, icons, uid, colors, hasTitle } ) {
	const after = a.currencyPosition === 'after';
	// Twin of $card_level / $group_level in render.php: one level under the
	// title, or the title's own level when none is printed.
	const titleLevel = Math.max( 2, Math.min( 4, Number( a.titleLevel ) || 2 ) );
	const level = hasTitle ? titleLevel + 1 : titleLevel;
	const NameTag = `h${ level }`;
	const GroupTag = `h${ Math.min( 6, level + 1 ) }`;
	const price = ( amount, per ) => {
		const text = plain( amount );
		const numeric = isNumeric( text );
		return (
			<>
				{ numeric && ! after && a.currency && (
					<span className="wrbc-comparison__currency">
						{ a.currency }
					</span>
				) }
				<span className="wrbc-comparison__value">{ text }</span>
				{ numeric && after && a.currency && (
					<span className="wrbc-comparison__currency">
						{ a.currency }
					</span>
				) }
				{ numeric && filled( str( per ) ) && (
					<span className="wrbc-comparison__period">
						{ plain( per ) }
					</span>
				) }
			</>
		);
	};
	return (
		<>
			{ /* Outside the list: only cards belong in it. */ }
			<p className="wrbc-comparison__editor-note">
				{ __(
					'Phone layout preview. Edit the table in a wider view.',
					'werun-blocks-community'
				) }
			</p>
			{ a.showCaption && (
				<p className="wrbc-comparison__cards-caption">
					{ plain( a.caption ) ||
						__( 'Plan comparison', 'werun-blocks-community' ) }
				</p>
			) }
			{ /* Each card paints the table's background (the list itself paints nothing). */ }
			<div
				className="wrbc-comparison__cards"
				role="list"
				aria-labelledby={ `${ uid }-caption` }
			>
				{ plans.map( ( plan ) => {
					const isFeatured = e.featured === plan.index + 1;
					const hasBadge =
						isFeatured && e.showBadge && filled( str( plan.badge ) );
					const named = filled( str( plan.name ) );
					const yearly = filled( str( plan.priceYearly ) );
					const btnClass =
						a.buttonStyle === 'fill' ||
						( a.buttonStyle !== 'outline' && isFeatured )
							? 'wrbc-btn'
							: 'wrbc-btn wrbc-btn--outline';
					const groups = [];
					let list = null;
					// Twin of render.php: a heading only with a line under it.
					let pending = null;
					rows.forEach( ( row ) => {
						if ( row.type === 'group' ) {
							pending = filled( str( row.label ) ) ? row : null;
							list = null;
							return;
						}
						const cell = cellValue( row, plan );
						if (
							( cell.type === 'cross' && a.stackedHideExcluded ) ||
							! filled( str( row.label ) ) ||
							! cell.type ||
							( cell.type === 'text' && ! filled( cell.text ) )
						) {
							return;
						}
						if ( pending ) {
							groups.push(
								<GroupTag
									key={ `g-${ pending.id }` }
									className="wrbc-comparison__card-group"
								>
									{ plain( pending.label ) }
								</GroupTag>
							);
							pending = null;
						}
						if ( ! list ) {
							list = [];
							groups.push(
								<ul
									key={ `l-${ row.id }` }
									className="wrbc-comparison__card-list"
								>
									{ list }
								</ul>
							);
						}
						const hasDesc = filled( row.description );
						list.push(
							<li
								key={ row.id }
								className={ `wrbc-comparison__card-item is-${ cell.type }` }
							>
								{ cell.type !== 'text' && (
									<Icon
										icon={ icons[ cell.type ] }
										className="wrbc-comparison__icon"
									/>
								) }
								<span className="wrbc-comparison__card-main">
									<span className="wrbc-comparison__label-row">
										<span className="wrbc-comparison__card-label">
											{ plain( row.label ) }
										</span>
										{ hasDesc && e.descToggle && (
											<span
												className="wrbc-comparison__tip"
												aria-hidden="true"
											>
												<Icon icon={ { name: 'info' } } />
											</span>
										) }
									</span>
									{ /* Behind the info button on the page; under the name otherwise. */ }
									{ hasDesc && ! e.descToggle && (
										<span className="wrbc-comparison__desc">
											{ plain( row.description ) }
										</span>
									) }
								</span>
								{ ( cell.type === 'text' ||
									( cell.type === 'partial' &&
										filled( cell.text ) ) ) && (
									<span className="wrbc-comparison__card-value">
										{ plain( cell.text ) }
									</span>
								) }
								{ cell.type !== 'text' && (
									<span className="wrbc-sr-only">
										{ `(${ STATUS[ cell.type ] })` }
									</span>
								) }
							</li>
						);
					} );
					return (
						<div
							key={ plan.id }
							{ ...partProps(
								isFeatured ? colors.featCard : colors.table,
								cx(
									'wrbc-comparison__card',
									isFeatured && 'is-featured'
								)
							) }
							role="listitem"
						>
							<NameTag
								className={ cx(
									'wrbc-comparison__card-name',
									! named && 'wrbc-sr-only'
								) }
							>
								{ plainName( plan ) }
								{ isFeatured && ! hasBadge && (
									<span className="wrbc-sr-only">
										{ ` (${ __(
											'Featured plan',
											'werun-blocks-community'
										) })` }
									</span>
								) }
							</NameTag>
							{ /* After the heading, drawn above it: twin of render.php. */ }
							{ hasBadge && (
								<span className="wrbc-comparison__badge">
									{ plain( plan.badge ) }
								</span>
							) }
							{ e.showPrices &&
								( filled( str( plan.price ) ) || yearly ) && (
									<p className="wrbc-comparison__price">
										{ ( e.toggle ||
											e.period === 'monthly' ) && (
											<span className="wrbc-comparison__amount wrbc-comparison__amount--monthly">
												{ filled( str( plan.price ) )
													? price(
															plan.price,
															plan.period
													  )
													: price(
															plan.priceYearly,
															plan.periodYearly
													  ) }
											</span>
										) }
										{ ( e.toggle || e.period === 'yearly' ) && (
											<span className="wrbc-comparison__amount wrbc-comparison__amount--yearly">
												{ yearly
													? price(
															plan.priceYearly,
															plan.periodYearly
													  )
													: price(
															plan.price,
															plan.period
													  ) }
											</span>
										) }
									</p>
								) }
							{ e.showCta && filled( str( plan.ctaLabel ) ) && (
								<span
									className={ `${ btnClass } wrbc-comparison__cta` }
								>
									{ plain( plan.ctaLabel ) }
								</span>
							) }
							{ groups }
						</div>
					);
				} ) }
			</div>
		</>
	);
}
