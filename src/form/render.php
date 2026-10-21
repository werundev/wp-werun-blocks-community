<?php
/**
 * Form: front-end markup. The embed comes from the provider
 * (includes/forms/providers/), built only from validated ids; third-party
 * embeds wait behind the consent placeholder. With gating, a signed ticket
 * travels with the form and a remembered visitor gets the link right away.
 *
 * Twin of the editor's "effective" logic: src/form/edit.js (gateOn, showsAfter).
 *
 * @var array    $attributes Block attributes.
 * @var string   $content    Unused.
 * @var WP_Block $block      Block instance.
 *
 * @package werun-blocks-community
 */

use Werun\BlocksCommunity\Forms\Forms;
use Werun\BlocksCommunity\Gate\Gate;

defined( 'ABSPATH' ) || exit;

if ( ! function_exists( 'wrbc_form_colors' ) ) {
	/**
	 * What the form's content sits on and what keeps it readable there
	 * (docs/accessibility.md). Twin: formColors() in src/form/colors.js.
	 *
	 * - card: the card's own colour (cardBg) or the default near-white card,
	 *   which stays light in a dark section (a light island: its text turns
	 *   ink, and plugin forms with built-in dark text stay readable). The
	 *   card's tone class is dropped when the block's chosen text colour
	 *   already reads on it. The accent as text and focus ring is set on the
	 *   card itself, so no tone class can reset it.
	 * - plain / inline: the block's surface.
	 *
	 * @param array  $a       Attributes.
	 * @param string $look    card | plain | inline.
	 * @param string $surface The block's surface (wrbc_surface()).
	 * @return array{ background: string, card_class: string, card_vars: array, error: string }
	 */
	function wrbc_form_colors( array $a, $look, $surface ) {
		$white = array( 255.0, 255.0, 255.0, 1.0 );
		$under = wrbc_color_rgba( $surface );
		$under = null === $under ? $white : wrbc_color_over( $under, $white );
		$back  = wrbc_color_hex( $under );
		$class = '';
		$vars  = array();
		if ( 'card' === $look ) {
			$card = wrbc_color_rgba( wrbc_text( $a['cardBg'] ?? '' ) );
			if ( null === $card ) {
				// style.scss: white with 3 % of the card's text; ink is the darkest it gets.
				$card = wrbc_color_mix( $white, wrbc_color_rgba( WERUN_BLOCKS_COMMUNITY_INK ), 0.03 );
			}
			$card  = wrbc_color_hex( wrbc_color_over( $card, $under ) );
			$class = wrbc_tone_class( $card, $back );
			$kept  = wrbc_block_colors( $a )['text'];
			if ( '' !== $kept && wrbc_contrast_ratio( $kept, $card ) >= WERUN_BLOCKS_COMMUNITY_AA_TEXT ) {
				$class = '';
			}
			$back   = $card;
			$accent = wrbc_text( $a['accentColor'] ?? '' );
			$text   = wrbc_readable_color( '' !== $accent && null !== wrbc_color_rgba( $accent ) ? $accent : WERUN_BLOCKS_COMMUNITY_ACCENT, $back, WERUN_BLOCKS_COMMUNITY_AA_TEXT );
			$vars   = array(
				'--wrbc-accent-text' => $text,
				'--wrbc-focus'       => $text,
			);
		}
		return array(
			'background' => $back,
			'card_class' => $class,
			'card_vars'  => $vars,
			// Errors (our fields, the gate's): the usual red, as little lighter or darker as this background needs.
			'error'      => wrbc_readable_color( '#b42318', $back, WERUN_BLOCKS_COMMUNITY_AA_TEXT ),
		);
	}
}

if ( ! class_exists( Forms::class ) ) {
	return;
}

$a        = $attributes;
$provider = Forms::get( $a['provider'] ?? '' );
if ( ! $provider || ! $provider->is_available() ) {
	return;
}

$uid = wrbc_uid( $a, 'wrbc-form' );

// The look. In 2.0.0 it was stored in `style`, the supports' attribute
// (src/form/legacy.js): content saved then and not edited since still has
// it there, as a string or spread into the supports' object.
$style = $a['formStyle'] ?? 'card';
$raw   = $block->parsed_block['attrs'] ?? array();
if ( ! isset( $raw['formStyle'] ) && isset( $raw['style'] ) ) {
	if ( is_string( $raw['style'] ) ) {
		$style = $raw['style'];
	} elseif ( is_array( $raw['style'] ) && isset( $raw['style'][0] ) ) {
		$chars = array_filter( $raw['style'], 'is_int', ARRAY_FILTER_USE_KEY );
		ksort( $chars );
		$style = implode( '', array_map( 'wrbc_text', $chars ) );
	}
}
$style  = in_array( $style, array( 'card', 'plain', 'inline' ), true ) ? $style : 'card';
$width  = is_numeric( $a['width'] ?? null ) ? (int) $a['width'] : 640;
$width  = $width <= 0 ? 0 : max( 280, min( 1200, $width ) );
$radius = is_numeric( $a['radius'] ?? null ) ? max( 0, min( 40, (int) $a['radius'] ) ) : 16;
$level  = is_numeric( $a['titleLevel'] ?? null ) ? max( 2, min( 4, (int) $a['titleLevel'] ) ) : 2;
$extra  = is_array( $a['extra'] ?? null ) ? $a['extra'] : array();
$mode   = Forms::consent_mode( $a['consent'] ?? 'inherit' );
$saas   = 'saas' === $provider->kind();

// Gating applies only when the provider can report success and the resource has a published download.
$gate      = is_array( $a['gate'] ?? null ) ? $a['gate'] : array();
$resource  = isset( $gate['resourceId'] ) && is_numeric( $gate['resourceId'] ) ? (int) $gate['resourceId'] : 0;
$gate_on   = ! empty( $gate['enabled'] ) && 'none' !== $provider->gating() && Gate::is_available( $resource );
$gate_text = trim( wp_strip_all_tags( wrbc_text( $gate['label'] ?? '' ) ) );
$gate_text = '' !== $gate_text ? $gate_text : __( 'Download', 'werun-blocks-community' );

// Our success message / redirect: SaaS embeds that report success (form plugins show their own), or any gated form.
$has_event = '' !== $provider->client_event();
$success   = ( $saas && $has_event ) || $gate_on ? trim( wp_strip_all_tags( wrbc_text( $a['successMessage'] ?? '' ) ) ) : '';
$redirect  = '';
if ( $saas && $has_event && ! $gate_on ) {
	$raw = trim( wrbc_text( $a['redirectUrl'] ?? '' ) );
	if ( '' !== $raw && '/' === $raw[0] && '/' !== ( $raw[1] ?? '' ) ) {
		$raw = home_url( $raw );
	}
	$redirect = preg_match( '#^https?://#i', $raw ) ? esc_url_raw( $raw, array( 'http', 'https' ) ) : '';
}

$title = wrbc_rich( $a['title'] ?? '' );
$intro = wrbc_rich( $a['intro'] ?? '' );
$head  = '';
if ( '' !== trim( wp_strip_all_tags( $title ) ) ) {
	$head .= sprintf( '<h%1$d class="wrbc-form__title" id="%2$s-title">%3$s</h%1$d>', $level, esc_attr( $uid ), $title );
}
if ( '' !== trim( wp_strip_all_tags( $intro ) ) ) {
	$head .= '<p class="wrbc-form__intro">' . $intro . '</p>';
}

// What the form sits on: its own background, or the one around it (a dark
// section or group). Text, accent, focus ring and errors follow it; in the
// card style they follow the card (wrbc_form_colors()).
$surface = wrbc_surface( $a, $block );
// The author's colours go out as hex: get_block_wrapper_attributes() passes
// the style through safecss_filter_attr(), which drops rgb(), hsl() and
// color-mix() values, and the maths below must match what the page paints.
$picked = array_merge(
	$a,
	array(
		'accentColor' => wrbc_color_hex( wrbc_text( $a['accentColor'] ?? '' ) ),
		'cardBg'      => wrbc_color_hex( wrbc_text( $a['cardBg'] ?? '' ) ),
	)
);
$colors = wrbc_form_colors( $picked, $style, $surface );

$extra_attrs = array(
	'class' => implode( ' ', array_filter( array( 'wrbc-root', 'wrbc-form', 'wrbc-form--' . $style, 'wrbc-form--' . $provider->kind(), 'wrbc-form--' . $provider->id(), $uid, wrbc_tone_class( $surface, wrbc_context_background( $block ) ) ) ) ),
	'id'    => $uid,
	'style' => wrbc_css_vars(
		array_merge(
			// The accent (button fills), its automatic "on" colour and the accent as text/focus on what the content sits on.
			wrbc_accent_vars( $picked, $colors['background'] ),
			array(
				'--wrbc-form-card-bg' => 'card' === $style ? $picked['cardBg'] : '',
				'--wrbc-form-error'   => $colors['error'],
				'--wrbc-form-width'   => $width > 0 ? $width . 'px' : '',
				'--wrbc-radius'       => $radius . 'px',
			)
		)
	),
);
if ( false !== strpos( $head, 'wrbc-form__title' ) ) {
	$extra_attrs['aria-labelledby'] = $uid . '-title';
}
$wrapper = get_block_wrapper_attributes( $extra_attrs );
$head    = '' !== $head ? '<header class="wrbc-form__header">' . $head . '</header>' : '';
// The card (or the plain frame): its own tone and accent text in the card style.
$inner = sprintf(
	'<div class="%1$s"%2$s>',
	esc_attr( trim( 'wrbc-form__inner ' . $colors['card_class'] ) ),
	$colors['card_vars'] ? ' style="' . esc_attr( wrbc_css_vars( $colors['card_vars'] ) ) . '"' : ''
);

// A visitor who already unlocked this resource gets the link, not the form.
if ( $gate_on && Gate::remembered( $resource, 'hard' === $provider->gating() ) ) {
	printf(
		'<section %1$s>%7$s%2$s<div class="wrbc-form__body"><div class="wrbc-form__result">%3$s<a class="wrbc-btn wrbc-form__download" href="%4$s" rel="nofollow">%5$s%6$s</a></div></div></div></section>',
		$wrapper, // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- get_block_wrapper_attributes().
		$head, // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- wrbc_rich().
		'' !== $success ? '<p class="wrbc-form__ready">' . esc_html( $success ) . '</p>' : '',
		esc_url( Gate::download_url( $resource ) ),
		wrbc_icon( 'download' ), // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- inline SVG from the bundled set.
		esc_html( $gate_text ),
		$inner // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped above.
	);
	return;
}

// The frames' accessible name: the block's title, else the provider's own name of the form (Provider::frame_title() falls back to "Form from <provider>").
$named = html_entity_decode( trim( wp_strip_all_tags( $title ) ), ENT_QUOTES, 'UTF-8' );
$args  = array(
	'formId' => $a['formId'] ?? '',
	'region' => $a['region'] ?? '',
	'extra'  => $extra,
	'uid'    => $uid,
	'inline' => 'inline' === $style,
	'title'  => '' !== $named ? $named : trim( wp_strip_all_tags( wrbc_text( $a['formTitle'] ?? '' ) ) ),
);
$valid = $provider->validate( $args );
if ( null === $valid ) {
	return; // Ids that don't validate print nothing (the editor says why).
}
// The provider's own id for the form (HubSpot GUID, Marketo number, plugin form id): ties events and hard tickets to it.
$form_key = wrbc_text( $valid['form'] ?? ( $valid['id'] ?? '' ) );

$hard = 'hard' === $provider->gating();
if ( $gate_on ) {
	$page           = isset( $block->context['postId'] ) ? (int) $block->context['postId'] : (int) get_queried_object_id();
	$args['ticket'] = Gate::ticket( $resource, $page, $hard ? 'hard' : 'soft', $hard ? $provider->id() . ':' . $form_key : '' );
	$gate_on        = '' !== $args['ticket'];
}

$embed = Forms::behind_consent( $provider, $provider->render( $args ), $mode, $provider->consent_host( $valid ) );

$config = array(
	'provider' => $provider->id(),
	'kind'     => $provider->kind(),
	'consent'  => $provider->needs_consent() ? $mode : 'none',
	'event'    => $saas ? $provider->client_event() : '',
	'origins'  => array_map(
		static function ( $host ) {
			return 'https://' . $host;
		},
		$provider->hosts()
	),
	'success'  => $gate_on ? '' : $success,
	'redirect' => $redirect,
	'gate'     => $gate_on,
	// Texts view.js shows or announces (loading, a failed load, sending), and the name it gives a provider's frame that has none.
	'labels'   => array(
		'loading' => __( 'Loading the form…', 'werun-blocks-community' ),
		'loaded'  => __( 'The form has loaded.', 'werun-blocks-community' ),
		/* translators: %s: provider name, e.g. HubSpot. */
		'failed'  => sprintf( __( 'The %s form could not be loaded. A content blocker or a network problem may be stopping it.', 'werun-blocks-community' ), $provider->label() ),
		'retry'   => __( 'Try again', 'werun-blocks-community' ),
		'sending' => __( 'Sending…', 'werun-blocks-community' ),
		'frame'   => $provider->frame_title( $args ),
	),
);

$body = '<div class="wrbc-form__slot">' . $embed . '</div>';
if ( $saas ) {
	// Announcements without a visible place of their own (the form loaded, sending, an error the focus can't move to).
	$body .= '<p class="wrbc-sr-only" role="status" data-wrbc-form-live></p>';
}
if ( $gate_on ) {
	// wrbc-gate (src/shared/view/gate.js) adds the ticket to native forms, hears the success event and swaps in the link.
	// The result is a live region from the start (one added with its text isn't announced), focusable for view.js.
	wp_enqueue_script( 'wrbc-gate' );
	$body = sprintf(
		'<div class="wrbc-form__gate" data-wrbc-gate="%1$s">%2$s<div class="wrbc-form__result" data-wrbc-gate-result role="status" tabindex="-1"></div>%3$s</div>',
		esc_attr(
			(string) wp_json_encode(
				array(
					'ticket'   => $args['ticket'],
					'mode'     => $hard ? 'hard' : 'soft',
					'provider' => $provider->id(),
					'formId'   => $form_key,
					'labels'   => array(
						'download'  => $gate_text,
						'ready'     => $success,
						'unlocking' => __( 'Preparing your download…', 'werun-blocks-community' ),
						'error'     => __( 'The download could not be unlocked. Please try again.', 'werun-blocks-community' ),
					),
				),
				JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP
			)
		),
		$body,
		'<p class="wrbc-form__note">' . esc_html__( 'The download link appears here once the form is sent.', 'werun-blocks-community' ) . '</p>'
	);
} elseif ( '' !== $success ) {
	// Empty until view.js writes the message in (config "success"): a live region already on the page is announced.
	$body .= '<p class="wrbc-form__success" role="status" tabindex="-1"></p>';
}

printf(
	'<section %1$s data-wrbc-form="%2$s">%5$s%3$s<div class="wrbc-form__body">%4$s</div></div></section>',
	$wrapper, // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- get_block_wrapper_attributes().
	esc_attr( (string) wp_json_encode( $config, JSON_UNESCAPED_SLASHES ) ),
	$head, // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- wrbc_rich().
	$body, // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- provider markup, escaped there.
	$inner // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped above.
);
