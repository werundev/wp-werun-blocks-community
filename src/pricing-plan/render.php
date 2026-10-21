<?php
/**
 * Pricing plan: front-end markup. Both prices are printed; the table's
 * data-period shows one of them.
 *
 * @var array    $attributes Block attributes.
 * @var string   $content    Unused.
 * @var WP_Block $block      Block instance.
 *
 * @package werun-blocks-community
 */

defined( 'ABSPATH' ) || exit;

// wrbc_pricing_plan_colors(): the plans render before their table, so they load it.
require_once dirname( __DIR__ ) . '/pricing/colors.php';

$a   = $attributes;
$ctx = $block->context;
$get = static function ( $key, $fallback ) use ( $ctx ) {
	return array_key_exists( 'werun-community/pricing/' . $key, $ctx ) ? $ctx[ 'werun-community/pricing/' . $key ] : $fallback;
};

$uid      = wrbc_uid( $a, 'wrbc-plan' );
$currency = (string) $get( 'currency', '$' );
$after    = 'after' === $get( 'currencyPosition', 'before' );
$toggle   = (bool) $get( 'showToggle', true );
$default  = 'yearly' === $get( 'defaultPeriod', 'monthly' ) ? 'yearly' : 'monthly';
$featured = ! empty( $a['featured'] );

$btn_style = $get( 'buttonStyle', 'auto' );
$btn_class = 'fill' === $btn_style || ( 'auto' === $btn_style && $featured ) ? 'wrbc-btn' : 'wrbc-btn wrbc-btn--outline';
// A URL esc_url() accepts, or '' (none, javascript:…): the button is then printed as text.
$cta_url = esc_url( trim( wrbc_text( $a['ctaUrl'] ) ) );

/** Whether rich text has any visible text. */
$filled = static function ( $value ) {
	return '' !== trim( wp_strip_all_tags( wrbc_text( $value ) ) );
};

/**
 * One price: currency, amount and period; text that is not a number
 * ("Custom") stands alone. "Number" is digits with . , or spaces, the same
 * test the editor preview uses. Screen readers get the price as one phrase
 * ("$49 per month", not "$, 49, slash month"); the pieces drawn on screen
 * are hidden from them.
 */
$price = static function ( $amount, $period ) use ( $currency, $after ) {
	$amount  = trim( wp_strip_all_tags( wrbc_text( $amount ) ) );
	$period  = trim( wp_strip_all_tags( wrbc_text( $period ) ) );
	$numeric = (bool) preg_match( '/^[\d.,\s]*\d[\d.,\s]*$/', $amount );
	if ( ! $numeric ) {
		return '<span class="wrbc-plan__value">' . esc_html( $amount ) . '</span>';
	}
	$out = '';
	if ( ! $after && '' !== $currency ) {
		$out .= '<span class="wrbc-plan__currency" aria-hidden="true">' . esc_html( $currency ) . '</span>';
	}
	$out .= '<span class="wrbc-plan__value" aria-hidden="true">' . esc_html( $amount ) . '</span>';
	if ( $after && '' !== $currency ) {
		$out .= '<span class="wrbc-plan__currency" aria-hidden="true">' . esc_html( $currency ) . '</span>';
	}
	if ( '' !== $period ) {
		$out .= '<span class="wrbc-plan__period" aria-hidden="true">' . esc_html( $period ) . '</span>';
	}

	if ( '' === $currency ) {
		$spoken = $amount;
	} elseif ( $after ) {
		$spoken = $amount . ' ' . $currency;
	} else {
		// "$49", but "USD 49".
		$spoken = $currency . ( preg_match( '/\p{L}$/u', $currency ) ? ' ' : '' ) . $amount;
	}
	if ( '/' === substr( $period, 0, 1 ) ) {
		$rest = trim( substr( $period, 1 ) );
		/* translators: %s: the billing period after its slash, e.g. "month" in "/month". Screen readers hear "$49 per month". */
		$period = '' === $rest ? '' : sprintf( __( 'per %s', 'werun-blocks-community' ), $rest );
	}
	return $out . '<span class="wrbc-sr-only">' . esc_html( trim( $spoken . ' ' . $period ) ) . '</span>';
};

// Readable on whatever it paints (src/pricing/colors.php; twin: planColors() in colors.js).
$colors = wrbc_pricing_plan_colors(
	$a,
	array(
		'cardStyle'     => $get( 'cardStyle', 'bordered' ),
		'cardBg'        => $get( 'cardBg', '' ),
		'featuredBg'    => $get( 'featuredBg', '' ),
		'accentColor'   => $get( 'accentColor', '' ),
		'onAccentColor' => $get( 'onAccentColor', '' ),
		'textColor'     => $get( 'textColor', '' ),
		'style'         => $get( 'style', array() ),
	),
	wrbc_context_background( $block ),
	$featured
);

$classes = array( 'wrbc-plan', 'wrbc-anim-host', $uid, $colors['class'] );
if ( $featured ) {
	$classes[] = 'is-featured';
}
// No empty heading, and nothing pointing at one, when the plan has no name.
$has_name = $filled( $a['name'] );
// Plan names sit one level under the table's title, or at the title's own
// level when the table prints none (same rule as planLevel in edit.js).
$title_level = max( 2, min( 4, (int) $get( 'titleLevel', 2 ) ) );
$level       = $get( 'showHeader', true ) && $filled( $get( 'title', '' ) ) ? $title_level + 1 : $title_level;
$extra       = array(
	'id'    => $uid,
	'class' => implode( ' ', array_filter( $classes ) ),
	'role'  => 'listitem',
);
if ( $colors['vars'] ) {
	$extra['style'] = wrbc_css_vars( $colors['vars'] );
}
if ( $has_name ) {
	$extra['aria-labelledby'] = $uid . '-name';
}
if ( $get( 'reveal', true ) ) {
	$extra['data-wrbc-reveal'] = '';
}

$show_icon  = $get( 'showPlanIcon', true ) && empty( $a['hideIcon'] ) && ! empty( $a['icon']['name'] );
$show_desc  = $get( 'showDescription', true ) && empty( $a['hideDescription'] ) && $filled( $a['description'] );
$show_badge = $featured && $get( 'showBadge', true ) && $filled( $a['badge'] );
$show_note  = $get( 'showNote', true ) && empty( $a['hideNote'] ) && $filled( $a['note'] );
$features   = is_array( $a['features'] ) ? $a['features'] : array();
$show_excl  = (bool) $get( 'showExcluded', true );
// The featured plan says so in its heading, where heading navigation and the
// button's description find it, not only with the accent and the size: the
// badge text, or "Featured plan" without one. The drawn badge is then hidden
// from screen readers so it isn't read twice.
$featured_in_name = $featured && $has_name;
?>
<div <?php echo get_block_wrapper_attributes( $extra ); // phpcs:ignore ?>>
	<div class="wrbc-plan__head">
		<?php if ( $show_icon ) : ?>
			<?php echo wrbc_icon_wrap( $a['icon'], 'square', 'wrbc-plan__icon' ); // phpcs:ignore ?>
		<?php endif; ?>
		<?php if ( $show_badge ) : ?>
			<span class="wrbc-plan__badge"<?php echo $featured_in_name ? ' aria-hidden="true"' : ''; ?>><?php echo wrbc_rich( $a['badge'] ); // phpcs:ignore ?></span>
		<?php elseif ( $featured && ! $has_name ) : ?>
			<span class="wrbc-sr-only"><?php esc_html_e( 'Featured plan', 'werun-blocks-community' ); ?></span>
		<?php endif; ?>
	</div>
	<?php if ( $has_name ) : ?>
		<h<?php echo (int) $level; ?> class="wrbc-plan__name" id="<?php echo esc_attr( $uid ); ?>-name">
			<?php echo wrbc_rich( $a['name'] ); // phpcs:ignore ?>
			<?php if ( $featured_in_name ) : ?>
				<span class="wrbc-sr-only">(<?php echo $show_badge ? wrbc_rich( $a['badge'] ) : esc_html__( 'Featured plan', 'werun-blocks-community' ); // phpcs:ignore ?>)</span>
			<?php endif; ?>
		</h<?php echo (int) $level; ?>>
	<?php endif; ?>
	<?php if ( $show_desc ) : ?>
		<p class="wrbc-plan__desc"><?php echo wrbc_rich( $a['description'] ); // phpcs:ignore ?></p>
	<?php endif; ?>

	<p class="wrbc-plan__price">
		<?php if ( $toggle || 'monthly' === $default ) : ?>
			<span class="wrbc-plan__amount wrbc-plan__amount--monthly"><?php echo $price( $a['priceMonthly'], $a['periodMonthly'] ); // phpcs:ignore ?></span>
		<?php endif; ?>
		<?php if ( $toggle || 'yearly' === $default ) : ?>
			<span class="wrbc-plan__amount wrbc-plan__amount--yearly"><?php echo $price( $a['priceYearly'], $a['periodYearly'] ); // phpcs:ignore ?></span>
		<?php endif; ?>
	</p>

	<?php if ( $filled( $a['ctaLabel'] ) && '' !== $cta_url ) : ?>
		<a class="<?php echo esc_attr( $btn_class ); ?> wrbc-btn--full wrbc-plan__cta" <?php echo wrbc_link_attrs( $cta_url, ! empty( $a['ctaNewTab'] ) ); // phpcs:ignore ?><?php echo $has_name ? ' aria-describedby="' . esc_attr( $uid ) . '-name"' : ''; ?>>
			<?php echo wrbc_rich( $a['ctaLabel'] ); // phpcs:ignore ?><?php echo wrbc_new_tab_note( ! empty( $a['ctaNewTab'] ) ); // phpcs:ignore ?>
		</a>
	<?php elseif ( $filled( $a['ctaLabel'] ) ) : ?>
		<?php // No URL (or a rejected one): the label with the button's look, not a link to nowhere. ?>
		<span class="<?php echo esc_attr( $btn_class ); ?> wrbc-btn--full wrbc-plan__cta is-static"><?php echo wrbc_rich( $a['ctaLabel'] ); // phpcs:ignore ?></span>
	<?php endif; ?>
	<?php if ( $show_note ) : ?>
		<p class="wrbc-plan__note"><?php echo wrbc_rich( $a['note'] ); // phpcs:ignore ?></p>
	<?php endif; ?>

	<?php
	// Only the lines that print: no empty list.
	$lines = array();
	if ( $get( 'showFeatures', true ) ) {
		foreach ( $features as $feature ) {
			$feature  = is_array( $feature ) ? $feature : array();
			$included = ! isset( $feature['included'] ) || $feature['included'];
			$text     = wrbc_rich( $feature['text'] ?? '' );
			if ( '' !== trim( wp_strip_all_tags( $text ) ) && ( $included || $show_excl ) ) {
				$lines[] = array( $included, $text );
			}
		}
	}
	?>
	<?php if ( $lines ) : ?>
		<?php // role="list": Safari drops the list semantics of a list without bullets. ?>
		<ul class="wrbc-plan__features" role="list">
			<?php foreach ( $lines as $line ) : ?>
				<?php list( $included, $text ) = $line; ?>
				<li class="wrbc-plan__feature <?php echo $included ? 'is-included' : 'is-excluded'; ?>">
					<?php echo wrbc_icon( $included ? $get( 'includedIcon', array( 'name' => 'check' ) ) : $get( 'excludedIcon', array( 'name' => 'x' ) ) ); // phpcs:ignore ?>
					<?php if ( ! $included ) : ?>
						<?php // Said first, so the line isn't heard as included until its end. ?>
						<span class="wrbc-sr-only"><?php esc_html_e( 'Not included:', 'werun-blocks-community' ); ?></span>
					<?php endif; ?>
					<span><?php echo $text; // phpcs:ignore ?></span>
				</li>
			<?php endforeach; ?>
		</ul>
	<?php endif; ?>
</div>
