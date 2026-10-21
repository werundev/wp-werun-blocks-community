<?php
/**
 * PHP side of the shared front-end modules (docs/shared-modules.md): the
 * markup helpers render.php files share with the JS in src/shared/view/.
 * Required automatically by werun-blocks-community.php (area "modules").
 *
 *   consent.php   wrbc_consent_mode(), wrbc_consent_placeholder()
 *   video.php     wrbc_video_id()
 *   carousel.php  wrbc_carousel_attrs(), wrbc_carousel_controls()
 *
 * @package werun-blocks-community
 */

defined( 'ABSPATH' ) || exit;

require_once __DIR__ . '/consent.php';
require_once __DIR__ . '/video.php';
require_once __DIR__ . '/carousel.php';
