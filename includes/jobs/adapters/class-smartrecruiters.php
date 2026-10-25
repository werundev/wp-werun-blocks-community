<?php
/**
 * SmartRecruiters posting API (public, no key), 100 a page, at most 5 pages.
 * GET https://api.smartrecruiters.com/v1/companies/{id}/postings?limit=100&offset=N
 *
 * @package werun-blocks-community
 */

namespace Werun\BlocksCommunity\Jobs\Adapters;

use Werun\BlocksCommunity\Jobs\Adapter;
use Werun\BlocksCommunity\Jobs\Http;
use Werun\BlocksCommunity\Jobs\Job;

defined( 'ABSPATH' ) || exit;

/**
 * SmartRecruiters.
 */
final class SmartRecruiters extends Adapter {

	private const BASE  = 'https://api.smartrecruiters.com/v1/companies/';
	private const PAGES = 5;
	private const LIMIT = 100;

	public function id(): string {
		return 'smartrecruiters';
	}

	public function label(): string {
		return 'SmartRecruiters';
	}

	public function hosts(): array {
		return array( 'smartrecruiters.com' );
	}

	public function fetch( array $cfg ) {
		$slug = $this->path_slug( $cfg );
		$all  = array();
		for ( $page = 0; $page < self::PAGES; $page++ ) {
			$data = Http::json( self::BASE . $slug . '/postings?limit=' . self::LIMIT . '&offset=' . ( $page * self::LIMIT ) );
			if ( is_wp_error( $data ) ) {
				// A later page failing keeps what the first pages brought.
				return $all ? $all : $data;
			}
			if ( ! isset( $data['content'] ) || ! is_array( $data['content'] ) ) {
				return $all ? $all : self::bad_payload();
			}
			foreach ( self::rows( $data['content'] ) as $row ) {
				$row['_wrbc'] = array( 'company' => (string) ( $cfg['slug'] ?? '' ) );
				$all[]       = $row;
			}
			$total = isset( $data['totalFound'] ) ? (int) $data['totalFound'] : 0;
			if ( count( $data['content'] ) < self::LIMIT || ( $page + 1 ) * self::LIMIT >= $total ) {
				break;
			}
		}
		return $all;
	}

	public function normalize( $raw ): array {
		if ( ! is_array( $raw ) ) {
			return array();
		}
		$loc     = is_array( $raw['location'] ?? null ) ? $raw['location'] : array();
		$company = Job::text( $raw['company']['identifier'] ?? '' );
		if ( ! preg_match( self::SLUG, $company ) ) {
			$company = (string) ( $raw['_wrbc']['company'] ?? '' );
		}
		$id       = Job::text( $raw['id'] ?? '' );
		$location = Job::text( $loc['fullLocation'] ?? '' );
		if ( '' === $location ) {
			$location = implode( ', ', array_filter( array( Job::text( $loc['city'] ?? '' ), Job::text( $loc['region'] ?? '' ), strtoupper( Job::text( $loc['country'] ?? '' ) ) ) ) );
		}
		$url = preg_match( '/^[A-Za-z0-9-]{1,64}$/', $id ) && '' !== $company
			? 'https://jobs.smartrecruiters.com/' . rawurlencode( $company ) . '/' . rawurlencode( $id )
			: '';
		return array(
			'id'             => $id,
			'title'          => $raw['name'] ?? '',
			'department'     => $raw['department']['label'] ?? ( $raw['function']['label'] ?? '' ),
			'team'           => $raw['function']['label'] ?? '',
			'location'       => $location,
			'remote'         => ! empty( $loc['remote'] ),
			'employmentType' => $raw['typeOfEmployment']['label'] ?? '',
			'url'            => $url,
			'applyUrl'       => $url,
			'postedAt'       => $raw['releasedDate'] ?? '',
		);
	}
}
