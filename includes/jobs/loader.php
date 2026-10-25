<?php
/**
 * Jobs (ATS) area: adapters, cache, editor REST routes and the markup of
 * the werun-community/jobs block. Required by werun-blocks-community.php when present.
 *
 * @package werun-blocks-community
 */

defined( 'ABSPATH' ) || exit;

require_once __DIR__ . '/class-adapter-interface.php';
require_once __DIR__ . '/class-adapter.php';
require_once __DIR__ . '/class-http.php';
require_once __DIR__ . '/class-job.php';
foreach ( array( 'greenhouse', 'lever', 'ashby', 'workable', 'smartrecruiters', 'personio', 'teamtailor', 'bamboohr' ) as $wrbc_jobs_adapter ) {
	require_once __DIR__ . '/adapters/class-' . $wrbc_jobs_adapter . '.php';
}
unset( $wrbc_jobs_adapter );
require_once __DIR__ . '/class-providers.php';
require_once __DIR__ . '/class-jobs.php';
require_once __DIR__ . '/class-rest.php';
require_once __DIR__ . '/class-render.php';

\Werun\BlocksCommunity\Jobs\Jobs::register();
\Werun\BlocksCommunity\Jobs\Rest::register();
