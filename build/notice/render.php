<?php
/**
 * Notice: front-end markup.
 *
 * Schedule: decided here, on the server, in the site's time zone. Outside
 * the window nothing is printed. (A full-page cache keeps whatever it stored,
 * so a cached page changes only when the cache expires.)
 *
 * Roles: a notice printed with the page is not a live region (role="status"
 * and role="alert" are for messages that appear while the page is in use,
 * and one already there when the page loads is not read out reliably). An
 * inline notice is a note beside the content (role="note"); a bar is a
 * labelled region, a landmark people can jump to or skip. A warning or danger
 * notice marked urgent is read out once by view.js, through an assertive live
 * region, after the page loads. The tone is in words too (a visually hidden
 * "Warning:"), never told by colour and icon alone. Twin rules in edit.js
 * (noticeRole()).
 *
 * Colours: the notice knows what it paints (its own background, the tone, or
 * the tone's tint over the section it sits in) and prints the tone class for
 * it (wrbc-is-dark / wrbc-is-light: readable text when none was chosen), the
 * colour on the tone (the chosen one made readable, else white or ink) and
 * the tone as icon / ring colour at 3:1 where it needs adjusting.
 *
 * @var array    $attributes Block attributes.
 * @var string   $content    Unused.
 * @var WP_Block $block      Block instance.
 *
 * @package werun-blocks-community
 */

defined( 'ABSPATH' ) || exit;

// Runs in its own scope: nothing here becomes a global.
( static function ( $attributes, $content, $block ) {
$a = $attributes;

// ── Schedule (twin: scheduleState() in edit.js) ──
if ( wrbc_on( $a, 'schedule', false ) ) {
	/** A stored date ("2026-10-16T09:00:00") as a timestamp in the site's time zone, or null. */
	$wrbc_notice_time = static function ( $value ) {
		$value = trim( wrbc_text( $value ) );
		if ( ! preg_match( '/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2})?$/', $value ) ) {
			return null;
		}
		$date = date_create_immutable( str_replace( 'T', ' ', $value ), wp_timezone() );
		return $date ? $date->getTimestamp() : null;
	};
	$now   = (int) current_time( 'timestamp', true ); // phpcs:ignore WordPress.DateTime.CurrentTimeTimestamp.RequestedUTC -- UTC "now", compared with UTC timestamps.
	$start = $wrbc_notice_time( $a['scheduleStart'] ?? '' );
	$end   = $wrbc_notice_time( $a['scheduleEnd'] ?? '' );
	if ( ( null !== $start && $now < $start ) || ( null !== $end && $now >= $end ) ) {
		return;
	}
}

/** Whether rich text has any visible text. */
$wrbc_notice_filled = static function ( $value ) {
	return '' !== trim( wp_strip_all_tags( wrbc_text( $value ) ) );
};

$title   = wrbc_text( $a['title'] ?? '' );
$message = wrbc_text( $a['message'] ?? '' );
$has_t   = $wrbc_notice_filled( $title );
$has_m   = $wrbc_notice_filled( $message );
$link    = wrbc_on( $a, 'showLink', false ) && $wrbc_notice_filled( $a['linkLabel'] ?? '' );

// An empty notice prints nothing.
if ( ! $has_t && ! $has_m && ! $link ) {
	return;
}

$uid    = wrbc_uid( $a, 'wrbc-notice' );
$tones  = array( 'info', 'success', 'warning', 'danger', 'neutral', 'brand' );
$tone   = in_array( $a['tone'] ?? '', $tones, true ) ? $a['tone'] : 'info';
$solid  = 'solid' === ( $a['appearance'] ?? '' );
$layout = 'bar' === ( $a['layout'] ?? '' ) ? 'bar' : 'inline';
$pos    = in_array( $a['barPosition'] ?? '', array( 'top', 'sticky-top', 'sticky-bottom' ), true ) ? $a['barPosition'] : 'top';
$sticky = 'bar' === $layout && 'top' !== $pos;
$dismiss = wrbc_on( $a, 'dismissible', false );

// Per-tone default icon when the notice has none of its own; {} = no icon.
$tone_icons = array(
	'info'    => 'info',
	'success' => 'circle-check',
	'warning' => 'triangle-alert',
	'danger'  => 'octagon-alert',
	'neutral' => 'bell',
	'brand'   => 'megaphone',
);
$icon = array_key_exists( 'icon', $a ) && is_array( $a['icon'] ) ? $a['icon'] : array( 'name' => $tone_icons[ $tone ] );

// Role (see the header comment).
$role   = 'bar' === $layout ? 'region' : 'note';
$urgent = in_array( $tone, array( 'warning', 'danger' ), true ) && wrbc_on( $a, 'urgent', false );
// The tone in words, so it is not told by colour alone (WCAG 1.4.1).
$tone_words = array(
	'info'    => __( 'Information:', 'werun-blocks-community' ),
	'success' => __( 'Success:', 'werun-blocks-community' ),
	'warning' => __( 'Warning:', 'werun-blocks-community' ),
	'danger'  => __( 'Important:', 'werun-blocks-community' ),
	'neutral' => '',
	'brand'   => '',
);

// ── Colours (WCAG 1.4.3, 1.4.11; docs/accessibility.md). Twin: noticeColors() in edit.js. ──
// The tone: the custom colour (a translucent one over what's behind it), or
// the tone's own (style.scss; brand is the accent).
$tone_colors = array(
	'info'    => '#1d4ed8',
	'success' => '#15803d',
	'warning' => '#b45309',
	'danger'  => '#b91c1c',
	'neutral' => '#334155',
	'brand'   => WERUN_BLOCKS_COMMUNITY_ACCENT,
);
$own          = wrbc_block_surface( $a, 'werun-community/notice' ); // Its own background (Color panel), '' = none.
$surface      = wrbc_surface( $a, $block );               // That, or the one around it.
$around       = wrbc_context_background( $block );
$surface_rgba = wrbc_color_rgba( $surface );
$surface_rgba = $surface_rgba ? $surface_rgba : wrbc_color_rgba( WERUN_BLOCKS_COMMUNITY_PAPER );
$tone_raw     = trim( wrbc_text( $a['toneColor'] ?? '' ) );
$tone_rgba    = wrbc_color_rgba( $tone_raw );
// Printed only when it can be read (or is a palette variable), so the maths
// below match the page; anything else leaves the tone's own colour.
$tone_css = ( $tone_rgba || 0 === strpos( $tone_raw, 'var(' ) ) ? $tone_raw : '';
if ( $tone_rgba && $tone_rgba[3] < 1 ) {
	$tone_rgba = wrbc_color_over( $tone_rgba, $surface_rgba );
}
$tone_hex = $tone_rgba ? wrbc_color_hex( $tone_rgba ) : $tone_colors[ $tone ];
// What the text sits on: the own background, the tone (Solid), or the tone
// at 9 % over what's around the notice (Soft).
if ( '' !== $own ) {
	$paint = $own;
} elseif ( $solid ) {
	$paint = $tone_hex;
} else {
	$paint = wrbc_color_hex( wrbc_color_mix( $surface_rgba, wrbc_color_rgba( $tone_hex ), 0.09 ) );
}
// On the tone (Solid text and icons, every button's label): the chosen
// colour, made readable when it isn't, or white / ink.
$on_rgba   = $solid ? wrbc_color_rgba( wrbc_text( $a['onToneColor'] ?? '' ) ) : null;
$on_chosen = $on_rgba ? wrbc_color_hex( $on_rgba[3] < 1 ? wrbc_color_over( $on_rgba, wrbc_color_rgba( $tone_hex ) ) : $on_rgba ) : '';
$on_tone   = '' !== $on_chosen ? wrbc_readable_color( $on_chosen, $tone_hex, WERUN_BLOCKS_COMMUNITY_AA_TEXT ) : wrbc_on_color( $tone_hex );
// The tone as icon and focus-ring colour where the text doesn't sit on the
// tone itself (Soft, own background): 3:1 on what it sits on.
$ink = ( ! $solid || '' !== $own ) ? wrbc_readable_color( $tone_hex, $paint, WERUN_BLOCKS_COMMUNITY_AA_UI ) : '';
// A tone-filled button with a dark label lightens on hover / focus instead of
// darkening (the label would lose contrast): its own --wrbc-accent-hover.
$hover = ( ! $solid || '' !== $own ) && true === wrbc_is_dark_color( $on_tone ) ? wrbc_color_hex( wrbc_color_mix( wrbc_color_rgba( $tone_hex ), wrbc_color_rgba( WERUN_BLOCKS_COMMUNITY_PAPER ), 0.14 ) ) : '';

$classes = array(
	'wrbc-root',
	'wrbc-notice',
	'wrbc-notice--' . $tone,
	'wrbc-notice--' . ( $solid ? 'solid' : 'soft' ),
	'wrbc-notice--' . $layout,
	$uid,
	wrbc_tone_class( $paint, $around ),
);
if ( 'bar' === $layout ) {
	$classes[] = 'wrbc-notice--pos-' . $pos;
	if ( 'center' === ( $a['contentAlign'] ?? '' ) ) {
		$classes[] = 'wrbc-notice--center';
	}
}
if ( $dismiss ) {
	$classes[] = 'is-dismissible';
}

$extra = array(
	'id'    => $uid,
	'class' => implode( ' ', array_filter( $classes ) ),
	'role'  => $role,
	'style' => wrbc_css_vars(
		array(
			'--wrbc-tone-color'       => $tone_css,
			// Only what differs from the stylesheet's white and plain tone.
			'--wrbc-on-tone-color'    => ( '' !== $on_chosen || '#ffffff' !== strtolower( $on_tone ) ) ? $on_tone : '',
			'--wrbc-tone-ink-color'   => ( '' !== $ink && strtolower( $ink ) !== strtolower( $tone_hex ) ) ? $ink : '',
			'--wrbc-tone-hover-color' => $hover,
			// The opaque backdrop of a soft sticky bar: what it sits on (view.js refines it).
			'--wrbc-notice-underlay'  => ( $sticky && ! $solid && '' === $own ) ? wrbc_color_hex( $surface_rgba ) : '',
			// Same limits as the editor's sliders.
			'--wrbc-icon-size'        => wrbc_px( max( 12, min( 40, (float) ( is_scalar( $a['iconSize'] ?? null ) ? $a['iconSize'] : 20 ) ) ) ),
			'--wrbc-radius'           => 'inline' === $layout ? wrbc_px( max( 0, min( 32, (int) ( is_scalar( $a['radius'] ?? null ) ? $a['radius'] : 12 ) ) ) ) : '',
			'--wrbc-notice-offset'    => $sticky ? max( 0, min( 200, (int) ( is_scalar( $a['stickyOffset'] ?? null ) ? $a['stickyOffset'] : 0 ) ) ) . 'px' : '',
		)
	),
);
// A region needs a name to be a landmark: the title, or a generic one.
if ( $has_t ) {
	$extra['aria-labelledby'] = $uid . '-title';
} elseif ( 'region' === $role ) {
	$extra['aria-label'] = __( 'Announcement', 'werun-blocks-community' );
}
if ( $urgent ) {
	$extra['data-wrbc-urgent'] = '1';
}
if ( $dismiss ) {
	$days = max( 0, min( 365, (int) ( is_scalar( $a['rememberDays'] ?? null ) ? $a['rememberDays'] : 7 ) ) );
	// The key changes when the text changes, so an edited notice shows again.
	$hash = substr( md5( $title . '|' . $message . '|' . wrbc_text( $a['linkLabel'] ?? '' ) . '|' . wrbc_text( $a['linkUrl'] ?? '' ) ), 0, 10 );
	$id   = preg_replace( '/[^A-Za-z0-9_-]/', '', wrbc_text( $a['noticeId'] ?? '' ) );
	$extra['data-wrbc-notice'] = wp_json_encode(
		array(
			'key'  => 'wrbc-notice:' . ( '' !== $id ? $id : 'n' ) . ':' . $hash,
			'days' => $days,
		)
	);
	$extra['data-dismissed'] = __( 'Notice dismissed', 'werun-blocks-community' );
}

$word = $tone_words[ $tone ];
// A paragraph by default (a bar often sits above the page's h1); a heading
// level when the author picks one for the page's outline.
$title_tag = in_array( $a['titleTag'] ?? '', array( 'p', 'h2', 'h3', 'h4', 'h5', 'h6' ), true ) ? $a['titleTag'] : 'p';
// The close icon has no animation control: a hand-edited "loop" can't move forever.
$close_icon            = is_array( $a['closeIcon'] ?? null ) && ! empty( $a['closeIcon']['name'] ) ? $a['closeIcon'] : array( 'name' => 'x' );
$close_icon['trigger'] = 'hover';
?>
<div <?php echo get_block_wrapper_attributes( $extra ); // phpcs:ignore -- escaped by core ?>>
	<div class="wrbc-notice__inner">
		<?php echo wrbc_icon_wrap( $icon, 'none', 'wrbc-notice__icon' ); // phpcs:ignore -- generated SVG ?>
		<div class="wrbc-notice__content">
			<?php if ( ! $has_t && ! $has_m && '' !== $word ) : ?>
				<span class="wrbc-sr-only"><?php echo esc_html( $word ); ?></span>
			<?php endif; ?>
			<?php if ( $has_t ) : ?>
				<<?php echo $title_tag; // phpcs:ignore -- one of a fixed list ?> class="wrbc-notice__title" id="<?php echo esc_attr( $uid ); ?>-title">
					<?php if ( '' !== $word ) : ?>
						<span class="wrbc-sr-only"><?php echo esc_html( $word ); ?> </span>
					<?php endif; ?>
					<?php echo wrbc_rich( $title ); // phpcs:ignore ?>
				</<?php echo $title_tag; // phpcs:ignore -- one of a fixed list ?>>
			<?php endif; ?>
			<?php if ( $has_m ) : ?>
				<p class="wrbc-notice__message">
					<?php if ( ! $has_t && '' !== $word ) : ?>
						<span class="wrbc-sr-only"><?php echo esc_html( $word ); ?> </span>
					<?php endif; ?>
					<?php echo wrbc_rich( $message ); // phpcs:ignore ?>
				</p>
			<?php endif; ?>
		</div>
		<?php if ( $link ) : ?>
			<?php $link_class = 'button' === ( $a['linkStyle'] ?? '' ) ? 'wrbc-btn wrbc-notice__button' : 'wrbc-notice__link'; ?>
			<a class="<?php echo esc_attr( $link_class ); ?>" <?php echo wrbc_link_attrs( wrbc_text( $a['linkUrl'] ?? '' ), wrbc_on( $a, 'linkNewTab', false ) ); // phpcs:ignore -- escaped in the helper ?>>
				<?php echo wrbc_rich( $a['linkLabel'] ); // phpcs:ignore ?>
				<?php if ( wrbc_on( $a, 'linkNewTab', false ) ) : ?>
					<span class="wrbc-sr-only"><?php esc_html_e( '(opens in a new tab)', 'werun-blocks-community' ); ?></span>
				<?php endif; ?>
			</a>
		<?php endif; ?>
		<?php if ( $dismiss ) : ?>
			<?php // Shown by view.js: without JavaScript it could not close anything. ?>
			<button type="button" class="wrbc-notice__close" data-wrbc-notice-close hidden aria-label="<?php echo esc_attr( $has_t ? sprintf( /* translators: %s: notice title. */ __( 'Dismiss: %s', 'werun-blocks-community' ), wp_strip_all_tags( $title ) ) : __( 'Dismiss notice', 'werun-blocks-community' ) ); ?>">
				<?php echo wrbc_icon( $close_icon ); // phpcs:ignore -- generated SVG ?>
			</button>
		<?php endif; ?>
	</div>
</div>
<?php
} )( $attributes, $content, $block );
