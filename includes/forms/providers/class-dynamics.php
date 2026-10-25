<?php
/**
 * Microsoft Dynamics 365 Customer Insights – Journeys forms: form id from
 * the block, organisation id from Integrations, region from a fixed list
 * (the API, the cached form and the form loader all live on that region's
 * fixed hosts).
 *
 * @package werun-blocks-community
 */

namespace Werun\BlocksCommunity\Forms\Providers;

use Werun\BlocksCommunity\Forms\Provider;
use Werun\BlocksCommunity\Integrations\Integrations;

defined( 'ABSPATH' ) || exit;

/**
 * Dynamics.
 */
final class Dynamics extends Provider {

	public function id(): string {
		return 'dynamics';
	}

	public function label(): string {
		return __( 'Dynamics 365 Customer Insights – Journeys', 'werun-blocks-community' );
	}

	public function regions(): array {
		return array(
			'public-usa' => __( 'United States', 'werun-blocks-community' ),
			'public-eur' => __( 'Europe', 'werun-blocks-community' ),
			'public-gbr' => __( 'United Kingdom', 'werun-blocks-community' ),
			'public-can' => __( 'Canada', 'werun-blocks-community' ),
			'public-aus' => __( 'Australia', 'werun-blocks-community' ),
			'public-jpn' => __( 'Japan', 'werun-blocks-community' ),
			'public-ind' => __( 'India', 'werun-blocks-community' ),
			'public-fra' => __( 'France', 'werun-blocks-community' ),
		);
	}

	public function default_region(): string {
		return (string) Integrations::get( 'forms.dynamics_region' );
	}

	public function hosts(): array {
		return array( 'mkt.dynamics.com', 'azureedge.net' );
	}

	public function client_event(): string {
		return 'dom:d365mkt-afterformsubmit';
	}

	public function gating(): string {
		return 'soft';
	}

	public function defaults(): array {
		return array( 'dynamics_org' => '' !== Integrations::get( 'forms.dynamics_org' ) );
	}

	public function hint(): string {
		return __( 'Form ID (a GUID), from data-form-id in the form\'s embed code.', 'werun-blocks-community' );
	}

	public function validate( array $args ): ?array {
		$form = self::match( $args['formId'] ?? '', self::GUID );
		$org  = self::match( Integrations::get( 'forms.dynamics_org' ), self::GUID );
		return ( null === $form || null === $org ) ? null : array(
			'form'   => strtolower( $form ),
			'org'    => strtolower( $org ),
			'region' => $this->region( $args['region'] ?? '', $this->default_region() ),
		);
	}

	protected function markup( array $v, array $args ): string {
		$r = substr( $v['region'], 7 ); // usa, eur, …
		return $this->mount(
			array(
				'type' => 'script',
				'src'  => 'https://cxpp' . $r . '1formui01cdnsa01-endpoint.azureedge.net/' . $r . '/FormLoader/FormLoader.bundle.js',
			),
			sprintf(
				'<div data-form-id="%1$s" data-form-api-url="%2$s" data-cached-form-url="%3$s"></div>',
				esc_attr( $v['form'] ),
				esc_url( 'https://' . $v['region'] . '.mkt.dynamics.com/api/v1.0/orgs/' . $v['org'] . '/landingpageforms' ),
				esc_url( 'https://assets1-' . $r . '.mkt.dynamics.com/' . $v['org'] . '/digitalassets/forms/' . $v['form'] )
			)
		);
	}
}
