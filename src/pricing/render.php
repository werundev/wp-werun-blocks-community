<?php
/**
 * Pricing table: front-end markup. The plans are its inner blocks; each one
 * prints both prices and the table's data-period decides which is shown, so
 * the switch works with CSS alone once view.js flips the attribute. The
 * switch is a group of native radio buttons: arrow keys and screen readers
 * work as with any radio group, and without JavaScript the checked radio
 * itself picks the prices (style.scss, :has()).
 *
 * @var array    $attributes Block attributes.
 * @var string   $content    Rendered plans.
 * @var WP_Block $block      Block instance.
 *
 * @package werun-blocks-community
 */

defined( 'ABSPATH' ) || exit;

$a      = $attributes;
$uid    = wrbc_uid( $a, 'wrbc-pricing' );
$period = 'yearly' === $a['defaultPeriod'] ? 'yearly' : 'monthly';
$toggle = wrbc_on( $a, 'showToggle' );
$cols_d = max( 1, min( 4, (int) $a['columnsDesktop'] ) );

// What the table sits on (its own background or the one around it): the
// tone class and the accent made readable on it (docs/accessibility.md).
require_once __DIR__ . '/colors.php';
$surface     = wrbc_surface( $a, $block );
$accent_vars = wrbc_accent_vars( $a, $surface );

$classes = array(
	'wrbc-root',
	'wrbc-pricing',
	'wrbc-pricing--' . ( in_array( $a['cardStyle'] ?? '', array( 'bordered', 'filled', 'shadow' ), true ) ? $a['cardStyle'] : 'bordered' ),
	'wrbc-pricing--align-' . ( 'center' === $a['contentAlign'] ? 'center' : 'left' ),
	$uid,
	wrbc_tone_class( $surface, wrbc_context_background( $block ) ),
);
// A taller featured plan only reads as such next to other plans.
if ( wrbc_on( $a, 'featuredScale' ) && $cols_d > 1 ) {
	$classes[] = 'has-featured-scale';
}

$extra = array(
	'id'          => $uid,
	'class'       => implode( ' ', array_filter( $classes ) ),
	'data-period' => $period,
	'style'       => wrbc_css_vars(
		array_merge(
			array(
				'--wrbc-cols-d'      => $cols_d,
				// Same limits as the Columns sliders in the editor.
				'--wrbc-cols-t'      => max( 1, min( 4, (int) $a['columnsTablet'] ) ),
				'--wrbc-cols-m'      => max( 1, min( 2, (int) $a['columnsMobile'] ) ),
				// Same limits as the editor's sliders (hand-written JSON can hold anything).
				'--wrbc-gap'         => is_numeric( $a['gap'] ?? null ) ? wrbc_px( max( 0, min( 64, (float) $a['gap'] ) ) ) : '',
				'--wrbc-card-bg'     => $a['cardBg'] ?? '',
				'--wrbc-featured-bg' => $a['featuredBg'] ?? '',
				'--wrbc-card-border' => $a['cardBorderColor'] ?? '',
				'--wrbc-radius'      => is_numeric( $a['cardRadius'] ?? null ) ? wrbc_px( max( 0, min( 40, (float) $a['cardRadius'] ) ) ) : '',
				'--wrbc-icon-size'   => is_numeric( $a['iconSize'] ?? null ) ? wrbc_px( max( 12, min( 28, (float) $a['iconSize'] ) ) ) : '',
				'--wrbc-icon-stroke' => is_numeric( $a['iconStroke'] ?? null ) ? max( 1, min( 3, (float) $a['iconStroke'] ) ) : '',
			),
			// --wrbc-accent, --wrbc-on-accent (automatic, or the pick made readable),
			// --wrbc-accent-text and --wrbc-accent-hover; then the table's own.
			$accent_vars,
			wrbc_pricing_table_colors( $a, $surface, $accent_vars )
		)
	),
);
if ( wrbc_on( $a, 'showHeader' ) && '' !== trim( wp_strip_all_tags( wrbc_text( $a['title'] ) ) ) ) {
	$extra['aria-labelledby'] = $uid . '-title';
}
?>
<section <?php echo get_block_wrapper_attributes( $extra ); // phpcs:ignore ?>>
	<?php echo wrbc_section_header( $a, $uid ); // phpcs:ignore ?>

	<?php if ( $toggle ) : ?>
		<div class="wrbc-pricing__switch-wrap<?php echo 'center' === $a['headerAlign'] ? ' is-center' : ''; ?>">
			<div class="wrbc-pricing__switch" role="radiogroup" aria-label="<?php esc_attr_e( 'Billing period', 'werun-blocks-community' ); ?>">
				<?php foreach ( array( 'monthly', 'yearly' ) as $p ) : ?>
					<?php
					// A radio needs a name: an emptied label falls back to the default one.
					$label = trim( wrbc_text( 'monthly' === $p ? $a['monthlyLabel'] : $a['yearlyLabel'] ) );
					if ( '' === $label ) {
						$label = 'monthly' === $p ? __( 'Monthly', 'werun-blocks-community' ) : __( 'Yearly', 'werun-blocks-community' );
					}
					?>
					<label class="wrbc-pricing__choice" for="<?php echo esc_attr( $uid . '-period-' . $p ); ?>">
						<input type="radio" class="wrbc-pricing__radio" id="<?php echo esc_attr( $uid . '-period-' . $p ); ?>" name="<?php echo esc_attr( $uid ); ?>-period" value="<?php echo esc_attr( $p ); ?>" aria-controls="<?php echo esc_attr( $uid ); ?>-plans"<?php checked( $p, $period ); ?>>
						<span class="wrbc-pricing__option">
							<?php echo esc_html( $label ); ?>
							<?php if ( 'yearly' === $p && wrbc_on( $a, 'showYearlyNote' ) && '' !== trim( wrbc_text( $a['yearlyNote'] ) ) ) : ?>
								<span class="wrbc-pricing__save"><?php echo esc_html( wrbc_text( $a['yearlyNote'] ) ); ?></span>
							<?php endif; ?>
						</span>
					</label>
				<?php endforeach; ?>
			</div>
		</div>
		<p class="wrbc-sr-only" aria-live="polite" data-wrbc-pricing-status data-monthly="<?php esc_attr_e( 'Showing monthly prices', 'werun-blocks-community' ); ?>" data-yearly="<?php esc_attr_e( 'Showing yearly prices', 'werun-blocks-community' ); ?>"></p>
	<?php endif; ?>

	<div class="wrbc-pricing__grid" id="<?php echo esc_attr( $uid ); ?>-plans" role="list">
		<?php echo $content; // phpcs:ignore -- rendered inner blocks ?>
	</div>
</section>
