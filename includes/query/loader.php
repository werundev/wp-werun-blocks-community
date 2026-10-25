<?php
/**
 * werun-community/query server side: config normalization, WP_Query builder, runner
 * with cache, markup, meta-key discovery and REST routes. Required by
 * werun-blocks-community.php (feature area "query").
 *
 * @package werun-blocks-community
 */

defined( 'ABSPATH' ) || exit;

require_once __DIR__ . '/class-config.php';
require_once __DIR__ . '/class-builder.php';
require_once __DIR__ . '/class-view.php';
require_once __DIR__ . '/class-request.php';
require_once __DIR__ . '/class-runner.php';
require_once __DIR__ . '/class-format.php';
require_once __DIR__ . '/class-renderer.php';
require_once __DIR__ . '/class-meta-keys.php';
require_once __DIR__ . '/class-rest.php';

\Werun\BlocksCommunity\Query\Rest::register();
