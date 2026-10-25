<?php
/**
 * Teamtailor API (needs an API key in Integrations), JSON:API, 30 a page,
 * at most 5 pages. The key identifies the company: no board slug.
 * GET https://api.teamtailor.com/v1/jobs?include=department,locations
 * Authorization: Token token=… · X-Api-Version
 *
 * @package werun-blocks-community
 */

namespace Werun\BlocksCommunity\Jobs\Adapters;

use Werun\BlocksCommunity\Integrations\Integrations;
use Werun\BlocksCommunity\Jobs\Adapter;
use Werun\BlocksCommunity\Jobs\Http;
use Werun\BlocksCommunity\Jobs\Job;

defined( 'ABSPATH' ) || exit;

/**
 * Teamtailor.
 */
final class Teamtailor extends Adapter {

	private const BASE    = 'https://api.teamtailor.com/v1/jobs';
	private const VERSION = '20240404';
	private const PAGES   = 5;
	private const SIZE    = 30;

	public function id(): string {
		return 'teamtailor';
	}

	public function label(): string {
		return 'Teamtailor';
	}

	public function hosts(): array {
		return array( 'teamtailor.com' );
	}

	public function needs_slug(): bool {
		return false;
	}

	public function secret(): string {
		return 'teamtailor_key';
	}

	public function fetch( array $cfg ) {
		$key = Integrations::secret( 'teamtailor_key' );
		if ( '' === $key ) {
			return new \WP_Error( 'wrbc_jobs_key', __( 'Teamtailor needs an API key: add it in Integrations.', 'werun-blocks-community' ) );
		}
		$headers = array(
			'Authorization' => 'Token token=' . $key,
			'X-Api-Version' => self::VERSION,
			'Accept'        => 'application/vnd.api+json',
		);
		$all     = array();
		for ( $page = 1; $page <= self::PAGES; $page++ ) {
			// The next page is built here, never taken from links.next (host stays constant).
			$data = Http::json( self::BASE . '?include=department%2Clocations&page%5Bsize%5D=' . self::SIZE . '&page%5Bnumber%5D=' . $page, $headers );
			if ( is_wp_error( $data ) ) {
				return $all ? $all : $data;
			}
			if ( ! isset( $data['data'] ) || ! is_array( $data['data'] ) ) {
				return $all ? $all : self::bad_payload();
			}
			$included = array();
			foreach ( self::rows( $data['included'] ?? array() ) as $inc ) {
				$attr = is_array( $inc['attributes'] ?? null ) ? $inc['attributes'] : array();
				$name = 'locations' === ( $inc['type'] ?? '' )
					? ( Job::text( $attr['name'] ?? '' ) ? $attr['name'] : implode( ', ', array_filter( array( Job::text( $attr['city'] ?? '' ), Job::text( $attr['country'] ?? '' ) ) ) ) )
					: ( $attr['name'] ?? '' );
				$included[ ( $inc['type'] ?? '' ) . ':' . ( $inc['id'] ?? '' ) ] = Job::text( $name );
			}
			foreach ( self::rows( $data['data'] ) as $row ) {
				$rel  = is_array( $row['relationships'] ?? null ) ? $row['relationships'] : array();
				$dept = $rel['department']['data'] ?? null;
				$locs = array();
				foreach ( self::rows( $rel['locations']['data'] ?? array() ) as $ref ) {
					$locs[] = $included[ 'locations:' . ( $ref['id'] ?? '' ) ] ?? '';
				}
				$row['_wrbc'] = array(
					'department' => is_array( $dept ) ? ( $included[ 'departments:' . ( $dept['id'] ?? '' ) ] ?? '' ) : '',
					'locations'  => array_values( array_filter( $locs ) ),
				);
				$all[]       = $row;
			}
			if ( empty( $data['links']['next'] ) || count( $data['data'] ) < self::SIZE ) {
				break;
			}
		}
		return $all;
	}

	public function normalize( $raw ): array {
		if ( ! is_array( $raw ) ) {
			return array();
		}
		$attr  = is_array( $raw['attributes'] ?? null ) ? $raw['attributes'] : array();
		$links = is_array( $raw['links'] ?? null ) ? $raw['links'] : array();
		$locs  = (array) ( $raw['_wrbc']['locations'] ?? array() );
		$state = (string) ( $attr['remote-status'] ?? '' );
		return array(
			'id'             => $raw['id'] ?? '',
			'title'          => $attr['title'] ?? '',
			'department'     => $raw['_wrbc']['department'] ?? '',
			'location'       => $locs[0] ?? '',
			'locations'      => $locs,
			'remote'         => in_array( $state, array( 'fully', 'temporary' ), true ),
			'employmentType' => $attr['employment-type'] ?? '',
			'url'            => $links['careersite-job-url'] ?? '',
			'applyUrl'       => $links['careersite-job-apply-url'] ?? '',
			'postedAt'       => $attr['created-at'] ?? '',
			'compensation'   => Job::salary( $attr['min-salary'] ?? 0, $attr['max-salary'] ?? 0, $attr['currency'] ?? '', $attr['salary-time-unit'] ?? '' ),
			'description'    => $attr['body'] ?? '',
		);
	}
}
