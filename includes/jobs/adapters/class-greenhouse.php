<?php
/**
 * Greenhouse job board API (public, no key).
 * GET https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true
 *
 * @package werun-blocks-community
 */

namespace Werun\BlocksCommunity\Jobs\Adapters;

use Werun\BlocksCommunity\Jobs\Adapter;
use Werun\BlocksCommunity\Jobs\Http;
use Werun\BlocksCommunity\Jobs\Job;

defined( 'ABSPATH' ) || exit;

/**
 * Greenhouse.
 */
final class Greenhouse extends Adapter {

	private const BASE = 'https://boards-api.greenhouse.io/v1/boards/';

	public function id(): string {
		return 'greenhouse';
	}

	public function label(): string {
		return 'Greenhouse';
	}

	public function hosts(): array {
		return array( 'greenhouse.io' );
	}

	public function fetch( array $cfg ) {
		$data = Http::json( self::BASE . $this->path_slug( $cfg ) . '/jobs?content=true' );
		// Large boards pass 2 MB with descriptions: list them without.
		if ( is_wp_error( $data ) && 'wrbc_jobs_size' === $data->get_error_code() ) {
			$data = Http::json( self::BASE . $this->path_slug( $cfg ) . '/jobs' );
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
		$departments = array();
		foreach ( self::rows( $raw['departments'] ?? array() ) as $dept ) {
			$departments[] = Job::text( $dept['name'] ?? '' );
		}
		$departments = array_values( array_filter( $departments ) );
		$location    = Job::text( $raw['location']['name'] ?? '' );
		// "New York, NY; Remote" is two locations.
		$locations = array_values( array_filter( preg_split( '/\s*[;|]\s*/', $location ) ) );
		$type        = '';
		foreach ( self::rows( $raw['metadata'] ?? array() ) as $meta ) {
			if ( preg_match( '/employment|job\s*type|contract/i', Job::text( $meta['name'] ?? '' ) ) && is_scalar( $meta['value'] ?? null ) ) {
				$type = $meta['value'];
				break;
			}
		}
		return array(
			'id'             => $raw['id'] ?? '',
			'title'          => $raw['title'] ?? '',
			'department'     => $departments[0] ?? '',
			'team'           => $departments[1] ?? '',
			'location'       => $locations[0] ?? '',
			'locations'      => $locations,
			'remote'         => Job::looks_remote( $location ),
			'employmentType' => $type,
			'url'            => $raw['absolute_url'] ?? '',
			'applyUrl'       => $raw['absolute_url'] ?? '',
			'postedAt'       => $raw['first_published'] ?? ( $raw['updated_at'] ?? '' ),
			// The content field is HTML with its entities encoded once more.
			'description'    => is_string( $raw['content'] ?? null ) ? html_entity_decode( $raw['content'], ENT_QUOTES | ENT_HTML5, 'UTF-8' ) : '',
		);
	}
}
