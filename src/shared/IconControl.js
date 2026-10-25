/**
 * Choosing an icon: a picker with two libraries and the animation settings.
 *
 *   Lucide           every icon at https://lucide.dev/icons/
 *   Lucide Animated  the icons https://lucide-animated.com animates; each one
 *                    comes with the CSS preset closest to its original move,
 *                    and a link to the original.
 */
import { __, sprintf } from '@wordpress/i18n';
import {
	BaseControl,
	Button,
	ExternalLink,
	Modal,
	SearchControl,
	SelectControl,
	Spinner,
	TabPanel,
} from '@wordpress/components';
import { useMemo, useState } from '@wordpress/element';
import { ANIMATED_URL, ANIMATIONS, Icon, LUCIDE_URL, TRIGGERS, useIconData } from './icons';

const PAGE = 240;

const ANIMATION_LABELS = {
	none: __( 'None', 'werun-blocks-community' ),
	auto: __( 'Lucide Animated preset', 'werun-blocks-community' ),
	draw: __( 'Draw the strokes', 'werun-blocks-community' ),
	wiggle: __( 'Wiggle', 'werun-blocks-community' ),
	'nudge-x': __( 'Nudge sideways', 'werun-blocks-community' ),
	'nudge-y': __( 'Nudge up', 'werun-blocks-community' ),
	bounce: __( 'Bounce', 'werun-blocks-community' ),
	pulse: __( 'Pulse', 'werun-blocks-community' ),
	spin: __( 'Spin', 'werun-blocks-community' ),
	pop: __( 'Pop in', 'werun-blocks-community' ),
	float: __( 'Float', 'werun-blocks-community' ),
	shake: __( 'Shake', 'werun-blocks-community' ),
	tilt: __( 'Tilt', 'werun-blocks-community' ),
};
const TRIGGER_LABELS = {
	hover: __( 'On hover (icon or its card)', 'werun-blocks-community' ),
	inview: __( 'When it scrolls into view', 'werun-blocks-community' ),
	loop: __( 'Loop', 'werun-blocks-community' ),
};

function Grid( { names, lib, value, onPick, animated } ) {
	const [ shown, setShown ] = useState( PAGE );
	if ( ! names.length ) {
		return <p className="wrbc-picker__empty">{ __( 'No icon matches that search.', 'werun-blocks-community' ) }</p>;
	}
	return (
		<>
			<div className="wrbc-picker__grid" role="listbox" aria-label={ __( 'Icons', 'werun-blocks-community' ) }>
				{ names.slice( 0, shown ).map( ( name ) => {
					const selected = value?.name === name && ( value?.lib || 'lucide' ) === lib;
					const icon = { name, lib, anim: lib === 'animated' ? 'auto' : 'none', trigger: 'hover' };
					return (
						<button
							key={ name }
							type="button"
							role="option"
							aria-selected={ selected }
							className={ `wrbc-picker__item wrbc-anim-host${ selected ? ' is-selected' : '' }` }
							onClick={ () => onPick( name ) }
							title={ lib === 'animated' ? `${ name } · ${ ANIMATION_LABELS[ animated[ name ] ] || '' }` : name }
						>
							<Icon icon={ icon } />
							<span className="wrbc-picker__name">{ name }</span>
						</button>
					);
				} ) }
			</div>
			{ names.length > shown && (
				<div className="wrbc-picker__more">
					<Button variant="secondary" onClick={ () => setShown( shown + PAGE ) }>
						{ sprintf(
							/* translators: %d: icons not shown yet */
							__( 'Show more (%d left)', 'werun-blocks-community' ),
							names.length - shown
						) }
					</Button>
				</div>
			) }
		</>
	);
}

export function IconPicker( { value, onChange, onClose } ) {
	const data = useIconData();
	const [ search, setSearch ] = useState( '' );

	const filter = ( names ) => {
		const q = search.trim().toLowerCase();
		if ( ! q ) {
			return names;
		}
		return names.filter(
			( name ) => name.includes( q ) || ( data.tags?.[ name ] || [] ).some( ( tag ) => tag.toLowerCase().includes( q ) )
		);
	};
	const lucide = useMemo( () => ( data ? Object.keys( data.icons ) : [] ), [ data ] );
	const animated = useMemo( () => ( data ? Object.keys( data.animated || {} ) : [] ), [ data ] );

	const pick = ( lib ) => ( name ) => {
		onChange( {
			name,
			lib,
			anim: lib === 'animated' ? 'auto' : value?.anim && value.anim !== 'auto' ? value.anim : 'none',
			trigger: value?.trigger || 'hover',
		} );
		onClose();
	};

	return (
		<Modal title={ __( 'Choose an icon', 'werun-blocks-community' ) } onRequestClose={ onClose } className="wrbc-picker" size="large">
			{ ! data ? (
				<Spinner />
			) : (
				<>
					<SearchControl
						__nextHasNoMarginBottom
						value={ search }
						onChange={ setSearch }
						placeholder={ __( 'Search by name or tag: arrow, user, shield…', 'werun-blocks-community' ) }
					/>
					<TabPanel
						className="wrbc-picker__tabs"
						initialTabName={ value?.lib === 'animated' ? 'animated' : 'lucide' }
						tabs={ [
							{ name: 'lucide', title: sprintf( 'Lucide (%d)', lucide.length ) },
							{ name: 'animated', title: sprintf( 'Lucide Animated (%d)', animated.length ) },
						] }
					>
						{ ( tab ) =>
							tab.name === 'lucide' ? (
								<>
									<p className="wrbc-picker__note">
										{ __( 'Every Lucide icon, drawn inline as SVG.', 'werun-blocks-community' ) }{ ' ' }
										<ExternalLink href={ LUCIDE_URL }>lucide.dev/icons</ExternalLink>
									</p>
									<Grid names={ filter( lucide ) } lib="lucide" value={ value } onPick={ pick( 'lucide' ) } />
								</>
							) : (
								<>
									<p className="wrbc-picker__note">
										{ __(
											'The icons Lucide Animated animates. Its originals are React components (motion library), so here each one plays a CSS preset close to its original move. Hover an icon to preview it.',
											'werun-blocks-community'
										) }{ ' ' }
										<ExternalLink href="https://lucide-animated.com">lucide-animated.com</ExternalLink>
									</p>
									<Grid
										names={ filter( animated ) }
										lib="animated"
										value={ value }
										onPick={ pick( 'animated' ) }
										animated={ data.animated || {} }
									/>
								</>
							)
						}
					</TabPanel>
				</>
			) }
		</Modal>
	);
}

/**
 * The inspector control: the icon, a button to change or remove it, and how
 * it animates.
 */
export function IconControl( { label, value, onChange, allowRemove = true, allowAnimation = true, help } ) {
	const [ open, setOpen ] = useState( false );
	const data = useIconData();
	const lib = value?.lib === 'animated' ? 'animated' : 'lucide';
	const animOptions = ( lib === 'animated' ? [ 'auto', ...ANIMATIONS ] : ANIMATIONS ).map( ( key ) => ( {
		value: key,
		label:
			key === 'auto' && value?.name && data?.animated?.[ value.name ]
				? `${ ANIMATION_LABELS.auto } (${ ANIMATION_LABELS[ data.animated[ value.name ] ] })`
				: ANIMATION_LABELS[ key ],
	} ) );

	return (
		<BaseControl __nextHasNoMarginBottom label={ label } help={ help } className="wrbc-icon-control">
			<div className="wrbc-icon-control__row">
				<span className="wrbc-icon-control__preview wrbc-anim-host">
					{ value?.name ? <Icon icon={ value } /> : <span className="wrbc-icon-control__none">—</span> }
				</span>
				<span className="wrbc-icon-control__name">
					{ value?.name || __( 'No icon', 'werun-blocks-community' ) }
					{ value?.name && <small>{ lib === 'animated' ? 'Lucide Animated' : 'Lucide' }</small> }
				</span>
				<Button variant="secondary" size="small" onClick={ () => setOpen( true ) }>
					{ value?.name ? __( 'Change', 'werun-blocks-community' ) : __( 'Choose', 'werun-blocks-community' ) }
				</Button>
				{ allowRemove && value?.name && (
					<Button variant="tertiary" size="small" isDestructive onClick={ () => onChange( {} ) }>
						{ __( 'Remove', 'werun-blocks-community' ) }
					</Button>
				) }
			</div>
			{ allowAnimation && value?.name && (
				<div className="wrbc-icon-control__anim">
					<SelectControl
						__nextHasNoMarginBottom
						__next40pxDefaultSize
						label={ __( 'Animation', 'werun-blocks-community' ) }
						value={ value.anim || ( lib === 'animated' ? 'auto' : 'none' ) }
						options={ animOptions }
						onChange={ ( anim ) => onChange( { ...value, anim } ) }
					/>
					{ ( value.anim || ( lib === 'animated' ? 'auto' : 'none' ) ) !== 'none' && (
						<SelectControl
							__nextHasNoMarginBottom
							__next40pxDefaultSize
							label={ __( 'Plays', 'werun-blocks-community' ) }
							value={ value.trigger || 'hover' }
							options={ TRIGGERS.map( ( key ) => ( { value: key, label: TRIGGER_LABELS[ key ] } ) ) }
							onChange={ ( trigger ) => onChange( { ...value, trigger } ) }
						/>
					) }
					<ExternalLink href={ ( lib === 'animated' ? ANIMATED_URL : LUCIDE_URL ) + value.name }>
						{ lib === 'animated'
							? __( 'See the original on lucide-animated.com', 'werun-blocks-community' )
							: __( 'See it on lucide.dev', 'werun-blocks-community' ) }
					</ExternalLink>
				</div>
			) }
			{ open && <IconPicker value={ value } onChange={ onChange } onClose={ () => setOpen( false ) } /> }
		</BaseControl>
	);
}
