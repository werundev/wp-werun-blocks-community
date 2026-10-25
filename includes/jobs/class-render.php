<?php
/**
 * werun-community/jobs markup. Every job (at most 300) is printed by PHP with the
 * data-* attributes of the wrbc-filter contract, so the list is complete
 * without JavaScript and the filters only hide items.
 *
 * Effective-value rules here are mirrored in src/jobs/edit.js (effective()).
 *
 * @package werun-blocks-community
 */

namespace Werun\BlocksCommunity\Jobs;

defined( 'ABSPATH' ) || exit;

/**
 * Render.
 */
final class Render {

	public const LAYOUTS = array( 'grouped-list', 'cards', 'table', 'list' );
	public const SORTS   = array( 'date', 'title', 'department' );

	/**
	 * Settings that decide what renders (twin: effective() in src/jobs/edit.js).
	 *
	 * @param array $a Attributes.
	 */
	public static function effective( array $a ): array {
		$layout = in_array( $a['layout'] ?? '', self::LAYOUTS, true ) ? $a['layout'] : 'grouped-list';
		$max     = isset( $a['maxJobs'] ) && is_numeric( $a['maxJobs'] ) ? max( 0, min( Jobs::MAX, (int) $a['maxJobs'] ) ) : 0;
		$grouped = in_array( $layout, array( 'grouped-list', 'list' ), true ) && wrbc_on( $a, 'groupBy', true );
		$sort    = in_array( $a['sort'] ?? '', self::SORTS, true ) ? $a['sort'] : 'date';
		// Inside a department group "by department" is "by title".
		if ( $grouped && 'department' === $sort ) {
			$sort = 'title';
		}
		return array(
			'layout'      => $layout,
			'grouped'     => $grouped,
			'description' => 'table' !== $layout && wrbc_on( $a, 'showDescription', false ),
			'reveal'      => 'table' !== $layout && wrbc_on( $a, 'reveal', false ),
			'filters'     => wrbc_on( $a, 'showFilters', false ),
			'sort'        => $sort,
			'max'         => 0 === $max ? Jobs::MAX : $max,
		);
	}

	/**
	 * Tone classes and colour custom properties (docs/accessibility.md):
	 * - the root: its tone on what it sits on, the accent made readable there
	 *   (wrbc_accent_vars(): on-accent, accent-text and so the focus ring), and
	 *   the "Remote" badge's text, readable on its accent tint;
	 * - cards with their own background: the card's tone class (light or ink
	 *   text) and the accent and badge text made readable on that background.
	 * The editor preview has no render context (ServerSideRender skips the
	 * block supports), so edit.js sends the background the canvas knows
	 * (useSurface()) in the query: wrbcSurface, wrbcAround, wrbcText.
	 *
	 * @param array          $a       Attributes.
	 * @param array          $e       Effective settings.
	 * @param \WP_Block|null $block   Block being rendered.
	 * @param bool           $preview Editor preview request.
	 * @return array{ classes: string[], vars: array, card: string }
	 */
	private static function colors( array $a, array $e, $block, bool $preview ): array {
		$surface = wrbc_surface( $a, $block instanceof \WP_Block ? $block : 'werun-community/jobs' );
		$around  = wrbc_context_background( $block instanceof \WP_Block ? $block : null );
		$classes = array();
		if ( $preview ) {
			$surface = self::query_color( 'wrbcSurface', $surface );
			$around  = self::query_color( 'wrbcAround', $around );
			// The author's text colour sits on the editor's wrapper: the tone must not override it.
			if ( isset( $_GET['wrbcText'] ) && '1' === $_GET['wrbcText'] ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended -- a flag for the preview's classes.
				$classes[] = 'has-text-color';
			}
		}
		$tone      = wrbc_tone_class( $surface, $around );
		$classes[] = $tone;
		// An accent that isn't a colour (a hand-edited "#zzz") would blank the
		// pressed chip's fill: it counts as no accent.
		$accent = wrbc_text( $a['accentColor'] ?? '' );
		if ( null === wrbc_color_rgba( $accent ) ) {
			$accent           = '';
			$a['accentColor'] = '';
		}
		$vars   = wrbc_accent_vars( $a, $surface );
		$accent = '' !== $accent ? $accent : WERUN_BLOCKS_COMMUNITY_ACCENT;
		$badge  = self::tint_text( $accent, $surface );
		if ( '' !== $badge && strtolower( $badge ) !== strtolower( $vars['--wrbc-accent-text'] ?? $accent ) ) {
			$vars['--wrbc-jobs-badge-text'] = $badge;
		}
		$card    = '';
		$card_bg = 'cards' === $e['layout'] ? wrbc_css_value( $a['cardBg'] ?? '' ) : '';
		$fill    = '' !== $card_bg ? wrbc_color_rgba( $card_bg ) : null;
		if ( null !== $fill ) {
			// What the card really shows: its colour over the block's background.
			$under     = wrbc_color_rgba( $surface );
			$card_bg   = wrbc_color_hex( wrbc_color_over( $fill, $under ? $under : array( 255.0, 255.0, 255.0, 1.0 ) ) );
			$card      = wrbc_tone_class( $card_bg, $surface );
			$classes[] = 'wrbc-jobs--card-tone';
			// The tone's light accent is a fallback: the exact readable colours for this card background.
			$vars['--wrbc-card-accent-text'] = wrbc_readable_color( $accent, $card_bg );
			$vars['--wrbc-card-badge-text']  = self::tint_text( $accent, $card_bg );
		}
		return array(
			'classes' => $classes,
			'vars'    => $vars,
			'card'    => $card,
		);
	}

	/**
	 * The accent as text on its own 12 % tint over $bg (the "Remote" badge):
	 * the closest colour to it that reaches 4.5:1 there. The tint takes some
	 * contrast away, so a colour that just reads on $bg may not on the badge.
	 *
	 * @param string $accent Accent colour.
	 * @param string $bg     What the badge sits on.
	 */
	private static function tint_text( string $accent, string $bg ): string {
		$fill  = wrbc_color_rgba( $accent );
		$under = wrbc_color_rgba( $bg );
		if ( null === $fill || null === $under ) {
			return '';
		}
		if ( $under[3] < 1 ) {
			$page  = wrbc_color_rgba( wrbc_page_colors()['background'] );
			$under = wrbc_color_over( $under, $page ? $page : array( 255.0, 255.0, 255.0, 1.0 ) );
		}
		// Unrounded, as the browser (and axe) composite it: a hex tint can be a
		// shade lighter or darker than what is painted.
		$tint = wrbc_color_over( array( $fill[0], $fill[1], $fill[2], 0.12 ), $under );
		return wrbc_readable_color( $accent, $tint );
	}

	/**
	 * A colour the editor sent with the preview request (hex, as the canvas
	 * computed it), or $fallback.
	 *
	 * @param string $key      Query argument.
	 * @param string $fallback Colour when it's missing or not a colour.
	 */
	private static function query_color( string $key, string $fallback ): string {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only preview colour, reduced to a hex value below.
		$raw = isset( $_GET[ $key ] ) && is_string( $_GET[ $key ] ) ? sanitize_text_field( wp_unslash( $_GET[ $key ] ) ) : '';
		$hex = '' !== $raw ? wrbc_color_hex( wrbc_color_rgba( $raw ) ) : '';
		return '' !== $hex ? $hex : $fallback;
	}

	/**
	 * The block.
	 *
	 * @param array          $a     Attributes.
	 * @param \WP_Block|null $block The block being rendered (its render context tells its background).
	 */
	public static function block( array $a, $block = null ): string {
		$preview = defined( 'REST_REQUEST' ) && REST_REQUEST && current_user_can( 'edit_posts' );
		$cfg     = Jobs::config( wrbc_text( $a['provider'] ?? '' ), wrbc_text( $a['board'] ?? '' ), wrbc_text( $a['region'] ?? '' ) );
		if ( is_wp_error( $cfg ) ) {
			return $preview ? '<div class="wrbc-root wrbc-jobs wrbc-jobs--setup"><p class="wrbc-jobs__notice">' . esc_html( $cfg->get_error_message() ) . '</p></div>' : '';
		}
		$data   = Jobs::get( $cfg );
		$e      = self::effective( $a );
		$uid    = wrbc_uid( $a, 'wrbc-jobs' );
		$jobs   = array_slice( self::sort( $data['jobs'], $e['sort'] ), 0, $e['max'] );
		$colors = self::colors( $a, $e, $block, $preview );

		$classes = array_merge( array( 'wrbc-root', 'wrbc-jobs', 'wrbc-jobs--' . $e['layout'], $uid ), $colors['classes'] );
		if ( $e['grouped'] ) {
			$classes[] = 'is-grouped';
		}
		$extra = array(
			'id'    => $uid,
			'class' => implode( ' ', array_filter( $classes ) ),
			'style' => wrbc_css_vars(
				array_merge(
					array(
						// Same ranges as the editor (ResponsiveColumns, max 4).
						'--wrbc-cols-d'  => 'cards' === $e['layout'] ? max( 1, min( 4, (int) ( $a['columnsDesktop'] ?? 3 ) ) ) : '',
						'--wrbc-cols-t'  => 'cards' === $e['layout'] ? max( 1, min( 4, (int) ( $a['columnsTablet'] ?? 2 ) ) ) : '',
						'--wrbc-cols-m'  => 'cards' === $e['layout'] ? max( 1, min( 2, (int) ( $a['columnsMobile'] ?? 1 ) ) ) : '',
						'--wrbc-gap'     => 'cards' === $e['layout'] ? wrbc_px( $a['gap'] ?? '' ) : '',
						'--wrbc-card-bg' => 'cards' === $e['layout'] ? ( $a['cardBg'] ?? '' ) : '',
						'--wrbc-radius'  => wrbc_px( $a['radius'] ?? '' ),
					),
					$colors['vars']
				)
			),
		);
		// The section is named by its title only when the header really prints one
		// (a title that sanitizes to nothing would leave aria-labelledby pointing nowhere).
		$header    = wrbc_section_header( $a, $uid );
		$has_title = false !== strpos( $header, 'id="' . $uid . '-title"' );
		$filters   = $e['filters'] && count( $jobs ) > 1;
		if ( $filters ) {
			// Every count the filters can show (0 … all) through _n(), so the live
			// count follows the plural forms of any language (wrbc-filter "counts").
			$counts = array();
			for ( $n = 0, $total = count( $jobs ); $n <= $total; $n++ ) {
				/* translators: %d: number of open positions */
				$counts[] = sprintf( _n( '%d open position', '%d open positions', $n, 'werun-blocks-community' ), $n );
			}
			$extra['data-wrbc-filter'] = wp_json_encode(
				array(
					'counts'  => $counts,
					/* translators: %d: number of positions shown */
					'live'    => __( '%d open positions', 'werun-blocks-community' ),
					'liveOne' => __( '1 open position', 'werun-blocks-community' ),
				)
			);
		}
		$tag = $has_title ? 'section' : 'div';
		if ( $has_title ) {
			$extra['aria-labelledby'] = $uid . '-title';
		}

		// The list's first headings (departments, or positions when not
		// grouped) sit one level under the header's title; without a title,
		// "Heading level" sets them, so the block fits under whatever heading
		// precedes it (WCAG 1.3.1). Same range as the editor (H2–H4).
		$first  = $has_title
			? max( 2, min( 4, (int) ( $a['titleLevel'] ?? 2 ) ) ) + 1
			: max( 2, min( 4, is_numeric( $a['headingLevel'] ?? null ) ? (int) $a['headingLevel'] : 3 ) );
		$levels = array(
			'group' => $first,
			'item'  => min( 6, $first + ( $e['grouped'] ? 1 : 0 ) ),
		);

		$notice = '';
		if ( $preview && '' !== $data['error'] ) {
			$notice = '<p class="wrbc-jobs__notice" role="status">' . esc_html( $data['error'] ) . ( $data['jobs'] ? ' ' . esc_html__( 'Showing the last good copy.', 'werun-blocks-community' ) : '' ) . '</p>';
		}
		if ( ! $jobs ) {
			if ( '' !== $data['error'] ) {
				// The board couldn't be fetched and there's no earlier copy: say so,
				// instead of claiming there are no open positions.
				$empty = '<p class="wrbc-jobs__empty wrbc-jobs__empty--error">' . esc_html__( 'Open positions couldn\'t be loaded right now. Please try again later.', 'werun-blocks-community' ) . '</p>';
			} else {
				$empty = wrbc_text( $a['emptyText'] ?? '' );
				$empty = '' !== trim( wp_strip_all_tags( $empty ) ) ? '<p class="wrbc-jobs__empty">' . wrbc_rich( $empty ) . '</p>' : '';
			}
			// Nothing to say at all: no empty box on the page (rule 17).
			if ( '' === $header . $notice . $empty ) {
				return '';
			}
			return '<' . $tag . ' ' . get_block_wrapper_attributes( $extra ) . '>' . $header . $notice . $empty . '</' . $tag . '>';
		}

		$out = '<' . $tag . ' ' . get_block_wrapper_attributes( $extra ) . '>' . $header . $notice;
		if ( $filters ) {
			$out .= self::filters( $a, $jobs, $uid, $has_title ? trim( wp_strip_all_tags( wrbc_text( $a['title'] ?? '' ) ) ) : '' );
		}
		if ( wrbc_on( $a, 'showCount', true ) ) {
			$count = count( $jobs );
			/* translators: %d: number of open positions */
			$text = sprintf( _n( '%d open position', '%d open positions', $count, 'werun-blocks-community' ), $count );
			$out .= $filters
				? '<p class="wrbc-jobs__count" data-wrbc-filter-status aria-live="polite" aria-atomic="true">' . esc_html( $text ) . '</p>'
				: '<p class="wrbc-jobs__count">' . esc_html( $text ) . '</p>';
		} elseif ( $filters ) {
			$out .= '<p class="wrbc-sr-only" data-wrbc-filter-status aria-live="polite" aria-atomic="true"></p>';
		}

		if ( 'table' === $e['layout'] ) {
			$out .= self::table( $a, $jobs, $uid );
		} elseif ( $e['grouped'] ) {
			$out .= '<div class="wrbc-jobs__groups">';
			$i    = 0;
			foreach ( self::groups( $jobs ) as $n => $group ) {
				$gid = $uid . '-g' . $n;
				// A plain <section> (no name, so not a landmark per department: the
				// heading already lets people jump between them). The count is
				// decoration for the eye: the list itself says how many items it has.
				$out .= sprintf(
					'<section class="wrbc-jobs__group" data-wrbc-jobs-group><h%2$d class="wrbc-jobs__group-title" id="%1$s">%3$s <span class="wrbc-jobs__group-count" data-wrbc-jobs-group-count aria-hidden="true">%4$d</span></h%2$d>',
					esc_attr( $gid ),
					$levels['group'],
					esc_html( $group['label'] ),
					count( $group['jobs'] )
				);
				$out .= self::items( $a, $e, $group['jobs'], $levels['item'], $i, $colors['card'] );
				$out .= '</section>';
			}
			$out .= '</div>';
		} else {
			$i    = 0;
			$out .= self::items( $a, $e, $jobs, $levels['item'], $i, $colors['card'] );
		}
		if ( $filters ) {
			$no   = wrbc_text( $a['noResults'] ?? '' );
			$out .= '<p class="wrbc-jobs__empty" data-wrbc-filter-empty hidden>' . ( '' !== trim( wp_strip_all_tags( $no ) ) ? wrbc_rich( $no ) : esc_html__( 'No position matches those filters.', 'werun-blocks-community' ) ) . '</p>';
		}
		return $out . '</' . $tag . '>';
	}

	/** Jobs sorted: newest first, by title, or by department then title. */
	public static function sort( array $jobs, string $by ): array {
		usort(
			$jobs,
			function ( $x, $y ) use ( $by ) {
				if ( 'date' === $by ) {
					$c = strcmp( (string) $y['postedAt'], (string) $x['postedAt'] );
					return 0 !== $c ? $c : strnatcasecmp( $x['title'], $y['title'] );
				}
				if ( 'department' === $by ) {
					$c = self::dept_cmp( $x['department'], $y['department'] );
					if ( 0 !== $c ) {
						return $c;
					}
				}
				return strnatcasecmp( $x['title'], $y['title'] );
			}
		);
		return $jobs;
	}

	/** Departments A–Z, jobs without one last. */
	private static function dept_cmp( string $x, string $y ): int {
		if ( ( '' === $x ) !== ( '' === $y ) ) {
			return '' === $x ? 1 : -1;
		}
		return strnatcasecmp( $x, $y );
	}

	/** Jobs by department, departments A–Z, "Other positions" last. */
	private static function groups( array $jobs ): array {
		$groups = array();
		foreach ( $jobs as $job ) {
			$groups[ $job['department'] ][] = $job;
		}
		uksort(
			$groups,
			function ( $x, $y ) {
				return self::dept_cmp( (string) $x, (string) $y );
			}
		);
		$out = array();
		foreach ( $groups as $dept => $list ) {
			$out[] = array(
				'label' => '' === (string) $dept ? __( 'Other positions', 'werun-blocks-community' ) : (string) $dept,
				'jobs'  => $list,
			);
		}
		return $out;
	}

	/** Filter value of a text (department, location, type). */
	private static function token( string $text ): string {
		$token = sanitize_title( $text );
		return '' !== $token ? $token : 'x' . substr( md5( $text ), 0, 8 );
	}

	/** data-* attributes of one job for wrbc-filter. */
	private static function filter_attrs( array $job ): string {
		$locs = array_unique( array_map( array( __CLASS__, 'token' ), array_filter( $job['locations'] ) ) );
		$text = implode( ' ', array_merge( array( $job['title'], $job['department'], $job['team'], Job::type_label( $job['employmentType'] ) ), $job['locations'] ) );
		return sprintf(
			' data-wrbc-filter-item data-dept="%1$s" data-loc="%2$s" data-type="%3$s" data-remote="%4$s" data-text="%5$s"',
			esc_attr( '' !== $job['department'] ? self::token( $job['department'] ) : 'none' ),
			esc_attr( implode( ' ', $locs ) ),
			esc_attr( '' !== $job['employmentType'] ? self::token( $job['employmentType'] ) : 'none' ),
			$job['remote'] ? '1' : '0',
			esc_attr( $text )
		);
	}

	/**
	 * Search, selects and the remote chip; only the ones with something to choose.
	 *
	 * @param array  $a     Attributes.
	 * @param array  $jobs  Jobs.
	 * @param string $uid   Instance id.
	 * @param string $title The block's title as plain text, '' when it prints none.
	 */
	private static function filters( array $a, array $jobs, string $uid, string $title = '' ): string {
		$depts = array();
		$locs  = array();
		$types = array();
		$remote = 0;
		foreach ( $jobs as $job ) {
			if ( '' !== $job['department'] ) {
				$depts[ self::token( $job['department'] ) ] = $job['department'];
			}
			foreach ( $job['locations'] as $place ) {
				$locs[ self::token( $place ) ] = $place;
			}
			if ( '' !== $job['employmentType'] ) {
				$types[ self::token( $job['employmentType'] ) ] = Job::type_label( $job['employmentType'] );
			}
			$remote += $job['remote'] ? 1 : 0;
		}
		$fields = '';
		if ( wrbc_on( $a, 'filterSearch', true ) ) {
			$placeholder = wrbc_text( $a['searchPlaceholder'] ?? '' );
			$fields     .= sprintf(
				'<div class="wrbc-jobs__field wrbc-jobs__field--search"><label class="wrbc-jobs__label" for="%1$s-q">%2$s</label><input class="wrbc-jobs__input" type="search" id="%1$s-q" data-wrbc-filter-search autocomplete="off"%3$s></div>',
				esc_attr( $uid ),
				esc_html__( 'Search', 'werun-blocks-community' ),
				'' !== $placeholder ? ' placeholder="' . esc_attr( $placeholder ) . '"' : ''
			);
		}
		$selects = array(
			'dept' => array( 'filterDepartment', true, $depts, __( 'Department', 'werun-blocks-community' ), __( 'All departments', 'werun-blocks-community' ) ),
			'loc'  => array( 'filterLocation', true, $locs, __( 'Location', 'werun-blocks-community' ), __( 'All locations', 'werun-blocks-community' ) ),
			'type' => array( 'filterType', false, $types, __( 'Type', 'werun-blocks-community' ), __( 'All types', 'werun-blocks-community' ) ),
		);
		foreach ( $selects as $key => list( $attr, $default, $options, $label, $all ) ) {
			if ( ! wrbc_on( $a, $attr, $default ) || count( $options ) < 2 ) {
				continue;
			}
			natcasesort( $options );
			$opts = '<option value="">' . esc_html( $all ) . '</option>';
			foreach ( $options as $value => $text ) {
				$opts .= '<option value="' . esc_attr( $value ) . '">' . esc_html( $text ) . '</option>';
			}
			$fields .= sprintf(
				'<div class="wrbc-jobs__field"><label class="wrbc-jobs__label" for="%1$s-%2$s">%3$s</label><select class="wrbc-jobs__select" id="%1$s-%2$s" data-wrbc-filter-select="%2$s">%4$s</select></div>',
				esc_attr( $uid ),
				esc_attr( $key ),
				esc_html( $label ),
				$opts
			);
		}
		// Remote only means something when some jobs are remote and some aren't.
		// Pressed shows a check instead of the house: the state reads without
		// the fill colour (WCAG 1.4.1, and forced-colors mode drops fills).
		if ( wrbc_on( $a, 'filterRemote', true ) && $remote > 0 && $remote < count( $jobs ) ) {
			$fields .= '<div class="wrbc-jobs__field wrbc-jobs__field--chip"><button type="button" class="wrbc-jobs__chip" data-wrbc-filter-chip="remote" data-value="1" aria-pressed="false">'
				. wrbc_icon( 'house', array( 'class' => 'wrbc-jobs__chip-off' ) ) . wrbc_icon( 'check', array( 'class' => 'wrbc-jobs__chip-on' ) )
				. '<span>' . esc_html__( 'Remote only', 'werun-blocks-community' ) . '</span></button></div>';
		}
		if ( '' === $fields ) {
			return '';
		}
		// Named after the block's title when it has one, and numbered when a name
		// repeats on the page ("Filter positions", "Filter positions 2"), so two
		// boards never give two search landmarks with the same name.
		static $used = array();
		$base  = '' !== $title
			/* translators: %s: the jobs block's title, e.g. "Open positions" */
			? sprintf( __( 'Filter %s', 'werun-blocks-community' ), $title )
			: __( 'Filter positions', 'werun-blocks-community' );
		$label = $base;
		for ( $n = 2; isset( $used[ $label ] ); $n++ ) {
			/* translators: 1: name of a search area, e.g. "Filter positions"; 2: its number on the page */
			$label = sprintf( __( '%1$s %2$d', 'werun-blocks-community' ), $base, $n );
		}
		$used[ $label ] = true;
		return '<div class="wrbc-jobs__filters" role="search" aria-label="' . esc_attr( $label ) . '">' . $fields . '</div>';
	}

	/** The title link (and the apply button) attributes. */
	private static function link( string $url, array $a ): string {
		return wrbc_link_attrs( $url, wrbc_on( $a, 'newTab', false ) );
	}

	/** " (opens in a new tab)" for screen readers (the shared note). */
	private static function new_tab( array $a ): string {
		return wrbc_new_tab_note( wrbc_on( $a, 'newTab', false ) );
	}

	/**
	 * Apply button, or ''. Its name starts with the visible label and goes on
	 * with the job ("Apply for Designer"), so every one is unique out of
	 * context (WCAG 2.4.4, 2.5.3). A label that strips to nothing falls back
	 * to "Apply" (never a button with no visible text).
	 */
	private static function apply( array $a, array $job, string $class = '' ): string {
		if ( ! wrbc_on( $a, 'showApply', true ) ) {
			return '';
		}
		$label = trim( wp_strip_all_tags( wrbc_text( $a['applyLabel'] ?? '' ) ) );
		$label = '' !== $label ? $label : __( 'Apply', 'werun-blocks-community' );
		return sprintf(
			'<a class="%1$s" %2$s>%3$s<span class="wrbc-sr-only"> %4$s</span>%5$s</a>',
			esc_attr( trim( 'wrbc-btn wrbc-btn--outline wrbc-jobs__apply ' . $class ) ),
			self::link( $job['applyUrl'], $a ),
			esc_html( $label ),
			/* translators: %s: job title, read after the apply button's label ("Apply for Product Designer"). */
			esc_html( sprintf( _x( 'for %s', 'apply link', 'werun-blocks-community' ), $job['title'] ) ),
			self::new_tab( $a )
		);
	}

	/** Date of a job for people, with its machine value. */
	private static function date( string $iso ): string {
		$time = '' !== $iso ? strtotime( $iso ) : false;
		return $time ? '<time datetime="' . esc_attr( $iso ) . '">' . esc_html( wp_date( get_option( 'date_format' ), $time ) ) . '</time>' : '';
	}

	/** Locations as text: the first three and "+N". */
	private static function places( array $job ): string {
		$list = $job['locations'] ? $job['locations'] : array_filter( array( $job['location'] ) );
		$text = implode( ' · ', array_slice( $list, 0, 3 ) );
		if ( count( $list ) > 3 ) {
			/* translators: %d: number of other locations */
			$text .= ' ' . sprintf( __( '+%d more', 'werun-blocks-community' ), count( $list ) - 3 );
		}
		return $text;
	}

	/**
	 * The meta parts a job shows, key => [ icon, sr label, html ].
	 *
	 * @param array $a   Attributes.
	 * @param array $job Job.
	 */
	private static function parts( array $a, array $job, bool $with_department = true ): array {
		$parts = array();
		if ( $with_department && wrbc_on( $a, 'showDepartment', true ) && '' !== $job['department'] ) {
			$parts['department'] = array( 'building', __( 'Department', 'werun-blocks-community' ), esc_html( $job['department'] ) );
		}
		if ( wrbc_on( $a, 'showLocation', true ) && '' !== self::places( $job ) ) {
			$parts['location'] = array( 'map-pin', __( 'Location', 'werun-blocks-community' ), esc_html( self::places( $job ) ) );
		}
		if ( wrbc_on( $a, 'showRemote', true ) && $job['remote'] ) {
			$parts['remote'] = array( 'house', '', '<span class="wrbc-jobs__badge">' . esc_html__( 'Remote', 'werun-blocks-community' ) . '</span>' );
		}
		if ( wrbc_on( $a, 'showType', true ) && '' !== $job['employmentType'] ) {
			$parts['type'] = array( 'clock', __( 'Type', 'werun-blocks-community' ), esc_html( Job::type_label( $job['employmentType'] ) ) );
		}
		if ( wrbc_on( $a, 'showDate', false ) && '' !== self::date( $job['postedAt'] ) ) {
			$parts['date'] = array( 'calendar', __( 'Posted', 'werun-blocks-community' ), self::date( $job['postedAt'] ) );
		}
		if ( wrbc_on( $a, 'showCompensation', false ) && '' !== $job['compensation'] ) {
			$parts['compensation'] = array( 'banknote', __( 'Compensation', 'werun-blocks-community' ), esc_html( $job['compensation'] ) );
		}
		return $parts;
	}

	/** The meta list of a job, or ''. */
	private static function meta( array $parts ): string {
		if ( ! $parts ) {
			return '';
		}
		$out = '<ul class="wrbc-jobs__meta" role="list">';
		foreach ( $parts as $key => list( $icon, $label, $html ) ) {
			$out .= '<li class="wrbc-jobs__meta-item wrbc-jobs__meta-item--' . esc_attr( $key ) . '">'
				. ( 'remote' !== $key ? wrbc_icon( $icon ) : '' )
				. ( '' !== $label ? '<span class="wrbc-sr-only">' . esc_html( $label ) . ': </span>' : '' )
				. $html . '</li>';
		}
		return $out . '</ul>';
	}

	/**
	 * Description in a disclosure, or ''. Every job's toggle says the same
	 * words, so the job title follows for screen readers (WCAG 2.4.6).
	 *
	 * @param array $e     Effective settings.
	 * @param array $job   Job.
	 * @param int   $level Heading level of the job title.
	 */
	private static function description( array $e, array $job, int $level ): string {
		if ( ! $e['description'] || '' === $job['description'] ) {
			return '';
		}
		return '<details class="wrbc-jobs__desc"><summary class="wrbc-jobs__desc-toggle">' . esc_html__( 'Job description', 'werun-blocks-community' )
			/* translators: %s: job title, read after "Job description" ("Job description for Product Designer"). */
			. '<span class="wrbc-sr-only"> ' . esc_html( sprintf( _x( 'for %s', 'job description toggle', 'werun-blocks-community' ), $job['title'] ) ) . '</span></summary><div class="wrbc-jobs__desc-body">'
			. wp_kses_post( self::relevel( $job['description'], $level + 1 ) ) . '</div></details>';
	}

	/**
	 * The description's headings moved so the highest one sits at $top (under
	 * the job title), in the same order, h6 at most: ATS descriptions often
	 * start at <h1>, which would break the page outline (WCAG 1.3.1).
	 *
	 * @param string $html Description HTML.
	 * @param int    $top  Level of its highest heading.
	 */
	private static function relevel( string $html, int $top ): string {
		if ( ! preg_match_all( '#<h([1-6])\b#i', $html, $found ) ) {
			return $html;
		}
		$shift = min( 6, $top ) - min( array_map( 'intval', $found[1] ) );
		if ( 0 === $shift ) {
			return $html;
		}
		return (string) preg_replace_callback(
			'#<(/?)h([1-6])\b#i',
			function ( $tag ) use ( $shift ) {
				return '<' . $tag[1] . 'h' . max( 1, min( 6, (int) $tag[2] + $shift ) );
			},
			$html
		);
	}

	/**
	 * A list of jobs (rows, items or cards).
	 *
	 * @param array  $a     Attributes.
	 * @param array  $e     Effective settings.
	 * @param array  $jobs  Jobs.
	 * @param int    $level Heading level of a job title.
	 * @param int    $i     Running index (reveal stagger), by reference.
	 * @param string $tone  Tone class of a card with its own background (colors()).
	 */
	private static function items( array $a, array $e, array $jobs, int $level, int &$i, string $tone = '' ): string {
		$cards = 'cards' === $e['layout'];
		$out   = '<ul class="wrbc-jobs__' . ( $cards ? 'cards' : 'list' ) . '" role="list">';
		foreach ( $jobs as $job ) {
			$reveal = $e['reveal'] ? ' data-wrbc-reveal style="--wrbc-reveal-delay:' . esc_attr( min( $i, 10 ) * 0.05 ) . 's"' : '';
			$title  = sprintf(
				'<h%1$d class="wrbc-jobs__title"><a class="wrbc-jobs__link" %2$s>%3$s%4$s</a></h%1$d>',
				$level,
				self::link( $job['url'], $a ),
				esc_html( $job['title'] ),
				self::new_tab( $a )
			);
			// Grouped lists already say the department in the group heading.
			$meta = self::meta( self::parts( $a, $job, ! $e['grouped'] ) );
			$out .= '<li class="wrbc-jobs__item"' . self::filter_attrs( $job ) . $reveal . '>';
			if ( $cards ) {
				$out .= '<article class="' . esc_attr( trim( 'wrbc-jobs__card ' . $tone ) ) . '">' . $title . $meta . self::description( $e, $job, $level ) . self::apply( $a, $job ) . '</article>';
			} else {
				$out .= '<div class="wrbc-jobs__row"><div class="wrbc-jobs__main">' . $title . $meta . '</div>' . self::apply( $a, $job ) . '</div>' . self::description( $e, $job, $level );
			}
			$out .= '</li>';
			++$i;
		}
		return $out . '</ul>';
	}

	/**
	 * Table layout: a real table with a caption, scrolling sideways when
	 * narrow in a box that takes the keyboard (tabindex; view.js keeps it a
	 * tab stop only while it scrolls). The box is a named group, not a
	 * region: the section around it is already the landmark.
	 */
	private static function table( array $a, array $jobs, string $uid ): string {
		$cols = array( 'title' => __( 'Position', 'werun-blocks-community' ) );
		if ( wrbc_on( $a, 'showDepartment', true ) ) {
			$cols['department'] = __( 'Department', 'werun-blocks-community' );
		}
		if ( wrbc_on( $a, 'showLocation', true ) || wrbc_on( $a, 'showRemote', true ) ) {
			$cols['location'] = __( 'Location', 'werun-blocks-community' );
		}
		if ( wrbc_on( $a, 'showType', true ) ) {
			$cols['type'] = __( 'Type', 'werun-blocks-community' );
		}
		if ( wrbc_on( $a, 'showDate', false ) ) {
			$cols['date'] = __( 'Posted', 'werun-blocks-community' );
		}
		if ( wrbc_on( $a, 'showCompensation', false ) ) {
			$cols['compensation'] = __( 'Compensation', 'werun-blocks-community' );
		}
		if ( wrbc_on( $a, 'showApply', true ) ) {
			$cols['apply'] = __( 'Apply', 'werun-blocks-community' );
		}
		$caption = trim( wp_strip_all_tags( wrbc_text( $a['title'] ?? '' ) ) );
		$caption = wrbc_on( $a, 'showHeader', false ) && '' !== $caption ? $caption : __( 'Open positions', 'werun-blocks-community' );
		$out     = '<div class="wrbc-jobs__table-wrap" role="group" tabindex="0" aria-labelledby="' . esc_attr( $uid ) . '-caption">';
		$out    .= '<table class="wrbc-jobs__table"><caption class="wrbc-sr-only" id="' . esc_attr( $uid ) . '-caption">' . esc_html( $caption ) . '</caption><thead><tr>';
		// Every column has a header; the apply column's is for screen readers only (each button says "Apply").
		foreach ( $cols as $key => $label ) {
			$out .= '<th scope="col" class="wrbc-jobs__th wrbc-jobs__th--' . esc_attr( $key ) . '">'
				. ( 'apply' === $key ? '<span class="wrbc-sr-only">' . esc_html( $label ) . '</span>' : esc_html( $label ) ) . '</th>';
		}
		$out .= '</tr></thead><tbody>';
		foreach ( $jobs as $job ) {
			$out .= '<tr class="wrbc-jobs__item"' . self::filter_attrs( $job ) . '>';
			foreach ( array_keys( $cols ) as $key ) {
				switch ( $key ) {
					case 'title':
						$out .= '<th scope="row" class="wrbc-jobs__cell wrbc-jobs__cell--title"><a class="wrbc-jobs__link" ' . self::link( $job['url'], $a ) . '>' . esc_html( $job['title'] ) . self::new_tab( $a ) . '</a></th>';
						break;
					case 'department':
						$out .= '<td class="wrbc-jobs__cell">' . esc_html( $job['department'] ) . '</td>';
						break;
					case 'location':
						$cell = wrbc_on( $a, 'showLocation', true ) ? esc_html( self::places( $job ) ) : '';
						if ( wrbc_on( $a, 'showRemote', true ) && $job['remote'] ) {
							$cell .= ( '' !== $cell ? ' ' : '' ) . '<span class="wrbc-jobs__badge">' . esc_html__( 'Remote', 'werun-blocks-community' ) . '</span>';
						}
						$out .= '<td class="wrbc-jobs__cell">' . $cell . '</td>';
						break;
					case 'type':
						$out .= '<td class="wrbc-jobs__cell">' . esc_html( Job::type_label( $job['employmentType'] ) ) . '</td>';
						break;
					case 'date':
						$out .= '<td class="wrbc-jobs__cell">' . self::date( $job['postedAt'] ) . '</td>';
						break;
					case 'compensation':
						$out .= '<td class="wrbc-jobs__cell">' . esc_html( $job['compensation'] ) . '</td>';
						break;
					case 'apply':
						$out .= '<td class="wrbc-jobs__cell wrbc-jobs__cell--apply">' . self::apply( $a, $job ) . '</td>';
						break;
				}
			}
			$out .= '</tr>';
		}
		return $out . '</tbody></table></div>';
	}
}
