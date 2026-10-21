<?php
/**
 * One applicant tracking system (ATS). An adapter knows its endpoint (the
 * host is a constant: the editor only ever supplies a board slug and a
 * region from an enum), fetches the raw postings and maps one posting to
 * the normalized job (see Job::finish()).
 *
 * @package werun-blocks-community
 */

namespace Werun\BlocksCommunity\Jobs;

defined( 'ABSPATH' ) || exit;

/**
 * Adapter_Interface.
 */
interface Adapter_Interface {

	/** Provider id, e.g. "greenhouse". */
	public function id(): string;

	/** Provider name shown to editors. */
	public function label(): string;

	/**
	 * The raw postings, each a self-contained array (the adapter resolves
	 * includes and attaches what normalize() needs under "_wrbc").
	 *
	 * @param array $cfg { @type string $slug, @type string $region } Validated by Jobs::config().
	 * @return array|\WP_Error
	 */
	public function fetch( array $cfg );

	/**
	 * One raw posting as a job: id, title, department, team, location,
	 * locations, remote, employmentType, url, applyUrl, postedAt,
	 * compensation, description. An empty array skips the posting.
	 *
	 * @param mixed $raw One item of fetch().
	 */
	public function normalize( $raw ): array;
}
