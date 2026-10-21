<?php
/**
 * GET wrbc/v1/forms/sources (edit_posts): what the form block's sidebar
 * offers. Available providers with their forms (native plugins, HubSpot with
 * a token), regions, gating type, and which Integrations defaults are set —
 * booleans only, never a secret or its value.
 *
 * @package werun-blocks-community
 */

namespace Werun\BlocksCommunity\Forms;

use Werun\BlocksCommunity\Gate\Gate;

defined( 'ABSPATH' ) || exit;

/**
 * Rest.
 */
final class Rest {

	/** Hooks. */
	public static function register(): void {
		add_action( 'rest_api_init', array( __CLASS__, 'routes' ) );
	}

	/** Routes. */
	public static function routes(): void {
		register_rest_route(
			'wrbc/v1',
			'/forms/sources',
			array(
				'methods'             => 'GET',
				'permission_callback' => static function () {
					return current_user_can( 'edit_posts' );
				},
				'callback'            => array( __CLASS__, 'sources' ),
			)
		);
	}

	/** The response. */
	public static function sources(): \WP_REST_Response {
		$providers = array();
		foreach ( Forms::providers() as $p ) {
			if ( ! $p->is_available() ) {
				continue;
			}
			$regions = array();
			foreach ( $p->regions() as $value => $label ) {
				$regions[] = array(
					'value' => (string) $value,
					'label' => (string) $label,
				);
			}
			$providers[] = array(
				'id'            => $p->id(),
				'label'         => $p->label(),
				'kind'          => $p->kind(),
				'gating'        => $p->gating(),
				'event'         => '' !== $p->client_event(),
				'consent'       => $p->needs_consent(),
				'regions'       => $regions,
				'defaultRegion' => $p->default_region(),
				'defaults'      => (object) array_map( 'boolval', $p->defaults() ),
				'forms'         => $p->list_forms(),
				'hint'          => $p->hint(),
				'host'          => (string) ( $p->hosts()[0] ?? '' ),
			);
		}
		$response = rest_ensure_response(
			array(
				'providers' => $providers,
				'resources' => class_exists( Gate::class ) ? Gate::resources() : array(),
			)
		);
		$response->header( 'Cache-Control', 'private, no-store' );
		return $response;
	}
}
