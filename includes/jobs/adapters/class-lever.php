<?php
/**
 * Lever postings API (public, no key).
 * GET https://api.lever.co/v0/postings/{site}?mode=json, EU: api.eu.lever.co
 *
 * @package werun-blocks-community
 */

namespace Werun\BlocksCommunity\Jobs\Adapters;

use Werun\BlocksCommunity\Jobs\Adapter;
use Werun\BlocksCommunity\Jobs\Http;
use Werun\BlocksCommunity\Jobs\Job;

defined( 'ABSPATH' ) || exit;

/**
 * Lever.
 */
final class Lever extends Adapter {

	private const HOSTS = array(
		''   => 'https://api.lever.co',
		'eu' => 'https://api.eu.lever.co',
	);

	public function id(): string {
		return 'lever';
	}

	public function label(): string {
		return 'Lever';
	}

	public function hosts(): array {
		return array( 'lever.co' );
	}

	public function regions(): array {
		return array(
			''   => __( 'Global (api.lever.co)', 'werun-blocks-community' ),
			'eu' => __( 'EU (api.eu.lever.co)', 'werun-blocks-community' ),
		);
	}

	public function fetch( array $cfg ) {
		$data = Http::json( self::HOSTS[ $this->region( $cfg ) ] . '/v0/postings/' . $this->path_slug( $cfg ) . '?mode=json' );
		if ( is_wp_error( $data ) ) {
			return $data;
		}
		// A list; an error is an object like {"ok":false,"error":"Document not found"}.
		if ( array() !== $data && ! isset( $data[0] ) ) {
			return self::bad_payload();
		}
		return self::rows( $data );
	}

	public function normalize( $raw ): array {
		if ( ! is_array( $raw ) ) {
			return array();
		}
		$cat         = is_array( $raw['categories'] ?? null ) ? $raw['categories'] : array();
		$description = is_string( $raw['description'] ?? null ) ? $raw['description'] : '';
		foreach ( self::rows( $raw['lists'] ?? array() ) as $list ) {
			if ( is_string( $list['content'] ?? null ) ) {
				$description .= '<h3>' . esc_html( Job::text( $list['text'] ?? '' ) ) . '</h3><ul>' . $list['content'] . '</ul>';
			}
		}
		if ( is_string( $raw['additional'] ?? null ) ) {
			$description .= $raw['additional'];
		}
		$salary = is_array( $raw['salaryRange'] ?? null ) ? $raw['salaryRange'] : array();
		$period = is_string( $salary['interval'] ?? null ) ? str_replace( '-', ' ', $salary['interval'] ) : '';
		return array(
			'id'             => $raw['id'] ?? '',
			'title'          => $raw['text'] ?? '',
			'department'     => $cat['department'] ?? '',
			'team'           => $cat['team'] ?? '',
			'location'       => $cat['location'] ?? '',
			'locations'      => is_array( $cat['allLocations'] ?? null ) ? $cat['allLocations'] : array(),
			'remote'         => 'remote' === ( $raw['workplaceType'] ?? '' ) || Job::looks_remote( $cat['location'] ?? '' ),
			'employmentType' => $cat['commitment'] ?? '',
			'url'            => $raw['hostedUrl'] ?? '',
			'applyUrl'       => $raw['applyUrl'] ?? '',
			'postedAt'       => $raw['createdAt'] ?? '',
			'compensation'   => $salary ? Job::salary( $salary['min'] ?? 0, $salary['max'] ?? 0, $salary['currency'] ?? '', $period ) : '',
			'description'    => $description,
		);
	}
}
