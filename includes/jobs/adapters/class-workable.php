<?php
/**
 * Workable public widget API (no key).
 * GET https://apply.workable.com/api/v1/widget/accounts/{subdomain}?details=true
 *
 * @package werun-blocks-community
 */

namespace Werun\BlocksCommunity\Jobs\Adapters;

use Werun\BlocksCommunity\Jobs\Adapter;
use Werun\BlocksCommunity\Jobs\Http;
use Werun\BlocksCommunity\Jobs\Job;

defined( 'ABSPATH' ) || exit;

/**
 * Workable.
 */
final class Workable extends Adapter {

	private const BASE = 'https://apply.workable.com/api/v1/widget/accounts/';

	public function id(): string {
		return 'workable';
	}

	public function label(): string {
		return 'Workable';
	}

	public function hosts(): array {
		return array( 'workable.com' );
	}

	public function fetch( array $cfg ) {
		$data = Http::json( self::BASE . $this->path_slug( $cfg ) . '?details=true' );
		// Large boards pass 2 MB with descriptions: list them without.
		if ( is_wp_error( $data ) && 'wrbc_jobs_size' === $data->get_error_code() ) {
			$data = Http::json( self::BASE . $this->path_slug( $cfg ) );
		}
		if ( is_wp_error( $data ) ) {
			return $data;
		}
		return isset( $data['jobs'] ) && is_array( $data['jobs'] ) ? self::rows( $data['jobs'] ) : self::bad_payload();
	}

	public function normalize( $raw ): array {
		if ( ! is_array( $raw ) ) {
			return array();
		}
		$place     = function ( $city, $region, $country ) {
			return implode( ', ', array_filter( array( Job::text( $city ), Job::text( $region ), Job::text( $country ) ) ) );
		};
		$location  = $place( $raw['city'] ?? '', $raw['state'] ?? '', $raw['country'] ?? '' );
		$locations = array();
		foreach ( self::rows( $raw['locations'] ?? array() ) as $loc ) {
			if ( empty( $loc['hidden'] ) ) {
				$locations[] = $place( $loc['city'] ?? '', $loc['region'] ?? '', $loc['country'] ?? '' );
			}
		}
		return array(
			'id'             => $raw['shortcode'] ?? ( $raw['code'] ?? '' ),
			'title'          => $raw['title'] ?? '',
			'department'     => $raw['department'] ?? '',
			'team'           => $raw['function'] ?? '',
			'location'       => $location,
			'locations'      => $locations,
			'remote'         => ! empty( $raw['telecommuting'] ),
			'employmentType' => $raw['employment_type'] ?? '',
			'url'            => $raw['url'] ?? ( $raw['shortlink'] ?? '' ),
			'applyUrl'       => $raw['application_url'] ?? '',
			'postedAt'       => $raw['published_on'] ?? ( $raw['created_at'] ?? '' ),
			'description'    => $raw['description'] ?? '',
		);
	}
}
