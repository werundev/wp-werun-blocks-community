<?php
/**
 * Testimonials: front-end markup. As a carousel, the track is a native
 * scroll-snap row (swipe and trackpad work without JavaScript); the shared
 * wrbc-carousel module adds the arrows, the dots, autoplay and the slide
 * labels (data attributes and controls from includes/modules/carousel.php).
 * The wrbc-testimonials__* classes stay next to the shared wrbc-carousel__*
 * ones, so custom CSS written for 1.x keeps working.
 *
 * Source "manual": the cards are the werun-community/testimonial inner blocks ($content).
 * Source "query": one card per post of the query (query.php), with the same
 * card markup (src/testimonial/card.php); the inner blocks are kept but not printed.
 *
 * @var array    $attributes Block attributes.
 * @var string   $content    Rendered testimonials.
 * @var WP_Block $block      Block instance.
 *
 * @package werun-blocks-community
 */

defined( 'ABSPATH' ) || exit;

// Runs in its own scope: nothing here becomes a global.
( static function ( $attributes, $content, $block ) {
$a = $attributes;

require_once dirname( __DIR__ ) . '/testimonial/card.php';
// What the block sits on (its own background, or the section/group around it): its tone
// class, the accent readable there, and what the cards and their stars sit on (card.php).
$wrbc_surface = wrbc_surface( $a, $block );
$wrbc_colors  = wrbc_testimonial_colors( array_merge( $a, array( 'surface' => $wrbc_surface ) ) );

$wrbc_dynamic = 'query' === ( $a['source'] ?? 'manual' );
if ( $wrbc_dynamic ) {
	require_once __DIR__ . '/query.php';
	// The post the block is shown on (for "leave out the post being viewed").
	$wrbc_post_id = isset( $block->context['postId'] ) ? absint( $block->context['postId'] ) : 0;
	if ( ! $wrbc_post_id && is_singular() ) {
		$wrbc_post_id = (int) get_queried_object_id();
	}
	// The editor's preview (/wp/v2/block-renderer, which checked edit_post) sets up the post being edited.
	if ( ! $wrbc_post_id && defined( 'REST_REQUEST' ) && REST_REQUEST ) {
		$wrbc_post_id = (int) get_the_ID();
	}
	$wrbc_cards = wrbc_testimonials_query( $a, $wrbc_post_id, $wrbc_surface );
	$content   = $wrbc_cards['html'];
	$wrbc_empty = sanitize_text_field( wrbc_text( $a['emptyText'] ?? '' ) );
	// Nothing matches and nothing to say: no section with a header and no quotes.
	if ( ! $wrbc_cards['count'] && '' === $wrbc_empty ) {
		return;
	}
}

$uid      = wrbc_uid( $a, 'wrbc-testimonials' );
$carousel = 'grid' !== $a['layout'];
// From a post type with nothing to show, the block prints only its text for that case:
// no track, so no carousel role, options or controls either.
$wrbc_track = ! ( $wrbc_dynamic && ! $wrbc_cards['count'] );

$classes = array(
	'wrbc-root',
	'wrbc-testimonials',
	'wrbc-testimonials--' . ( $carousel ? 'carousel' : 'grid' ),
	'wrbc-testimonials--' . sanitize_html_class( $a['cardStyle'] ),
	'wrbc-testimonials--align-' . ( 'center' === $a['contentAlign'] ? 'center' : 'left' ),
	'wrbc-testimonials--controls-' . ( 'top' === $a['controlsPosition'] ? 'top' : 'bottom' ),
	$carousel ? 'wrbc-carousel wrbc-carousel--controls-' . ( 'top' === $a['controlsPosition'] ? 'top' : 'bottom' ) : '',
	// Autoplay keeps the quote icons still (style.scss): every step would start a new animation.
	$carousel && wrbc_on( $a, 'autoplay', false ) ? 'wrbc-testimonials--autoplay' : '',
	wrbc_tone_class( $wrbc_surface, wrbc_context_background( $block ) ),
	$uid,
);
$cols = array(
	'd' => max( 1, min( 4, (int) $a['columnsDesktop'] ) ),
	// Same ranges as the editor's sliders (ResponsiveColumns with max 4).
	't' => max( 1, min( 4, (int) $a['columnsTablet'] ) ),
	'm' => max( 1, min( 2, (int) $a['columnsMobile'] ) ),
);

$extra = array(
	'id'    => $uid,
	'class' => implode( ' ', array_filter( $classes ) ),
	'style' => wrbc_css_vars(
		array_merge(
			array(
				'--wrbc-cols-d'      => $cols['d'],
				'--wrbc-cols-t'      => $cols['t'],
				'--wrbc-cols-m'      => $cols['m'],
				// Slides per view of the shared carousel track (assets/modules.css).
				'--wrbc-pv-d'        => $carousel ? $cols['d'] : '',
				'--wrbc-pv-t'        => $carousel ? $cols['t'] : '',
				'--wrbc-pv-m'        => $carousel ? $cols['m'] : '',
				'--wrbc-gap'         => wrbc_px( $a['gap'] ),
				// The stars at 3:1 on the cards (a card with a background of its own prints its own).
				'--wrbc-star'        => $wrbc_colors['star'],
				'--wrbc-card-bg'     => $a['cardBg'] ?? '',
				'--wrbc-card-border' => $a['cardBorderColor'] ?? '',
				'--wrbc-radius'      => wrbc_px( $a['cardRadius'] ),
				'--wrbc-icon-size'   => wrbc_px( $a['iconSize'] ),
				'--wrbc-icon-stroke' => $a['iconStroke'],
			),
			// --wrbc-accent, its automatic on-colour, and --wrbc-accent-text readable where it's used:
			// the surface, and the cards' 4 % tint when they're filled (links in the role line).
			wrbc_accent_vars( $a, '' !== $wrbc_colors['bg'] ? $wrbc_surface : $wrbc_colors['under'] )
		)
	),
);
if ( $carousel && $wrbc_track ) {
	// role="region", aria-roledescription "carousel" and the name "Testimonials" for a
	// carousel without a title (named after what it holds, not "Carousel" or "4 slides").
	$extra = array_merge( $extra, wrbc_carousel_attrs( $a, array( 'label' => __( 'Testimonials', 'werun-blocks-community' ) ) ) );
}
// Labelled by its title only when wrbc_section_header() prints one (same test: a title of
// tags only, or of the wrong type, prints nothing); aria-labelledby wins over that name.
if ( wrbc_on( $a, 'showHeader' ) && '' !== trim( wp_strip_all_tags( wrbc_text( $a['title'] ?? '' ) ) ) ) {
	$extra['aria-labelledby'] = $uid . '-title';
}

// Without arrows and dots a mouse can't reach the slides out of view (the track hides its
// scrollbar): the arrows show then. They hide with the rest of the row while every slide
// fits (wrbc-carousel: .is-static). Twin: navAttributes in edit.js.
$wrbc_nav = $a;
if ( ! wrbc_on( $a, 'showArrows' ) && ! wrbc_on( $a, 'showDots' ) ) {
	$wrbc_nav['showArrows'] = true;
}
$controls = $carousel && $wrbc_track
	? wrbc_carousel_controls(
		array(
			'attributes' => $wrbc_nav,
			'track_id'   => $uid . '-track',
			'prefix'     => 'wrbc-testimonials',
		)
	)
	: '';
?>
<section <?php echo get_block_wrapper_attributes( $extra ); // phpcs:ignore ?>>
	<?php echo wrbc_section_header( $a, $uid ); // phpcs:ignore ?>
	<?php echo 'top' === $a['controlsPosition'] ? $controls : ''; // phpcs:ignore ?>
	<?php if ( ! $wrbc_track ) : // Same whitespace as 1.x around the viewport. ?><p class="wrbc-testimonials__empty"><?php echo esc_html( $wrbc_empty ); ?></p>
<?php else : ?><div class="wrbc-testimonials__viewport">
		<?php
		// A list of cards (each card is a <li>, card.php); role="list" because list-style: none
		// drops the list in Safari. As a carousel the track scrolls with the keyboard: a Tab
		// stop, named (the list role lets the name be read; wrbc-carousel drops the Tab stop
		// when every slide has a link or button of its own).
		?>
		<ul class="wrbc-testimonials__track<?php echo $carousel ? ' wrbc-carousel__track' : ''; ?>" id="<?php echo esc_attr( $uid ); ?>-track" role="list"<?php echo $carousel ? ' data-wrbc-track tabindex="0" aria-label="' . esc_attr__( 'Testimonials, use the arrow keys to move', 'werun-blocks-community' ) . '"' : ''; ?>>
			<?php echo $content; // phpcs:ignore -- rendered inner blocks, or the query's cards (escaped in card.php) ?>
		</ul>
	</div>
<?php endif; ?>
	<?php echo 'top' !== $a['controlsPosition'] ? $controls : ''; // phpcs:ignore ?>
</section>
<?php
} )( $attributes, $content, $block );
