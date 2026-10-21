<?php
/**
 * Carousel markup every carousel block shares (testimonials, carousel,
 * logos, query…), so the attributes and buttons always match what
 * src/shared/view/carousel.js reads and assets/modules.css draws.
 *
 * Attributes, named like testimonials' (CarouselPanel in
 * src/shared/controls-extra.js edits them): loop, autoplay, interval
 * (seconds, 2–20), pauseOnHover, showArrows, showDots, controlsPosition
 * (top | bottom), prevIcon, nextIcon.
 *
 * @package werun-blocks-community
 */

defined( 'ABSPATH' ) || exit;

if ( ! function_exists( 'wrbc_carousel_attrs' ) ) {
	/**
	 * Wrapper attributes for a carousel root: role, aria-roledescription, a
	 * fallback name and data-wrbc-carousel (options and translated labels as
	 * JSON). Merge them into get_block_wrapper_attributes().
	 *
	 * The root is a region described as a carousel (WAI-ARIA APG carousel
	 * pattern; docs/accessibility.md): named by the block's title when it
	 * prints one (the block adds aria-labelledby, which wins over the fallback
	 * aria-label), otherwise by `label` (what the slides are, e.g.
	 * "Testimonials"), otherwise by the number of slides ("4 slides": with
	 * the role description a screen reader says "4 slides, carousel", not
	 * "Carousel, carousel"). Without `count` the name says "Carousel" until
	 * wrbc-carousel counts the slides (options.autoName).
	 *
	 * @param array $a    Block attributes.
	 * @param array $args {
	 *     Optional.
	 *
	 *     @type string $label The fallback accessible name, e.g. __( 'Testimonials', 'werun-blocks-community' ).
	 *     @type int    $count Number of slides, for the "%d slides" name.
	 * }
	 * @return array Attribute => value (unescaped: get_block_wrapper_attributes() escapes).
	 */
	function wrbc_carousel_attrs( $a, $args = array() ) {
		$a     = is_array( $a ) ? $a : array();
		$args  = is_array( $args ) ? $args : array();
		$label = trim( wp_strip_all_tags( wrbc_text( $args['label'] ?? '' ) ) );
		$count = isset( $args['count'] ) && is_numeric( $args['count'] ) ? max( 0, (int) $args['count'] ) : 0;
		$auto  = '' === $label;
		if ( $auto ) {
			$label = $count > 0
				/* translators: %d: number of slides */
				? sprintf( _n( '%d slide', '%d slides', $count, 'werun-blocks-community' ), $count )
				: __( 'Carousel', 'werun-blocks-community' );
		}
		return array(
			'role'                 => 'region',
			'aria-roledescription' => __( 'carousel', 'werun-blocks-community' ),
			'aria-label'           => $label,
			'data-wrbc-carousel'    => wp_json_encode(
				array(
					'loop'         => wrbc_on( $a, 'loop', true ),
					'autoplay'     => wrbc_on( $a, 'autoplay', false ),
					// Same range as CarouselPanel's slider.
					'interval'     => max( 2, min( 20, is_numeric( $a['interval'] ?? null ) ? (float) $a['interval'] : 6 ) ),
					'pauseOnHover' => wrbc_on( $a, 'pauseOnHover', true ),
					// The name above is a fallback: wrbc-carousel keeps it as "n slides".
					'autoName'     => $auto,
					'labels'       => array(
						'carousel'   => $label,
						'slide'      => __( 'slide', 'werun-blocks-community' ),
						/* translators: %d: slide number */
						'dotLabel'   => __( 'Go to slide %d', 'werun-blocks-community' ),
						/* translators: 1: slide number, 2: number of slides */
						'slideLabel' => __( '%1$d of %2$d', 'werun-blocks-community' ),
						/* translators: 1: slide number, 2: number of slides. Announced after the visitor moves the carousel. */
						'current'    => __( 'Slide %1$d of %2$d', 'werun-blocks-community' ),
						// The track's name when it is a Tab stop and the block printed none.
						'track'      => __( 'Slides, use the arrow keys to move', 'werun-blocks-community' ),
						'play'       => __( 'Play the slides', 'werun-blocks-community' ),
						'pause'      => __( 'Pause the slides', 'werun-blocks-community' ),
					),
				)
			),
		);
	}
}

if ( ! function_exists( 'wrbc_carousel_has_controls' ) ) {
	/**
	 * Whether the controls row exists: arrows, dots or autoplay (its pause
	 * button). Twin of hasControls in CarouselPanel.
	 *
	 * @param array $a Block attributes.
	 */
	function wrbc_carousel_has_controls( $a ) {
		$a = is_array( $a ) ? $a : array();
		return wrbc_on( $a, 'showArrows' ) || wrbc_on( $a, 'showDots' ) || wrbc_on( $a, 'autoplay', false );
	}
}

if ( ! function_exists( 'wrbc_carousel_controls' ) ) {
	/**
	 * The controls row: pause/play (with autoplay), dots, previous / next.
	 * Every element gets the shared wrbc-carousel__* class plus, with
	 * `prefix`, the block's own (`wrbc-testimonials` → wrbc-testimonials__btn),
	 * so a block's CSS keeps working.
	 *
	 * @param array $args {
	 *     @type array  $attributes Block attributes (showArrows, showDots, autoplay, prevIcon, nextIcon).
	 *     @type string $track_id   Id of the [data-wrbc-track] element (aria-controls).
	 *     @type string $prefix     The block's class prefix, e.g. "wrbc-testimonials".
	 *     @type string $label      Accessible name of the dots group.
	 * }
	 * @return string Markup, or '' when there are no controls.
	 */
	function wrbc_carousel_controls( array $args ) {
		$a = isset( $args['attributes'] ) && is_array( $args['attributes'] ) ? $args['attributes'] : array();
		if ( ! wrbc_carousel_has_controls( $a ) ) {
			return '';
		}
		$prefix   = sanitize_html_class( wrbc_text( $args['prefix'] ?? '' ) );
		$cls      = function ( $element ) use ( $prefix ) {
			return 'wrbc-carousel__' . $element . ( '' !== $prefix ? ' ' . $prefix . '__' . $element : '' );
		};
		$track_id = preg_replace( '/[^A-Za-z0-9_:.-]/', '', wrbc_text( $args['track_id'] ?? '' ) );
		$controls = '' !== $track_id ? ' aria-controls="' . esc_attr( $track_id ) . '"' : '';
		// An unknown icon name renders nothing: fall back to the default arrow, never an empty button.
		$prev_svg = isset( $a['prevIcon'] ) && is_array( $a['prevIcon'] ) ? wrbc_icon( $a['prevIcon'] ) : '';
		$next_svg = isset( $a['nextIcon'] ) && is_array( $a['nextIcon'] ) ? wrbc_icon( $a['nextIcon'] ) : '';
		$prev_svg = '' !== $prev_svg ? $prev_svg : wrbc_icon( 'arrow-left' );
		$next_svg = '' !== $next_svg ? $next_svg : wrbc_icon( 'arrow-right' );

		ob_start();
		?>
		<div class="<?php echo esc_attr( $cls( 'controls' ) ); ?>">
			<?php if ( wrbc_on( $a, 'autoplay', false ) ) : ?>
				<?php // The name says what pressing it does (wrbc-carousel switches it to "Play the slides" and back); no aria-pressed. ?>
				<button type="button" class="<?php echo esc_attr( $cls( 'btn' ) . ' ' . $cls( 'play' ) ); ?>" data-wrbc-play aria-label="<?php esc_attr_e( 'Pause the slides', 'werun-blocks-community' ); ?>">
					<?php
					// wrbc_icon() returns escaped SVG markup.
					echo wrbc_icon( 'pause', array( 'class' => $cls( 'when-playing' ) ) ) . wrbc_icon( 'play', array( 'class' => $cls( 'when-paused' ) ) ); // phpcs:ignore WordPress.Security.EscapeOutput
					?>
				</button>
			<?php endif; ?>
			<?php if ( wrbc_on( $a, 'showDots' ) ) : ?>
				<div class="<?php echo esc_attr( $cls( 'dots' ) ); ?>" role="group" aria-label="<?php echo esc_attr( wrbc_text( $args['label'] ?? '' ) ? wrbc_text( $args['label'] ) : __( 'Choose a slide', 'werun-blocks-community' ) ); ?>" data-wrbc-dots></div>
			<?php endif; ?>
			<?php if ( wrbc_on( $a, 'showArrows' ) ) : ?>
				<div class="<?php echo esc_attr( $cls( 'arrows' ) ); ?>">
					<button type="button" class="<?php echo esc_attr( $cls( 'btn' ) ); ?> wrbc-anim-host" data-wrbc-prev<?php echo $controls; // phpcs:ignore WordPress.Security.EscapeOutput -- escaped above ?> aria-label="<?php esc_attr_e( 'Previous slide', 'werun-blocks-community' ); ?>"><?php echo $prev_svg; // phpcs:ignore WordPress.Security.EscapeOutput -- wrbc_icon() output ?></button>
					<button type="button" class="<?php echo esc_attr( $cls( 'btn' ) ); ?> wrbc-anim-host" data-wrbc-next<?php echo $controls; // phpcs:ignore WordPress.Security.EscapeOutput -- escaped above ?> aria-label="<?php esc_attr_e( 'Next slide', 'werun-blocks-community' ); ?>"><?php echo $next_svg; // phpcs:ignore WordPress.Security.EscapeOutput -- wrbc_icon() output ?></button>
				</div>
			<?php endif; ?>
		</div>
		<?php
		return trim( ob_get_clean() );
	}
}
