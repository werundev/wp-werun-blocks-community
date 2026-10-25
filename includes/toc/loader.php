<?php
/**
 * Table of contents area: heading ids for the werun-community/toc block.
 * Required automatically by werun-blocks-community.php.
 *
 * @package werun-blocks-community
 */

defined( 'ABSPATH' ) || exit;

require_once __DIR__ . '/class-toc.php';
\Werun\BlocksCommunity\Toc\Toc::register();
