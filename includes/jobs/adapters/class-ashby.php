<?php
/**
 * Ashby job board API (public, no key).
 * GET https://api.ashbyhq.com/posting-api/job-board/{board}?includeCompensation=true
 *
 * @package werun-blocks-community
 */

namespace Werun\BlocksCommunity\Jobs\Adapters;

use Werun\BlocksCommunity\Jobs\Adapter;
use Werun\BlocksCommunity\Jobs\Http;
use Werun\BlocksCommunity\Jobs\Job;

defined( 'ABSPATH' ) || exit;

/**
 * Ashby.
 */
final class Ashby extends Adapter {

	private const BASE = 'https://api.ashbyhq.com/posting-api/job-board/';

	public function id(): string {
		return 'ashby';
	}

	public function label(): string {
		return 'Ashby';
	}

	public function hosts(): array {
		return array( 'ashbyhq.com' );
	}

	public function fetch( array $cfg ) {
		$data = Http::json( self::BASE . $this->path_slug( $cfg ) . '?includeCompensation=true' );
		if ( is_wp_error( $data ) ) {
			return $data;
		}
		if ( ! isset( $data['jobs'] ) || ! is_array( $data['jobs'] ) ) {
			return self::bad_payload();
		}
		// Unlisted postings are reachable by link only: never list them.
		return array_values(
			array_filter(
				self::rows( $data['jobs'] ),
				function ( $job ) {
					return false !== ( $job['isListed'] ?? true );
				}
			)
		);
	}

	public function normalize( $raw ): array {
		if ( ! is_array( $raw ) ) {
			return array();
		}
		$locations = array( $raw['location'] ?? '' );
		foreach ( self::rows( $raw['secondaryLocations'] ?? array() ) as $place ) {
			$locations[] = $place['location'] ?? '';
		}
		$pay = is_array( $raw['compensation'] ?? null ) ? $raw['compensation'] : array();
		return array(
			'id'             => $raw['id'] ?? '',
			'title'          => $raw['title'] ?? '',
			'department'     => $raw['department'] ?? '',
			'team'           => $raw['team'] ?? '',
			'location'       => $raw['location'] ?? '',
			'locations'      => $locations,
			'remote'         => ! empty( $raw['isRemote'] ) || 'remote' === strtolower( (string) ( $raw['workplaceType'] ?? '' ) ),
			'employmentType' => $raw['employmentType'] ?? '',
			'url'            => $raw['jobUrl'] ?? '',
			'applyUrl'       => $raw['applyUrl'] ?? '',
			'postedAt'       => $raw['publishedAt'] ?? '',
			'compensation'   => $pay['compensationTierSummary'] ?? ( $pay['scrapeableCompensationSalarySummary'] ?? '' ),
			'description'    => $raw['descriptionHtml'] ?? '',
		);
	}
}
