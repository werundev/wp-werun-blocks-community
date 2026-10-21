<?php
/**
 * werun.Blocks.Community → Integrations screen (required by werun-blocks-community.php).
 *
 * @package werun-blocks-community
 */

defined( 'ABSPATH' ) || exit;

require_once __DIR__ . '/class-settings-fields.php';
require_once __DIR__ . '/class-integrations-page.php';

( new \Werun\BlocksCommunity\Admin\Integrations\Integrations_Page() )->register();
