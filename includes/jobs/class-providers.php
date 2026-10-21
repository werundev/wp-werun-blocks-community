<?php
/**
 * The adapters by id. The list is closed: every host is a constant inside
 * its adapter.
 *
 * @package werun-blocks-community
 */

namespace Werun\BlocksCommunity\Jobs;

defined( 'ABSPATH' ) || exit;

/**
 * Providers.
 */
final class Providers {

	/** Same ids, same order as Integrations jobs.provider and src/jobs/providers.js. */
	public const CLASSES = array(
		'greenhouse'      => Adapters\Greenhouse::class,
		'lever'           => Adapters\Lever::class,
		'ashby'           => Adapters\Ashby::class,
		'workable'        => Adapters\Workable::class,
		'smartrecruiters' => Adapters\SmartRecruiters::class,
		'personio'        => Adapters\Personio::class,
		'teamtailor'      => Adapters\Teamtailor::class,
		'bamboohr'        => Adapters\BambooHR::class,
	);

	/** Region values any adapter accepts (REST enum); each adapter narrows it. */
	public const REGIONS = array( '', 'eu', 'com' );

	/** One adapter, or null for an unknown id. */
	public static function get( string $id ): ?Adapter {
		static $made = array();
		if ( ! isset( self::CLASSES[ $id ] ) ) {
			return null;
		}
		if ( ! isset( $made[ $id ] ) ) {
			$class       = self::CLASSES[ $id ];
			$made[ $id ] = new $class();
		}
		return $made[ $id ];
	}

	/** Every id. */
	public static function ids(): array {
		return array_keys( self::CLASSES );
	}
}
