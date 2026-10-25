<?php
/**
 * Accordion / FAQ: front-end markup.
 *
 * The items are native <details> elements. Here, after they rendered, they
 * get this instance's group name (one open at a time, enforced by the
 * browser) and the first one opens if asked; with two columns they split
 * into two column wrappers. Search, expand all and links to a question are
 * view.js (results announced in the status region printed here); without it
 * everything still opens and closes.
 *
 * @var array    $attributes Block attributes.
 * @var string   $content    Rendered items.
 * @var WP_Block $block      Block instance.
 *
 * @package werun-blocks-community
 */

defined( 'ABSPATH' ) || exit;

// Runs in its own scope: nothing here becomes a global.
( static function ( $attributes, $content, $block ) {
$a        = $attributes;
$uid      = wrbc_uid( $a, 'wrbc-accordion' );
$multiple = wrbc_on( $a, 'allowMultiple', false );

// The look. Before 2.0 it was stored in `style`, the supports' attribute
// (src/accordion/legacy.js): content saved before that and not edited since
// still has it there, as a string or spread into the supports' object.
$styles = array( 'separated', 'boxed', 'minimal' );
$look   = $a['accordionStyle'] ?? 'separated';
$raw    = $block->parsed_block['attrs'] ?? array();
if ( ! isset( $raw['accordionStyle'] ) && isset( $raw['style'] ) ) {
	if ( is_string( $raw['style'] ) ) {
		$look = $raw['style'];
	} elseif ( is_array( $raw['style'] ) && isset( $raw['style'][0] ) ) {
		$chars = array_filter( $raw['style'], 'is_int', ARRAY_FILTER_USE_KEY );
		ksort( $chars );
		$look = implode( '', array_map( 'wrbc_text', $chars ) );
	}
}
$look = in_array( $look, $styles, true ) ? $look : 'separated';

// This accordion's own items, not those of an accordion nested in an answer:
// their <details> sit at depth 0 (counting <details>), their panels at 1.
$count = 0;
$depth = 0;
$scan  = new WP_HTML_Tag_Processor( $content );
while ( $scan->next_tag(
	array(
		'tag_name'    => 'DETAILS',
		'tag_closers' => 'visit',
	)
) ) {
	if ( $scan->is_tag_closer() ) {
		$depth = max( 0, $depth - 1 );
		continue;
	}
	if ( 0 === $depth && $scan->has_class( 'wrbc-acc-item__details' ) ) {
		++$count;
	}
	++$depth;
}

// What the accordion sits on: its own background, or the one around it (a
// dark section or group). Text, accent and focus ring follow it
// (docs/accessibility.md).
$surface = wrbc_surface( $a, $block );


// Boxes with an Item background: every item is marked as painting it
// (wrbc-acc-item--bg: answer links take the readable accent) and gets the
// text, accent and focus ring that read on it (wrbc_acc_item_colors(),
// defined by the items' render.php, which runs first). Items with a
// background of their own (Color panel, .has-background) do it themselves.
$item_bg     = wrbc_color_rgba( 'boxed' === $look ? wrbc_text( $a['itemBg'] ?? '' ) : '' );
$item_colors = null;
if ( null !== $item_bg && $item_bg[3] > 0 && function_exists( 'wrbc_acc_item_colors' ) ) {
	$item_colors = wrbc_acc_item_colors( wrbc_text( $a['itemBg'] ), $surface, wrbc_text( $a['accentColor'] ?? '' ) );
	// A text colour picked for the accordion (Color panel) on the items' own
	// background: the closest one to it that reads there, the stored value
	// untouched (docs/accessibility.md, "Colours the author picks"). Without
	// one, the tone class picks white or ink.
	$picked = wrbc_block_colors( $a )['text'];
	if ( '' !== $picked ) {
		$text                         = wrbc_readable_color( $picked, $item_colors['paint'], WERUN_BLOCKS_COMMUNITY_AA_TEXT );
		$item_colors['vars']['color'] = $text;
		// Answers are --wrbc-muted (the text at 76 %, 85 % on dark): the full
		// colour when that would fall under 4.5:1 there.
		$muted    = wrbc_color_rgba( $text );
		$muted[3] = 'wrbc-is-dark' === $item_colors['class'] ? 0.85 : 0.76;
		if ( wrbc_contrast_ratio( $muted, $item_colors['paint'] ) < WERUN_BLOCKS_COMMUNITY_AA_TEXT ) {
			$item_colors['vars']['--wrbc-muted'] = $text;
		}
	}
}

// Two columns: the items split in two halves, each in a column of its own,
// so opening one never moves the others to the other column, and the
// reading order (first column, then second) is the visual one.
$columns = max( 1, min( 2, (int) ( $a['columns'] ?? 1 ) ) );
$split   = 2 === $columns && $count > 1;
$second  = (int) ceil( $count / 2 );
$marker  = 'c' . wp_rand();
// Answers are regions named by their question, unless more than six can be
// open at once: then they'd crowd the landmarks list (WAI-ARIA APG).
$plain = $multiple && $count > 6;

// Group name and first-open, written into this accordion's own <details>:
// those of an accordion nested in an answer keep their own group.
$items = new WP_HTML_Tag_Processor( $content );
$index = 0;
$nth   = 0;
$depth = 0;
while ( $items->next_tag( array( 'tag_closers' => 'visit' ) ) ) {
	$tag = $items->get_tag();
	if ( 'DETAILS' === $tag ) {
		if ( $items->is_tag_closer() ) {
			$depth = max( 0, $depth - 1 );
			continue;
		}
		if ( 0 === $depth && $items->has_class( 'wrbc-acc-item__details' ) ) {
			if ( ! $multiple ) {
				$items->set_attribute( 'name', $uid );
			}
			if ( 0 === $index && wrbc_on( $a, 'firstOpen', true ) ) {
				$items->set_attribute( 'open', true );
			}
			++$index;
		}
		++$depth;
		continue;
	}
	if ( 'DIV' !== $tag || $items->is_tag_closer() ) {
		continue;
	}
	if ( 0 === $depth && $items->has_class( 'wrbc-acc-item' ) ) {
		if ( $split && $nth === $second ) {
			$items->set_attribute( 'data-wrbc-col', $marker );
		}
		++$nth;
		if ( $item_colors && ! $items->has_class( 'has-background' ) ) {
			$items->add_class( 'wrbc-acc-item--bg' );
			if ( '' !== $item_colors['class'] ) {
				$items->add_class( $item_colors['class'] );
			}
			if ( $item_colors['vars'] ) {
				$own_style = $items->get_attribute( 'style' );
				$own_style = is_string( $own_style ) ? rtrim( trim( $own_style ), ';' ) : '';
				$items->set_attribute( 'style', ( '' !== $own_style ? $own_style . ';' : '' ) . wrbc_css_vars( $item_colors['vars'] ) );
			}
		}
	} elseif ( $plain && 1 === $depth && $items->has_class( 'wrbc-acc-item__panel' ) ) {
		$items->remove_attribute( 'role' );
		$items->remove_attribute( 'aria-labelledby' );
	}
}
$content = $items->get_updated_html();

if ( $split ) {
	$attr = ' data-wrbc-col="' . $marker . '"';
	$at   = strpos( $content, $attr );
	$lt   = false === $at ? false : strrpos( substr( $content, 0, $at ), '<' );
	if ( false !== $lt ) {
		$content = '<div class="wrbc-accordion__col">' . substr( $content, 0, $lt ) . '</div><div class="wrbc-accordion__col">'
			. substr_replace( substr( $content, $lt ), '', $at - $lt, strlen( $attr ) ) . '</div>';
	} else {
		$split = false;
	}
}

$tone    = wrbc_tone_class( $surface, wrbc_context_background( $block ) );
$classes = array(
	'wrbc-root',
	'wrbc-accordion',
	'wrbc-accordion--' . $look,
	// No open / close icon: no side either (the answer's indent follows it).
	'wrbc-accordion--icon-' . ( 'none' === ( $a['iconType'] ?? '' ) ? 'none' : ( 'left' === ( $a['iconPosition'] ?? '' ) ? 'left' : 'right' ) ),
	$uid,
	$tone,
);
// The accent as text sits on the surface and, in Boxes without an Item
// background, on the items' 4 % tint of the text colour (--wrbc-surface): made
// readable on the tint, it reads on the surface too (the tint only moves the
// background further from it). Twin: src/accordion/edit.js.
$accent_bg = $surface;
if ( 'boxed' === $look && ! $item_colors ) {
	$ink  = wrbc_block_colors( $a )['text'];
	$ink  = wrbc_color_rgba( '' !== $ink ? $ink : ( true === wrbc_is_dark_color( $surface ) ? '#ffffff' : '#000000' ) );
	$base = wrbc_color_rgba( $surface );
	if ( null !== $ink && null !== $base ) {
		$ink[3]    = 0.04;
		$accent_bg = wrbc_color_hex( wrbc_color_over( $ink, $base ) );
	}
}
$accent_vars = wrbc_accent_vars( $a, $accent_bg );

// Numbers within the editor's ranges (src/accordion/edit.js).
$num   = static function ( $key, $min, $max ) use ( $a ) {
	return isset( $a[ $key ] ) && is_numeric( $a[ $key ] ) ? max( $min, min( $max, 0 + $a[ $key ] ) ) : '';
};
$extra = array(
	'id'                 => $uid,
	'class'              => implode( ' ', array_filter( $classes ) ),
	'data-wrbc-accordion' => $multiple ? 'multiple' : 'single',
	'style'              => wrbc_css_vars(
		array_merge(
			// The accent, and the accent as text (icons, eyebrow, links, focus
			// ring) made readable where it sits.
			$accent_vars,
			array(
				'--wrbc-acc-cols'    => $columns,
				'--wrbc-gap'         => wrbc_px( $num( 'gap', 0, 40 ) ),
				'--wrbc-item-bg'     => 'boxed' === $look ? ( $a['itemBg'] ?? '' ) : '',
				'--wrbc-item-border' => 'minimal' !== $look ? ( $a['itemBorderColor'] ?? '' ) : '',
				'--wrbc-radius'      => wrbc_px( $num( 'radius', 0, 32 ) ),
				'--wrbc-icon-size'   => wrbc_px( $num( 'iconSize', 12, 32 ) ),
				'--wrbc-icon-stroke' => $num( 'iconStroke', 1, 3 ),
			)
		)
	),
);
// Same test as wrbc_section_header(): a title with text.
if ( wrbc_on( $a, 'showHeader' ) && '' !== trim( wp_strip_all_tags( wrbc_text( $a['title'] ?? '' ) ) ) ) {
	$extra['aria-labelledby'] = $uid . '-title';
}
// Texts the visitor needs even when the fields were emptied.
$search_label = trim( wrbc_text( $a['searchPlaceholder'] ?? '' ) );
$search_label = '' !== $search_label ? $search_label : __( 'Search the questions', 'werun-blocks-community' );
$no_results   = trim( wrbc_text( $a['noResults'] ?? '' ) );
$no_results   = '' !== $no_results ? $no_results : __( 'No question matches that search.', 'werun-blocks-community' );

$search     = wrbc_on( $a, 'showSearch', false );
$expand_all = $multiple && wrbc_on( $a, 'showExpandAll', false );
$tools      = $search || $expand_all;
// What view.js announces (status region): the number of questions a search
// leaves, with each count's own plural, and what expand / collapse all did.
if ( $tools ) {
	$found = array();
	for ( $n = 1; $n <= $count; $n++ ) {
		/* translators: %d: number of questions that match the search. */
		$found[] = sprintf( _n( '%d question found.', '%d questions found.', $n, 'werun-blocks-community' ), $n );
	}
	$extra['data-wrbc-acc-labels'] = wp_json_encode(
		array(
			'found'  => $found,
			'none'   => $no_results,
			'all'    => __( 'All questions are shown.', 'werun-blocks-community' ),
			'opened' => __( 'All answers are open.', 'werun-blocks-community' ),
			'closed' => __( 'All answers are closed.', 'werun-blocks-community' ),
		)
	);
}
?>
<section <?php echo get_block_wrapper_attributes( $extra ); // phpcs:ignore ?>>
	<?php echo wrbc_section_header( $a, $uid ); // phpcs:ignore ?>

	<?php if ( $tools ) : ?>
		<div class="wrbc-accordion__tools">
			<?php if ( $search ) : ?>
				<div class="wrbc-accordion__search">
					<label class="wrbc-sr-only" for="<?php echo esc_attr( $uid ); ?>-search"><?php echo esc_html( $search_label ); ?></label>
					<?php echo wrbc_icon( 'search', array( 'class' => 'wrbc-accordion__search-icon' ) ); // phpcs:ignore ?>
					<input type="search" id="<?php echo esc_attr( $uid ); ?>-search" class="wrbc-accordion__input" placeholder="<?php echo esc_attr( wrbc_text( $a['searchPlaceholder'] ?? '' ) ); ?>" autocomplete="off" data-wrbc-acc-search>
				</div>
			<?php endif; ?>
			<?php if ( $expand_all ) : ?>
				<div class="wrbc-accordion__all">
					<button type="button" class="wrbc-btn wrbc-btn--outline wrbc-accordion__all-btn" data-wrbc-acc-all="open"><?php esc_html_e( 'Expand all', 'werun-blocks-community' ); ?></button>
					<button type="button" class="wrbc-btn wrbc-btn--outline wrbc-accordion__all-btn" data-wrbc-acc-all="close"><?php esc_html_e( 'Collapse all', 'werun-blocks-community' ); ?></button>
				</div>
			<?php endif; ?>
		</div>
	<?php endif; ?>

	<div class="wrbc-accordion__list<?php echo $split ? ' wrbc-accordion__list--split' : ''; ?>">
		<?php echo $content; // phpcs:ignore -- rendered inner blocks ?>
	</div>
	<?php if ( $search ) : ?>
		<p class="wrbc-accordion__empty" hidden data-wrbc-acc-empty><?php echo esc_html( $no_results ); ?></p>
	<?php endif; ?>
	<?php if ( $tools ) : ?>
		<p class="wrbc-sr-only" role="status" data-wrbc-acc-status></p>
	<?php endif; ?>

	<?php
	// FAQPage structured data from the questions and their answers. The
	// answers render again here, so an accordion rendered for another one's
	// schema adds none of its own: nesting can't multiply the work.
	if ( wrbc_on( $a, 'faqSchema', false ) && ! wrbc_in_faq_schema() ) {
		wrbc_in_faq_schema( true );
		$entities = array();
		foreach ( $block->inner_blocks as $item ) {
			if ( 'werun-community/accordion-item' !== $item->name ) {
				continue;
			}
			$question = trim( wp_strip_all_tags( wrbc_text( $item->attributes['question'] ?? '' ) ) );
			$answer   = '';
			foreach ( $item->inner_blocks as $part ) {
				$answer .= $part->render();
			}
			$answer = trim( preg_replace( '/\s+/', ' ', wp_strip_all_tags( $answer ) ) );
			if ( '' !== $question && '' !== $answer ) {
				$entities[] = array(
					'@type'          => 'Question',
					'name'           => $question,
					'acceptedAnswer' => array(
						'@type' => 'Answer',
						'text'  => $answer,
					),
				);
			}
		}
		wrbc_in_faq_schema( false );
		if ( $entities ) {
			printf(
				'<script type="application/ld+json">%s</script>',
				wp_json_encode(
					array(
						'@context'   => 'https://schema.org',
						'@type'      => 'FAQPage',
						'mainEntity' => $entities,
					),
					JSON_HEX_TAG | JSON_HEX_AMP
				)
			);
		}
	}
	?>
</section>
<?php
} )( $attributes, $content, $block );
