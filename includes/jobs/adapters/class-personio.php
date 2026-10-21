<?php
/**
 * Personio XML feed (public, no key).
 * GET https://{subdomain}.jobs.personio.de/xml (or .com by region)
 * Parsed by Http::parse_xml(): no DTD, no entities, no network.
 *
 * @package werun-blocks-community
 */

namespace Werun\BlocksCommunity\Jobs\Adapters;

use Werun\BlocksCommunity\Jobs\Adapter;
use Werun\BlocksCommunity\Jobs\Http;
use Werun\BlocksCommunity\Jobs\Job;

defined( 'ABSPATH' ) || exit;

/**
 * Personio.
 */
final class Personio extends Adapter {

	private const TLDS = array(
		''    => 'de',
		'com' => 'com',
	);

	public function id(): string {
		return 'personio';
	}

	public function label(): string {
		return 'Personio';
	}

	public function hosts(): array {
		return array( 'personio.de', 'personio.com' );
	}

	public function regions(): array {
		return array(
			''    => 'jobs.personio.de',
			'com' => 'jobs.personio.com',
		);
	}

	public function fetch( array $cfg ) {
		$sub = $this->host_slug( $cfg );
		if ( is_wp_error( $sub ) ) {
			return $sub;
		}
		$host = $sub . '.jobs.personio.' . self::TLDS[ $this->region( $cfg ) ];
		$xml  = Http::xml( 'https://' . $host . '/xml' );
		if ( is_wp_error( $xml ) ) {
			return $xml;
		}
		if ( 'workzag-jobs' !== $xml->getName() ) {
			return self::bad_payload();
		}
		$rows = array();
		foreach ( $xml->position as $position ) {
			$offices = array( (string) $position->office );
			if ( isset( $position->additionalOffices ) ) {
				foreach ( $position->additionalOffices->office as $office ) {
					$offices[] = (string) $office;
				}
			}
			$sections = array();
			if ( isset( $position->jobDescriptions ) ) {
				foreach ( $position->jobDescriptions->jobDescription as $section ) {
					$sections[] = array(
						'name'  => (string) $section->name,
						'value' => (string) $section->value,
					);
				}
			}
			$rows[] = array(
				'id'             => (string) $position->id,
				'name'           => (string) $position->name,
				'department'     => (string) $position->department,
				'subcompany'     => (string) $position->subcompany,
				'offices'        => $offices,
				'employmentType' => (string) $position->employmentType,
				'schedule'       => (string) $position->schedule,
				'createdAt'      => (string) $position->createdAt,
				'sections'       => $sections,
				'_wrbc'           => array( 'host' => $host ),
			);
		}
		return $rows;
	}

	public function normalize( $raw ): array {
		if ( ! is_array( $raw ) ) {
			return array();
		}
		$id  = preg_match( '/^\d{1,20}$/', (string) ( $raw['id'] ?? '' ) ) ? $raw['id'] : '';
		$url = '' !== $id ? 'https://' . ( $raw['_wrbc']['host'] ?? '' ) . '/job/' . $id : '';
		// Schedule (full-time / part-time) says more than the contract type.
		$type        = in_array( $raw['schedule'] ?? '', array( 'full-time', 'part-time' ), true ) ? $raw['schedule'] : ( $raw['employmentType'] ?? '' );
		$description = '';
		foreach ( (array) ( $raw['sections'] ?? array() ) as $section ) {
			$description .= '<h3>' . esc_html( Job::text( $section['name'] ?? '' ) ) . '</h3>' . ( is_string( $section['value'] ?? null ) ? $section['value'] : '' );
		}
		$offices = (array) ( $raw['offices'] ?? array() );
		return array(
			'id'             => $id,
			'title'          => $raw['name'] ?? '',
			'department'     => $raw['department'] ?? '',
			'team'           => $raw['subcompany'] ?? '',
			'location'       => $offices[0] ?? '',
			'locations'      => $offices,
			'remote'         => Job::looks_remote( ...array_map( 'strval', $offices ) ),
			'employmentType' => $type,
			'url'            => $url,
			'applyUrl'       => '' !== $url ? $url . '#apply' : '',
			'postedAt'       => $raw['createdAt'] ?? '',
			'description'    => $description,
		);
	}
}
