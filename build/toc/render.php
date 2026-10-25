<?php
/**
 * Table of contents: links to the headings of the current post.
 *
 * The headings and their ids come from Werun\BlocksCommunity\Toc\Toc (includes/toc/),
 * which also writes the generated ids into the headings as they render.
 * view.js adds smooth scrolling, the highlight of the section in view and
 * the dropdown behaviour on phones; without it the links still jump and
 * the <details> still opens and closes.
 *
 * @var array    $attributes Block attributes.
 * @var string   $content    Unused (no inner blocks).
 * @var WP_Block $block      Block instance.
 *
 * @package werun-blocks-community
 */

defined( 'ABSPATH' ) || exit;

// Runs in its own scope: nothing here becomes a global.
( static function ( $attributes, $content, $block ) {
if ( ! class_exists( '\Werun\BlocksCommunity\Toc\Toc' ) ) {
	return;
}

$a       = $attributes;
$post_id = isset( $block->context['postId'] ) ? (int) $block->context['postId'] : (int) get_the_ID();
if ( ! $post_id ) {
	return;
}
\Werun\BlocksCommunity\Toc\Toc::mark_rendered();

// Effective options. Twin: src/toc/headings.js (effective()).
$min_level = max( 2, min( 6, (int) ( $a['minLevel'] ?? 2 ) ) );
$max_level = max( $min_level, min( 6, (int) ( $a['maxLevel'] ?? 3 ) ) );
$toc_style = in_array( $a['tocStyle'] ?? '', array( 'list', 'numbered', 'pills' ), true ) ? $a['tocStyle'] : 'list';
$numbering = in_array( $a['numberStyle'] ?? '', array( 'decimal', 'nested', 'leading-zero' ), true ) ? $a['numberStyle'] : 'nested';
$depth     = 'pills' === $toc_style ? 1 : max( 1, min( $max_level - $min_level + 1, (int) ( $a['maxDepth'] ?? 2 ) ) );
$sticky    = wrbc_on( $a, 'sticky', false );
$offset    = $sticky ? max( 0, min( 200, (int) ( $a['stickyOffset'] ?? 32 ) ) ) : 0;
$collapse  = wrbc_on( $a, 'collapsible', false );
$title     = wrbc_rich( $a['title'] ?? '' );
if ( '' === trim( wp_strip_all_tags( $title ) ) ) {
	$title = $collapse ? esc_html__( 'On this page', 'werun-blocks-community' ) : '';
}
$has_title = '' !== $title && ( $collapse || wrbc_on( $a, 'showTitle', true ) );

$items = array();
foreach ( \Werun\BlocksCommunity\Toc\Toc::headings( $post_id ) as $heading ) {
	if ( ! $heading['skip'] && '' !== $heading['id'] && $heading['level'] >= $min_level && $heading['level'] <= $max_level ) {
		$heading['rel'] = min( $depth - 1, $heading['level'] - $min_level );
		$items[]        = $heading;
	}
}
if ( ! $items ) {
	return;
}

$uid = wrbc_uid( $a, 'wrbc-toc' );
$tag = 'numbered' === $toc_style ? 'ol' : 'ul';

// Nested lists from relative levels. A heading never opens more than one
// level at a time, so a jump (h2 → h4) nests once and the markup stays valid.
// Twin: buildTree() in src/toc/headings.js.
$list = '';
$open = 0;
foreach ( $items as $item ) {
	$level = min( $item['rel'], $open );
	if ( 0 === $open ) {
		$list .= '<' . $tag . ' class="wrbc-toc__list" role="list">';
		$open  = 1;
	} elseif ( $level + 1 > $open ) {
		$list .= '<' . $tag . ' class="wrbc-toc__list wrbc-toc__list--sub" role="list">';
		++$open;
	} else {
		$list .= '</li>';
		while ( $open > $level + 1 ) {
			$list .= '</' . $tag . '></li>';
			--$open;
		}
	}
	$list .= sprintf(
		'<li class="wrbc-toc__item wrbc-toc__item--h%1$d"><a class="wrbc-toc__link" href="#%2$s">%3$s</a>',
		(int) $item['level'],
		esc_attr( rawurlencode( $item['id'] ) ),
		esc_html( $item['text'] )
	);
}
while ( $open > 0 ) {
	$list .= '</li></' . $tag . '>';
	--$open;
}

// What the list sits on: its own background, or the one around it (a dark
// section, group or sidebar). Text, accent and focus ring follow it
// (docs/accessibility.md). Twin: src/toc/edit.js.
$surface = wrbc_surface( $a, $block );

$classes = array(
	'wrbc-root',
	'wrbc-toc',
	'wrbc-toc--' . $toc_style,
	'numbered' === $toc_style ? 'wrbc-toc--num-' . $numbering : '',
	$sticky ? 'wrbc-toc--sticky' : '',
	$collapse ? 'wrbc-toc--collapsible' : '',
	$uid,
	wrbc_tone_class( $surface, wrbc_context_background( $block ) ),
);
$extra   = array(
	'id'          => $uid,
	'class'       => implode( ' ', array_filter( $classes ) ),
	'style'       => wrbc_css_vars(
		array_merge(
			// The accent (current pill), the text on it, and the accent as
			// current link, numbers and focus ring, readable on the surface.
			wrbc_accent_vars( $a, $surface ),
			array( '--wrbc-toc-top' => $sticky ? wrbc_px( $offset ) : '' )
		)
	),
	'data-wrbc-toc' => wp_json_encode(
		array(
			'highlight'   => wrbc_on( $a, 'highlight', true ),
			'smooth'      => wrbc_on( $a, 'smoothScroll', true ),
			'offset'      => $offset,
			'collapsible' => $collapse,
		)
	),
);
if ( $has_title ) {
	$extra['aria-labelledby'] = $uid . '-title';
} else {
	$extra['aria-label'] = __( 'Table of contents', 'werun-blocks-community' );
}
?>
<nav <?php echo get_block_wrapper_attributes( $extra ); // phpcs:ignore ?>>
	<?php if ( $collapse ) : ?>
		<details class="wrbc-toc__details" open data-wrbc-toc-details>
			<summary class="wrbc-toc__title wrbc-toc__summary" id="<?php echo esc_attr( $uid ); ?>-title">
				<span class="wrbc-toc__title-text"><?php echo $title; // phpcs:ignore -- wrbc_rich() / esc_html() ?></span>
				<?php echo wrbc_icon( 'chevron-down', array( 'class' => 'wrbc-toc__chevron' ) ); // phpcs:ignore ?>
			</summary>
			<div class="wrbc-toc__body"><?php echo $list; // phpcs:ignore -- built from escaped parts ?></div>
		</details>
	<?php else : ?>
		<?php if ( $has_title ) : ?>
			<p class="wrbc-toc__title" id="<?php echo esc_attr( $uid ); ?>-title"><?php echo $title; // phpcs:ignore -- wrbc_rich() ?></p>
		<?php endif; ?>
		<div class="wrbc-toc__body"><?php echo $list; // phpcs:ignore -- built from escaped parts ?></div>
	<?php endif; ?>
</nav>
<?php
} )( $attributes, $content, $block );
