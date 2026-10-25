<?php
/**
 * BambooHR: the public careers list, and when it fails and an API key is set
 * in Integrations, the applicant tracking API.
 * GET https://{subdomain}.bamboohr.com/careers/list
 * GET https://api.bamboohr.com/api/gateway.php/{subdomain}/v1/applicant_tracking/jobs?statusGroups=Open (Basic key:x)
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
 * BambooHR.
 */
final class BambooHR extends Adapter {

	private const API = 'https://api.bamboohr.com/api/gateway.php/';

	public function id(): string {
		return 'bamboohr';
	}

	public function label(): string {
		return 'BambooHR';
	}

	public function hosts(): array {
		return array( 'bamboohr.com' );
	}

	public function secret(): string {
		return 'bamboohr_key';
	}

	public function optional_secret(): bool {
		return true;
	}

	public function fetch( array $cfg ) {
		$sub = $this->host_slug( $cfg );
		if ( is_wp_error( $sub ) ) {
			return $sub;
		}
		$data = Http::json( 'https://' . $sub . '.bamboohr.com/careers/list' );
		if ( ! is_wp_error( $data ) && isset( $data['result'] ) && is_array( $data['result'] ) ) {
			return $this->tag( self::rows( $data['result'] ), 'public', $sub );
		}
		$key = Integrations::secret( 'bamboohr_key' );
		if ( '' === $key ) {
			return is_wp_error( $data ) ? $data : self::bad_payload();
		}
		$api = Http::json(
			self::API . rawurlencode( $sub ) . '/v1/applicant_tracking/jobs?statusGroups=Open',
			array( 'Authorization' => 'Basic ' . base64_encode( $key . ':x' ) ) // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions.obfuscation_base64_encode -- HTTP Basic auth.
		);
		if ( is_wp_error( $api ) ) {
			return $api;
		}
		if ( array() !== $api && ! isset( $api[0] ) ) {
			return self::bad_payload();
		}
		return $this->tag( self::rows( $api ), 'api', $sub );
	}

	private function tag( array $rows, string $source, string $sub ): array {
		foreach ( $rows as $i => $row ) {
			$rows[ $i ]['_wrbc'] = array(
				'source' => $source,
				'sub'    => $sub,
			);
		}
		return $rows;
	}

	public function normalize( $raw ): array {
		if ( ! is_array( $raw ) ) {
			return array();
		}
		$sub = (string) ( $raw['_wrbc']['sub'] ?? '' );
		$id  = Job::text( $raw['id'] ?? '' );
		$url = preg_match( '/^\d{1,12}$/', $id ) && '' !== $sub ? 'https://' . $sub . '.bamboohr.com/careers/' . $id : '';
		if ( 'api' === ( $raw['_wrbc']['source'] ?? '' ) ) {
			$location = $raw['location']['label'] ?? '';
			return array(
				'id'             => $id,
				'title'          => $raw['title']['label'] ?? ( $raw['title'] ?? '' ),
				'department'     => $raw['department']['label'] ?? '',
				'location'       => $location,
				'remote'         => Job::looks_remote( $location ),
				'employmentType' => $raw['employmentStatus']['label'] ?? ( $raw['employmentType']['label'] ?? '' ),
				'url'            => Job::url( $raw['postingUrl'] ?? '' ) ? $raw['postingUrl'] : $url,
				'applyUrl'       => $url,
				'postedAt'       => $raw['postedDate'] ?? ( $raw['createdDate'] ?? '' ),
			);
		}
		$loc   = is_array( $raw['atsLocation'] ?? null ) && array_filter( $raw['atsLocation'] ) ? $raw['atsLocation'] : ( is_array( $raw['location'] ?? null ) ? $raw['location'] : array() );
		$place = implode( ', ', array_filter( array( Job::text( $loc['city'] ?? '' ), Job::text( $loc['state'] ?? ( $loc['province'] ?? '' ) ), Job::text( $loc['country'] ?? '' ) ) ) );
		return array(
			'id'             => $id,
			'title'          => $raw['jobOpeningName'] ?? '',
			'department'     => $raw['departmentLabel'] ?? '',
			'location'       => $place,
			// locationType: 0 on site, 1 remote, 2 hybrid.
			'remote'         => ! empty( $raw['isRemote'] ) || '1' === (string) ( $raw['locationType'] ?? '' ),
			'employmentType' => $raw['employmentStatusLabel'] ?? '',
			'url'            => $url,
			'applyUrl'       => $url,
			'postedAt'       => $raw['datePosted'] ?? '',
		);
	}
}
