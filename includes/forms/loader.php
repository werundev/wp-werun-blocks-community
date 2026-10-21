<?php
/**
 * Forms area: providers (SaaS embeds and form plugins), the sources route
 * for the form block's editor, and the hidden gate-ticket field. Loaded by
 * werun-blocks-community.php. The block itself is src/form/.
 *
 * @package werun-blocks-community
 */

defined( 'ABSPATH' ) || exit;

require_once __DIR__ . '/interface-provider.php';
require_once __DIR__ . '/class-provider.php';
require_once __DIR__ . '/class-native-provider.php';
foreach ( array( 'hubspot', 'marketo', 'pardot', 'dynamics', 'typeform', 'jotform', 'mailchimp', 'activecampaign', 'zoho', 'calendly', 'gravity', 'wpforms', 'cf7', 'fluent', 'ninja', 'formidable' ) as $wrbc_provider ) {
	require_once __DIR__ . '/providers/class-' . $wrbc_provider . '.php';
}
unset( $wrbc_provider );
require_once __DIR__ . '/class-forms.php';
require_once __DIR__ . '/class-rest.php';

\Werun\BlocksCommunity\Forms\Forms::register();
\Werun\BlocksCommunity\Forms\Rest::register();
