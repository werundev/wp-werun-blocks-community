<?php
/**
 * Query: front-end markup. Everything below the section header comes from
 * Werun\BlocksCommunity\Query\Renderer, the same code the editor preview and the
 * public REST route print (includes/query/).
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
if ( ! class_exists( '\Werun\BlocksCommunity\Query\Renderer' ) ) {
	return;
}

$a   = is_array( $attributes ) ? $attributes : array();
$uid = wrbc_uid( $a, 'wrbc-query' );

// The post the block is shown on: the loop's post (query loops, single
// templates), else the queried singular object; 0 on archives.
$wrbc_post_id = isset( $block->context['postId'] ) ? absint( $block->context['postId'] ) : 0;
if ( ! $wrbc_post_id && is_singular() ) {
	$wrbc_post_id = (int) get_queried_object_id();
}

$built = \Werun\BlocksCommunity\Query\Renderer::build(
	$a,
	array(
		'postId' => $wrbc_post_id,
		'uid'    => $uid,
	)
);
$view  = $built['view'];

foreach ( \Werun\BlocksCommunity\Query\Renderer::modules( $view ) as $wrbc_handle ) {
	wp_enqueue_script( $wrbc_handle );
}
if ( $built['token'] || 'carousel' === $view['layout'] || 'map' === $view['layout'] ) {
	wp_enqueue_style( 'wrbc-modules' );
}

// What the block sits on: its own background (Color panel), or the one
// around it (a dark section or group). Its text, accent and focus ring follow
// it, and the cards follow their own background (docs/accessibility.md).
// Twin in edit.js (useSurface(), cardColors()).
$surface = wrbc_surface( $a, $block );
$cards   = \Werun\BlocksCommunity\Query\Renderer::card_colors( $a, $view['card']['style'], $surface );

$layout  = $view['layout'];
$classes = array(
	'wrbc-root',
	'wrbc-query',
	'wrbc-query--' . $layout,
	'wrbc-query--' . $view['card']['style'],
	'wrbc-query--variant-' . $view['variant'],
	'wrbc-query--link-' . $view['card']['link'],
	$uid,
	wrbc_tone_class( $surface, wrbc_context_background( $block ) ),
	$cards['class'],
);

$extra = array(
	'id'    => $uid,
	'class' => implode( ' ', array_filter( $classes ) ),
	'style' => wrbc_css_vars(
		array_merge(
			// The accent, its automatic on-colour, and the accent as text (terms,
			// links, focus ring) made readable on the surface when it needs to be.
			wrbc_accent_vars( $a, $surface ),
			array(
				'--wrbc-cols-d'      => $view['cols'][0],
				'--wrbc-cols-t'      => $view['cols'][1],
				'--wrbc-cols-m'      => $view['cols'][2],
				'--wrbc-gap'         => wrbc_px( isset( $a['gap'] ) ? max( 0, min( 64, (int) $a['gap'] ) ) : '' ),
				'--wrbc-card-bg'     => $a['cardBg'] ?? '',
				'--wrbc-card-border' => $a['cardBorderColor'] ?? '',
				'--wrbc-radius'      => wrbc_px( isset( $a['cardRadius'] ) ? max( 0, min( 40, (int) $a['cardRadius'] ) ) : '' ),
				'--wrbc-marker'      => $view['map']['markerColor'],
			),
			$cards['vars']
		)
	),
);
// Only when wrbc_section_header() prints the title (same test: tags stripped).
if ( \Werun\BlocksCommunity\Query\Renderer::header_level( $a ) ) {
	$extra['aria-labelledby'] = $uid . '-title';
}
if ( $built['token'] ) {
	$extra['data-wrbc-query'] = wp_json_encode(
		array(
			'c'          => $built['token'],
			'key'        => $built['key'],
			'endpoint'   => esc_url_raw( rest_url( 'wrbc/v1/query' ) ),
			'pagination' => $view['pagination'],
			'labels'     => array(
				/* translators: %d: number of results */
				'results' => __( '%d results', 'werun-blocks-community' ),
				'one'     => __( '1 result', 'werun-blocks-community' ),
				'none'    => __( 'No results', 'werun-blocks-community' ),
				'loading' => __( 'Loading…', 'werun-blocks-community' ),
				'error'   => __( 'Could not load the results. Try again.', 'werun-blocks-community' ),
				/* translators: 1: items just added, 2: items shown now, 3: all results */
				'more'    => __( '%1$d more loaded, %2$d of %3$d shown.', 'werun-blocks-community' ),
			),
		)
	);
}
?>
<section <?php echo get_block_wrapper_attributes( $extra ); // phpcs:ignore ?>>
	<?php echo wrbc_section_header( $a, $uid ); // phpcs:ignore ?>
	<?php echo $built['html']; // phpcs:ignore -- escaped by Renderer ?>
</section>
<?php
} )( $attributes, $content, $block );
