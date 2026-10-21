<?php
/**
 * The one testimonial card markup. Both sources print it:
 * - manual: src/testimonial/render.php (one werun-community/testimonial child block);
 * - query: src/testimonials/query.php (one card per post of the query).
 * So grid/carousel, stars, photo, quote icon and the parent's "what every
 * card shows" toggles behave the same whatever the source.
 *
 * Required with require_once from build/testimonial/render.php and
 * build/testimonials/render.php (copied by --webpack-copy-php).
 *
 * @package werun-blocks-community
 */

defined( 'ABSPATH' ) || exit;

if ( ! function_exists( 'wrbc_testimonial_ctx' ) ) {
	/**
	 * The testimonials block's per-card settings, with the same fallbacks the
	 * child block has always used for a missing context value.
	 *
	 * @param array $values showRating, showAvatar, showRole, showQuoteIcon, quoteIcon, layout, reveal,
	 *                      cardStyle, cardBg, starColor, accentColor (the parent's attributes, or
	 *                      its block context without the prefix), and surface: the background
	 *                      around the cards (the testimonials block's wrbc_surface()).
	 * @return array
	 */
	function wrbc_testimonial_ctx( array $values ) {
		$defaults = array(
			'showRating'    => true,
			'showAvatar'    => true,
			'showRole'      => true,
			'showQuoteIcon' => true,
			'quoteIcon'     => array( 'name' => 'quote' ),
			'layout'        => 'carousel',
			'reveal'        => true,
			'cardStyle'     => 'bordered',
			'cardBg'        => '',
			'starColor'     => '',
			'accentColor'   => '',
			'surface'       => '',
		);
		$out = array();
		foreach ( $defaults as $key => $fallback ) {
			$out[ $key ] = array_key_exists( $key, $values ) ? $values[ $key ] : $fallback;
		}
		return $out;
	}
}

if ( ! function_exists( 'wrbc_testimonial_star' ) ) {
	/**
	 * The stars' colour on what they sit on (WCAG 1.4.11: 3:1). A chosen colour
	 * stays as it is when it reaches 3:1 there, otherwise the closest one that
	 * does; without a choice, the dark gold on light backgrounds and a bright
	 * gold on dark ones. Twin: starColor() in src/testimonials/colors.js.
	 *
	 * @param mixed $star Star colour attribute ('' = not chosen).
	 * @param mixed $bg   Background under the stars ('' = unknown).
	 */
	function wrbc_testimonial_star( $star, $bg ) {
		$star = wrbc_text( $star );
		if ( null === wrbc_color_rgba( wrbc_text( $bg ) ) ) {
			return $star;
		}
		if ( '' === $star || null === wrbc_color_rgba( $star ) ) {
			$star = true === wrbc_is_dark_color( $bg ) ? '#f59e0b' : '#b77400';
		}
		return wrbc_readable_color( $star, $bg, WERUN_BLOCKS_COMMUNITY_AA_UI );
	}
}

if ( ! function_exists( 'wrbc_testimonial_colors' ) ) {
	/**
	 * A card's background and the colours that read on it.
	 * Twin: cardColors() in src/testimonials/colors.js.
	 *
	 * @param array  $ctx      wrbc_testimonial_ctx() (cardStyle, cardBg, starColor, accentColor, surface).
	 * @param string $own      The card's own background (its Color panel), '' for none.
	 * @param string $own_text The card's own text colour (its Color panel), '' for none.
	 * @return array {
	 *     @type string $bg    The card's background as one opaque colour: its own, else the
	 *                         card background (every style but plain), else white for the
	 *                         shadow style; '' when it paints none (it shows the surface).
	 *     @type string $under What the card's text sits on: $bg, or the surface (tinted 4 %
	 *                         for the filled style).
	 *     @type bool   $painted The card paints a background other than the surface around it
	 *                         (the card gets .wrbc-testi--painted and the $vars below).
	 *     @type string $tone  wrbc-is-dark / wrbc-is-light when that background isn't the surface
	 *                         around it (text, accent and focus turn around with it).
	 *     @type string $star  The stars' colour (wrbc_testimonial_star()) on what they sit on.
	 *     @type array  $vars  Custom properties for a painted card: its text (--wrbc-card-text,
	 *                         the automatic on-colour unless it has its own), the accent as
	 *                         links and focus ring at 4.5:1, the stars, and the role line
	 *                         (--wrbc-muted) at 4.5:1.
	 * }
	 */
	function wrbc_testimonial_colors( array $ctx, $own = '', $own_text = '' ) {
		$ctx     = wrbc_testimonial_ctx( $ctx );
		$under   = wrbc_color_rgba( wrbc_text( $ctx['surface'] ) );
		$under   = null !== $under && $under[3] >= 1 ? $under : wrbc_color_rgba( wrbc_page_colors()['background'] );
		$surface = wrbc_color_hex( $under );
		$style   = in_array( $ctx['cardStyle'], array( 'plain', 'bordered', 'filled', 'shadow' ), true ) ? $ctx['cardStyle'] : 'bordered';
		$bg      = wrbc_text( $own );
		if ( '' === $bg && 'plain' !== $style ) {
			$bg = wrbc_text( $ctx['cardBg'] );
		}
		if ( '' === $bg && 'shadow' === $style ) {
			$bg = WERUN_BLOCKS_COMMUNITY_PAPER;
		}
		// One opaque colour: a translucent background as it looks over the surface.
		$rgba = '' !== $bg ? wrbc_color_rgba( $bg ) : null;
		$bg   = null !== $rgba ? wrbc_color_hex( wrbc_color_over( $rgba, $under ) ) : '';
		if ( '' !== $bg ) {
			$stars_on = $bg;
		} elseif ( 'filled' === $style ) {
			// The filled card's 4 % tint of the text colour (assets: --wrbc-surface).
			$text     = wrbc_color_rgba( wrbc_on_color( $under ) );
			$stars_on = wrbc_color_hex( wrbc_color_over( array( $text[0], $text[1], $text[2], 0.04 ), $under ) );
		} else {
			$stars_on = $surface;
		}
		$out = array(
			'bg'      => $bg,
			'under'   => $stars_on,
			'painted' => false,
			'tone'    => '',
			'star'    => wrbc_testimonial_star( $ctx['starColor'], $stars_on ),
			'vars'    => array(),
		);
		if ( '' !== $bg && strtolower( $bg ) !== strtolower( $surface ) ) {
			$accent = wrbc_text( $ctx['accentColor'] );
			$accent = '' !== $accent && null !== wrbc_color_rgba( $accent ) ? $accent : WERUN_BLOCKS_COMMUNITY_ACCENT;
			$link   = wrbc_readable_color( $accent, $bg, WERUN_BLOCKS_COMMUNITY_AA_TEXT );
			// Text: the card's own colour (its Color panel: kept as chosen), or the one that
			// reads best on the background the block gave it.
			$own_text       = null !== wrbc_color_rgba( wrbc_text( $own_text ) ) ? wrbc_text( $own_text ) : '';
			$text           = '' !== $own_text ? $own_text : wrbc_on_color( $bg );
			$out['painted'] = true;
			$out['tone']    = wrbc_tone_class( $bg, $surface );
			$out['vars']    = array(
				'--wrbc-card-text'   => '' === $own_text ? $text : '',
				'--wrbc-accent-text' => $link,
				'--wrbc-focus'       => $link,
				'--wrbc-star'        => $out['star'],
			);
			// The role line: that text at 76 % (85 % on dark, as assets/shared.css mixes it),
			// raised to 4.5:1 when a mid-tone background needs it.
			$color = wrbc_color_rgba( $text );
			if ( null !== $color ) {
				$mix                         = array( $color[0], $color[1], $color[2], 'wrbc-is-dark' === $out['tone'] ? 0.85 : 0.76 );
				$out['vars']['--wrbc-muted'] = wrbc_readable_color( wrbc_color_hex( wrbc_color_over( $mix, wrbc_color_rgba( $bg ) ) ), $bg, WERUN_BLOCKS_COMMUNITY_AA_TEXT );
			}
		}
		return $out;
	}
}

if ( ! function_exists( 'wrbc_testimonial_card' ) ) {
	/**
	 * One testimonial card.
	 *
	 * @param array $data {
	 *     @type string $id         Element id (also added as a class, as before).
	 *     @type string $wrapper    'block': attributes through get_block_wrapper_attributes()
	 *                              (a werun-community/testimonial block being rendered, with its supports);
	 *                              anything else: plain attributes (query cards).
	 *     @type mixed  $quote      Quote: inline HTML, printed through wrbc_rich() (wp_kses_post).
	 *     @type mixed  $name       Name, through wrbc_rich().
	 *     @type mixed  $role       Role / company, through wrbc_rich(); hidden when it has no text.
	 *     @type mixed  $rating     Stars, cast to an integer and clamped to 0–5 (0 = no stars).
	 *     @type mixed  $avatarId   Attachment id of the photo (wp_get_attachment_image).
	 *     @type mixed  $avatarUrl  Photo URL, only when there is no attachment id (manual 1.x cards).
	 *     @type bool   $hideRating This card hides its stars.
	 *     @type bool   $hideAvatar This card hides its photo.
	 *     @type string $ownBg      The card's own background (a werun-community/testimonial's Color panel).
	 *     @type string $ownText    The card's own text colour (same panel).
	 * }
	 * @param array $ctx wrbc_testimonial_ctx().
	 * @return string
	 */
	function wrbc_testimonial_card( array $data, array $ctx ) {
		$ctx    = wrbc_testimonial_ctx( $ctx );
		$uid    = wrbc_text( $data['id'] ?? '' );
		$uid    = '' !== $uid ? $uid : wp_unique_id( 'wrbc-testi-' );
		$rating = max( 0, min( 5, is_numeric( $data['rating'] ?? null ) ? (int) $data['rating'] : 0 ) );
		$quote  = $data['quote'] ?? '';
		$name   = $data['name'] ?? '';
		$role   = $data['role'] ?? '';
		$avatar = array(
			'id'  => is_numeric( $data['avatarId'] ?? null ) ? (int) $data['avatarId'] : 0,
			// esc_url() drops javascript:, data: and the like: a URL it empties shows no photo (not an <img src="">).
			'url' => esc_url( wrbc_text( $data['avatarUrl'] ?? '' ) ),
		);
		$show_r = $ctx['showRating'] && empty( $data['hideRating'] ) && $rating > 0;
		$show_a = $ctx['showAvatar'] && empty( $data['hideAvatar'] ) && ( ! empty( $avatar['id'] ) || ! empty( $avatar['url'] ) );
		$show_q = $ctx['showQuoteIcon'];
		// Only parts with text are printed (no empty <cite>, <figcaption>).
		$show_n = '' !== trim( wp_strip_all_tags( wrbc_text( $name ) ) );
		$show_o = $ctx['showRole'] && '' !== trim( wp_strip_all_tags( wrbc_text( $role ) ) );
		// The photo sits next to the printed name, so it's decorative (alt=""). Without a
		// name, a library image keeps its own alt text (WCAG 1.1.1).
		$img_attr = array(
			'class'   => 'wrbc-testi__avatar',
			'loading' => 'lazy',
		);
		if ( $show_n ) {
			$img_attr['alt'] = '';
		}

		// A card with a background of its own (shadow, card background, its Color panel) turns
		// its text, accent, focus ring and stars around for it (wrbc-is-dark / wrbc-is-light).
		$colors = wrbc_testimonial_colors( $ctx, wrbc_text( $data['ownBg'] ?? '' ), wrbc_text( $data['ownText'] ?? '' ) );
		$extra  = array(
			'id'    => $uid,
			'class' => trim( 'wrbc-testi wrbc-anim-host ' . $uid . ' ' . $colors['tone'] . ( $colors['painted'] ? ' wrbc-testi--painted' : '' ) ),
		);
		$vars = wrbc_css_vars( $colors['vars'] );
		if ( '' !== $vars ) {
			$extra['style'] = $vars;
		}
		// Slides of a carousel are revealed by scrolling, not by fading in.
		if ( 'grid' === $ctx['layout'] && $ctx['reveal'] ) {
			$extra['data-wrbc-reveal'] = '';
		}
		if ( 'block' === ( $data['wrapper'] ?? '' ) ) {
			$attrs = get_block_wrapper_attributes( $extra );
		} else {
			// Same order and escaping as get_block_wrapper_attributes(), plus the
			// class a werun-community/testimonial block gets, so custom CSS matches both.
			$extra['class'] .= ' wp-block-werun-community-testimonial';
			$parts           = array();
			foreach ( $extra as $key => $value ) {
				$parts[] = $key . '="' . esc_attr( $value ) . '"';
			}
			$attrs = implode( ' ', $parts );
		}

		ob_start();
		// The markup below keeps the structure and classes of the 1.x render.php
		// (figure > blockquote + figcaption), minus empty parts, in a list item: the
		// testimonials track is a list (<ul role="list">), so a screen reader hears
		// how many there are. A carousel keeps the item's role and describes it as a
		// slide (wrbc-carousel). The editor's cards sit in the track without the item.
		?>
<li class="wrbc-testimonials__item">
<figure <?php echo $attrs; // phpcs:ignore ?>>
	<?php if ( $show_q || $show_r ) : ?>
		<div class="wrbc-testi__top">
			<?php if ( $show_q ) : ?>
				<?php echo wrbc_icon( $ctx['quoteIcon'], array( 'class' => 'wrbc-testi__mark' ) ); // phpcs:ignore ?>
			<?php endif; ?>
			<?php if ( $show_r ) : ?>
				<?php /* translators: %d: rating out of 5 */ ?>
				<span class="wrbc-testi__rating" role="img" aria-label="<?php echo esc_attr( sprintf( __( 'Rated %d out of 5', 'werun-blocks-community' ), $rating ) ); ?>">
					<?php for ( $i = 1; $i <= 5; $i++ ) : ?>
						<?php echo wrbc_icon( 'star', array( 'class' => 'wrbc-testi__star' . ( $i <= $rating ? ' is-on' : '' ) ) ); // phpcs:ignore ?>
					<?php endfor; ?>
				</span>
			<?php endif; ?>
		</div>
	<?php endif; ?>
	<blockquote class="wrbc-testi__quote"><p><?php echo wrbc_rich( $quote ); // phpcs:ignore ?></p></blockquote>
	<?php if ( $show_a || $show_n || $show_o ) : ?>
	<figcaption class="wrbc-testi__author">
		<?php if ( $show_a ) : ?>
			<?php
			echo ! empty( $avatar['id'] )
				? wp_get_attachment_image( $avatar['id'], 'thumbnail', false, $img_attr )
				: '<img class="wrbc-testi__avatar" src="' . $avatar['url'] . '" alt="" loading="lazy" width="48" height="48">'; // Escaped above.
			?>
		<?php endif; ?>
		<?php if ( $show_n || $show_o ) : ?>
		<span class="wrbc-testi__meta">
			<?php if ( $show_n ) : ?>
				<cite class="wrbc-testi__name"><?php echo wrbc_rich( $name ); // phpcs:ignore ?></cite>
			<?php endif; ?>
			<?php if ( $show_o ) : ?>
				<?php // Name and role are two lines on screen; read aloud, a comma keeps them apart ("Ana Pérez, CEO"). ?>
				<?php echo $show_n ? '<span class="wrbc-sr-only">' . esc_html_x( ',', 'spoken between a person\'s name and their role', 'werun-blocks-community' ) . ' </span>' : ''; ?>
				<span class="wrbc-testi__role"><?php echo wrbc_rich( $role ); // phpcs:ignore ?></span>
			<?php endif; ?>
		</span>
		<?php endif; ?>
	</figcaption>
	<?php endif; ?>
</figure>
</li>
<?php
		return (string) ob_get_clean();
	}
}
