<?php
/**
 * Comparison table: front-end markup. A real <table> (caption, thead,
 * th scope="col" per plan, th scope="row" per feature, one <tbody> per group
 * with a th scope="rowgroup" heading). With the "stacked" phone layout the
 * same data is also printed as one card per plan; the CSS shows one or the
 * other by the block's width, so a screen reader only meets one of them.
 *
 * Twin of edit.js / model.js: the same normalisation, limits and "effective
 * value" rules.
 *
 * @var array    $attributes Block attributes.
 * @var string   $content    Unused.
 * @var WP_Block $block      Block instance.
 *
 * @package werun-blocks-community
 */

defined( 'ABSPATH' ) || exit;

if ( ! function_exists( 'wrbc_comparison_area' ) ) {
	/**
	 * One part of the table that paints its own background (the table, the
	 * header row, a stripe, the featured column): its tone class and what keeps
	 * it readable there — its text (the Color panel's made readable; without
	 * one the tone's, or what it inherits when that reads, else white, ink or
	 * black), muted text, and the accent as text, links, icons and focus ring —
	 * each printed only where it differs from what the part inherits. On a
	 * background the author picked behind accent fills (button, badge) under
	 * 3:1, the accent is made to stand out from it, with its on-colour readable
	 * on that and a hover fill that keeps it readable (--wrbc-accent-hover).
	 * Twin of areaColors() in src/comparison/colors.js.
	 *
	 * @param string     $bg     The part's background (opaque hex).
	 * @param array      $parent The part around it: bg, text, alpha, accent_text, muted_abs.
	 * @param string     $chosen The block's Color panel text colour ('' = none).
	 * @param string     $accent The accent.
	 * @param array|null $fills  For a picked background behind accent fills: array( 'on' => picked on-accent or '' ).
	 * @return array{ class: string, vars: array, ctx: array }
	 */
	function wrbc_comparison_area( $bg, array $parent, $chosen, $accent, $fills = null ) {
		$min  = WERUN_BLOCKS_COMMUNITY_AA_TEXT;
		$same = static function ( $x, $y ) {
			return strtolower( (string) $x ) === strtolower( (string) $y );
		};
		$tone = wrbc_tone_class( $bg, $parent['bg'] );
		// The same tone as the part around it: nothing to turn around.
		if ( '' !== $tone && ( true === wrbc_is_dark_color( $bg ) ) === ( true === wrbc_is_dark_color( $parent['bg'] ) ) ) {
			$tone = '';
		}
		$vars = array();

		if ( '' !== $chosen ) {
			$text = wrbc_readable_color( $chosen, $bg, $min );
			if ( '' !== $tone || ! $same( $text, $parent['text'] ) ) {
				$vars['--wrbc-cmp-ink'] = $text;
			}
		} else {
			if ( 'wrbc-is-dark' === $tone ) {
				$kept = WERUN_BLOCKS_COMMUNITY_PAPER;
			} elseif ( 'wrbc-is-light' === $tone ) {
				// What assets/shared.css paints on .wrbc-is-light.
				$kept = '#000000';
			} else {
				$kept = $parent['text'];
			}
			if ( wrbc_contrast_ratio( $kept, $bg ) >= $min ) {
				$text = $kept;
			} else {
				$text                  = wrbc_on_color( $bg );
				$vars['--wrbc-cmp-ink'] = $text;
			}
		}

		// Muted text: the shared token (76 %, 85 % on dark) unless it falls short
		// here; an absolute colour printed around this part is reset.
		if ( 'wrbc-is-dark' === $tone ) {
			$alpha = 0.85;
		} elseif ( 'wrbc-is-light' === $tone ) {
			$alpha = 0.76;
		} else {
			$alpha = $parent['alpha'];
		}
		$ink       = wrbc_color_rgba( $text );
		$muted_abs = false;
		if ( null !== $ink ) {
			$ink[3] = $alpha;
			$muted  = wrbc_color_hex( wrbc_color_over( $ink, wrbc_color_rgba( $bg ) ) );
			if ( wrbc_contrast_ratio( $muted, $bg ) < $min ) {
				$vars['--wrbc-muted'] = wrbc_readable_color( $muted, $bg, $min );
				$muted_abs           = true;
			} elseif ( ! empty( $parent['muted_abs'] ) ) {
				$vars['--wrbc-muted'] = 'color-mix(in srgb, currentColor ' . (int) round( $alpha * 100 ) . '%, transparent)';
			}
		}

		$accent_text = wrbc_readable_color( $accent, $bg, $min );
		if ( '' !== $tone || ! $same( $accent_text, $parent['accent_text'] ) ) {
			$vars['--wrbc-accent-text'] = $accent_text;
			$vars['--wrbc-focus']       = $accent_text;
		}

		if ( null !== $fills && wrbc_contrast_ratio( $accent, $bg ) < WERUN_BLOCKS_COMMUNITY_AA_UI ) {
			$fill                    = wrbc_readable_color( $accent, $bg, WERUN_BLOCKS_COMMUNITY_AA_UI );
			$vars['--wrbc-accent']    = $fill;
			$vars['--wrbc-on-accent'] = '' !== $fills['on'] ? wrbc_readable_color( $fills['on'], $fill, $min ) : wrbc_on_color( $fill );
			// Hover/focus fill away from the label (wrbc_accent_vars()): lighter
			// under a dark label, else the stylesheet's darker one.
			$vars['--wrbc-accent-hover'] = true === wrbc_is_dark_color( $vars['--wrbc-on-accent'] )
				? wrbc_color_hex( wrbc_color_mix( wrbc_color_rgba( $fill ), array( 255.0, 255.0, 255.0, 1.0 ), 0.14 ) )
				: 'initial';
		}

		return array(
			'class' => trim( $tone . ( isset( $vars['--wrbc-cmp-ink'] ) ? ' has-cmp-ink' : '' ) ),
			'vars'  => $vars,
			'ctx'   => array(
				'bg'          => $bg,
				'text'        => $text,
				'alpha'       => $alpha,
				'accent_text' => $accent_text,
				'muted_abs'   => $muted_abs,
			),
		);
	}

	/**
	 * Everything the table prints for its colours: the root's tone and
	 * custom properties (accent, on-accent and their hover, accent as text —
	 * wrbc_accent_vars() — the "Save" note, the table's background, the
	 * surface) and the parts that paint their own background (null when a
	 * part inherits). The table paints what the block sits on (a dark
	 * section: a dark table) unless a Table background was picked. A part's
	 * colours are worked out against its parent element's: the header row
	 * against the root (<thead> isn't inside <tbody>), the rows and their cells
	 * against the table's sections.
	 * Twin of comparisonColors() in src/comparison/colors.js.
	 *
	 * @param array  $a       Attributes.
	 * @param string $surface What the block sits on (wrbc_surface()).
	 * @param string $around  What's around the block (wrbc_context_background()).
	 * @param array  $opts    featured, zebra, toggle (bool each).
	 * @return array
	 */
	function wrbc_comparison_colors( array $a, $surface, $around, array $opts ) {
		$min    = WERUN_BLOCKS_COMMUNITY_AA_TEXT;
		$white  = array( 255.0, 255.0, 255.0, 1.0 );
		$pick   = static function ( $value ) {
			$value = wrbc_text( $value );
			return '' !== $value ? wrbc_color_rgba( $value ) : null;
		};
		$found  = wrbc_color_rgba( $surface );
		$back   = null === $found ? $white : wrbc_color_over( $found, $white );
		$under  = wrbc_color_hex( $back );
		$accent = null !== $pick( $a['accentColor'] ?? '' ) ? wrbc_text( $a['accentColor'] ) : WERUN_BLOCKS_COMMUNITY_ACCENT;
		$on     = null !== $pick( $a['onAccentColor'] ?? '' ) ? wrbc_text( $a['onAccentColor'] ) : '';
		$tone   = wrbc_tone_class( $under, $around );
		$chosen = wrbc_block_colors( $a )['text'];

		if ( '' !== $chosen ) {
			$root_text = $chosen;
		} elseif ( 'wrbc-is-dark' === $tone ) {
			$root_text = WERUN_BLOCKS_COMMUNITY_PAPER;
		} elseif ( 'wrbc-is-light' === $tone ) {
			$root_text = '#000000';
		} else {
			$root_text = true === wrbc_is_dark_color( $under ) ? WERUN_BLOCKS_COMMUNITY_PAPER : wrbc_page_colors()['text'];
		}
		$root_accent_text = wrbc_readable_color( $accent, $under, $min );
		// Accent, its on-colour (a picked one made readable on it), the hover
		// fill under a dark label, the accent as text on the surface.
		$vars                     = wrbc_accent_vars( $a, $under );
		$vars['--wrbc-cmp-surface'] = $under;
		if ( ! empty( $opts['toggle'] ) ) {
			// The "Save" note: accent text on a 14 % accent tint over the switch's
			// 4 % track (4 % black on a light background, 4 % white on a dark one).
			$base                 = wrbc_color_rgba( $accent );
			$tint                 = true === wrbc_is_dark_color( $under ) ? array( 255.0, 255.0, 255.0, 0.04 ) : array( 0.0, 0.0, 0.0, 0.04 );
			$note                 = wrbc_color_hex( wrbc_color_over( array( $base[0], $base[1], $base[2], 0.14 ), wrbc_color_over( $tint, $back ) ) );
			$vars['--wrbc-cmp-save'] = wrbc_readable_color( $accent, $note, $min );
			// Painted as that exact colour, so the note's text is checked against what shows.
			$vars['--wrbc-cmp-save-bg'] = $note;
		}

		$table_pick           = $pick( $a['tableBg'] ?? '' );
		$table_bg             = null !== $table_pick ? wrbc_color_hex( wrbc_color_over( $table_pick, $back ) ) : $under;
		$vars['--wrbc-table-bg'] = $table_bg;
		$root_ctx             = array(
			'bg'          => $under,
			'text'        => $root_text,
			'alpha'       => 'wrbc-is-dark' === $tone ? 0.85 : 0.76,
			'accent_text' => $root_accent_text,
			'muted_abs'   => false,
		);
		$table                = null !== $table_pick ? wrbc_comparison_area( $table_bg, $root_ctx, $chosen, $accent ) : null;
		$table_ctx            = null !== $table ? $table['ctx'] : array_merge( $root_ctx, array( 'bg' => $table_bg ) );
		$table_rgba           = wrbc_color_rgba( $table_bg );

		// The header row: its own background, else the table's part (printed on
		// <thead> too). Against the root: <thead> sits in <table>, beside <tbody>.
		$head_pick = $pick( $a['headBg'] ?? '' );
		$head      = null;
		if ( null !== $head_pick ) {
			$head_bg                   = wrbc_color_hex( wrbc_color_over( $head_pick, $table_rgba ) );
			$head                      = wrbc_comparison_area( $head_bg, $root_ctx, $chosen, $accent );
			$vars['--wrbc-cmp-head-bg'] = $head_bg;
		}
		$head_ctx  = null !== $head ? $head['ctx'] : $table_ctx;

		$alt    = null;
		$alt_bg = '';
		if ( ! empty( $opts['zebra'] ) ) {
			$zebra_pick = $pick( $a['zebraColor'] ?? '' );
			$ink        = wrbc_color_rgba( $table_ctx['text'] );
			$ink        = null !== $ink ? $ink : wrbc_color_rgba( WERUN_BLOCKS_COMMUNITY_INK );
			$alt_bg     = null !== $zebra_pick ? wrbc_color_hex( wrbc_color_over( $zebra_pick, $table_rgba ) ) : wrbc_color_hex( wrbc_color_mix( $table_rgba, $ink, 0.04 ) );
			$alt        = wrbc_comparison_area( $alt_bg, $table_ctx, $chosen, $accent );
			// Printed, so a cell whose text colour changes keeps the stripe its colours were worked out for.
			$vars['--wrbc-cmp-alt-bg'] = $alt_bg;
		}

		$feat      = null;
		$feat_head = null;
		$feat_alt  = null;
		$feat_card = null;
		if ( ! empty( $opts['featured'] ) ) {
			$feat_pick   = $pick( $a['featuredBg'] ?? '' );
			$accent_rgba = wrbc_color_rgba( $accent );
			$feat_bg     = null !== $feat_pick ? wrbc_color_hex( wrbc_color_over( $feat_pick, $table_rgba ) ) : wrbc_color_hex( wrbc_color_mix( $table_rgba, $accent_rgba, 0.07 ) );
			$fills       = null !== $feat_pick ? array( 'on' => $on ) : null;
			$feat        = wrbc_comparison_area( $feat_bg, $table_ctx, $chosen, $accent, $fills );
			// The exact colour its colours were worked out for (a CSS mix isn't rounded the same way).
			$vars['--wrbc-cmp-feat-bg'] = $feat_bg;
			$feat_head   = wrbc_comparison_area( $feat_bg, $head_ctx, $chosen, $accent, $fills );
			// The featured phone card: its own surface beside the others, on what the block sits on.
			$feat_card   = wrbc_comparison_area( $feat_bg, $root_ctx, $chosen, $accent, $fills );
			if ( null !== $alt ) {
				$feat_alt_bg = null !== $feat_pick ? $feat_bg : wrbc_color_hex( wrbc_color_mix( wrbc_color_rgba( $alt_bg ), $accent_rgba, 0.05 ) );
				$feat_alt    = wrbc_comparison_area( $feat_alt_bg, $alt['ctx'], $chosen, $accent, $fills );
				$vars['--wrbc-cmp-feat-alt-bg'] = $feat_alt_bg;
			}
		}

		return array(
			'root_class' => $tone,
			'root_vars'  => $vars,
			'table'      => $table,
			'head'       => $head,
			'alt'        => $alt,
			'feat'       => $feat,
			'feat_head'  => $feat_head,
			'feat_alt'   => $feat_alt,
			'feat_card'  => $feat_card,
		);
	}
}

$a   = $attributes;
$uid = wrbc_uid( $a, 'wrbc-comparison' );

/** Whether rich text has any visible text. */
$wrbc_cmp_filled = static function ( $value ) {
	return '' !== trim( wp_strip_all_tags( wrbc_text( $value ) ) );
};

// ── Plans: at most 6 (same limit as the editor), each with a unique id. ──
$plans = array();
$taken = array();
foreach ( array_slice( is_array( $a['plans'] ?? null ) ? array_values( $a['plans'] ) : array(), 0, 6 ) as $i => $plan ) {
	$plan = is_array( $plan ) ? $plan : array();
	$id   = preg_replace( '/[^A-Za-z0-9_-]/', '', wrbc_text( $plan['id'] ?? '' ) );
	if ( '' === $id || isset( $taken[ $id ] ) ) {
		$id = 'p' . $i;
	}
	$taken[ $id ] = true;
	$plans[]      = array(
		'id'           => $id,
		'index'        => $i,
		'name'         => wrbc_text( $plan['name'] ?? '' ),
		'price'        => wrbc_text( $plan['price'] ?? '' ),
		'period'       => wrbc_text( $plan['period'] ?? '' ),
		'priceYearly'  => wrbc_text( $plan['priceYearly'] ?? '' ),
		'periodYearly' => wrbc_text( $plan['periodYearly'] ?? '' ),
		'ctaLabel'     => wrbc_text( $plan['ctaLabel'] ?? '' ),
		'ctaUrl'       => wrbc_text( $plan['ctaUrl'] ?? '' ),
		'ctaNewTab'    => ! empty( $plan['ctaNewTab'] ),
		'badge'        => wrbc_text( $plan['badge'] ?? '' ),
	);
}
$count = count( $plans );

// Nothing to compare without a plan.
if ( ! $count ) {
	return;
}

// ── Rows: at most 80, group headings only when groups are on. ──
$show_groups = wrbc_on( $a, 'showGroups' );
$rows        = array();
foreach ( array_slice( is_array( $a['rows'] ?? null ) ? array_values( $a['rows'] ) : array(), 0, 80 ) as $row ) {
	$row   = is_array( $row ) ? $row : array();
	$group = 'group' === ( $row['type'] ?? '' );
	if ( $group && ! $show_groups ) {
		continue;
	}
	$values = is_array( $row['values'] ?? null ) ? $row['values'] : array();
	$cells  = array();
	foreach ( $plans as $plan ) {
		// Keyed by plan id; a plain list (hand-written JSON) by position.
		$value = $values[ $plan['id'] ] ?? ( $values[ $plan['index'] ] ?? null );
		$value = is_array( $value ) ? $value : array();
		$type  = wrbc_text( $value['type'] ?? '' );
		$cells[] = array(
			'type' => in_array( $type, array( 'check', 'cross', 'partial', 'text' ), true ) ? $type : '',
			'text' => wrbc_text( $value['text'] ?? '' ),
		);
	}
	$rows[] = array(
		'group'       => $group,
		'label'       => wrbc_text( $row['label'] ?? '' ),
		'description' => wrbc_text( $row['description'] ?? '' ),
		'cells'       => $cells,
	);
}

// ── Effective options (twin: model.js effective()). ──
// A column number (1 to the number of plans); anything else is no featured plan.
$featured     = (int) ( is_scalar( $a['featuredColumn'] ?? null ) ? $a['featuredColumn'] : 0 );
$featured     = $featured >= 1 && $featured <= $count ? $featured : 0;
$show_badge   = $featured && wrbc_on( $a, 'showBadge' );
$show_prices  = wrbc_on( $a, 'showPrices' );
$show_cta     = wrbc_on( $a, 'showCta' );
$on_top       = wrbc_on( $a, 'pricesOnTop', false );
$has_yearly   = false;
foreach ( $plans as $plan ) {
	$has_yearly = $has_yearly || $wrbc_cmp_filled( $plan['priceYearly'] );
}
// The switch only when there is a yearly price to switch to.
$toggle      = $show_prices && wrbc_on( $a, 'showToggle', false ) && $has_yearly;
// Without the switch only the (monthly) price is shown.
$period      = $toggle && 'yearly' === ( $a['defaultPeriod'] ?? '' ) ? 'yearly' : 'monthly';
$currency    = wrbc_text( $a['currency'] ?? '' );
$after       = 'after' === ( $a['currencyPosition'] ?? '' );
$mobile      = 'stacked' === ( $a['mobileLayout'] ?? '' ) ? 'stacked' : 'scroll';
$desc_toggle = 'below' !== ( $a['descriptionDisplay'] ?? '' );
$zebra       = wrbc_on( $a, 'zebra', false );
$btn_style   = in_array( $a['buttonStyle'] ?? '', array( 'auto', 'fill', 'outline' ), true ) ? $a['buttonStyle'] : 'auto';
$foot        = ! $on_top && ( $show_prices || $show_cta );
$any_cta     = false;
foreach ( $plans as $plan ) {
	$any_cta = $any_cta || $wrbc_cmp_filled( $plan['ctaLabel'] );
}
$details = ( $show_prices || ( $show_cta && $any_cta ) );

// ── Colours (docs/accessibility.md). Twin: comparisonColors() in colors.js. ──
$colors = wrbc_comparison_colors(
	$a,
	wrbc_surface( $a, $block ),
	wrbc_context_background( $block ),
	array(
		'featured' => (bool) $featured,
		'zebra'    => $zebra,
		'toggle'   => $toggle,
	)
);
/** A part's tone class and its custom properties, for the element that paints it. */
$part = static function ( $area ) {
	if ( null === $area ) {
		return array( '', '' );
	}
	$style = wrbc_css_vars( $area['vars'] );
	return array( $area['class'], '' !== $style ? ' style="' . esc_attr( $style ) . '"' : '' );
};
list( $table_class, $table_style ) = $part( $colors['table'] );
list( $head_class, $head_style )   = null !== $colors['head'] ? $part( $colors['head'] ) : array( $table_class, $table_style );
list( $alt_class, $alt_style )     = $part( $colors['alt'] );

/** A plan's cell (or card) in the featured column: its part (header row, stripe or plain). */
$featured_part = static function ( $where ) use ( $colors, $part ) {
	$areas = array(
		'head' => $colors['feat_head'],
		'alt'  => $colors['feat_alt'],
		'card' => $colors['feat_card'],
	);
	$area  = $areas[ $where ] ?? $colors['feat'];
	return $part( $area );
};

/**
 * A button without a URL ('' or '#', or one esc_url() refuses) isn't a link
 * ("#" goes nowhere): its label prints with the button's look, as text
 * (docs/accessibility.md). Twin: noUrl() in edit.js.
 */
$has_url = static function ( $url ) {
	$url = trim( wrbc_text( $url ) );
	return '' !== $url && '#' !== $url && '' !== esc_url( $url );
};

$icons = array(
	'check'   => is_array( $a['includedIcon'] ?? null ) ? $a['includedIcon'] : array( 'name' => 'check' ),
	'cross'   => is_array( $a['excludedIcon'] ?? null ) ? $a['excludedIcon'] : array( 'name' => 'x' ),
	'partial' => is_array( $a['partialIcon'] ?? null ) ? $a['partialIcon'] : array( 'name' => 'minus' ),
);
$status = array(
	'check'   => __( 'Included', 'werun-blocks-community' ),
	'cross'   => __( 'Not included', 'werun-blocks-community' ),
	'partial' => __( 'Partially included', 'werun-blocks-community' ),
);

/**
 * One price: currency, amount and period; text that is not a number
 * ("Custom") stands alone. Same test as the pricing table and model.js.
 */
$price_html = static function ( $amount, $per ) use ( $currency, $after ) {
	$amount  = trim( wp_strip_all_tags( $amount ) );
	$per     = trim( wp_strip_all_tags( $per ) );
	$numeric = (bool) preg_match( '/^[\d.,\s]*\d[\d.,\s]*$/', $amount );
	$out     = '';
	if ( $numeric && ! $after && '' !== $currency ) {
		$out .= '<span class="wrbc-comparison__currency">' . esc_html( $currency ) . '</span>';
	}
	$out .= '<span class="wrbc-comparison__value">' . esc_html( $amount ) . '</span>';
	if ( $numeric && $after && '' !== $currency ) {
		$out .= '<span class="wrbc-comparison__currency">' . esc_html( $currency ) . '</span>';
	}
	if ( $numeric && '' !== $per ) {
		$out .= '<span class="wrbc-comparison__period">' . esc_html( $per ) . '</span>';
	}
	return $out;
};

/** Price (both periods with the switch, the yearly one falling back to the monthly) and button of a plan. */
$details_html = static function ( $plan, $position ) use ( $show_prices, $show_cta, $toggle, $period, $featured, $btn_style, $price_html, $wrbc_cmp_filled, $uid, $has_url ) {
	$out = '';
	if ( $show_prices ) {
		$yearly     = $wrbc_cmp_filled( $plan['priceYearly'] );
		$m          = $price_html( $plan['price'], $plan['period'] );
		$y          = $yearly ? $price_html( $plan['priceYearly'], $plan['periodYearly'] ) : $m;
		$has_price  = $wrbc_cmp_filled( $plan['price'] ) || $yearly;
		if ( $has_price ) {
			$out .= '<p class="wrbc-comparison__price">';
			if ( $toggle || 'monthly' === $period ) {
				$out .= '<span class="wrbc-comparison__amount wrbc-comparison__amount--monthly">' . ( $wrbc_cmp_filled( $plan['price'] ) ? $m : $y ) . '</span>';
			}
			if ( $toggle || 'yearly' === $period ) {
				$out .= '<span class="wrbc-comparison__amount wrbc-comparison__amount--yearly">' . $y . '</span>';
			}
			$out .= '</p>';
		}
	}
	if ( $show_cta && $wrbc_cmp_filled( $plan['ctaLabel'] ) ) {
		$is_featured = $featured === $plan['index'] + 1;
		$class       = 'fill' === $btn_style || ( 'auto' === $btn_style && $is_featured ) ? 'wrbc-btn' : 'wrbc-btn wrbc-btn--outline';
		// The plan's name in the header row or on its card: both are always
		// printed (visually hidden "Plan N" without a name), so "Talk to us"
		// is always described by the plan it belongs to (WCAG 2.4.4).
		$name_id     = $uid . '-' . ( 'card' === $position ? 'card' : 'head' ) . '-p' . $plan['index'];
		if ( ! $has_url( $plan['ctaUrl'] ) ) {
			$out .= '<span class="' . esc_attr( $class ) . ' wrbc-comparison__cta is-static">' . wrbc_rich( $plan['ctaLabel'] ) . '</span>';
		} else {
			$out .= '<a class="' . esc_attr( $class ) . ' wrbc-comparison__cta" ' . wrbc_link_attrs( $plan['ctaUrl'], $plan['ctaNewTab'] )
				. ' aria-describedby="' . esc_attr( $name_id ) . '">'
				. wrbc_rich( $plan['ctaLabel'] )
				// A new tab is announced with the link, not sprung on the visitor.
				. wrbc_new_tab_note( $plan['ctaNewTab'] )
				. '</a>';
		}
	}
	return $out;
};

/** A value cell's inside: icon with its status for screen readers, and the text. */
$cell_html = static function ( $cell ) use ( $icons, $status ) {
	$type = $cell['type'];
	$text = wrbc_rich( $cell['text'] );
	if ( 'text' === $type || '' === $type ) {
		return '' !== trim( wp_strip_all_tags( $text ) ) ? '<span class="wrbc-comparison__text">' . $text . '</span>' : '';
	}
	$out  = wrbc_icon( $icons[ $type ], array( 'class' => 'wrbc-comparison__icon' ) );
	$out .= '<span class="wrbc-sr-only">' . esc_html( $status[ $type ] ) . '</span>';
	if ( 'partial' === $type && '' !== trim( wp_strip_all_tags( $text ) ) ) {
		$out .= '<span class="wrbc-comparison__text">' . $text . '</span>';
	}
	return $out;
};

// ── Wrapper ──
$classes = array(
	'wrbc-root',
	'wrbc-comparison',
	'wrbc-comparison--mobile-' . $mobile,
	'wrbc-comparison--' . ( 'compact' === ( $a['density'] ?? '' ) ? 'compact' : 'comfortable' ),
	$uid,
);
if ( wrbc_on( $a, 'stickyHeader' ) ) {
	$classes[] = 'has-sticky-head';
}
if ( 'scroll' === $mobile && wrbc_on( $a, 'stickyFirstColumn' ) ) {
	$classes[] = 'has-sticky-col';
}
if ( $featured ) {
	$classes[] = 'has-featured';
}
if ( '' !== $colors['root_class'] ) {
	$classes[] = $colors['root_class'];
}
$extra = array(
	'id'          => $uid,
	'class'       => implode( ' ', $classes ),
	'data-period' => $period,
	'style'       => wrbc_css_vars(
		array_merge(
			array(
				'--wrbc-plans'       => $count,
				// Same limits as the editor's sliders.
				'--wrbc-label-col'   => max( 20, min( 50, (int) ( $a['labelWidth'] ?? 32 ) ) ) . '%',
				'--wrbc-sticky-top'  => wrbc_on( $a, 'stickyHeader' ) ? max( 0, min( 200, (int) ( $a['stickyOffset'] ?? 0 ) ) ) . 'px' : '',
				'--wrbc-featured-bg' => $featured ? ( $a['featuredBg'] ?? '' ) : '',
				'--wrbc-head-bg'     => $a['headBg'] ?? '',
				'--wrbc-line'        => $a['lineColor'] ?? '',
				'--wrbc-zebra'       => $zebra ? ( $a['zebraColor'] ?? '' ) : '',
				'--wrbc-radius'      => wrbc_px( max( 0, min( 32, (int) ( $a['tableRadius'] ?? 14 ) ) ) ),
				'--wrbc-icon-size'   => wrbc_px( max( 12, min( 32, (float) ( $a['iconSize'] ?? 20 ) ) ) ),
				'--wrbc-icon-stroke' => max( 1, min( 3, (float) ( $a['iconStroke'] ?? 2.25 ) ) ),
			),
			// Accent, its on-colour and its readable text colour, the "Save"
			// note's colour, and the table's background (what it sits on, or the
			// one picked).
			$colors['root_vars']
		)
	),
);
$has_title = wrbc_on( $a, 'showHeader' ) && $wrbc_cmp_filled( $a['title'] ?? '' );
if ( $has_title ) {
	$extra['aria-labelledby'] = $uid . '-title';
}

$caption    = $wrbc_cmp_filled( $a['caption'] ?? '' ) ? wrbc_rich( $a['caption'] ) : esc_html__( 'Plan comparison', 'werun-blocks-community' );
// The phone cards' plan names: one level under the section title (which
// wrbc_section_header() clamps to 2–4), or at the title's own level when none
// is printed ("Plan name level" in the editor); a card's group headings one
// level under that. Twin: Cards() in edit.js.
$title_level = max( 2, min( 4, (int) ( is_scalar( $a['titleLevel'] ?? null ) ? $a['titleLevel'] : 2 ) ) );
$card_level  = $has_title ? $title_level + 1 : $title_level;
$reveal     = wrbc_on( $a, 'reveal' ) ? ' data-wrbc-reveal' : '';
$cols       = $count + 1;

/** A plan's name as plain text, "Plan N" without one (header cells, cards). */
$plain_name = static function ( $plan ) use ( $wrbc_cmp_filled ) {
	return $wrbc_cmp_filled( $plan['name'] )
		? trim( wp_strip_all_tags( $plan['name'] ) )
		/* translators: %d: column number. */
		: sprintf( __( 'Plan %d', 'werun-blocks-community' ), $plan['index'] + 1 );
};
/*
 * The featured plan in words, for screen readers, when no badge says it:
 * the tint, the top bar and the filled button are only colour (WCAG 1.4.1).
 */
$featured_note = '<span class="wrbc-sr-only">(' . esc_html__( 'Featured plan', 'werun-blocks-community' ) . ')</span>';

/** A feature's info button: shows and hides its description (view.js); hidden without JS, where the text shows. */
$tip_html = static function ( $label, $desc_id ) {
	return '<button type="button" class="wrbc-comparison__tip" aria-expanded="false" aria-controls="' . esc_attr( $desc_id ) . '" hidden>'
		. wrbc_icon( array( 'name' => 'info' ) )
		/* translators: %s: feature name. */
		. '<span class="wrbc-sr-only">' . esc_html( sprintf( __( 'More about %s', 'werun-blocks-community' ), trim( wp_strip_all_tags( $label ) ) ) ) . '</span>'
		. '</button>';
};
?>
<section <?php echo get_block_wrapper_attributes( $extra ); // phpcs:ignore -- escaped by core ?>>
	<?php echo wrbc_section_header( $a, $uid ); // phpcs:ignore -- escaped in the helper ?>

	<?php if ( $toggle ) : ?>
		<div class="wrbc-comparison__switch-wrap<?php echo 'center' === ( $a['headerAlign'] ?? '' ) ? ' is-center' : ''; ?>">
			<?php
			// Native radio buttons, as in the pricing table: arrow keys and
			// screen readers work as with any radio group ("1 of 2, checked"),
			// and without JavaScript the checked radio itself picks the prices
			// (style.scss, :has()).
			?>
			<div class="wrbc-comparison__switch" role="radiogroup" aria-label="<?php esc_attr_e( 'Billing period', 'werun-blocks-community' ); ?>">
				<?php foreach ( array( 'monthly', 'yearly' ) as $p ) : ?>
					<?php
					// A radio needs a name: an emptied label falls back to the default one.
					$option_label = trim( wp_strip_all_tags( wrbc_text( 'monthly' === $p ? ( $a['monthlyLabel'] ?? '' ) : ( $a['yearlyLabel'] ?? '' ) ) ) );
					if ( '' === $option_label ) {
						$option_label = 'monthly' === $p ? __( 'Monthly', 'werun-blocks-community' ) : __( 'Yearly', 'werun-blocks-community' );
					}
					?>
					<label class="wrbc-comparison__choice">
						<input type="radio" class="wrbc-comparison__radio" name="<?php echo esc_attr( $uid ); ?>-period" value="<?php echo esc_attr( $p ); ?>" aria-controls="<?php echo esc_attr( $uid ); ?>-body"<?php checked( $p, $period ); ?>>
						<span class="wrbc-comparison__option">
							<?php echo esc_html( $option_label ); ?>
							<?php if ( 'yearly' === $p && wrbc_on( $a, 'showYearlyNote' ) && $wrbc_cmp_filled( $a['yearlyNote'] ?? '' ) ) : ?>
								<span class="wrbc-comparison__save"><?php echo esc_html( wp_strip_all_tags( wrbc_text( $a['yearlyNote'] ) ) ); ?></span>
							<?php endif; ?>
						</span>
					</label>
				<?php endforeach; ?>
			</div>
		</div>
		<p class="wrbc-sr-only" aria-live="polite" data-wrbc-comparison-status data-monthly="<?php esc_attr_e( 'Showing monthly prices', 'werun-blocks-community' ); ?>" data-yearly="<?php esc_attr_e( 'Showing yearly prices', 'werun-blocks-community' ); ?>"></p>
	<?php endif; ?>

	<div class="wrbc-comparison__body" id="<?php echo esc_attr( $uid ); ?>-body"<?php echo $reveal; // phpcs:ignore -- fixed string ?>>
		<?php
		// The scroll box of the scrolling phone layout is a focusable group
		// named by the caption, so keyboard users can scroll it (columns
		// without a button can't be reached with Tab); view.js keeps that only
		// while it really overflows. A group, not a region: a region would be
		// a landmark (docs/accessibility.md).
		$scroll_attrs = 'scroll' === $mobile
			? ' role="group" tabindex="0" aria-labelledby="' . esc_attr( $uid ) . '-caption" data-wrbc-scroll'
			: '';
		?>
		<div class="wrbc-comparison__scroll"<?php echo $scroll_attrs; // phpcs:ignore -- escaped above ?>>
			<table class="wrbc-comparison__table">
				<caption id="<?php echo esc_attr( $uid ); ?>-caption" class="wrbc-comparison__caption<?php echo wrbc_on( $a, 'showCaption', false ) ? '' : ' wrbc-sr-only'; ?>"><?php echo $caption; // phpcs:ignore -- wp_kses_post / esc_html ?></caption>
				<colgroup>
					<col class="wrbc-comparison__col-label">
					<?php foreach ( $plans as $plan ) : ?>
						<col class="wrbc-comparison__col-plan<?php echo $featured === $plan['index'] + 1 ? ' is-featured' : ''; ?>">
					<?php endforeach; ?>
				</colgroup>
				<thead<?php echo $head_class ? ' class="' . esc_attr( $head_class ) . '"' : ''; ?><?php echo $head_style; // phpcs:ignore -- escaped in $part ?>>
					<tr>
						<?php if ( $wrbc_cmp_filled( $a['cornerLabel'] ?? '' ) ) : ?>
							<th scope="col" class="wrbc-comparison__corner"><?php echo wrbc_rich( $a['cornerLabel'] ); // phpcs:ignore ?></th>
						<?php else : ?>
							<td class="wrbc-comparison__corner"></td>
						<?php endif; ?>
						<?php foreach ( $plans as $plan ) : ?>
							<?php
							$is_featured = $featured === $plan['index'] + 1;
							$has_badge   = $is_featured && $show_badge && $wrbc_cmp_filled( $plan['badge'] );
							// A header cell always has a name, for screen readers at least.
							$name_html = $wrbc_cmp_filled( $plan['name'] )
								? wrbc_rich( $plan['name'] )
								: '<span class="wrbc-sr-only">' . esc_html( $plain_name( $plan ) ) . '</span>';
							// Screen readers repeat a column's header on every cell: with a badge,
							// a price or a button in it, abbr gives them just the name.
							$head_abbr = $is_featured || ( $on_top && $details ) ? ' abbr="' . esc_attr( $plain_name( $plan ) ) . '"' : '';
							// The featured column's header: its own background, in the header row.
							list( $cell_class, $cell_style ) = $is_featured ? $featured_part( 'head' ) : array( '', '' );
							?>
							<th scope="col" id="<?php echo esc_attr( $uid . '-plan-p' . $plan['index'] ); ?>" class="wrbc-comparison__plan<?php echo $is_featured ? ' is-featured' : ''; ?><?php echo $cell_class ? ' ' . esc_attr( $cell_class ) : ''; ?>"<?php echo $head_abbr . $cell_style; // phpcs:ignore -- escaped above and in $part ?>>
								<?php if ( $has_badge ) : ?>
									<span class="wrbc-comparison__badge"><?php echo wrbc_rich( $plan['badge'] ); // phpcs:ignore ?></span>
								<?php endif; ?>
								<span class="wrbc-comparison__name" id="<?php echo esc_attr( $uid . '-head-p' . $plan['index'] ); ?>"><?php echo $name_html; // phpcs:ignore -- escaped above ?>
									<?php echo $is_featured && ! $has_badge ? $featured_note : ''; // phpcs:ignore -- fixed markup ?>
								</span>
								<?php if ( $on_top && $details ) : ?>
									<div class="wrbc-comparison__details"><?php echo $details_html( $plan, 'head' ); // phpcs:ignore -- escaped in the closure ?></div>
								<?php endif; ?>
							</th>
						<?php endforeach; ?>
					</tr>
				</thead>
				<?php
				/*
				 * Every value cell names its headers (headers="plan feature group"):
				 * the group's header spans the whole row (scope="rowgroup"), which
				 * screen readers and checkers map unevenly without them. The scopes
				 * stay for the ones that don't read headers.
				 */
				$open     = false;
				$alt      = false;
				$index    = 0;
				$groups   = 0;
				$group_id = '';
				foreach ( $rows as $row ) :
					if ( $row['group'] || ! $open ) {
						if ( $open ) {
							echo '</tbody>';
						}
						echo '<tbody' . ( $table_class ? ' class="' . esc_attr( $table_class ) . '"' : '' ) . $table_style . '>'; // phpcs:ignore -- escaped in $part
						$open     = true;
						$alt      = false;
						$group_id = '';
					}
					if ( $row['group'] ) :
						if ( ! $wrbc_cmp_filled( $row['label'] ) ) {
							continue;
						}
						$group_id = $uid . '-group-' . ( ++$groups );
						?>
						<tr class="wrbc-comparison__group">
							<th scope="rowgroup" colspan="<?php echo (int) $cols; ?>" id="<?php echo esc_attr( $group_id ); ?>"><span class="wrbc-comparison__group-label"><?php echo wrbc_rich( $row['label'] ); // phpcs:ignore ?></span></th>
						</tr>
						<?php
						continue;
					endif;
					++$index;
					$is_alt    = $zebra && $alt;
					$row_class = 'wrbc-comparison__row' . ( $is_alt ? ' ' . trim( 'is-alt ' . $alt_class ) : '' );
					$alt       = ! $alt;
					// The featured cell of this row: on a stripe or not.
					list( $cell_class, $cell_style ) = $featured ? $featured_part( $is_alt ? 'alt' : 'plain' ) : array( '', '' );
					$has_desc  = $wrbc_cmp_filled( $row['description'] );
					$desc_id   = $uid . '-d' . $index;
					?>
					<tr class="<?php echo esc_attr( $row_class ); ?>"<?php echo $is_alt ? $alt_style : ''; // phpcs:ignore -- escaped in $part ?>>
						<?php
						// The row header is repeated on every cell too: abbr is the bare
						// name, without the info button and the description.
						$row_abbr = $has_desc && $wrbc_cmp_filled( $row['label'] ) ? ' abbr="' . esc_attr( trim( wp_strip_all_tags( $row['label'] ) ) ) . '"' : '';
						?>
						<th scope="row" id="<?php echo esc_attr( $uid . '-row-' . $index ); ?>" class="wrbc-comparison__label"<?php echo $row_abbr; // phpcs:ignore -- escaped above ?>>
							<span class="wrbc-comparison__label-row">
								<span class="wrbc-comparison__label-text"><?php echo wrbc_rich( $row['label'] ); // phpcs:ignore ?></span>
								<?php echo $has_desc && $desc_toggle ? $tip_html( $row['label'], $desc_id ) : ''; // phpcs:ignore -- escaped in the closure ?>
							</span>
							<?php if ( $has_desc ) : ?>
								<span class="wrbc-comparison__desc" id="<?php echo esc_attr( $desc_id ); ?>"<?php echo $desc_toggle ? ' data-wrbc-tip' : ''; ?>><?php echo wrbc_rich( $row['description'] ); // phpcs:ignore ?></span>
							<?php endif; ?>
						</th>
						<?php foreach ( $row['cells'] as $i => $cell ) : ?>
							<?php $is_feat_cell = $featured === $i + 1; ?>
							<td headers="<?php echo esc_attr( trim( $uid . '-plan-p' . $i . ' ' . $uid . '-row-' . $index . ' ' . $group_id ) ); ?>" class="wrbc-comparison__cell<?php echo $cell['type'] ? ' is-' . esc_attr( $cell['type'] ) : ''; ?><?php echo $is_feat_cell ? ' is-featured' . ( $cell_class ? ' ' . esc_attr( $cell_class ) : '' ) : ''; ?>"<?php echo $is_feat_cell ? $cell_style : ''; // phpcs:ignore -- escaped in $part ?>><?php echo $cell_html( $cell ); // phpcs:ignore -- escaped in the closure ?></td>
						<?php endforeach; ?>
					</tr>
				<?php endforeach; ?>
				<?php
				if ( $open ) {
					echo '</tbody>';
				}
				?>
				<?php if ( $foot && $details ) : ?>
					<tfoot<?php echo $table_class ? ' class="' . esc_attr( $table_class ) . '"' : ''; ?><?php echo $table_style; // phpcs:ignore -- escaped in $part ?>>
						<tr>
							<th scope="row" id="<?php echo esc_attr( $uid ); ?>-price" class="wrbc-comparison__corner"><span class="wrbc-sr-only"><?php echo $show_prices ? esc_html__( 'Price', 'werun-blocks-community' ) : esc_html__( 'Choose a plan', 'werun-blocks-community' ); ?></span></th>
							<?php list( $cell_class, $cell_style ) = $featured ? $featured_part( 'plain' ) : array( '', '' ); ?>
							<?php foreach ( $plans as $plan ) : ?>
								<?php $is_feat_cell = $featured === $plan['index'] + 1; ?>
								<td headers="<?php echo esc_attr( $uid . '-plan-p' . $plan['index'] . ' ' . $uid . '-price' ); ?>" class="wrbc-comparison__cell wrbc-comparison__foot<?php echo $is_feat_cell ? ' is-featured' . ( $cell_class ? ' ' . esc_attr( $cell_class ) : '' ) : ''; ?>"<?php echo $is_feat_cell ? $cell_style : ''; // phpcs:ignore -- escaped in $part ?>>
									<?php echo $details_html( $plan, 'foot' ); // phpcs:ignore -- escaped in the closure ?>
								</td>
							<?php endforeach; ?>
						</tr>
					</tfoot>
				<?php endif; ?>
			</table>
		</div>

		<?php if ( 'stacked' === $mobile ) : ?>
			<?php
			// The phone cards carry everything the table does (WCAG 1.4.10): the
			// visible caption, a heading per plan and per group, the descriptions.
			$group_level = min( 6, $card_level + 1 );
			if ( wrbc_on( $a, 'showCaption', false ) ) :
				?>
				<p class="wrbc-comparison__cards-caption"><?php echo $caption; // phpcs:ignore -- wp_kses_post / esc_html ?></p>
			<?php endif; ?>
			<?php // Each card paints the table's background (the list itself paints nothing). ?>
			<div class="wrbc-comparison__cards" role="list" aria-labelledby="<?php echo esc_attr( $uid ); ?>-caption">
				<?php foreach ( $plans as $plan ) : ?>
					<?php
					$is_featured = $featured === $plan['index'] + 1;
					$has_badge   = $is_featured && $show_badge && $wrbc_cmp_filled( $plan['badge'] );
					$named       = $wrbc_cmp_filled( $plan['name'] );
					list( $cell_class, $cell_style ) = $is_featured ? $featured_part( 'card' ) : array( $table_class, $table_style );
					?>
					<div class="wrbc-comparison__card<?php echo $is_featured ? ' is-featured' : ''; ?><?php echo $cell_class ? ' ' . esc_attr( $cell_class ) : ''; ?>" role="listitem"<?php echo $cell_style; // phpcs:ignore -- escaped in $part ?>>
						<?php // Every card has its heading: "Plan N", visually hidden, without a name. ?>
						<h<?php echo (int) $card_level; ?> class="wrbc-comparison__card-name<?php echo $named ? '' : ' wrbc-sr-only'; ?>" id="<?php echo esc_attr( $uid . '-card-p' . $plan['index'] ); ?>"><?php echo $named ? wrbc_rich( $plan['name'] ) : esc_html( $plain_name( $plan ) ); // phpcs:ignore -- escaped ?>
							<?php echo $is_featured && ! $has_badge ? $featured_note : ''; // phpcs:ignore -- fixed markup ?>
						</h<?php echo (int) $card_level; ?>>
						<?php // After the heading, so moving by headings doesn't skip it; drawn above it (style.scss). ?>
						<?php if ( $has_badge ) : ?>
							<span class="wrbc-comparison__badge"><?php echo wrbc_rich( $plan['badge'] ); // phpcs:ignore ?></span>
						<?php endif; ?>
						<?php echo $details_html( $plan, 'card' ); // phpcs:ignore -- escaped in the closure ?>
						<?php
						$list_open = false;
						// A group heading is printed with the first line under it: no empty
						// heading, and none above a group whose lines are all left out.
						$pending = '';
						foreach ( $rows as $r => $row ) :
							if ( $row['group'] ) {
								if ( $list_open ) {
									echo '</ul>';
									$list_open = false;
								}
								$pending = $wrbc_cmp_filled( $row['label'] ) ? wrbc_rich( $row['label'] ) : '';
								continue;
							}
							$cell = $row['cells'][ $plan['index'] ];
							if ( ( 'cross' === $cell['type'] && wrbc_on( $a, 'stackedHideExcluded', false ) ) || ! $wrbc_cmp_filled( $row['label'] ) ) {
								continue;
							}
							if ( '' === $cell['type'] || ( 'text' === $cell['type'] && ! $wrbc_cmp_filled( $cell['text'] ) ) ) {
								continue;
							}
							if ( '' !== $pending ) {
								printf( '<h%1$d class="wrbc-comparison__card-group">%2$s</h%1$d>', (int) $group_level, $pending ); // phpcs:ignore -- wp_kses_post
								$pending = '';
							}
							if ( ! $list_open ) {
								echo '<ul class="wrbc-comparison__card-list">';
								$list_open = true;
							}
							$has_desc = $wrbc_cmp_filled( $row['description'] );
							$desc_id  = $uid . '-c' . $plan['index'] . '-d' . $r;
							?>
							<li class="wrbc-comparison__card-item is-<?php echo esc_attr( $cell['type'] ); ?>">
								<?php if ( 'text' !== $cell['type'] ) : ?>
									<?php echo wrbc_icon( $icons[ $cell['type'] ], array( 'class' => 'wrbc-comparison__icon' ) ); // phpcs:ignore ?>
								<?php endif; ?>
								<span class="wrbc-comparison__card-main">
									<span class="wrbc-comparison__label-row">
										<span class="wrbc-comparison__card-label"><?php echo wrbc_rich( $row['label'] ); // phpcs:ignore ?></span>
										<?php echo $has_desc && $desc_toggle ? $tip_html( $row['label'], $desc_id ) : ''; // phpcs:ignore -- escaped in the closure ?>
									</span>
									<?php if ( $has_desc ) : ?>
										<span class="wrbc-comparison__desc" id="<?php echo esc_attr( $desc_id ); ?>"<?php echo $desc_toggle ? ' data-wrbc-tip' : ''; ?>><?php echo wrbc_rich( $row['description'] ); // phpcs:ignore ?></span>
									<?php endif; ?>
								</span>
								<?php if ( 'text' === $cell['type'] || ( 'partial' === $cell['type'] && $wrbc_cmp_filled( $cell['text'] ) ) ) : ?>
									<span class="wrbc-comparison__card-value"><?php echo wrbc_rich( $cell['text'] ); // phpcs:ignore ?></span>
								<?php endif; ?>
								<?php if ( 'text' !== $cell['type'] ) : ?>
									<span class="wrbc-sr-only">(<?php echo esc_html( $status[ $cell['type'] ] ); ?>)</span>
								<?php endif; ?>
							</li>
							<?php
						endforeach;
						if ( $list_open ) {
							echo '</ul>';
						}
						?>
					</div>
				<?php endforeach; ?>
			</div>
		<?php endif; ?>
	</div>
</section>
