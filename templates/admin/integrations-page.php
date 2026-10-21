<?php
/**
 * werun.Blocks.Community → Integrations. Vertical tabs
 * with search, one form for every tab so saving never drops hidden values)
 * with the werun-blocks-community-ui-* kit and one tab per group of sections.
 *
 * @package werun-blocks-community
 *
 * @var array $vars {tabs, values, hosts, saved, option}
 */

use Werun\BlocksCommunity\Admin\Ui;
use Werun\BlocksCommunity\Admin\Integrations\Integrations_Page;
use Werun\BlocksCommunity\Admin\Integrations\Settings_Fields;
use Werun\BlocksCommunity\Integrations\Integrations;

defined( 'ABSPATH' ) || exit;

$werun_blocks_community_tabs   = (array) $vars['tabs'];
$werun_blocks_community_active = Settings_Fields::active_tab( $werun_blocks_community_tabs );
$werun_blocks_community_id     = 'werun-blocks-community-integrations';
$werun_blocks_community_sprite = WERUN_BLOCKS_COMMUNITY_DIR . 'assets/admin/icons/sprite.svg';
$werun_blocks_community_errors = array();
foreach ( get_settings_errors( Integrations::OPTION ) as $werun_blocks_community_error ) {
	// The sanitizer can run twice on the first save: one notice per code.
	if ( 'settings_updated' !== ( $werun_blocks_community_error['code'] ?? '' ) ) {
		$werun_blocks_community_errors[ (string) $werun_blocks_community_error['code'] ] = $werun_blocks_community_error;
	}
}
?>
<div class="werun-blocks-community-app werun-blocks-community-settings werun-blocks-community-integrations" data-saved="<?php echo $vars['saved'] ? '1' : '0'; ?>">
	<?php
	if ( is_readable( $werun_blocks_community_sprite ) ) {
		echo file_get_contents( $werun_blocks_community_sprite ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped, WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- the plugin's own static sprite.
	}
	?>
	<div class="werun-blocks-community-ui-canvas">
		<div class="werun-blocks-community-ui-wrap">

			<nav class="werun-blocks-community-ui-breadcrumb werun-blocks-community-ui-mono" aria-label="<?php esc_attr_e( 'Breadcrumb', 'werun-blocks-community' ); ?>">
				<ol>
					<li><a href="<?php echo esc_url( Integrations_Page::url() ); ?>">werun.Blocks.Community</a></li>
					<li><span aria-current="page"><?php esc_html_e( 'Integrations', 'werun-blocks-community' ); ?></span></li>
				</ol>
			</nav>

			<header class="werun-blocks-community-settings-header">
				<div class="werun-blocks-community-settings-heading">
					<h1 class="werun-blocks-community-ui-display"><?php esc_html_e( 'Integrations', 'werun-blocks-community' ); ?></h1>
					<p class="werun-blocks-community-ui-lead"><?php esc_html_e( 'Maps, consent, form providers, job boards and gated downloads used by the werun.Blocks.Community blocks.', 'werun-blocks-community' ); ?></p>
				</div>
			</header>

			<hr class="wp-header-end">

			<?php if ( $vars['saved'] && ! $werun_blocks_community_errors ) : ?>
				<p class="werun-blocks-community-ui-notice werun-blocks-community-ui-notice-good" data-saved-notice tabindex="-1">
					<?php echo Ui::icon( 'circle-check' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped in icon(). ?>
					<span><?php esc_html_e( 'Settings saved.', 'werun-blocks-community' ); ?></span>
				</p>
			<?php endif; ?>

			<?php foreach ( $werun_blocks_community_errors as $werun_blocks_community_error ) : ?>
				<p class="werun-blocks-community-ui-notice werun-blocks-community-ui-notice-<?php echo 'error' === ( $werun_blocks_community_error['type'] ?? '' ) ? 'danger' : 'warn'; ?>" role="alert">
					<?php echo Ui::icon( 'circle-exclamation' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped in icon(). ?>
					<span><?php echo esc_html( wp_strip_all_tags( (string) ( $werun_blocks_community_error['message'] ?? '' ) ) ); ?></span>
				</p>
			<?php endforeach; ?>

			<div class="werun-blocks-community-settings-body">
				<div class="werun-blocks-community-ui-tabsearch" data-tabsearch>
					<div class="werun-blocks-community-ui-tabsearch-search">
						<label class="screen-reader-text" for="<?php echo esc_attr( $werun_blocks_community_id ); ?>-search"><?php esc_html_e( 'Search settings', 'werun-blocks-community' ); ?></label>
						<svg class="werun-blocks-community-ui-icon werun-blocks-community-ui-tabsearch-search-icon" aria-hidden="true" focusable="false"><use href="#werun-blocks-community-icon-magnifying-glass"></use></svg>
						<input type="search" id="<?php echo esc_attr( $werun_blocks_community_id ); ?>-search" class="werun-blocks-community-ui-tabsearch-search-input" placeholder="<?php esc_attr_e( 'Search settings…', 'werun-blocks-community' ); ?>" autocomplete="off" spellcheck="false" aria-keyshortcuts="/" aria-describedby="<?php echo esc_attr( $werun_blocks_community_id ); ?>-status" data-tabsearch-input>
						<button type="button" class="werun-blocks-community-ui-icon-button werun-blocks-community-ui-tabsearch-search-clear" data-tabsearch-clear hidden aria-label="<?php esc_attr_e( 'Clear search', 'werun-blocks-community' ); ?>">
							<?php echo Ui::icon( 'xmark' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped in icon(). ?>
						</button>
						<kbd class="werun-blocks-community-ui-kbd werun-blocks-community-ui-tabsearch-search-kbd" data-tabsearch-kbd aria-hidden="true">/</kbd>
					</div>
					<p class="screen-reader-text" id="<?php echo esc_attr( $werun_blocks_community_id ); ?>-status" aria-live="polite" data-tabsearch-status></p>

					<form method="post" action="<?php echo esc_url( admin_url( 'options.php' ) ); ?>" class="werun-blocks-community-settings-form">
						<?php settings_fields( Integrations_Page::GROUP ); ?>

						<div class="werun-blocks-community-ui-tabsearch-layout">
							<div class="werun-blocks-community-ui-tabsearch-nav" role="tablist" aria-orientation="vertical" aria-label="<?php esc_attr_e( 'Integrations', 'werun-blocks-community' ); ?>" data-tabsearch-tablist>
								<?php
								foreach ( $werun_blocks_community_tabs as $werun_blocks_community_key => $werun_blocks_community_tab ) :
									$werun_blocks_community_is_active = $werun_blocks_community_key === $werun_blocks_community_active;
									?>
									<button type="button" role="tab" class="werun-blocks-community-ui-tabsearch-tab" id="<?php echo esc_attr( $werun_blocks_community_id . '-tab-' . $werun_blocks_community_key ); ?>" aria-controls="<?php echo esc_attr( $werun_blocks_community_id . '-panel-' . $werun_blocks_community_key ); ?>" aria-selected="<?php echo $werun_blocks_community_is_active ? 'true' : 'false'; ?>" tabindex="<?php echo $werun_blocks_community_is_active ? '0' : '-1'; ?>" data-tabsearch-tab="<?php echo esc_attr( (string) $werun_blocks_community_key ); ?>">
										<span class="werun-blocks-community-ui-tabsearch-tab-label"><?php echo esc_html( (string) $werun_blocks_community_tab['title'] ); ?></span>
										<span class="werun-blocks-community-ui-tabsearch-tab-matches werun-blocks-community-ui-mono" data-tabsearch-matches hidden></span>
									</button>
								<?php endforeach; ?>
							</div>

							<div class="werun-blocks-community-ui-tabsearch-panels">
								<?php foreach ( $werun_blocks_community_tabs as $werun_blocks_community_key => $werun_blocks_community_tab ) : ?>
									<div class="werun-blocks-community-ui-tabsearch-panel werun-blocks-community-integrations-panel" role="tabpanel" id="<?php echo esc_attr( $werun_blocks_community_id . '-panel-' . $werun_blocks_community_key ); ?>" aria-labelledby="<?php echo esc_attr( $werun_blocks_community_id . '-tab-' . $werun_blocks_community_key ); ?>" tabindex="0" data-tabsearch-panel="<?php echo esc_attr( (string) $werun_blocks_community_key ); ?>">
										<?php Settings_Fields::render_sections( (array) $werun_blocks_community_tab['sections'], (string) $vars['option'], (array) $vars['values'] ); ?>
									</div>
								<?php endforeach; ?>

								<div class="werun-blocks-community-ui-empty werun-blocks-community-ui-tabsearch-empty" data-tabsearch-empty hidden>
									<?php echo Ui::icon( 'magnifying-glass' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped in icon(). ?>
									<p><?php esc_html_e( 'No settings match your search.', 'werun-blocks-community' ); ?></p>
								</div>
							</div>
						</div>

						<div class="werun-blocks-community-settings-actions">
							<button type="submit" class="werun-blocks-community-ui-button werun-blocks-community-ui-button-primary"><?php esc_html_e( 'Save changes', 'werun-blocks-community' ); ?></button>
						</div>
					</form>
				</div>

				<section class="werun-blocks-community-ui-card werun-blocks-community-settings-section werun-blocks-community-integrations-hosts" aria-labelledby="werun-blocks-community-integrations-hosts-title">
					<header class="werun-blocks-community-settings-section-header">
						<h2 class="werun-blocks-community-ui-eyebrow" id="werun-blocks-community-integrations-hosts-title"><?php esc_html_e( 'Hosts this site may load', 'werun-blocks-community' ); ?></h2>
						<p class="werun-blocks-community-settings-section-description"><?php esc_html_e( 'For a Content-Security-Policy or a firewall allowlist: the outside hosts a visitor’s browser may contact with the saved settings (after consent). Leaflet itself is served from this site; job boards and the HubSpot token are used only by the server. Read-only, updated when you save.', 'werun-blocks-community' ); ?></p>
					</header>
					<div class="werun-blocks-community-settings-table-wrap">
						<table class="werun-blocks-community-settings-table">
							<thead>
								<tr>
									<th scope="col"><?php esc_html_e( 'Service', 'werun-blocks-community' ); ?></th>
									<th scope="col"><?php esc_html_e( 'Host', 'werun-blocks-community' ); ?></th>
									<th scope="col"><?php esc_html_e( 'CSP directives', 'werun-blocks-community' ); ?></th>
								</tr>
							</thead>
							<tbody>
								<?php foreach ( (array) $vars['hosts'] as $werun_blocks_community_row ) : ?>
									<tr>
										<td><?php echo esc_html( $werun_blocks_community_row['service'] ); ?></td>
										<td><code class="werun-blocks-community-ui-mono"><?php echo esc_html( $werun_blocks_community_row['host'] ); ?></code></td>
										<td class="werun-blocks-community-ui-mono"><?php echo esc_html( $werun_blocks_community_row['directives'] ); ?></td>
									</tr>
								<?php endforeach; ?>
							</tbody>
						</table>
					</div>
				</section>
			</div>

			<footer class="werun-blocks-community-ui-footer werun-blocks-community-ui-mono">
				<span>werun.Blocks.Community <?php echo esc_html( WERUN_BLOCKS_COMMUNITY_VERSION ); ?> · <a href="https://werun.dev" target="_blank" rel="noopener">werun.dev<span class="screen-reader-text"> <?php esc_html_e( '(opens in a new tab)', 'werun-blocks-community' ); ?></span></a></span>
				<span><?php esc_html_e( 'Built to run.', 'werun-blocks-community' ); ?></span>
			</footer>
		</div>
	</div>
	<div class="werun-blocks-community-ui-toasts" role="status" aria-live="polite" aria-atomic="true" data-toasts></div>
</div>
