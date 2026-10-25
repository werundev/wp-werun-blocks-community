/**
 * Copy of werun.Toolkit's assets/admin/js/tab-search.js with the
 * werun-blocks-community prefix (keep them in sync). Used by werun.Blocks.Community → Integrations.
 *
 * Shared vertical tabs (WAI-ARIA tabs pattern) with a search that filters tabs,
 * groups and items. Markup contract (all data attributes):
 *
 *   [data-tabsearch]                       root
 *   [data-tabsearch-input|clear|kbd]       search box
 *   [data-tabsearch-status]                live region text
 *   [data-tabsearch-empty]                 "nothing matches" block
 *   [data-tabsearch-tablist]               tab list
 *   [data-tabsearch-tab="id"]              tab; may hold [data-tabsearch-count]
 *                                          (="switches" counts switches that are on,
 *                                          ="checks" every checked box, live)
 *                                          and [data-tabsearch-matches]
 *   [data-tabsearch-panel="id"]            panel; [data-tabsearch-panel-text] (or the
 *                                          settings section header) matches the whole panel
 *   [data-tabsearch-group]                 optional group; [data-tabsearch-group-text]
 *                                          matches the whole group; <details> opens on search
 *   [data-tabsearch-item]                  searchable item (data-tabsearch-text overrides
 *                                          its text). Panels without items use their
 *                                          settings fields (.werun-blocks-community-ui-field).
 *
 * Tabs, panels and items with .werun-blocks-community-is-condition-hidden (a show_if that
 * isn't met, see integrations-page.js) are skipped; the "werun-blocks-community:conditions"
 * event re-renders and moves off a tab that disappeared.
 *
 * Without JavaScript every panel stays visible.
 */
( function ( document, window, wp ) {
	'use strict';

	const { __, _n, sprintf } = wp.i18n;
	const speak = wp.a11y && wp.a11y.speak ? wp.a11y.speak : () => {};
	const narrow = window.matchMedia( '(max-width: 960px)' );
	const reducedMotion = window.matchMedia( '(prefers-reduced-motion: reduce)' );

	// Lowercase and strip accents so "sesion" finds "sesión".
	const normalize = ( text ) =>
		String( text || '' )
			.normalize( 'NFD' )
			.replace( /[̀-ͯ]/g, '' )
			.toLowerCase()
			.replace( /\s+/g, ' ' )
			.trim();

	const FIELD_TEXT =
		'.werun-blocks-community-ui-label, .werun-blocks-community-ui-switch-label, .werun-blocks-community-ui-hint, .werun-blocks-community-ui-check-label, option';

	function itemText( el ) {
		if ( el.hasAttribute( 'data-tabsearch-text' ) ) {
			return normalize( el.getAttribute( 'data-tabsearch-text' ) );
		}
		if ( el.classList.contains( 'werun-blocks-community-ui-field' ) ) {
			// Labels, hints and option names; typed values are left out.
			return normalize(
				Array.from( el.querySelectorAll( FIELD_TEXT ) )
					.map( ( node ) => node.textContent )
					.join( ' ' )
			);
		}
		return normalize( el.textContent );
	}

	function init( root ) {
		const tablist = root.querySelector( '[data-tabsearch-tablist]' );
		const tabs = Array.from( root.querySelectorAll( '[data-tabsearch-tab]' ) );
		const panels = Array.from( root.querySelectorAll( '[data-tabsearch-panel]' ) );
		const input = root.querySelector( '[data-tabsearch-input]' );
		const clear = root.querySelector( '[data-tabsearch-clear]' );
		const kbd = root.querySelector( '[data-tabsearch-kbd]' );
		const status = root.querySelector( '[data-tabsearch-status]' );
		const empty = root.querySelector( '[data-tabsearch-empty]' );
		const referer = root.querySelector( 'input[name="_wp_http_referer"]' );
		if ( ! tablist || ! tabs.length || ! input ) {
			return;
		}

		const tabFor = ( id ) => tabs.find( ( tab ) => tab.getAttribute( 'data-tabsearch-tab' ) === id );
		const CONDITION_HIDDEN = 'werun-blocks-community-is-condition-hidden';
		const shown = ( el ) => ! el.closest( '.' + CONDITION_HIDDEN );
		const visibleTabs = () => tabs.filter( shown );
		let active = (
			visibleTabs().find( ( tab ) => tab.getAttribute( 'aria-selected' ) === 'true' ) ||
			visibleTabs()[ 0 ] ||
			tabs[ 0 ]
		).getAttribute( 'data-tabsearch-tab' );
		let query = '';
		let speakTimer = 0;

		/* Index ----------------------------------------------------------- */

		const index = panels.map( ( panel ) => {
			const panelTextEl =
				panel.querySelector( '[data-tabsearch-panel-text]' ) ||
				panel.querySelector( '.werun-blocks-community-settings-section-header' );
			let items = Array.from( panel.querySelectorAll( '[data-tabsearch-item]' ) );
			if ( ! items.length ) {
				items = Array.from( panel.querySelectorAll( '.werun-blocks-community-ui-field' ) );
			}
			const groups = Array.from( panel.querySelectorAll( '[data-tabsearch-group]' ) ).map(
				( group ) => {
					const textEl = group.querySelector( '[data-tabsearch-group-text]' );
					return {
						el: group,
						text: normalize( textEl ? textEl.textContent : '' ),
						wasOpen: group.tagName === 'DETAILS' ? group.open : null,
					};
				}
			);
			return {
				id: panel.getAttribute( 'data-tabsearch-panel' ),
				panel,
				text: normalize( panelTextEl ? panelTextEl.textContent : '' ),
				groups,
				items: items.map( ( el ) => ( {
					el,
					text: itemText( el ),
					group: groups.find( ( group ) => group.el.contains( el ) ) || null,
				} ) ),
			};
		} );

		/* Tabs ------------------------------------------------------------ */

		function rememberTab( id ) {
			// Survives the options.php round trip: WordPress redirects back to _wp_http_referer.
			try {
				const url = new URL( window.location.href );
				url.searchParams.set( 'tab', id );
				url.searchParams.delete( 'settings-updated' );
				window.history.replaceState( null, '', url );
				if ( referer ) {
					referer.value = url.pathname + url.search;
				}
			} catch ( error ) {
				// Old browsers: the first tab opens after saving.
			}
		}

		const enabledTabs = () =>
			visibleTabs().filter( ( tab ) => tab.getAttribute( 'aria-disabled' ) !== 'true' );

		function selectTab( id, { focus = false } = {} ) {
			active = id;
			tabs.forEach( ( tab ) => {
				const selected = tab.getAttribute( 'data-tabsearch-tab' ) === id;
				tab.setAttribute( 'aria-selected', selected ? 'true' : 'false' );
				if ( selected && focus ) {
					tab.focus();
				}
			} );
			rememberTab( id );
			render();
		}

		tabs.forEach( ( tab ) => {
			tab.addEventListener( 'click', () => {
				if ( tab.getAttribute( 'aria-disabled' ) === 'true' ) {
					return;
				}
				const id = tab.getAttribute( 'data-tabsearch-tab' );
				selectTab( id );
				if ( query ) {
					const panel = panels.find( ( item ) => item.getAttribute( 'data-tabsearch-panel' ) === id );
					panel.scrollIntoView( {
						behavior: reducedMotion.matches ? 'auto' : 'smooth',
						block: 'start',
					} );
				}
			} );
		} );

		tablist.addEventListener( 'keydown', ( event ) => {
			const list = enabledTabs();
			const current = list.indexOf( document.activeElement );
			if ( current === -1 ) {
				return;
			}
			const keys = {
				ArrowDown: current + 1,
				ArrowRight: current + 1,
				ArrowUp: current - 1,
				ArrowLeft: current - 1,
				Home: 0,
				End: list.length - 1,
			};
			if ( ! ( event.key in keys ) ) {
				return;
			}
			event.preventDefault();
			const next = list[ ( keys[ event.key ] + list.length ) % list.length ];
			selectTab( next.getAttribute( 'data-tabsearch-tab' ), { focus: true } );
		} );

		const syncOrientation = () =>
			tablist.setAttribute( 'aria-orientation', narrow.matches ? 'horizontal' : 'vertical' );
		narrow.addEventListener( 'change', syncOrientation );
		syncOrientation();

		/* Live counters --------------------------------------------------- */

		panels.forEach( ( panel ) => {
			const counter = tabFor( panel.getAttribute( 'data-tabsearch-panel' ) ).querySelector(
				'[data-tabsearch-count="switches"], [data-tabsearch-count="checks"]'
			);
			if ( ! counter ) {
				return;
			}
			const checks = counter.getAttribute( 'data-tabsearch-count' ) === 'checks';
			const selector = checks ? 'input[type="checkbox"]' : 'input[role="switch"]';
			panel.addEventListener( 'change', ( event ) => {
				if ( ! event.target.matches( selector ) ) {
					return;
				}
				// A checked tree parent locks its children checked: they count.
				const boxes = Array.from( panel.querySelectorAll( selector ) );
				const on = boxes.filter( ( item ) => item.checked ).length;
				counter.textContent = checks
					? /* translators: 1: checked options, 2: options in the section. */
					  sprintf( __( '%1$s/%2$s selected', 'werun-blocks-community' ), on, boxes.length )
					: /* translators: 1: switches turned on, 2: switches in the section. */
					  sprintf( __( '%1$s/%2$s on', 'werun-blocks-community' ), on, boxes.length );
			} );
		} );

		/* Render ---------------------------------------------------------- */

		function render() {
			const terms = normalize( query ).split( ' ' ).filter( Boolean );
			let total = 0;
			let sections = 0;

			index.forEach( ( section ) => {
				const tab = tabFor( section.id );
				const matches = tab.querySelector( '[data-tabsearch-matches]' );
				const counter = tab.querySelector( '[data-tabsearch-count]' );

				if ( ! terms.length ) {
					section.panel.hidden = section.id !== active;
					section.items.forEach( ( item ) => {
						item.el.hidden = false;
						item.el.classList.remove( 'werun-blocks-community-ui-tabsearch-hit' );
					} );
					section.groups.forEach( ( group ) => {
						group.el.hidden = false;
						if ( group.wasOpen !== null ) {
							group.el.open = group.wasOpen;
						}
					} );
					tab.removeAttribute( 'aria-disabled' );
					if ( matches ) {
						matches.hidden = true;
					}
					if ( counter ) {
						counter.hidden = false;
					}
					return;
				}

				const has = ( text, term ) => text.includes( term );
				const panelHit = terms.every( ( term ) => has( section.text, term ) );
				const groupHits = new Map();
				let hits = 0;

				section.items.forEach( ( item ) => {
					const groupText = item.group ? item.group.text : '';
					const hit = shown( item.el ) && shown( tab ) && terms.every(
						( term ) => has( item.text, term ) || has( groupText, term ) || has( section.text, term )
					);
					item.el.hidden = ! hit;
					item.el.classList.toggle( 'werun-blocks-community-ui-tabsearch-hit', hit && ! panelHit );
					if ( hit ) {
						hits++;
						if ( item.group ) {
							groupHits.set( item.group, true );
						}
					}
				} );

				section.groups.forEach( ( group ) => {
					const visible = groupHits.has( group );
					group.el.hidden = ! visible;
					if ( visible && group.wasOpen !== null ) {
						group.el.open = true;
					}
				} );

				section.panel.hidden = hits === 0;
				total += hits;
				sections += hits ? 1 : 0;

				if ( hits ) {
					tab.removeAttribute( 'aria-disabled' );
				} else {
					tab.setAttribute( 'aria-disabled', 'true' );
				}
				if ( matches ) {
					matches.hidden = false;
					/* translators: %s: number of matching items. */
					matches.textContent = sprintf( _n( '%s match', '%s matches', hits, 'werun-blocks-community' ), hits );
				}
				if ( counter ) {
					counter.hidden = true;
				}
			} );

			if ( empty ) {
				empty.hidden = ! terms.length || total > 0;
			}

			// Keep one focusable tab, never a disabled one.
			const selected = tabFor( active );
			const focusTab =
				selected && selected.getAttribute( 'aria-disabled' ) !== 'true' ? selected : enabledTabs()[ 0 ];
			tabs.forEach( ( tab ) => {
				tab.tabIndex = tab === focusTab ? 0 : -1;
			} );

			announce( terms.length > 0, total, sections );
		}

		function announce( searching, total, sections ) {
			window.clearTimeout( speakTimer );
			if ( ! status ) {
				return;
			}
			if ( ! searching ) {
				status.textContent = '';
				return;
			}
			const message = total
				? sprintf(
						/* translators: 1: matching items, 2: matching tabs. */
						_n( '%1$s result in %2$s tab.', '%1$s results in %2$s tabs.', total, 'werun-blocks-community' ),
						total,
						sections
				  )
				: __( 'Nothing matches your search.', 'werun-blocks-community' );
			status.textContent = message;
			speakTimer = window.setTimeout( () => speak( message ), 400 );
		}

		/* Search box ------------------------------------------------------ */

		function setQuery( value ) {
			query = value;
			if ( clear ) {
				clear.hidden = value === '';
			}
			if ( kbd ) {
				kbd.hidden = value !== '';
			}
			render();
		}

		input.addEventListener( 'input', () => setQuery( input.value ) );
		input.addEventListener( 'keydown', ( event ) => {
			if ( event.key !== 'Escape' ) {
				return;
			}
			if ( input.value !== '' ) {
				event.preventDefault();
				input.value = '';
				setQuery( '' );
			} else {
				input.blur();
			}
		} );
		if ( clear ) {
			clear.addEventListener( 'click', () => {
				input.value = '';
				setQuery( '' );
				input.focus();
			} );
		}

		// "/" focuses the search unless the user is typing somewhere.
		document.addEventListener( 'keydown', ( event ) => {
			if ( event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey ) {
				return;
			}
			const el = document.activeElement;
			if ( el && ( /^(INPUT|TEXTAREA|SELECT)$/.test( el.tagName ) || el.isContentEditable ) ) {
				return;
			}
			event.preventDefault();
			input.focus();
		} );

		document.addEventListener( 'werun-blocks-community:conditions', () => {
			const current = tabFor( active );
			if ( current && ! shown( current ) && visibleTabs().length ) {
				selectTab( visibleTabs()[ 0 ].getAttribute( 'data-tabsearch-tab' ) );
				return;
			}
			render();
		} );

		rememberTab( active );
		render();
	}

	document.querySelectorAll( '[data-tabsearch]' ).forEach( init );
} )( document, window, window.wp );
