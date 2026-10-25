<?php
/**
 * Calendly: the event path (user/event) as an inline scheduling widget.
 *
 * @package werun-blocks-community
 */

namespace Werun\BlocksCommunity\Forms\Providers;

use Werun\BlocksCommunity\Forms\Provider;

defined( 'ABSPATH' ) || exit;

/**
 * Calendly.
 */
final class Calendly extends Provider {

	public function id(): string {
		return 'calendly';
	}

	public function label(): string {
		return 'Calendly';
	}

	public function hosts(): array {
		return array( 'calendly.com', 'assets.calendly.com' );
	}

	public function client_event(): string {
		return 'message:calendly.event_scheduled';
	}

	public function gating(): string {
		return 'soft';
	}

	public function hint(): string {
		return __( 'The event link, e.g. https://calendly.com/your-name/30min (or your-name/30min).', 'werun-blocks-community' );
	}

	public function consent_label(): string {
		return __( 'Load the Calendly scheduler', 'werun-blocks-community' );
	}

	public function validate( array $args ): ?array {
		$value = trim( wrbc_text( $args['formId'] ?? '' ) );
		$p     = self::url_parts( $value, array( 'calendly.com' ) );
		if ( null !== $p ) {
			$value = ltrim( $p['path'], '/' );
		}
		$path = self::match( rtrim( $value, '/' ), '#^[A-Za-z0-9_-]{1,64}(/[A-Za-z0-9_-]{1,64})?$#' );
		if ( null === $path ) {
			return null;
		}
		$extra = is_array( $args['extra'] ?? null ) ? $args['extra'] : array();
		return array(
			'url'    => 'https://calendly.com/' . $path . '?hide_gdpr_banner=1' . ( empty( $extra['hideDetails'] ) ? '' : '&hide_event_type_details=1' ),
			'height' => self::height( $extra, 700 ),
		);
	}

	protected function markup( array $v, array $args ): string {
		return $this->mount(
			array(
				'type' => 'calendly',
				'src'  => 'https://assets.calendly.com/assets/external/widget.js',
				'url'  => $v['url'],
			),
			sprintf( '<div class="wrbc-form__calendly" style="height:%dpx"></div>', $v['height'] )
		);
	}
}
