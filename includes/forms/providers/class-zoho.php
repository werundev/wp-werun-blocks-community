<?php
/**
 * Zoho Forms: the form's permalink (/<org>/form/<Name>/formperma/<key>) on
 * the data centre's fixed host, in an iframe.
 *
 * @package werun-blocks-community
 */

namespace Werun\BlocksCommunity\Forms\Providers;

use Werun\BlocksCommunity\Forms\Provider;
use Werun\BlocksCommunity\Integrations\Integrations;

defined( 'ABSPATH' ) || exit;

/**
 * Zoho.
 */
final class Zoho extends Provider {

	public function id(): string {
		return 'zoho';
	}

	public function label(): string {
		return 'Zoho Forms';
	}

	public function regions(): array {
		return array(
			'com'    => 'zohopublic.com',
			'eu'     => 'zohopublic.eu',
			'in'     => 'zohopublic.in',
			'com.au' => 'zohopublic.com.au',
			'jp'     => 'zohopublic.jp',
		);
	}

	public function default_region(): string {
		return (string) Integrations::get( 'forms.zoho_dc' );
	}

	public function hosts(): array {
		return array_map(
			static function ( $host ) {
				return 'forms.' . $host;
			},
			array_values( $this->regions() )
		);
	}

	public function hint(): string {
		return __( 'The form\'s permalink, e.g. https://forms.zohopublic.com/yourorg/form/Contact/formperma/AbC…', 'werun-blocks-community' );
	}

	public function validate( array $args ): ?array {
		$value  = trim( wrbc_text( $args['formId'] ?? '' ) );
		$region = $this->region( $args['region'] ?? '', $this->default_region() );
		// A pasted URL sets the data centre from its host.
		$p = self::url_parts( $value, $this->hosts() );
		if ( null !== $p ) {
			$region = (string) array_search( substr( $p['host'], 6 ), $this->regions(), true );
			$value  = $p['path'];
		}
		$path = self::match( $value, '#^/[A-Za-z0-9_.-]{1,64}/form/[A-Za-z0-9_-]{1,100}/formperma/[A-Za-z0-9_-]{10,100}$#' );
		if ( null === $path || ! isset( $this->regions()[ $region ] ) ) {
			return null;
		}
		$extra = is_array( $args['extra'] ?? null ) ? $args['extra'] : array();
		return array(
			'src'    => 'https://forms.' . $this->regions()[ $region ] . $path,
			'height' => self::height( $extra, 640 ),
		);
	}

	public function consent_label(): string {
		return __( 'Load the Zoho form', 'werun-blocks-community' );
	}

	/** The data centre's host the frame loads from (forms.zohopublic.eu, …). */
	public function consent_host( array $v ): string {
		$host = (string) wp_parse_url( (string) ( $v['src'] ?? '' ), PHP_URL_HOST );
		return '' !== $host ? $host : parent::consent_host( $v );
	}

	protected function markup( array $v, array $args ): string {
		return $this->iframe( $v['src'], $this->frame_title( $args ), $v['height'] );
	}
}
