<?php
/**
 * Editor routes (edit_posts):
 * - POST wrbc/v1/jobs/test    { provider, board, region } → { count, departments, locations, error }
 *   Fetches live and stores nothing.
 * - POST wrbc/v1/jobs/refresh { provider, board, region } → same, plus fetched.
 *   "Refresh now": drops the fresh copy and fetches the board again; on
 *   failure the last good copy stays.
 *
 * @package werun-blocks-community
 */

namespace Werun\BlocksCommunity\Jobs;

defined( 'ABSPATH' ) || exit;

/**
 * Rest.
 */
final class Rest {

	public static function register(): void {
		add_action( 'rest_api_init', array( __CLASS__, 'routes' ) );
	}

	public static function routes(): void {
		$args = array(
			'provider' => array(
				'type'    => 'string',
				'enum'    => array_merge( array( '' ), Providers::ids() ),
				'default' => '',
			),
			'board'    => array(
				'type'    => 'string',
				'pattern' => '^([A-Za-z0-9_-]{1,64})?$',
				'default' => '',
			),
			'region'   => array(
				'type'    => 'string',
				'enum'    => Providers::REGIONS,
				'default' => '',
			),
		);
		foreach ( array( 'test', 'refresh' ) as $route ) {
			register_rest_route(
				'wrbc/v1',
				'/jobs/' . $route,
				array(
					'methods'             => 'POST',
					'permission_callback' => function () {
						if ( ! current_user_can( 'edit_posts' ) ) {
							return false;
						}
						// Each call fetches from the ATS (and refresh stores a copy): 10 a minute per user.
						$key   = 'wrbc_jobs_rl_' . get_current_user_id();
						$count = (int) get_transient( $key );
						if ( $count >= 10 ) {
							return new \WP_Error( 'wrbc_jobs_rate_limited', __( 'Too many checks in a row. Wait a minute and try again.', 'werun-blocks-community' ), array( 'status' => 429 ) );
						}
						set_transient( $key, $count + 1, MINUTE_IN_SECONDS );
						return true;
					},
					'args'                => $args,
					'callback'            => array( __CLASS__, $route ),
				)
			);
		}
	}

	/** @param \WP_REST_Request $request Request. */
	public static function test( $request ) {
		$cfg = Jobs::config( $request['provider'], $request['board'], $request['region'] );
		return self::answer( is_wp_error( $cfg ) ? $cfg : Jobs::fetch( $cfg ) );
	}

	/** @param \WP_REST_Request $request Request. */
	public static function refresh( $request ) {
		$cfg = Jobs::config( $request['provider'], $request['board'], $request['region'] );
		if ( is_wp_error( $cfg ) ) {
			return self::answer( $cfg );
		}
		Jobs::clear( $cfg );
		return self::answer( Jobs::refresh( $cfg ) );
	}

	/**
	 * The summary the editor shows.
	 *
	 * @param array|\WP_Error $result Fetch result.
	 */
	private static function answer( $result ): \WP_REST_Response {
		if ( is_wp_error( $result ) ) {
			$response = rest_ensure_response(
				array(
					'count'       => 0,
					'departments' => array(),
					'locations'   => array(),
					'error'       => $result->get_error_message(),
				)
			);
		} else {
			$departments = array();
			$locations   = array();
			foreach ( $result['jobs'] as $job ) {
				if ( '' !== $job['department'] ) {
					$departments[ $job['department'] ] = true;
				}
				foreach ( $job['locations'] as $place ) {
					$locations[ $place ] = true;
				}
			}
			$departments = array_keys( $departments );
			$locations   = array_keys( $locations );
			natcasesort( $departments );
			natcasesort( $locations );
			$response = rest_ensure_response(
				array(
					'count'       => (int) $result['total'],
					'departments' => array_slice( array_values( $departments ), 0, 100 ),
					'locations'   => array_slice( array_values( $locations ), 0, 100 ),
					'error'       => '',
					'fetched'     => (int) $result['fetched'],
				)
			);
		}
		$response->header( 'Cache-Control', 'no-store' );
		return $response;
	}
}
