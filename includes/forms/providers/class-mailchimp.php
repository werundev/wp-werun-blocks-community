<?php
/**
 * Mailchimp: the embedded form's action URL (https://<x>.list-manage.com/
 * subscribe/post?u=…&id=…), validated, and our own HTML form posting there.
 * Nothing loads from Mailchimp until the visitor submits, so no consent
 * placeholder. view.js sends the form through Mailchimp's JSONP endpoint
 * (post-json, same validated host) when the forms consent allows it, so a
 * rejected address shows as an error; otherwise it posts into a hidden
 * frame, whose answer can't be read.
 *
 * @package werun-blocks-community
 */

namespace Werun\BlocksCommunity\Forms\Providers;

use Werun\BlocksCommunity\Forms\Provider;

defined( 'ABSPATH' ) || exit;

/**
 * Mailchimp.
 */
final class Mailchimp extends Provider {

	public function id(): string {
		return 'mailchimp';
	}

	public function label(): string {
		return 'Mailchimp';
	}

	public function hosts(): array {
		return array( 'list-manage.com' );
	}

	public function needs_consent(): bool {
		return false;
	}

	/** view.js posts into a hidden iframe and reports when it loads. */
	public function client_event(): string {
		return 'dom:wrbc:mailchimp-sent';
	}

	public function gating(): string {
		return 'soft';
	}

	public function hint(): string {
		return __( 'The form action URL from Mailchimp\'s embedded form code: https://….list-manage.com/subscribe/post?u=…&id=…', 'werun-blocks-community' );
	}

	public function validate( array $args ): ?array {
		$p = self::url_parts( str_replace( '&amp;', '&', wrbc_text( $args['formId'] ?? '' ) ), array(), array( '.list-manage.com' ) );
		if ( null === $p || ! in_array( $p['path'], array( '/subscribe/post', '/subscribe/post-json' ), true ) ) {
			return null;
		}
		parse_str( $p['query'], $q );
		$u   = self::match( $q['u'] ?? '', '/^[0-9a-f]{10,40}$/' );
		$id  = self::match( $q['id'] ?? '', '/^[0-9a-f]{6,16}$/' );
		$fid = self::match( $q['f_id'] ?? '', '/^[0-9a-f]{6,16}$/' );
		if ( null === $u || null === $id || ! preg_match( '/^[a-z0-9-]{1,63}(\.us\d{1,3})?\.list-manage\.com$/', $p['host'] ) ) {
			return null;
		}
		$extra = is_array( $args['extra'] ?? null ) ? $args['extra'] : array();
		$query = array(
			'u'  => $u,
			'id' => $id,
		);
		if ( null !== $fid ) {
			$query['f_id'] = $fid;
		}
		return array(
			'action' => 'https://' . $p['host'] . '/subscribe/post?' . http_build_query( $query ),
			'u'      => $u,
			'id'     => $id,
			'name'   => ! empty( $extra['name'] ),
			'button' => trim( wp_strip_all_tags( wrbc_text( $extra['button'] ?? '' ) ) ),
			'inline' => ! empty( $args['inline'] ),
		);
	}

	protected function markup( array $v, array $args ): string {
		$uid    = sanitize_html_class( wrbc_text( $args['uid'] ?? 'wrbc-form' ) );
		$button = '' !== $v['button'] ? $v['button'] : __( 'Subscribe', 'werun-blocks-community' );
		// What view.js says about Mailchimp's answer (its own texts are English and may hold HTML).
		$messages = array(
			'already' => __( 'This email address is already subscribed.', 'werun-blocks-community' ),
			'limit'   => __( 'Too many sign-up attempts with this address. Please try again in a few minutes.', 'werun-blocks-community' ),
			'failed'  => __( 'The subscription could not be sent. Please try again.', 'werun-blocks-community' ),
		);
		$out      = sprintf(
			'<form class="wrbc-form__native wrbc-form__mc" action="%1$s" method="post" target="_blank" data-wrbc-mc="%2$s">',
			esc_url( $v['action'] ),
			esc_attr( (string) wp_json_encode( $messages ) )
		);
		if ( $v['name'] ) {
			// Optional here; Mailchimp may require it (its answer then marks the field, view.js).
			$out .= sprintf(
				'<div class="wrbc-form__field"><label class="wrbc-form__label" for="%1$s-fname">%2$s</label><p class="wrbc-form__error" id="%1$s-fname-error"></p><input class="wrbc-form__input" id="%1$s-fname" type="text" name="FNAME" autocomplete="given-name" data-wrbc-missing="%3$s"></div>',
				esc_attr( $uid ),
				esc_html__( 'First name', 'werun-blocks-community' ),
				esc_attr__( 'Enter your first name.', 'werun-blocks-community' )
			);
		}
		// Required in words, not only for screen readers (the attribute says it to them, so the word is hidden from them);
		// view.js writes the error between the label and the field, tied with aria-describedby (WCAG 3.3.1–3.3.3).
		$out .= sprintf(
			'<div class="wrbc-form__field"><label class="wrbc-form__label" for="%1$s-email">%2$s <span class="wrbc-form__req" aria-hidden="true">%3$s</span></label><p class="wrbc-form__error" id="%1$s-email-error"></p><input class="wrbc-form__input" id="%1$s-email" type="email" name="EMAIL" autocomplete="email" required data-wrbc-missing="%4$s" data-wrbc-invalid="%5$s"></div>',
			esc_attr( $uid ),
			esc_html__( 'Email address', 'werun-blocks-community' ),
			esc_html__( '(required)', 'werun-blocks-community' ),
			esc_attr__( 'Enter your email address.', 'werun-blocks-community' ),
			esc_attr__( 'Enter an email address like name@example.com.', 'werun-blocks-community' )
		);
		// Mailchimp's bot trap: a field people never see or fill.
		$out .= sprintf( '<div class="wrbc-form__trap" aria-hidden="true"><input type="text" name="b_%1$s_%2$s" tabindex="-1" value="" autocomplete="off"></div>', esc_attr( $v['u'] ), esc_attr( $v['id'] ) );
		// Mailchimp's answer when it isn't about one field (already subscribed, too many attempts, network): an alert, so it's heard where the focus stays (the button).
		$out .= sprintf( '<p class="wrbc-form__mc-message" id="%s-mc-message" role="alert"></p>', esc_attr( $uid ) );
		$out .= sprintf( '<p class="wrbc-form__actions"><button class="wrbc-btn wrbc-form__submit" type="submit">%s</button></p>', esc_html( $button ) );
		return $out . '</form>';
	}
}
