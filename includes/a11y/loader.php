<?php
/**
 * Accessibility helpers every block uses: colour contrast and the render
 * context (the background a block sits on). Contract: docs/accessibility.md.
 *
 * @package werun-blocks-community
 */

defined( 'ABSPATH' ) || exit;

require_once __DIR__ . '/contrast.php';
require_once __DIR__ . '/context.php';
