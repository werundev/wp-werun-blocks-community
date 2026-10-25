<?php
/**
 * Gate area: resource gating (tickets, unlock route, hard-gating hooks of
 * the form plugins, download links). Loaded by werun-blocks-community.php.
 *
 * Public API for other blocks (the query block's resource cards):
 * wrbc_gate_ticket(), wrbc_gate_remembered(), wrbc_gate_download_url(),
 * wrbc_gate_attachment_id(). Contract: docs/shared-modules.md (wrbc-gate).
 *
 * @package werun-blocks-community
 */

defined( 'ABSPATH' ) || exit;

require_once __DIR__ . '/class-gate.php';
require_once __DIR__ . '/class-hard.php';
require_once __DIR__ . '/class-unlock.php';
require_once __DIR__ . '/class-download.php';

\Werun\BlocksCommunity\Gate\Gate::register();
\Werun\BlocksCommunity\Gate\Hard::register();
\Werun\BlocksCommunity\Gate\Unlock::register();
\Werun\BlocksCommunity\Gate\Download::register();

if ( ! function_exists( 'wrbc_gate_ticket' ) ) {
	/**
	 * A signed gate ticket for a resource ('' when it has no download).
	 *
	 * @param int    $resource Resource post id.
	 * @param int    $page     Page id (0 = none).
	 * @param string $mode     soft | hard (hard needs $form).
	 * @param string $form     "provider:formId" for hard tickets.
	 */
	function wrbc_gate_ticket( $resource, $page = 0, $mode = 'soft', $form = '' ) {
		return \Werun\BlocksCommunity\Gate\Gate::ticket( (int) $resource, (int) $page, (string) $mode, (string) $form );
	}
}

if ( ! function_exists( 'wrbc_gate_remembered' ) ) {
	/**
	 * Whether the visitor's signed cookie says they unlocked this resource.
	 *
	 * @param int  $resource Resource post id.
	 * @param bool $hard     Only an unlock through a verified (hard) submission.
	 */
	function wrbc_gate_remembered( $resource, $hard = false ) {
		return \Werun\BlocksCommunity\Gate\Gate::remembered( (int) $resource, (bool) $hard );
	}
}

if ( ! function_exists( 'wrbc_gate_download_url' ) ) {
	/**
	 * A signed, expiring download link ('' when unavailable).
	 *
	 * @param int $resource Resource post id.
	 */
	function wrbc_gate_download_url( $resource ) {
		return \Werun\BlocksCommunity\Gate\Gate::download_url( (int) $resource );
	}
}

if ( ! function_exists( 'wrbc_gate_attachment_id' ) ) {
	/**
	 * The attachment a resource downloads (0 = none).
	 *
	 * @param int $resource Resource post id.
	 */
	function wrbc_gate_attachment_id( $resource ) {
		return \Werun\BlocksCommunity\Gate\Gate::attachment_id( (int) $resource );
	}
}
