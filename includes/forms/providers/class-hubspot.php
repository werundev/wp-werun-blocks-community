<?php
/**
 * HubSpot forms: the v2 embed (hbspt.forms.create) or the new
 * hs-form-frame embed. Portal and region default to Integrations; with a
 * private-app token the editor lists the portal's forms (API v3, cached).
 *
 * @package werun-blocks-community
 */

namespace Werun\BlocksCommunity\Forms\Providers;

use Werun\BlocksCommunity\Forms\Provider;
use Werun\BlocksCommunity\Integrations\Integrations;

defined( 'ABSPATH' ) || exit;

/**
 * HubSpot.
 */
final class HubSpot extends Provider {

	private const CACHE = 'wrbc_forms_hubspot_list';

	public function id(): string {
		return 'hubspot';
	}

	public function label(): string {
		return 'HubSpot';
	}

	public function regions(): array {
		return array(
			'na1' => __( 'North America (na1)', 'werun-blocks-community' ),
			'na2' => __( 'North America (na2)', 'werun-blocks-community' ),
			'eu1' => __( 'Europe (eu1)', 'werun-blocks-community' ),
			'ap1' => __( 'Asia Pacific (ap1)', 'werun-blocks-community' ),
		);
	}

	public function default_region(): string {
		return (string) Integrations::get( 'forms.hubspot_region' );
	}

	public function hosts(): array {
		return array( 'js.hsforms.net', 'js-eu1.hsforms.net', 'js-na2.hsforms.net', 'js-ap1.hsforms.net', 'forms.hsforms.com', 'forms-eu1.hsforms.com', 'forms-na2.hsforms.com', 'forms-ap1.hsforms.com', 'forms.hscollectedforms.net' );
	}

	public function client_event(): string {
		return 'callback';
	}

	public function gating(): string {
		return 'soft';
	}

	public function defaults(): array {
		return array(
			'hubspot_portal' => '' !== Integrations::get( 'forms.hubspot_portal' ),
			'hubspot_token'  => '' !== Integrations::secret( 'hubspot_token' ),
		);
	}

	public function hint(): string {
		return __( 'Form ID (a GUID like 1a2b3c4d-…), from the form\'s Share › Embed code.', 'werun-blocks-community' );
	}

	/** The region's script host (js-eu1.hsforms.net, …), as markup() builds it. */
	public function consent_host( array $v ): string {
		$region = (string) ( $v['region'] ?? 'na1' );
		return 'na1' === $region ? 'js.hsforms.net' : 'js-' . $region . '.hsforms.net';
	}

	public function validate( array $args ): ?array {
		$extra  = is_array( $args['extra'] ?? null ) ? $args['extra'] : array();
		$form   = self::match( $args['formId'] ?? '', self::GUID );
		$portal = self::match( $extra['portal'] ?? '', '/^\d{3,12}$/' ) ?? self::match( Integrations::get( 'forms.hubspot_portal' ), '/^\d{3,12}$/' );
		if ( null === $form || null === $portal ) {
			return null;
		}
		return array(
			'form'   => strtolower( $form ),
			'portal' => $portal,
			'region' => $this->region( $args['region'] ?? '', $this->default_region() ),
			'embed'  => ( $extra['embed'] ?? '' ) === 'v2' ? 'v2' : 'frame',
		);
	}

	protected function markup( array $v, array $args ): string {
		// Script hosts per region: js.hsforms.net (na1), js-<region>.hsforms.net otherwise.
		$js = 'na1' === $v['region'] ? 'js.hsforms.net' : 'js-' . $v['region'] . '.hsforms.net';
		if ( 'v2' === $v['embed'] ) {
			return $this->mount(
				array(
					'type'   => 'hubspot-v2',
					'src'    => 'https://' . $js . '/forms/embed/v2.js',
					'region' => $v['region'],
					'portal' => $v['portal'],
					'form'   => $v['form'],
				)
			);
		}
		return $this->mount(
			array(
				'type' => 'script',
				'src'  => 'https://' . $js . '/forms/embed/' . $v['portal'] . '.js',
			),
			sprintf(
				'<div class="hs-form-frame" data-region="%1$s" data-form-id="%2$s" data-portal-id="%3$s"></div>',
				esc_attr( $v['region'] ),
				esc_attr( $v['form'] ),
				esc_attr( $v['portal'] )
			)
		);
	}

	/** The portal's forms, with a private-app token (scope "forms"). Cached 10 minutes. */
	public function list_forms(): array {
		$token = Integrations::secret( 'hubspot_token' );
		if ( '' === $token ) {
			return array();
		}
		$key    = self::CACHE . '_' . substr( hash( 'sha256', $token ), 0, 12 );
		$cached = get_transient( $key );
		if ( is_array( $cached ) ) {
			return $cached;
		}
		$out   = array();
		$after = '';
		$code  = 0;
		// Paged (50 a page), at most 200 forms.
		for ( $page = 0; $page < 4; $page++ ) {
			$response = wp_remote_get(
				add_query_arg( array_filter( array( 'limit' => 50, 'archived' => 'false', 'after' => $after ) ), 'https://api.hubapi.com/marketing/v3/forms' ),
				array(
					'timeout' => 8,
					'headers' => array(
						'Authorization' => 'Bearer ' . $token,
						'Accept'        => 'application/json',
					),
				)
			);
			$code = is_wp_error( $response ) ? 0 : (int) wp_remote_retrieve_response_code( $response );
			$body = 200 === $code ? json_decode( (string) wp_remote_retrieve_body( $response ), true ) : null;
			foreach ( ( is_array( $body ) && is_array( $body['results'] ?? null ) ) ? $body['results'] : array() as $row ) {
				$id = self::match( $row['id'] ?? '', self::GUID );
				if ( null !== $id ) {
					$out[] = array(
						'id'    => strtolower( $id ),
						'title' => wp_strip_all_tags( wrbc_text( $row['name'] ?? $id ) ),
					);
				}
			}
			$after = is_array( $body ) ? wrbc_text( $body['paging']['next']['after'] ?? '' ) : '';
			if ( '' === $after || 200 !== $code ) {
				break;
			}
		}
		// A failed call is cached briefly too, so the editor doesn't hammer the API.
		set_transient( $key, $out, $out || 200 === $code ? 10 * MINUTE_IN_SECONDS : MINUTE_IN_SECONDS );
		return $out;
	}
}
