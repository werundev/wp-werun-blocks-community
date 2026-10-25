<?php
/**
 * Logos: front-end markup. Three layouts share one list of logos:
 *   grid     a list in responsive columns (container queries)
 *   marquee  the list twice in a CSS-only infinite row; the copy is
 *            aria-hidden and its links leave the tab order. Pauses on hover,
 *            on focus and with a pause button (view.js; still until the
 *            button works); keyboard focus on a logo stops it, scrolled to
 *            that logo; with reduced motion it is a static, wrapped row
 *   carousel the wrbc-carousel module (docs/shared-modules.md), enqueued here
 *            only when this layout is used
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
$a = $attributes;

// The logos, validated: an image needs an attachment id or a URL. Block
// JSON can hold any type inside the array, so every field goes through
// wrbc_text() / absint(). Same rules as normalizeLogos() in edit.js.
$wrbc_logos = array();
foreach ( is_array( $a['logos'] ?? null ) ? $a['logos'] : array() as $wrbc_logo ) {
	if ( ! is_array( $wrbc_logo ) ) {
		continue;
	}
	$wrbc_id  = is_numeric( $wrbc_logo['id'] ?? null ) ? absint( $wrbc_logo['id'] ) : 0;
	$wrbc_url = wrbc_text( $wrbc_logo['url'] ?? '' );
	if ( '' === esc_url( $wrbc_url ) ) {
		$wrbc_url = ''; // javascript:, data: and the like.
	}
	if ( ! $wrbc_id && '' === $wrbc_url ) {
		continue;
	}
	$wrbc_logos[] = array(
		'id'       => $wrbc_id,
		'url'      => $wrbc_url,
		'alt'      => trim( wrbc_text( $wrbc_logo['alt'] ?? '' ) ),
		'name'     => trim( wrbc_text( $wrbc_logo['name'] ?? '' ) ),
		'link'     => trim( wrbc_text( $wrbc_logo['link'] ?? '' ) ),
		'newTab'   => ! empty( $wrbc_logo['newTab'] ),
		// 1-based, for the last-resort link name ("Logo 3").
		'position' => count( $wrbc_logos ) + 1,
	);
}
if ( ! $wrbc_logos ) {
	return; // Nothing to show: no empty section, no lone header.
}

$uid    = wrbc_uid( $a, 'wrbc-logos' );
$layout = in_array( $a['layout'] ?? '', array( 'grid', 'marquee', 'carousel' ), true ) ? $a['layout'] : 'grid';
$names  = wrbc_on( $a, 'showNames', false );
// Logo colour: their own, or every logo in one flat colour (black / white)
// so they read on any background. A flat colour has nothing to turn grey.
$tone = in_array( $a['logoTone'] ?? '', array( 'original', 'dark', 'light' ), true ) ? $a['logoTone'] : 'original';
$gray = 'original' === $tone && wrbc_on( $a, 'grayscale', false );
// Same limits as the editor's sliders. Opacity stops at 50%: below it a
// solid black logo drops under 3:1 on white (and a grey one long before),
// so dimmed logos fade out instead of looking dimmed.
$opacity = max( 50, min( 100, (int) ( is_numeric( $a['opacity'] ?? null ) ? $a['opacity'] : 100 ) ) );
// "Colour on hover" only does something when the logos are dimmed or grey (edit.js: canReveal).
// With a flat logo colour it only takes the dimming away.
$reveal_hover = ( $gray || $opacity < 100 ) && wrbc_on( $a, 'hoverReveal', true );
// What the block's text, accent and focus ring sit on: its own background,
// or the section / group around it (docs/accessibility.md).
$surface = wrbc_surface( $a, $block );
// A marquee has no cells to align a logo in (edit.js hides the control): centred.
$align        = 'marquee' !== $layout && in_array( $a['itemAlign'] ?? '', array( 'left', 'center', 'right' ), true ) ? $a['itemAlign'] : 'center';
$reveal       = wrbc_on( $a, 'reveal', true );
$num          = static function ( $value, $min, $max, $fallback ) {
	return max( $min, min( $max, is_numeric( $value ) ? 0 + $value : $fallback ) );
};

$classes = array(
	'wrbc-root',
	'wrbc-logos',
	'wrbc-logos--' . $layout,
	'wrbc-logos--align-' . $align,
	$uid,
	// wrbc-is-dark / wrbc-is-light: light text and accent on a dark background, and back.
	wrbc_tone_class( $surface, wrbc_context_background( $block ) ),
);
if ( 'original' !== $tone ) {
	$classes[] = 'wrbc-logos--tone-' . $tone;
}
if ( $gray ) {
	$classes[] = 'is-grayscale';
}
if ( $reveal_hover ) {
	$classes[] = 'is-hover-reveal';
}
if ( $names ) {
	$classes[] = 'has-names';
}
if ( 'marquee' === $layout && 'right' === ( $a['marqueeDirection'] ?? '' ) ) {
	$classes[] = 'wrbc-logos--dir-right';
}

$vars = array_merge(
	array(
		'--wrbc-gap'    => wrbc_px( $num( $a['gap'] ?? null, 0, 120, 40 ) ),
		'--wrbc-logo-h' => wrbc_px( $num( $a['logoHeight'] ?? null, 16, 160, 48 ) ),
		'--wrbc-logo-w' => wrbc_px( $num( $a['logoMaxWidth'] ?? null, 40, 400, 160 ) ),
		'--wrbc-logo-o' => $opacity / 100,
	),
	// --wrbc-accent (current dot), and --wrbc-accent-text when the accent has to
	// change to read on $surface: the eyebrow and the focus ring use it.
	wrbc_accent_vars( $a, $surface )
);
if ( 'grid' === $layout ) {
	$vars['--wrbc-cols-d'] = (int) $num( $a['columnsDesktop'] ?? null, 1, 8, 6 );
	$vars['--wrbc-cols-t'] = (int) $num( $a['columnsTablet'] ?? null, 1, 4, 4 );
	$vars['--wrbc-cols-m'] = (int) $num( $a['columnsMobile'] ?? null, 1, 2, 2 );
}

$extra = array(
	'id'    => $uid,
	'class' => implode( ' ', array_filter( $classes ) ),
);
// A landmark only when the header really prints a title (wrbc_section_header()
// skips an empty one). Without one the section stays a plain, unnamed element:
// a "Logos" region per block would only add noise to the landmarks list.
$titled = wrbc_on( $a, 'showHeader' ) && '' !== trim( wp_strip_all_tags( wrbc_text( $a['title'] ?? '' ) ) );
if ( 'carousel' === $layout ) {
	// The block is the carousel's root, as in src/carousel and testimonials:
	// data-wrbc-carousel and aria-roledescription "carousel"; a region named by
	// the title, or a group named "Logos" (not a landmark) without one.
	$extra          = array_merge( $extra, wrbc_carousel_attrs( $a, array( 'label' => __( 'Logos', 'werun-blocks-community' ) ) ) );
	$extra['role']  = $titled ? 'region' : 'group';
	$extra['aria-label'] = __( 'Logos', 'werun-blocks-community' );
}
if ( $titled ) {
	$extra['aria-labelledby'] = $uid . '-title';
	unset( $extra['aria-label'] );
}

/**
 * One logo: the image, the name as a caption when names show, and a link
 * around both when it has one. $copy marks the marquee's duplicate.
 *
 * The image's alt is the company name (WCAG 1.1.1), and a link's name comes
 * from it (2.4.4, 4.1.2): the alt field, else the name, else the media
 * library's alt text. A logo with none of them is decorative (alt="", the
 * editor flags it); a link still needs a name: its site, its path, or
 * "Logo 3". Twin of logoAlt() in edit.js (which can't read the media library).
 */
$wrbc_logo_html = static function ( $logo, $copy = false ) use ( $names ) {
	$caption = $names && '' !== $logo['name'];
	// Only a link esc_url() accepts is printed (javascript: and the like are not).
	$href = '' !== $logo['link'] ? esc_url( $logo['link'] ) : '';
	// A visible name already says it: the image would repeat it.
	$alt = $logo['alt'];
	if ( $caption && ( '' === $alt || $alt === $logo['name'] ) ) {
		$alt = '';
	} elseif ( '' === $alt ) {
		$alt = $logo['name'];
	}
	if ( ! $caption && '' === $alt && $logo['id'] ) {
		$alt = trim( wrbc_text( get_post_meta( $logo['id'], '_wp_attachment_image_alt', true ) ) );
	}
	if ( ! $caption && '' === $alt && '' !== $href ) {
		$alt = preg_replace( '/^www\./i', '', (string) wp_parse_url( $href, PHP_URL_HOST ) );
		if ( '' === $alt ) {
			// A link on this site ("/clients/acme"): its path says where it goes.
			$alt = trim( rawurldecode( (string) wp_parse_url( $href, PHP_URL_PATH ) ), '/' );
		}
		if ( '' === $alt ) {
			/* translators: %d: position of the logo in the list */
			$alt = sprintf( __( 'Logo %d', 'werun-blocks-community' ), $logo['position'] );
		}
	}
	$img = '';
	if ( $logo['id'] ) {
		$img = wp_get_attachment_image(
			$logo['id'],
			'medium',
			false,
			array(
				'class'    => 'wrbc-logos__img',
				'alt'      => $alt,
				'loading'  => 'lazy',
				'decoding' => 'async',
			)
		);
	}
	if ( '' === $img && '' !== $logo['url'] ) {
		$img = '<img class="wrbc-logos__img" src="' . esc_url( $logo['url'] ) . '" alt="' . esc_attr( $alt ) . '" loading="lazy" decoding="async">';
	}
	if ( '' === $img ) {
		return '';
	}
	$inner = $img . ( $caption ? '<span class="wrbc-logos__name">' . esc_html( $logo['name'] ) . '</span>' : '' );
	if ( '' !== $href ) {
		// The marquee's copy is aria-hidden: out of the tab order too, but still clickable.
		// wrbc_new_tab_note(): the shared visually hidden "(opens in a new tab)".
		return '<a class="wrbc-logos__logo wrbc-logos__link" ' . wrbc_link_attrs( $logo['link'], $logo['newTab'] ) . ( $copy ? ' tabindex="-1"' : '' ) . '>' . $inner . wrbc_new_tab_note( $logo['newTab'] ) . '</a>';
	}
	return '<span class="wrbc-logos__logo">' . $inner . '</span>';
};

$items = array();
foreach ( $wrbc_logos as $wrbc_logo ) {
	$wrbc_html = $wrbc_logo_html( $wrbc_logo );
	if ( '' !== $wrbc_html ) {
		$items[] = array( $wrbc_logo, $wrbc_html );
	}
}
if ( ! $items ) {
	return;
}
if ( 'marquee' === $layout ) {
	// One loop takes "seconds per logo" × logos, so the speed stays the same however many there are.
	$vars['--wrbc-marquee-dur'] = ( $num( $a['marqueeSpeed'] ?? null, 1, 10, 3 ) * count( $items ) ) . 's';
}
$extra['style'] = wrbc_css_vars( $vars );

ob_start();
if ( 'grid' === $layout ) :
	?>
	<ul class="wrbc-logos__list wrbc-logos__grid" role="list">
		<?php foreach ( $items as $wrbc_item ) : ?>
			<li class="wrbc-logos__item"<?php echo $reveal ? ' data-wrbc-reveal' : ''; ?>><?php echo $wrbc_item[1]; // phpcs:ignore -- built above, escaped ?></li>
		<?php endforeach; ?>
	</ul>
	<?php
elseif ( 'marquee' === $layout ) :
	?>
	<div class="wrbc-logos__marquee"<?php echo $reveal ? ' data-wrbc-reveal' : ''; ?>>
		<?php // Its name says what pressing it does, like the carousels' play button (no aria-pressed): view.js toggles .is-paused, the CSS swaps icon and name. ?>
		<button type="button" class="wrbc-logos__btn wrbc-logos__pause" data-wrbc-marquee-pause>
			<?php echo wrbc_icon( 'pause', array( 'class' => 'wrbc-logos__when-playing' ) ) . wrbc_icon( 'play', array( 'class' => 'wrbc-logos__when-paused' ) ); // phpcs:ignore ?>
			<span class="wrbc-sr-only wrbc-logos__when-playing"><?php esc_html_e( 'Pause the moving logos', 'werun-blocks-community' ); ?></span>
			<span class="wrbc-sr-only wrbc-logos__when-paused"><?php esc_html_e( 'Play the moving logos', 'werun-blocks-community' ); ?></span>
		</button>
		<div class="wrbc-logos__rail">
			<ul class="wrbc-logos__list" role="list">
				<?php foreach ( $items as $wrbc_item ) : ?>
					<li class="wrbc-logos__item"><?php echo $wrbc_item[1]; // phpcs:ignore -- escaped ?></li>
				<?php endforeach; ?>
			</ul>
			<ul class="wrbc-logos__list wrbc-logos__copy" role="list" aria-hidden="true">
				<?php foreach ( $items as $wrbc_item ) : ?>
					<li class="wrbc-logos__item"><?php echo $wrbc_logo_html( $wrbc_item[0], true ); // phpcs:ignore -- escaped ?></li>
				<?php endforeach; ?>
			</ul>
		</div>
	</div>
	<?php
else :
	// The wrbc-carousel contract: options as JSON, slides per view and gap as custom properties.
	wp_enqueue_script( 'wrbc-carousel' );
	wp_enqueue_style( 'wrbc-modules' );
	$position = 'top' === ( $a['controlsPosition'] ?? '' ) ? 'top' : 'bottom';
	$controls = wrbc_carousel_controls(
		array(
			'attributes' => $a,
			'track_id'   => $uid . '-track',
			'prefix'     => 'wrbc-logos',
		)
	);
	$carousel_style = wrbc_css_vars(
		array(
			'--wrbc-pv-d' => (int) $num( $a['columnsDesktop'] ?? null, 1, 8, 6 ),
			'--wrbc-pv-t' => (int) $num( $a['columnsTablet'] ?? null, 1, 4, 4 ),
			'--wrbc-pv-m' => (int) $num( $a['columnsMobile'] ?? null, 1, 2, 2 ),
		)
	);
	// The carousel's root (data-wrbc-carousel, role, name) is the section itself, above.
	?>
	<div class="wrbc-logos__carousel wrbc-carousel--controls-<?php echo esc_attr( $position ); ?>" style="<?php echo esc_attr( $carousel_style ); ?>"<?php echo $reveal ? ' data-wrbc-reveal' : ''; ?>>
		<?php echo 'top' === $position ? $controls : ''; // phpcs:ignore -- escaped above ?>
		<?php
		// The track scrolls with the keyboard once focused (arrows, Home, End),
		// so it's a named group in the tab order (a name needs a role; as
		// src/carousel). A single logo has nothing to scroll: no extra tab stop.
		$track_a11y = count( $items ) > 1
			? ' tabindex="0" role="group" aria-label="' . esc_attr__( 'Logos, use the arrow keys to move', 'werun-blocks-community' ) . '"'
			: '';
		?>
		<div class="wrbc-carousel__track wrbc-logos__track" id="<?php echo esc_attr( $uid ); ?>-track" data-wrbc-track<?php echo $track_a11y; // phpcs:ignore WordPress.Security.EscapeOutput -- escaped above ?>>
			<?php foreach ( $items as $wrbc_item ) : ?>
				<div class="wrbc-logos__item" data-wrbc-slide><?php echo $wrbc_item[1]; // phpcs:ignore -- escaped ?></div>
			<?php endforeach; ?>
		</div>
		<?php echo 'top' !== $position ? $controls : ''; // phpcs:ignore -- escaped above ?>
	</div>
	<?php
endif;
$body = ob_get_clean();
?>
<section <?php echo get_block_wrapper_attributes( $extra ); // phpcs:ignore ?>>
	<?php echo wrbc_section_header( $a, $uid ); // phpcs:ignore ?>
	<?php echo $body; // phpcs:ignore -- built above, escaped ?>
</section>
<?php
} )( $attributes, $content, $block );
