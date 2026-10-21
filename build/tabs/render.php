<?php
/**
 * Tabs: front-end markup, per the wrbc-tabs contract (docs/shared-modules.md).
 *
 * Each werun-community/tab renders its own panel (<section role="tabpanel">). Here,
 * after they rendered, the tab list is built from the panels' ids and the
 * tabs' labels, and every top-level panel gets its position (for the
 * accordion layout) and, the first one, the "initial" class (what shows
 * before the module runs). The module (wrbc-tabs) does the switching,
 * keyboard and hash links; without JavaScript every panel shows with its
 * own heading.
 *
 * @var array    $attributes Block attributes.
 * @var string   $content    Rendered panels.
 * @var WP_Block $block      Block instance.
 *
 * @package werun-blocks-community
 */

defined( 'ABSPATH' ) || exit;

$a   = $attributes;
$uid = wrbc_uid( $a, 'wrbc-tabs' );

// Effective options. Twin: effective() in src/tabs/edit.js.
$orientation = in_array( $a['orientation'] ?? '', array( 'horizontal', 'vertical' ), true ) ? $a['orientation'] : 'horizontal';
$tab_style   = in_array( $a['tabStyle'] ?? '', array( 'underline', 'pills', 'boxed', 'segmented' ), true ) ? $a['tabStyle'] : 'underline';
$horizontal  = 'horizontal' === $orientation;
$full_width  = $horizontal && wrbc_on( $a, 'fullWidth', false );
$tab_align   = $horizontal && ! $full_width && in_array( $a['tabAlign'] ?? '', array( 'start', 'center', 'end' ), true ) ? $a['tabAlign'] : 'start';
$show_icons  = wrbc_on( $a, 'showIcons', false );
$icon_pos    = in_array( $a['iconPosition'] ?? '', array( 'start', 'top', 'end' ), true ) ? $a['iconPosition'] : 'start';
$accordion   = 'accordion' === ( $a['mobileMode'] ?? '' );
$breakpoint  = in_array( (int) ( $a['accordionBelow'] ?? 600 ), array( 480, 600, 782, 960 ), true ) ? (int) $a['accordionBelow'] : 600;
$activation  = 'manual' === ( $a['activation'] ?? '' ) ? 'manual' : 'auto';

// The tabs, in the order their panels rendered.
$tabs = array();
foreach ( $block->inner_blocks as $inner ) {
	if ( 'werun-community/tab' === $inner->name ) {
		$tabs[] = $inner;
	}
}

// Ids of this block's own panels (a tabs block inside a panel keeps its own),
// position and initial state written into each.
$panels = new WP_HTML_Tag_Processor( $content );
$ids    = array();
$depth  = 0;
while ( $panels->next_tag( array( 'tag_closers' => 'visit' ) ) ) {
	if ( 'SECTION' !== $panels->get_tag() ) {
		continue;
	}
	if ( $panels->is_tag_closer() ) {
		$depth = max( 0, $depth - 1 );
		continue;
	}
	if ( 0 === $depth && null !== $panels->get_attribute( 'data-wrbc-tab-panel' ) ) {
		$index = count( $ids );
		$ids[] = (string) $panels->get_attribute( 'id' );
		$style = trim( (string) $panels->get_attribute( 'style' ), " \t\n\r;" );
		$panels->set_attribute( 'style', ( '' !== $style ? $style . ';' : '' ) . '--wrbc-tab-i:' . $index );
		if ( 0 === $index ) {
			$panels->add_class( 'wrbc-tab--initial' );
		}
	}
	++$depth;
}
$content = $panels->get_updated_html();

if ( ! $ids ) {
	return;
}

// Each tab's label, or "Tab N" when it has none: on the tab, and on its
// panel's own heading (shown without JavaScript), which tab/render.php
// leaves empty for this block to name. Nested tab sets already named
// theirs, so the empty ones left are this block's, in order.
$labels = array();
foreach ( $ids as $i => $panel_id ) {
	$tab   = $tabs[ $i ] ?? null;
	$label = $tab ? wrbc_rich( $tab->attributes['label'] ?? '' ) : '';
	if ( '' === trim( wp_strip_all_tags( $label ) ) ) {
		/* translators: %d: position of the tab. */
		$label   = esc_html( sprintf( __( 'Tab %d', 'werun-blocks-community' ), $i + 1 ) );
		$content = preg_replace_callback(
			'#<h([3-5]) class="wrbc-tab__heading" data-wrbc-tab-fallback></h\1>#',
			static function ( $m ) use ( $label ) {
				return '<h' . $m[1] . ' class="wrbc-tab__heading">' . $label . '</h' . $m[1] . '>';
			},
			$content,
			1
		);
	}
	$labels[ $i ] = $label;
}

// What the tabs sit on: their own background, or the one around them (a
// dark section or group). Text, accent and focus ring follow it
// (docs/accessibility.md). Twin: src/tabs/edit.js.
$surface = wrbc_surface( $a, $block );

$classes = array(
	'wrbc-root',
	'wrbc-tabs',
	'wrbc-tabs--' . $orientation,
	'wrbc-tabs--' . $tab_style,
	$horizontal ? ( $full_width ? 'wrbc-tabs--full' : 'wrbc-tabs--align-' . $tab_align ) : '',
	$show_icons ? 'wrbc-tabs--icon-' . $icon_pos : '',
	$accordion ? 'wrbc-tabs--accordion wrbc-tabs--acc-' . $breakpoint : 'wrbc-tabs--scroll',
	$uid,
	wrbc_tone_class( $surface, wrbc_context_background( $block ) ),
);
$extra   = array(
	'id'    => $uid,
	'class' => implode( ' ', array_filter( $classes ) ),
	'style' => wrbc_css_vars(
		array_merge(
			// The accent (pills), the text on it, and the accent as open-tab
			// line, label and focus ring made readable on the surface.
			wrbc_accent_vars( $a, $surface ),
			array(
				'--wrbc-radius'      => in_array( $tab_style, array( 'boxed', 'segmented' ), true ) ? wrbc_px( max( 0, min( 24, (int) ( $a['radius'] ?? 10 ) ) ) ) : '',
				'--wrbc-tabs-nav-w'  => $horizontal ? '' : wrbc_px( max( 140, min( 400, (int) ( $a['navWidth'] ?? 240 ) ) ) ),
				'--wrbc-icon-size'   => $show_icons ? wrbc_px( max( 12, min( 32, (float) ( $a['iconSize'] ?? 18 ) ) ) ) : '',
				'--wrbc-icon-stroke' => $show_icons ? max( 1, min( 3, (float) ( $a['iconStroke'] ?? 2 ) ) ) : '',
			)
		)
	),
);
$has_title = wrbc_on( $a, 'showHeader', false ) && '' !== trim( wp_strip_all_tags( wrbc_text( $a['title'] ?? '' ) ) );
if ( $has_title ) {
	$extra['aria-labelledby'] = $uid . '-title';
}

$options = array(
	'activation'  => $activation,
	'orientation' => $orientation,
	'hash'        => wrbc_on( $a, 'deepLinks', true ),
);
$default = is_array( $a['tabIcon'] ?? null ) ? $a['tabIcon'] : array( 'name' => 'sparkles' );
// A <section>: with its title printed (aria-labelledby above) it is a
// region named by it; without one it's a plain element, no landmark.
?>
<section <?php echo get_block_wrapper_attributes( $extra ); // phpcs:ignore ?>>
	<?php
	if ( wrbc_on( $a, 'showHeader', false ) ) {
		echo wrbc_section_header( $a, $uid ); // phpcs:ignore -- built from escaped parts
	}
	?>
	<div class="wrbc-tabs__body" data-wrbc-tabs="<?php echo esc_attr( wp_json_encode( $options ) ); ?>"<?php echo wrbc_on( $a, 'reveal', true ) ? ' data-wrbc-reveal' : ''; ?>>
		<div class="wrbc-tabs__list" role="tablist"<?php echo $horizontal ? '' : ' aria-orientation="vertical"'; ?><?php echo $has_title ? ' aria-labelledby="' . esc_attr( $uid ) . '-title"' : ''; ?>>
			<?php
			foreach ( $ids as $i => $panel_id ) {
				$tab = $tabs[ $i ] ?? null;
				// The tab's own icon, or the block's while it has none; an own icon with no name hides it.
				$icon = '';
				if ( $show_icons ) {
					$own  = $tab && isset( $tab->attributes['icon'] ) && is_array( $tab->attributes['icon'] ) ? $tab->attributes['icon'] : null;
					$icon = wrbc_icon( null !== $own ? $own : $default, array( 'class' => 'wrbc-tabs__icon' ) );
				}
				printf(
					'<button type="button" role="tab" class="wrbc-tabs__tab wrbc-anim-host" id="%1$s-tab" aria-controls="%1$s" aria-selected="%2$s" tabindex="%3$s" style="--wrbc-tab-i:%6$d">%4$s<span class="wrbc-tabs__label">%5$s</span></button>',
					esc_attr( $panel_id ),
					0 === $i ? 'true' : 'false',
					0 === $i ? '0' : '-1',
					$icon, // phpcs:ignore -- wrbc_icon() output
					$labels[ $i ], // phpcs:ignore -- wrbc_rich() / esc_html()
					(int) $i
				);
			}
			?>
		</div>
		<div class="wrbc-tabs__panels">
			<?php echo $content; // phpcs:ignore -- rendered panels ?>
		</div>
	</div>
</section>
