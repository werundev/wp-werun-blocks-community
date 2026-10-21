<?php
/**
 * Carousel: front-end markup, on the wrbc-carousel contract
 * (docs/shared-modules.md): options as JSON in data-wrbc-carousel, the
 * scroll-snap track [data-wrbc-track] (swipe and trackpad work without
 * JavaScript) holding the slides [data-wrbc-slide], and the controls the
 * module drives. Thumbnails are this block's own (view.js).
 *
 * @var array    $attributes Block attributes.
 * @var string   $content    Rendered slides.
 * @var WP_Block $block      Block instance.
 *
 * @package werun-blocks-community
 */

defined( 'ABSPATH' ) || exit;

// Runs in its own scope: nothing here becomes a global.
( static function ( $attributes, $content, $block ) {
$a   = $attributes;
$uid = wrbc_uid( $a, 'wrbc-carousel' );
$num = static function ( $value, $min, $max, $fallback ) {
	return max( $min, min( $max, is_numeric( $value ) ? 0 + $value : $fallback ) );
};
$pick = static function ( $value, $allowed, $fallback ) {
	return in_array( $value, $allowed, true ) ? $value : $fallback;
};

$slides = array();
foreach ( $block->inner_blocks as $wrbc_inner ) {
	if ( 'werun-community/slide' === $wrbc_inner->name ) {
		$slides[] = $wrbc_inner;
	}
}
if ( ! $slides ) {
	return; // No slides: nothing to show.
}

$style    = $pick( $a['slideStyle'] ?? '', array( 'plain', 'bordered', 'filled', 'shadow' ), 'filled' );
$valign   = $pick( $a['verticalAlign'] ?? '', array( 'top', 'center', 'bottom' ), 'center' );
$ratio    = $pick( $a['aspectRatio'] ?? '', array( 'auto', '21/9', '16/9', '3/2', '4/3', '1/1', '3/4' ), 'auto' );
$position = 'top' === ( $a['controlsPosition'] ?? '' ) ? 'top' : 'bottom';
// Thumbnails only make sense with two slides or more (edit.js: hasThumbs).
$thumbs = wrbc_on( $a, 'showThumbs', false ) && count( $slides ) > 1;
$min_h  = (int) $num( $a['minHeight'] ?? null, 0, 900, 0 );

// Colours (docs/accessibility.md): what the carousel sits on gives its tone
// (light text and rings in a dark section) and the accent made readable as a
// mark on it (current dot and thumbnail, focus rings).
$surface = wrbc_surface( $a, $block );

$classes = array(
	'wrbc-root',
	'wrbc-carousel',
	'wrbc-carousel--' . $style,
	'wrbc-carousel--valign-' . $valign,
	'wrbc-carousel--controls-' . $position,
	$uid,
	wrbc_tone_class( $surface, wrbc_context_background( $block ) ),
);
if ( $thumbs ) {
	$classes[] = 'has-thumbs';
}

// The carousel's name: the header's title when it really prints one
// (wrbc_section_header() skips an empty one), else the author's label, else
// "n slides" (wrbc_carousel_attrs() with the count). Not "Carousel":
// aria-roledescription already says it ("Carousel, carousel").
$titled = wrbc_on( $a, 'showHeader', false ) && '' !== trim( wp_strip_all_tags( wrbc_text( $a['title'] ?? '' ) ) );

// Region + aria-roledescription, data-wrbc-carousel (options, translated
// labels): includes/modules/carousel.php.
$extra = wrbc_carousel_attrs(
	$a,
	array(
		'label' => trim( wp_strip_all_tags( wrbc_text( $a['label'] ?? '' ) ) ),
		'count' => count( $slides ),
	)
) + array(
	'id'    => $uid,
	'class' => implode( ' ', array_filter( $classes ) ),
	'style' => wrbc_css_vars(
		array_merge(
			// --wrbc-accent, automatic --wrbc-on-accent, --wrbc-accent-text on the surface.
			wrbc_accent_vars( $a, $surface ),
			array(
				// Same ranges as the editor's sliders (ResponsiveColumns with max 4).
				'--wrbc-pv-d'          => (int) $num( $a['columnsDesktop'] ?? null, 1, 4, 1 ),
				'--wrbc-pv-t'          => (int) $num( $a['columnsTablet'] ?? null, 1, 4, 1 ),
				'--wrbc-pv-m'          => (int) $num( $a['columnsMobile'] ?? null, 1, 2, 1 ),
				'--wrbc-gap'           => wrbc_px( $num( $a['gap'] ?? null, 0, 96, 24 ) ),
				'--wrbc-peek'          => wrbc_px( $num( $a['peek'] ?? null, 0, 240, 0 ) ),
				'--wrbc-radius'        => wrbc_px( $num( $a['slideRadius'] ?? null, 0, 48, 16 ) ),
				'--wrbc-slide-pad'     => wrbc_px( $num( $a['slidePadding'] ?? null, 0, 120, 40 ) ),
				'--wrbc-ratio'         => 'auto' === $ratio ? '' : str_replace( '/', ' / ', $ratio ),
				'--wrbc-slide-min-h'   => $min_h ? $min_h . 'px' : '',
				'--wrbc-thumb-size'    => $thumbs ? wrbc_px( $num( $a['thumbSize'] ?? null, 40, 120, 64 ) ) : '',
				// The slides' text and accent on these: slide/render.php (context).
				'--wrbc-slide-bg'      => 'plain' !== $style ? ( $a['slideBg'] ?? '' ) : '',
				// Decoration only (a card's outline), so any colour goes.
				'--wrbc-slide-border'  => 'bordered' === $style ? ( $a['slideBorderColor'] ?? '' ) : '',
			)
		)
	),
);
if ( $titled ) {
	$extra['aria-labelledby'] = $uid . '-title';
	unset( $extra['aria-label'] );
}

/**
 * A slide's title for its thumbnail's name ("Go to slide 2: Our team"): the
 * text of its first heading, else its background image's alt text.
 */
$find_heading = static function ( $blocks ) use ( &$find_heading ) {
	foreach ( $blocks as $wrbc_child ) {
		if ( 'core/heading' === $wrbc_child->name ) {
			$wrbc_text = trim( preg_replace( '/\s+/', ' ', wp_strip_all_tags( (string) ( $wrbc_child->parsed_block['innerHTML'] ?? '' ) ) ) );
			if ( '' !== $wrbc_text ) {
				return $wrbc_text;
			}
		}
		$wrbc_found = $find_heading( $wrbc_child->inner_blocks );
		if ( '' !== $wrbc_found ) {
			return $wrbc_found;
		}
	}
	return '';
};
$title_of = static function ( $slide ) use ( $find_heading ) {
	$wrbc_title = $find_heading( $slide->inner_blocks );
	if ( '' === $wrbc_title ) {
		$wrbc_title = trim( wp_strip_all_tags( wrbc_text( $slide->attributes['bgAlt'] ?? '' ) ) );
	}
	return wp_trim_words( $wrbc_title, 12, '…' );
};

/**
 * The image a thumbnail shows for a slide: its own thumbnail, else its
 * background image, else the first image block inside it. Twin of
 * slideThumb() in edit.js. Returns array( id, url ).
 */
$find_image = static function ( $blocks ) use ( &$find_image ) {
	foreach ( $blocks as $wrbc_child ) {
		if ( in_array( $wrbc_child->name, array( 'core/image', 'core/cover', 'core/media-text' ), true ) ) {
			$wrbc_attrs = $wrbc_child->parsed_block['attrs'] ?? array();
			$wrbc_id    = (int) ( 'core/media-text' === $wrbc_child->name ? ( $wrbc_attrs['mediaId'] ?? 0 ) : ( $wrbc_attrs['id'] ?? 0 ) );
			$wrbc_url   = wrbc_text( $wrbc_attrs['url'] ?? '' );
			if ( ! $wrbc_id && '' === $wrbc_url && preg_match( '/<img[^>]+src="([^"]+)"/', (string) ( $wrbc_child->parsed_block['innerHTML'] ?? '' ), $wrbc_m ) ) {
				$wrbc_url = html_entity_decode( $wrbc_m[1] );
			}
			$wrbc_url = '' !== esc_url( $wrbc_url ) ? $wrbc_url : '';
			if ( $wrbc_id || '' !== $wrbc_url ) {
				return array( $wrbc_id, $wrbc_url );
			}
		}
		$wrbc_found = $find_image( $wrbc_child->inner_blocks );
		if ( $wrbc_found ) {
			return $wrbc_found;
		}
	}
	return null;
};
$thumb_of = static function ( $slide ) use ( $find_image ) {
	$sa = $slide->attributes;
	foreach ( array( array( 'thumbId', 'thumbUrl' ), array( 'bgId', 'bgUrl' ) ) as $keys ) {
		$id  = is_numeric( $sa[ $keys[0] ] ?? null ) ? absint( $sa[ $keys[0] ] ) : 0;
		$url = wrbc_text( $sa[ $keys[1] ] ?? '' );
		$url = '' !== esc_url( $url ) ? $url : '';
		if ( $id || '' !== $url ) {
			return array( $id, $url );
		}
	}
	return $find_image( $slide->inner_blocks );
};

// Pause/play, dots, previous/next, as the module expects them (includes/modules/carousel.php).
$controls = wrbc_carousel_controls(
	array(
		'attributes' => $a,
		'track_id'   => $uid . '-track',
	)
);
?>
<section <?php echo get_block_wrapper_attributes( $extra ); // phpcs:ignore ?>>
	<?php echo wrbc_section_header( $a, $uid ); // phpcs:ignore ?>
	<?php echo 'top' === $position ? $controls : ''; // phpcs:ignore -- escaped above ?>
	<div class="wrbc-carousel__viewport"<?php echo wrbc_on( $a, 'reveal' ) ? ' data-wrbc-reveal' : ''; ?>>
		<?php
		// The track scrolls with the keyboard once focused (arrows, Home, End), so
		// it's a named group in the tab order (a name needs a role). Off-screen
		// slides stay readable and focusable: focusing a link in one scrolls it
		// into view. A single slide has nothing to scroll: no extra tab stop.
		$wrbc_track_a11y = count( $slides ) > 1
			? ' role="group" tabindex="0" aria-label="' . esc_attr__( 'Slides, use the arrow keys to move', 'werun-blocks-community' ) . '"'
			: '';
		?>
		<div class="wrbc-carousel__track" id="<?php echo esc_attr( $uid ); ?>-track" data-wrbc-track<?php echo $wrbc_track_a11y; // phpcs:ignore WordPress.Security.EscapeOutput -- escaped above ?>>
			<?php echo $content; // phpcs:ignore -- rendered inner blocks ?>
		</div>
	</div>
	<?php if ( $thumbs ) : ?>
		<div class="wrbc-carousel__thumbs wrbc-carousel__thumbs--<?php echo 'left' === ( $a['thumbsAlign'] ?? '' ) ? 'left' : 'center'; ?>" role="group" aria-label="<?php esc_attr_e( 'Slide thumbnails', 'werun-blocks-community' ); ?>" data-wrbc-thumbs>
			<?php
			foreach ( $slides as $wrbc_i => $wrbc_slide ) :
				$wrbc_thumb = $thumb_of( $wrbc_slide );
				$wrbc_img   = '';
				if ( $wrbc_thumb && $wrbc_thumb[0] ) {
					$wrbc_img = wp_get_attachment_image(
						$wrbc_thumb[0],
						'thumbnail',
						false,
						array(
							'class'   => 'wrbc-carousel__thumb-img',
							'alt'     => '',
							'loading' => 'lazy',
						)
					);
				}
				if ( '' === $wrbc_img && $wrbc_thumb && '' !== $wrbc_thumb[1] ) {
					$wrbc_img = '<img class="wrbc-carousel__thumb-img" src="' . esc_url( $wrbc_thumb[1] ) . '" alt="" loading="lazy">';
				}
				// The image is decorative (alt=""): the button's name says where it goes.
				$wrbc_title = $title_of( $wrbc_slide );
				$wrbc_name  = '' !== $wrbc_title
					/* translators: 1: slide number, 2: the slide's title */
					? sprintf( __( 'Go to slide %1$d: %2$s', 'werun-blocks-community' ), $wrbc_i + 1, $wrbc_title )
					/* translators: %d: slide number */
					: sprintf( __( 'Go to slide %d', 'werun-blocks-community' ), $wrbc_i + 1 );
				?>
				<button type="button" class="wrbc-carousel__thumb" aria-controls="<?php echo esc_attr( $uid ); ?>-track" aria-label="<?php echo esc_attr( $wrbc_name ); ?>"<?php echo 0 === $wrbc_i ? ' aria-current="true"' : ''; ?>>
					<?php echo '' !== $wrbc_img ? $wrbc_img : '<span class="wrbc-carousel__thumb-num" aria-hidden="true">' . (int) ( $wrbc_i + 1 ) . '</span>'; // phpcs:ignore -- escaped above ?>
				</button>
			<?php endforeach; ?>
		</div>
	<?php endif; ?>
	<?php echo 'top' !== $position ? $controls : ''; // phpcs:ignore -- escaped above ?>
</section>
<?php
} )( $attributes, $content, $block );
