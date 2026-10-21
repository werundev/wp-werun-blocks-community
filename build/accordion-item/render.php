<?php
/**
 * Accordion item: a native <details>. The answer is the item's inner blocks.
 *
 * @var array    $attributes Block attributes.
 * @var string   $content    Rendered answer.
 * @var WP_Block $block      Block instance.
 *
 * @package werun-blocks-community
 */

defined( 'ABSPATH' ) || exit;

if ( ! function_exists( 'wrbc_acc_item_colors' ) ) {
	/**
	 * An item that paints a background (its own Color panel one, or the
	 * accordion's Item background in Boxes): the tone class that turns its
	 * text light or dark when no text colour was chosen, and the accent and
	 * focus ring readable on it. Used here and, for the Item background, by
	 * src/accordion/render.php (items render first, so this is defined by
	 * then). Twin: itemColors() in src/accordion-item/colors.js.
	 *
	 * @param string $bg     The item's background (may be translucent).
	 * @param string $around What the accordion sits on.
	 * @param string $accent The accordion's accent ('' = the default one).
	 * @return array{ class: string, vars: array, paint: string }
	 */
	function wrbc_acc_item_colors( $bg, $around, $accent ) {
		$rgba = wrbc_color_rgba( $bg );
		if ( null === $rgba || $rgba[3] <= 0 ) {
			return array(
				'class' => '',
				'vars'  => array(),
				'paint' => '',
			);
		}
		$white = array( 255.0, 255.0, 255.0, 1.0 );
		$under = wrbc_color_rgba( $around );
		$under = wrbc_color_hex( null === $under ? $white : wrbc_color_over( $under, $white ) );
		$paint = wrbc_color_hex( wrbc_color_over( $rgba, wrbc_color_rgba( $under ) ) );
		$base  = null !== wrbc_color_rgba( $accent ) ? wrbc_text( $accent ) : WERUN_BLOCKS_COMMUNITY_ACCENT;
		$text  = wrbc_readable_color( $base, $paint, WERUN_BLOCKS_COMMUNITY_AA_TEXT );
		$class = wrbc_tone_class( $paint, $under );
		$vars  = array();
		// Its own values when the accordion's (made for what it sits on) don't
		// read on this background, or a tone class would reset them to its mix.
		if ( '' !== $class || strtolower( $text ) !== strtolower( wrbc_readable_color( $base, $under, WERUN_BLOCKS_COMMUNITY_AA_TEXT ) ) ) {
			$vars = array(
				'--wrbc-accent-text' => $text,
				'--wrbc-focus'       => $text,
			);
		}
		return array(
			'class' => $class,
			'vars'  => $vars,
			'paint' => $paint,
		);
	}
}

$a   = $attributes;
$ctx = $block->context;
$get = static function ( $key, $fallback ) use ( $ctx ) {
	return array_key_exists( 'werun-community/accordion/' . $key, $ctx ) ? $ctx[ 'werun-community/accordion/' . $key ] : $fallback;
};

// The question is the summary's text: phrasing without links or controls
// (nothing interactive may sit inside a <summary>). No question, no item: a
// toggle without a name can't be told apart from the others.
$question = wp_kses(
	wrbc_text( $a['question'] ?? '' ),
	array(
		'em'     => array(),
		'i'      => array(),
		'strong' => array(),
		'b'      => array(),
		'br'     => array(),
		'code'   => array(),
		'sub'    => array(),
		'sup'    => array(),
		's'      => array(),
		'small'  => array(),
		'mark'   => array(
			'class' => true,
			'style' => true,
		),
		'span'   => array(
			'class' => true,
			'lang'  => true,
			'dir'   => true,
		),
	)
);
if ( '' === trim( wp_strip_all_tags( $question ) ) ) {
	return;
}

$uid  = wrbc_uid( $a, 'wrbc-acc-item' );
$type = $get( 'iconType', 'chevron' );

// The question's element: a heading when the accordion asks for one, so
// screen-reader users can jump from question to question. Automatic: one
// level below the section title, plain text when no title shows.
// Twin: src/accordion-item/edit.js.
$heading = $get( 'questionHeading', 'auto' );
$heading = in_array( $heading, array( 'auto', 'none', 'h2', 'h3', 'h4', 'h5', 'h6' ), true ) ? $heading : 'auto';
if ( 'auto' === $heading ) {
	// Same test as wrbc_section_header(): the header is on and its title has text.
	$has_title = (bool) $get( 'showHeader', true ) && '' !== trim( wp_strip_all_tags( wrbc_text( $get( 'title', '' ) ) ) );
	$heading   = $has_title ? 'h' . ( max( 2, min( 4, (int) $get( 'titleLevel', 2 ) ) ) + 1 ) : 'none';
}
$tag = 'none' === $heading ? 'span' : $heading;

// The icon before the question: the item's own, or the accordion's when the
// item has none of its own. An own icon with no name hides it on this item.
$lead = '';
if ( $get( 'showItemIcons', false ) ) {
	$icon = isset( $a['icon'] ) && is_array( $a['icon'] ) ? $a['icon'] : $get( 'itemIcon', array( 'name' => 'circle-question-mark' ) );
	$lead = wrbc_icon( $icon, array( 'class' => 'wrbc-acc-item__lead' ) );
}

$toggle = '';
if ( 'chevron' === $type ) {
	$toggle = wrbc_icon( 'chevron-down', array( 'class' => 'wrbc-acc-item__chevron' ) );
} elseif ( 'plus' === $type ) {
	$toggle = wrbc_icon( 'plus', array( 'class' => 'wrbc-acc-item__when-closed' ) ) . wrbc_icon( 'minus', array( 'class' => 'wrbc-acc-item__when-open' ) );
} elseif ( 'custom' === $type ) {
	$toggle = wrbc_icon( $get( 'iconClosed', array( 'name' => 'plus' ) ), array( 'class' => 'wrbc-acc-item__when-closed' ) )
		. wrbc_icon( $get( 'iconOpen', array( 'name' => 'minus' ) ), array( 'class' => 'wrbc-acc-item__when-open' ) );
}

$extra = array(
	'id'    => $uid,
	'class' => 'wrbc-acc-item wrbc-anim-host ' . $uid,
);
// A background of its own (Color panel): text, accent and focus ring that
// read on it. The accordion's Item background is written in by
// src/accordion/render.php, which knows the effective style.
$own_bg = wrbc_block_surface( $a, 'werun-community/accordion-item' );
if ( '' !== $own_bg ) {
	$colors          = wrbc_acc_item_colors( $own_bg, wrbc_context_background( $block ), wrbc_text( $get( 'accentColor', '' ) ) );
	$extra['class'] .= ' wrbc-acc-item--bg' . ( '' !== $colors['class'] ? ' ' . $colors['class'] : '' );
	$extra['style']  = wrbc_css_vars( $colors['vars'] );
}
// The open / closed state is the browser's own (expanded / collapsed on the
// summary); the icons only repeat it, so they are hidden from screen readers.
// The panel is a region named by its question; the accordion drops the role
// when more than six can be open at once (too many landmarks).
?>
<div <?php echo get_block_wrapper_attributes( $extra ); // phpcs:ignore ?>>
	<details class="wrbc-acc-item__details"<?php echo ! empty( $a['openByDefault'] ) ? ' open' : ''; ?>>
		<summary class="wrbc-acc-item__summary" id="<?php echo esc_attr( $uid ); ?>-q">
			<?php echo $lead; // phpcs:ignore -- wrbc_icon() output ?>
			<<?php echo esc_attr( $tag ); ?> class="wrbc-acc-item__question"><?php echo $question; // phpcs:ignore -- wp_kses() above ?></<?php echo esc_attr( $tag ); ?>>
			<?php if ( '' !== $toggle ) : ?>
				<span class="wrbc-acc-item__toggle" aria-hidden="true"><?php echo $toggle; // phpcs:ignore ?></span>
			<?php endif; ?>
		</summary>
		<div class="wrbc-acc-item__panel" role="region" aria-labelledby="<?php echo esc_attr( $uid ); ?>-q">
			<div class="wrbc-acc-item__content"><?php echo $content; // phpcs:ignore -- rendered inner blocks ?></div>
		</div>
	</details>
</div>
