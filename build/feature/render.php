<?php
/**
 * Feature card: front-end markup. What it shows comes from the grid
 * (context) and from its own "hide" switches.
 *
 * @var array    $attributes Block attributes.
 * @var string   $content    Unused.
 * @var WP_Block $block      Block instance.
 *
 * @package werun-blocks-community
 */

defined( 'ABSPATH' ) || exit;

require_once __DIR__ . '/colors.php';

$a   = $attributes;
$ctx = $block->context;
$get = static function ( $key, $fallback ) use ( $ctx ) {
	return array_key_exists( 'werun-community/features/' . $key, $ctx ) ? $ctx[ 'werun-community/features/' . $key ] : $fallback;
};

$uid        = wrbc_uid( $a, 'wrbc-feature' );
$link_style = $get( 'linkStyle', 'link' );
// Card titles sit one level below the grid's own title when it prints one
// (wrbc_section_header(): H2 to H4), so the outline never repeats or skips a
// level; without it, the level chosen on the grid (H2 to H4, features/edit.js).
// Same rule as edit.js.
$has_header = $get( 'showHeader', true ) && '' !== trim( wp_strip_all_tags( wrbc_text( $get( 'title', '' ) ) ) );
$level      = $has_header
	? max( 2, min( 4, (int) $get( 'titleLevel', 2 ) ) ) + 1
	: max( 2, min( 4, (int) $get( 'itemTitleLevel', 3 ) ) );
// A URL esc_url() refuses (javascript:, …) is no URL: no link to "#".
$has_url    = '' !== esc_url( trim( wrbc_text( $a['linkUrl'] ) ) );
// An unknown icon name prints nothing, so it counts as no icon (no empty holder).
$icon_html  = ( $get( 'showIcon', true ) && empty( $a['hideIcon'] ) && is_array( $a['icon'] ) )
	? wrbc_icon_wrap( $a['icon'], $get( 'iconStyle', 'square' ), 'wrbc-feature__icon' )
	: '';
$show_icon  = '' !== $icon_html;
$show_title = $get( 'showTitle', true ) && '' !== trim( wp_strip_all_tags( wrbc_text( $a['title'] ) ) );
$show_text  = $get( 'showText', true ) && empty( $a['hideText'] ) && '' !== trim( wp_strip_all_tags( wrbc_text( $a['text'] ) ) );
$show_badge = $get( 'showBadge', true ) && '' !== trim( wp_strip_all_tags( wrbc_text( $a['badge'] ) ) );
$show_link  = $get( 'showLink', true ) && empty( $a['hideLink'] ) && $has_url;
// The whole card links through its title; without one it keeps a text link.
$card_link  = $show_link && 'card' === $link_style && $show_title;
$link_label = trim( wrbc_text( $a['linkLabel'] ) );
$link_label = '' !== trim( wp_strip_all_tags( $link_label ) ) ? $link_label : __( 'Learn more', 'werun-blocks-community' );
// Screen readers hear that the link opens a new tab (same test as wrbc_link_attrs()).
$new_tab    = wrbc_new_tab_note( ! empty( $a['linkNewTab'] ) );
// "Learn more" is described by the card's title, or by its text without one.
$described  = $show_title ? $uid . '-title' : ( $show_text ? $uid . '-text' : '' );

if ( ! $show_icon && ! $show_badge && ! $show_title && ! $show_text && ! $show_link ) {
	return; // Nothing to show: no empty card in the grid.
}

// What the card paints, and its colours made readable on it (colors.php; twin in edit.js).
$colors = wrbc_feature_colors(
	$a,
	array(
		'cardStyle'   => $get( 'cardStyle', 'bordered' ),
		'cardBg'      => $get( 'cardBg', '' ),
		'accentColor' => $get( 'accentColor', '' ),
		'textColor'   => $get( 'textColor', '' ),
		'style'       => $get( 'style', array() ),
		'iconStyle'   => $get( 'iconStyle', 'square' ),
		'iconColor'   => $get( 'iconColor', '' ),
		'iconBg'      => $get( 'iconBg', '' ),
	),
	wrbc_context_background( $block )
);
if ( ! $show_badge ) {
	unset( $colors['vars']['--wrbc-features-badge'] );
}
if ( ! $show_icon ) {
	unset( $colors['vars']['--wrbc-icon-color'] );
}

$classes = array( 'wrbc-feature', 'wrbc-anim-host', $uid );
if ( ! empty( $a['highlight'] ) ) {
	$classes[] = 'is-highlight';
}
if ( $card_link ) {
	$classes[] = 'is-card-link';
}
if ( '' !== $colors['class'] ) {
	$classes[] = $colors['class'];
}
// A colour of its own: links in its text take the accent readable on it (style.scss).
if ( $colors['custom'] ) {
	$classes[] = 'has-card-bg';
}
$extra = array(
	'id'    => $uid,
	'class' => implode( ' ', $classes ),
	'role'  => 'listitem',
);
$card_vars = wrbc_css_vars( $colors['vars'] );
if ( '' !== $card_vars ) {
	$extra['style'] = $card_vars;
}
if ( $get( 'reveal', true ) ) {
	$extra['data-wrbc-reveal'] = '';
}
?>
<div <?php echo get_block_wrapper_attributes( $extra ); // phpcs:ignore ?>>
	<?php if ( $show_icon || $show_badge ) : ?>
		<div class="wrbc-feature__top">
			<?php if ( $show_icon ) : ?>
				<?php echo $icon_html; // phpcs:ignore -- escaped by wrbc_icon_wrap() ?>
			<?php endif; ?>
			<?php if ( $show_badge ) : ?>
				<span class="wrbc-feature__badge"><?php echo wrbc_rich( $a['badge'] ); // phpcs:ignore ?></span>
			<?php endif; ?>
		</div>
	<?php endif; ?>
	<?php if ( $show_title || $show_text || $show_link ) : ?>
	<div class="wrbc-feature__body">
		<?php if ( $show_title ) : ?>
			<?php
			$title = wrbc_rich( $a['title'] );
			if ( $card_link ) {
				// The title becomes the card's one link: no link nested inside it.
				$no_links = wp_kses_allowed_html( 'post' );
				unset( $no_links['a'] );
				$title = '<a class="wrbc-feature__stretched" ' . wrbc_link_attrs( $a['linkUrl'], $a['linkNewTab'] ) . '>' . wp_kses( $title, $no_links ) . $new_tab . '</a>';
			}
			printf( '<h%1$d class="wrbc-feature__title" id="%2$s-title">%3$s</h%1$d>', (int) $level, esc_attr( $uid ), $title ); // phpcs:ignore
			?>
		<?php endif; ?>
		<?php if ( $show_text ) : ?>
			<p class="wrbc-feature__text"<?php echo $show_link && ! $card_link && $uid . '-text' === $described ? ' id="' . esc_attr( $described ) . '"' : ''; ?>><?php echo wrbc_rich( $a['text'] ); // phpcs:ignore ?></p>
		<?php endif; ?>
		<?php if ( $show_link && ! $card_link ) : ?>
			<a class="wrbc-feature__link wrbc-btn <?php echo 'button' === $link_style ? 'wrbc-btn--outline' : 'wrbc-btn--link'; ?>" <?php echo wrbc_link_attrs( $a['linkUrl'], $a['linkNewTab'] ); // phpcs:ignore ?><?php echo '' !== $described ? ' aria-describedby="' . esc_attr( $described ) . '"' : ''; ?>>
				<span><?php echo wrbc_rich( $link_label ); // phpcs:ignore ?></span>
				<?php echo wrbc_icon( array( 'name' => 'arrow-right', 'anim' => 'nudge-x', 'trigger' => 'hover' ), array( 'class' => 'wrbc-feature__arrow' ) ); // phpcs:ignore ?>
				<?php echo $new_tab; // phpcs:ignore -- escaped above ?>
			</a>
		<?php endif; ?>
	</div>
	<?php endif; ?>
</div>
