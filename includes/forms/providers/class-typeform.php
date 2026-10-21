<?php
/**
 * Typeform: the form id (or its URL), embedded as a widget with Typeform's
 * embed SDK.
 *
 * @package werun-blocks-community
 */

namespace Werun\BlocksCommunity\Forms\Providers;

use Werun\BlocksCommunity\Forms\Provider;

defined( 'ABSPATH' ) || exit;

/**
 * Typeform.
 */
final class Typeform extends Provider {

	public function id(): string {
		return 'typeform';
	}

	public function label(): string {
		return 'Typeform';
	}

	public function hosts(): array {
		return array( 'embed.typeform.com', 'form.typeform.com' );
	}

	public function client_event(): string {
		return 'callback';
	}

	public function gating(): string {
		return 'soft';
	}

	public function hint(): string {
		return __( 'Form ID or URL, e.g. https://yourname.typeform.com/to/AbC123xy.', 'werun-blocks-community' );
	}

	public function validate( array $args ): ?array {
		$value = trim( wrbc_text( $args['formId'] ?? '' ) );
		if ( preg_match( '#^https://[a-z0-9-]+\.typeform\.com/to/([A-Za-z0-9]{4,16})(?:[?\#].*)?$#', $value, $m ) ) {
			$value = $m[1];
		}
		$id = self::match( $value, '/^[A-Za-z0-9]{4,16}$/' );
		if ( null === $id ) {
			return null;
		}
		$extra = is_array( $args['extra'] ?? null ) ? $args['extra'] : array();
		return array(
			'id'     => $id,
			'height' => self::height( $extra, 560 ),
		);
	}

	protected function markup( array $v, array $args ): string {
		// The SDK reads "key=value,key=value": no commas or equals signs in the frame's title.
		$title = trim( preg_replace( '/[\s,=]+/', ' ', $this->frame_title( $args ) ) );
		return $this->mount(
			array(
				'type' => 'typeform',
				'src'  => 'https://embed.typeform.com/next/embed.js',
			),
			sprintf(
				'<div data-tf-widget="%1$s" data-tf-on-submit="wrbcFormTypeformSubmit" data-tf-disable-tracking data-tf-iframe-props="title=%2$s" style="height:%3$dpx"></div>',
				esc_attr( $v['id'] ),
				esc_attr( $title ),
				$v['height']
			)
		);
	}
}
