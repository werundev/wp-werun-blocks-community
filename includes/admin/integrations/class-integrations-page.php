<?php
/**
 * werun.Blocks.Community → Integrations: maps, privacy (consent), form providers, jobs
 * (ATS) and resource gating, plus the hosts this site may load (CSP helper).
 * The plugin's only screen, with its own menu (the werun monogram) and the
 * werun-blocks-community-ui-* kit (vertical tabs with search).
 *
 * Values: Integrations (one option, its schema validates). Secrets: Secret
 * (encrypted, one option each), never printed back, wp-config constant wins.
 *
 * @package werun-blocks-community
 */

namespace Werun\BlocksCommunity\Admin\Integrations;

use Werun\BlocksCommunity\Admin\Ui;
use Werun\BlocksCommunity\Integrations\Integrations;
use Werun\BlocksCommunity\Integrations\Secret;
use WP_Error;
use WP_REST_Response;

defined( 'ABSPATH' ) || exit;

/**
 * Integrations screen.
 */
final class Integrations_Page {

	public const SLUG  = 'werun-blocks-community-integrations';
	public const GROUP = 'werun_blocks_community_integrations';

	/** Hook suffix of the screen. */
	private string $hook = '';

	/**
	 * Hooks.
	 */
	public function register(): void {
		add_action( 'admin_menu', array( $this, 'add_menu' ) );
		add_action( 'admin_init', array( $this, 'register_settings' ) );
		add_action( 'rest_api_init', array( $this, 'register_routes' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue' ) );
		add_filter( 'admin_body_class', array( $this, 'body_class' ) );
		add_filter( 'plugin_action_links_' . plugin_basename( WERUN_BLOCKS_COMMUNITY_FILE ), array( $this, 'action_link' ) );
	}

	/**
	 * "Settings" link on the Plugins screen.
	 *
	 * @param array $links Links.
	 */
	public function action_link( $links ): array {
		$links = (array) $links;
		array_unshift( $links, '<a href="' . esc_url( self::url() ) . '">' . esc_html__( 'Settings', 'werun-blocks-community' ) . '</a>' );
		return $links;
	}

	/**
	 * Screen URL.
	 *
	 * @param string $tab Tab id, or '' for the first one.
	 */
	public static function url( string $tab = '' ): string {
		$url = admin_url( 'admin.php?page=' . self::SLUG );
		return '' !== $tab ? add_query_arg( 'tab', $tab, $url ) : $url;
	}

	/**
	 * werun.Blocks.Community menu with an Integrations submenu.
	 */
	public function add_menu(): void {
		$this->hook = (string) add_menu_page(
			'werun.Blocks.Community',
			'werun.Blocks.Community',
			'manage_options',
			self::SLUG,
			array( $this, 'render' ),
			'none', // The werun monogram is drawn by assets/admin/css/menu-icon.css.
			83
		);
		add_submenu_page( self::SLUG, __( 'Integrations', 'werun-blocks-community' ), __( 'Integrations', 'werun-blocks-community' ), 'manage_options', self::SLUG, array( $this, 'render' ) );
	}

	/**
	 * Registers the setting (admin_init).
	 */
	public function register_settings(): void {
		register_setting(
			self::GROUP,
			Integrations::OPTION,
			array(
				'type'              => 'array',
				'show_in_rest'      => false,
				'default'           => array(),
				'sanitize_callback' => array( __CLASS__, 'sanitize' ),
			)
		);
	}

	/**
	 * Settings sanitizer: stores the secrets apart (Secret), then validates
	 * every plain value with Integrations::sanitize(). A filled-in value that
	 * doesn't validate keeps the saved one and shows an error, instead of
	 * silently falling back to the default.
	 *
	 * @param mixed $input Submitted values.
	 */
	public static function sanitize( $input ): array {
		$input = is_array( $input ) ? $input : array();

		if ( current_user_can( 'manage_options' ) ) {
			$secrets = isset( $input['secrets'] ) && is_array( $input['secrets'] ) ? $input['secrets'] : array();
			$clear   = isset( $input['secrets_clear'] ) && is_array( $input['secrets_clear'] ) ? $input['secrets_clear'] : array();
			foreach ( Integrations::SECRETS as $name ) {
				$secret = Secret::named( $name );
				if ( $secret->from_constant() ) {
					continue;
				}
				// Remove first, so "remove + a new value" replaces it.
				if ( isset( $clear[ $name ] ) ) {
					$secret->sanitize_clear( $clear[ $name ] );
				}
				if ( isset( $secrets[ $name ] ) ) {
					$secret->sanitize_field( $secrets[ $name ] );
				}
			}
		}
		unset( $input['secrets'], $input['secrets_clear'] );

		$out    = Integrations::sanitize( $input );
		$stored = get_option( Integrations::OPTION, array() );
		$stored = is_array( $stored ) ? $stored : array();
		$labels = self::labels();

		foreach ( Integrations::schema() as $section => $fields ) {
			foreach ( $fields as $key => $field ) {
				if ( ! in_array( $field['type'], array( 'text', 'url' ), true ) || ! isset( $input[ $section ][ $key ] ) || ! is_scalar( $input[ $section ][ $key ] ) ) {
					continue;
				}
				$typed = trim( sanitize_text_field( (string) $input[ $section ][ $key ] ) );
				if ( '' === $typed || $typed === $out[ $section ][ $key ] || ( 'url' === $field['type'] && $out[ $section ][ $key ] !== $field['default'] ) ) {
					continue;
				}
				// Rejected: keep what was saved before.
				$out[ $section ][ $key ] = isset( $stored[ $section ][ $key ] ) ? Integrations::sanitize( array( $section => array( $key => $stored[ $section ][ $key ] ) ) )[ $section ][ $key ] : $field['default'];
				add_settings_error(
					Integrations::OPTION,
					'wrbc-invalid-' . $section . '-' . $key,
					/* translators: %s: field label. */
					sprintf( __( '%s wasn’t saved: the value doesn’t have the expected format. The previous value was kept.', 'werun-blocks-community' ), $labels[ $section . '.' . $key ] ?? $section . '.' . $key ),
					'error'
				);
			}
		}

		return $out;
	}

	/**
	 * Field labels by "section.key" (for error messages).
	 */
	private static function labels(): array {
		$labels = array();
		foreach ( self::tabs() as $tab ) {
			foreach ( $tab['sections'] as $section ) {
				foreach ( (array) ( $section['fields'] ?? array() ) as $key => $field ) {
					$labels[ $key ] = (string) ( $field['label'] ?? $key );
				}
			}
		}
		return $labels;
	}

	/**
	 * POST wrbc/v1/integrations/hubspot/test: checks the saved HubSpot token.
	 */
	public function register_routes(): void {
		register_rest_route(
			'wrbc/v1',
			'/integrations/hubspot/test',
			array(
				'methods'             => 'POST',
				'callback'            => array( $this, 'test_hubspot' ),
				'permission_callback' => static function () {
					if ( current_user_can( 'manage_options' ) ) {
						return true;
					}
					return new WP_Error( 'rest_forbidden', __( 'Sorry, you are not allowed to manage werun.Blocks.', 'werun-blocks-community' ), array( 'status' => rest_authorization_required_code() ) );
				},
			)
		);
	}

	/**
	 * A server-side request to HubSpot with the saved token. The answer says
	 * only whether it worked; the token never leaves the server.
	 */
	public function test_hubspot(): WP_REST_Response {
		$token = Integrations::secret( 'hubspot_token' );
		if ( '' === $token ) {
			return new WP_REST_Response(
				array(
					'ok'      => false,
					'message' => __( 'No HubSpot token is saved.', 'werun-blocks-community' ),
				)
			);
		}

		$response = wp_remote_get(
			'https://api.hubapi.com/marketing/v3/forms?limit=1',
			array(
				'timeout'     => 10,
				'redirection' => 0,
				'headers'     => array(
					'Authorization' => 'Bearer ' . $token,
					'Accept'        => 'application/json',
				),
			)
		);

		if ( is_wp_error( $response ) ) {
			$ok      = false;
			$message = __( 'HubSpot couldn’t be reached from this server. Try again later.', 'werun-blocks-community' );
		} else {
			$code = (int) wp_remote_retrieve_response_code( $response );
			$ok   = 200 === $code;
			if ( $ok ) {
				$message = __( 'The token works: HubSpot answered.', 'werun-blocks-community' );
			} elseif ( 401 === $code ) {
				$message = __( 'HubSpot rejected the token. Check it, or create a new one in the private app.', 'werun-blocks-community' );
			} elseif ( 403 === $code ) {
				$message = __( 'The token is valid but lacks the “forms” scope. Add it to the private app.', 'werun-blocks-community' );
			} elseif ( 429 === $code ) {
				$message = __( 'HubSpot is limiting requests right now. Try again in a minute.', 'werun-blocks-community' );
			} else {
				/* translators: %d: HTTP status code. */
				$message = sprintf( __( 'HubSpot answered with an error (HTTP %d).', 'werun-blocks-community' ), $code );
			}
		}

		return new WP_REST_Response(
			array(
				'ok'      => $ok,
				'message' => $message,
			)
		);
	}

	/**
	 * Scopes the UI kit to this screen (body class).
	 *
	 * @param string $classes Body classes.
	 */
	public function body_class( $classes ): string {
		$screen = get_current_screen();
		if ( $screen && '' !== $this->hook && $this->hook === $screen->id ) {
			$classes .= ' werun-blocks-community-screen werun-blocks-community-screen-integrations';
		}
		return (string) $classes;
	}

	/**
	 * Menu icon everywhere the menu shows; the UI kit on this screen only.
	 *
	 * @param string $hook Screen hook.
	 */
	public function enqueue( $hook ): void {
		$base = WERUN_BLOCKS_COMMUNITY_URL . 'assets/admin/';
		if ( current_user_can( 'manage_options' ) ) {
			wp_enqueue_style( 'werun-blocks-community-admin-menu-icon', $base . 'css/menu-icon.css', array(), self::version( 'css/menu-icon.css' ) );
		}
		if ( '' === $this->hook || $hook !== $this->hook ) {
			return;
		}

		wp_enqueue_style( 'werun-blocks-community-admin-tokens', $base . 'css/tokens.css', array(), self::version( 'css/tokens.css' ) );
		wp_enqueue_style( 'werun-blocks-community-admin-ui', $base . 'css/ui.css', array( 'werun-blocks-community-admin-tokens' ), self::version( 'css/ui.css' ) );
		wp_enqueue_style( 'werun-blocks-community-settings-page', $base . 'css/settings-page.css', array( 'werun-blocks-community-admin-ui' ), self::version( 'css/settings-page.css' ) );
		wp_enqueue_style( 'werun-blocks-community-tab-search', $base . 'css/tab-search.css', array( 'werun-blocks-community-admin-ui' ), self::version( 'css/tab-search.css' ) );
		wp_enqueue_style( 'werun-blocks-community-integrations-page', $base . 'css/integrations-page.css', array( 'werun-blocks-community-settings-page', 'werun-blocks-community-tab-search' ), self::version( 'css/integrations-page.css' ) );

		wp_register_script( 'werun-blocks-community-admin-ui', $base . 'js/ui.js', array( 'wp-i18n', 'wp-a11y' ), self::version( 'js/ui.js' ), true );
		wp_enqueue_script( 'werun-blocks-community-tab-search', $base . 'js/tab-search.js', array( 'wp-i18n', 'wp-a11y' ), self::version( 'js/tab-search.js' ), true );
		wp_enqueue_script( 'werun-blocks-community-integrations-page', $base . 'js/integrations-page.js', array( 'werun-blocks-community-admin-ui', 'werun-blocks-community-tab-search', 'wp-api-fetch', 'wp-i18n', 'wp-a11y' ), self::version( 'js/integrations-page.js' ), true );
	}

	/**
	 * Asset version: plugin version, or file mtime while debugging.
	 *
	 * @param string $relative Path under assets/admin/.
	 */
	private static function version( string $relative ): string {
		if ( defined( 'WP_DEBUG' ) && WP_DEBUG ) {
			$file = WERUN_BLOCKS_COMMUNITY_DIR . 'assets/admin/' . $relative;
			if ( is_readable( $file ) ) {
				return WERUN_BLOCKS_COMMUNITY_VERSION . '.' . filemtime( $file );
			}
		}
		return WERUN_BLOCKS_COMMUNITY_VERSION;
	}

	/**
	 * Current values by "section.key".
	 */
	public static function values(): array {
		$values = array();
		foreach ( Integrations::schema() as $section => $fields ) {
			foreach ( array_keys( $fields ) as $key ) {
				$values[ $section . '.' . $key ] = Integrations::get( $section . '.' . $key );
			}
		}
		return $values;
	}

	/**
	 * Consent banners (CMPs) the "cmp" mode can follow: label => active.
	 */
	public static function detected_cmps(): array {
		return array(
			'WP Consent API' => function_exists( 'wp_has_consent' ),
			'Complianz'      => defined( 'cmplz_version' ) || function_exists( 'cmplz_has_consent' ) || class_exists( 'COMPLIANZ' ),
			'CookieYes'      => defined( 'CKY_VERSION' ) || defined( 'CLI_VERSION' ),
			'Cookiebot'      => defined( 'CYBOT_COOKIEBOT_VERSION' ) || class_exists( '\cybot\cookiebot\Cookiebot_WP' ),
		);
	}

	/**
	 * WordPress form plugins the form block can embed: label => active.
	 */
	public static function detected_form_plugins(): array {
		return array(
			'Gravity Forms'  => class_exists( 'GFForms' ),
			'WPForms'        => function_exists( 'wpforms' ),
			'Contact Form 7' => defined( 'WPCF7_VERSION' ),
			'Fluent Forms'   => defined( 'FLUENTFORM' ) || defined( 'FLUENTFORM_VERSION' ),
			'Ninja Forms'    => class_exists( 'Ninja_Forms' ),
			'Formidable'     => class_exists( 'FrmAppHelper' ),
		);
	}

	/**
	 * Hosts the visitor's browser may load for the saved settings, for a
	 * Content-Security-Policy: rows of { service, host, directives }.
	 */
	public static function hosts(): array {
		$rows = array();
		$add  = static function ( string $service, string $host, string $directives ) use ( &$rows ): void {
			$rows[] = array(
				'service'    => $service,
				'host'       => $host,
				'directives' => $directives,
			);
		};

		if ( 'google' === Integrations::get( 'maps.provider' ) ) {
			$add( __( 'Google Maps', 'werun-blocks-community' ), 'maps.googleapis.com', 'script-src, connect-src, img-src' );
			// A row of the CSP table shown to the admin (Google Maps' image host); nothing is loaded from here.
			$add( __( 'Google Maps', 'werun-blocks-community' ), 'maps.gstatic.com', 'img-src' ); // phpcs:ignore PluginCheck.CodeAnalysis.Offloading.OffloadedContent
		} else {
			$tiles = strtr(
				(string) Integrations::get( 'maps.tiles' ),
				array(
					'{s}' => 'wrbsub',
					'{z}' => '0',
					'{x}' => '0',
					'{y}' => '0',
					'{r}' => '',
				)
			);
			$host  = (string) wp_parse_url( $tiles, PHP_URL_HOST );
			if ( '' !== $host ) {
				$add( __( 'Map tiles (Leaflet)', 'werun-blocks-community' ), str_replace( 'wrbsub', '*', $host ), 'img-src' );
			}
		}

		if ( '' !== Integrations::get( 'forms.hubspot_portal' ) ) {
			$eu = 'eu1' === Integrations::get( 'forms.hubspot_region' ) ? '-eu1' : '';
			$add( 'HubSpot', 'js' . $eu . '.hsforms.net', 'script-src' );
			$add( 'HubSpot', 'forms' . $eu . '.hsforms.com', 'connect-src, img-src, frame-src' );
		}
		$marketo = (string) Integrations::get( 'forms.marketo_base' );
		if ( '' !== $marketo ) {
			$add( 'Marketo', $marketo, 'script-src, connect-src, frame-src' );
		}
		$pardot = (string) Integrations::get( 'forms.pardot_domain' );
		if ( '' !== $pardot ) {
			$add( 'Account Engagement (Pardot)', $pardot, 'frame-src' );
		}
		if ( '' !== Integrations::get( 'forms.dynamics_org' ) ) {
			$region = (string) Integrations::get( 'forms.dynamics_region' );
			$add( 'Dynamics 365 Customer Insights', $region . '.mkt.dynamics.com', 'connect-src' );
			$add( 'Dynamics 365 Customer Insights', 'assets-' . substr( $region, strlen( 'public-' ) ) . '.mkt.dynamics.com', 'script-src' );
		}
		$ac = (string) Integrations::get( 'forms.activecampaign' );
		if ( '' !== $ac ) {
			$add( 'ActiveCampaign', $ac . '.activehosted.com', 'script-src, frame-src' );
		}
		$add( __( 'Zoho Forms (only when a form uses it)', 'werun-blocks-community' ), 'forms.zohopublic.' . Integrations::get( 'forms.zoho_dc' ), 'frame-src' );

		$add( __( 'YouTube videos', 'werun-blocks-community' ), 'www.youtube-nocookie.com', 'frame-src' );
		$add( __( 'Vimeo videos', 'werun-blocks-community' ), 'player.vimeo.com', 'frame-src' );

		return $rows;
	}

	/**
	 * Tabs → sections → fields. Field keys are "section.key" of the
	 * Integrations schema, or a secret name for type "secret".
	 */
	public static function tabs(): array {
		$cmps    = self::detected_cmps();
		$minutes = __( 'minutes', 'werun-blocks-community' );
		$days    = __( 'days', 'werun-blocks-community' );

		$tabs = array(
			'maps'    => array(
				'title'    => __( 'Maps', 'werun-blocks-community' ),
				'sections' => array(
					'maps' => array(
						'title'       => __( 'Map provider', 'werun-blocks-community' ),
						'description' => __( 'Used by every map block. Maps load only after the visitor’s consent (see Privacy).', 'werun-blocks-community' ),
						'fields'      => array(
							'maps.provider'      => array(
								'type'    => 'select',
								'label'   => __( 'Provider', 'werun-blocks-community' ),
								'options' => array(
									'leaflet' => __( 'OpenStreetMap-style tiles (Leaflet)', 'werun-blocks-community' ),
									'google'  => __( 'Google Maps', 'werun-blocks-community' ),
								),
							),
							'maps.tiles'         => array(
								'type'        => 'url',
								'label'       => __( 'Tiles template', 'werun-blocks-community' ),
								'placeholder' => 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
								'description' => __( 'An https:// address with {z}, {x} and {y}; {s} (subdomain) and {r} (retina) are optional. The default OpenStreetMap servers are run by volunteers: their tile usage policy allows light use only, with the attribution visible, and no heavy or commercial traffic. For a busy or commercial site use a commercial provider (MapTiler, Stadia Maps, Thunderforest, Mapbox…) and paste its template with your key.', 'werun-blocks-community' ),
								'show_if'     => array( 'maps.provider' => 'leaflet' ),
								'wide'        => true,
							),
							'maps.attribution'   => array(
								'type'        => 'text',
								'label'       => __( 'Attribution', 'werun-blocks-community' ),
								'description' => __( 'Shown in the corner of the map. Tile providers require it; use the text your provider asks for.', 'werun-blocks-community' ),
								'show_if'     => array( 'maps.provider' => 'leaflet' ),
							),
							'maps.google_key'    => array(
								'type'        => 'text',
								'label'       => __( 'Google Maps browser key', 'werun-blocks-community' ),
								'placeholder' => 'AIza…',
								'description' => __( 'A browser key is sent to every visitor, so it is public. In Google Cloud restrict it by HTTP referrer to this site’s domain and to the Maps JavaScript API only.', 'werun-blocks-community' ),
								'show_if'     => array( 'maps.provider' => 'google' ),
							),
							'maps.google_map_id' => array(
								'type'        => 'text',
								'label'       => __( 'Map ID', 'werun-blocks-community' ),
								'description' => __( 'Optional. Needed for advanced markers and cloud-based map styles (Google Cloud → Map Management).', 'werun-blocks-community' ),
								'show_if'     => array( 'maps.provider' => 'google' ),
							),
						),
					),
				),
			),
			'privacy' => array(
				'title'    => __( 'Privacy', 'werun-blocks-community' ),
				'sections' => array(
					'consent'  => array(
						'title'       => __( 'Consent for embeds', 'werun-blocks-community' ),
						'description' => __( 'Maps, videos and third-party forms set cookies or send the visitor’s IP to another company. Choose when they may load. A block can override this.', 'werun-blocks-community' ),
						'fields'      => array(
							'privacy.consent'       => array(
								'type'    => 'select',
								'label'   => __( 'Load embeds', 'werun-blocks-community' ),
								'options' => array(
									'click' => __( 'On click (a placeholder on each embed)', 'werun-blocks-community' ),
									'cmp'   => __( 'When the cookie banner allows it', 'werun-blocks-community' ),
									'none'  => __( 'Right away (no consent)', 'werun-blocks-community' ),
								),
							),
							'privacy.remember_days' => array(
								'type'        => 'number',
								'label'       => __( 'Remember the choice for', 'werun-blocks-community' ),
								'min'         => 0,
								'max'         => 730,
								'suffix'      => $days,
								'description' => __( 'After a visitor loads one embed, others of the same kind load on their own for this long. 0 asks on every page.', 'werun-blocks-community' ),
								'show_if'     => array( 'privacy.consent' => 'click' ),
							),
							'privacy.note_click'    => array(
								'type'    => 'note',
								'label'   => __( 'On click: each embed shows a placeholder “Load … (from host)”. Nothing is requested from the other company until the visitor clicks. Works without a cookie banner.', 'werun-blocks-community' ),
								'show_if' => array( 'privacy.consent' => 'click' ),
							),
							'privacy.note_cmp'      => array(
								'type'    => 'note',
								'label'   => __( 'Cookie banner: embeds wait for the matching category (maps, video, forms) in your consent banner and load as soon as it is accepted. Until then the placeholder shows.', 'werun-blocks-community' ),
								'show_if' => array( 'privacy.consent' => 'cmp' ),
							),
							'privacy.note_none'     => array(
								'type'    => 'note',
								'tone'    => 'warn',
								'label'   => __( 'Right away: embeds load with the page. Use it only where no consent is required, or when your banner already blocks these scripts.', 'werun-blocks-community' ),
								'show_if' => array( 'privacy.consent' => 'none' ),
							),
						),
					),
					'detected' => array(
						'title'       => __( 'Cookie banners on this site', 'werun-blocks-community' ),
						'description' => __( '“When the cookie banner allows it” follows any of these.', 'werun-blocks-community' ),
						'fields'      => array(
							'privacy.cmps' => array(
								'type'  => 'list',
								'label' => __( 'Supported consent tools', 'werun-blocks-community' ),
								'items' => $cmps,
							),
						),
					),
				),
			),
			'forms'   => array(
				'title'    => __( 'Forms', 'werun-blocks-community' ),
				'sections' => array(
					'hubspot'        => array(
						'title'       => 'HubSpot',
						'description' => __( 'The portal ID is in HubSpot → Settings → Account details.', 'werun-blocks-community' ),
						'fields'      => array(
							'forms.hubspot_portal' => array(
								'type'        => 'text',
								'label'       => __( 'Portal ID', 'werun-blocks-community' ),
								'placeholder' => '12345678',
								'description' => __( 'Digits only.', 'werun-blocks-community' ),
							),
							'forms.hubspot_region' => array(
								'type'    => 'select',
								'label'   => __( 'Data center', 'werun-blocks-community' ),
								'options' => array(
									'na1' => __( 'North America (na1)', 'werun-blocks-community' ),
									'eu1' => __( 'Europe (eu1)', 'werun-blocks-community' ),
								),
								'show_if' => array( 'forms.hubspot_portal' => Settings_Fields::FILLED ),
							),
							'hubspot_token'        => array(
								'type'         => 'secret',
								'label'        => __( 'Private app token', 'werun-blocks-community' ),
								'placeholder'  => 'pat-…',
								'description'  => __( 'Optional: lets the editor list your forms. Create a private app with the “forms” scope. Used only by this server, never sent to the browser.', 'werun-blocks-community' ),
								'remove_label' => __( 'Remove the saved HubSpot token', 'werun-blocks-community' ),
								'test'         => array(
									'label' => __( 'Test token', 'werun-blocks-community' ),
									'path'  => '/wrbc/v1/integrations/hubspot/test',
								),
							),
						),
					),
					'marketo'        => array(
						'title'       => 'Marketo',
						'description' => __( 'Both are in Marketo → Admin → Munchkin. Forms need both.', 'werun-blocks-community' ),
						'fields'      => array(
							'forms.marketo_base'     => array(
								'type'        => 'text',
								'label'       => __( 'Base host', 'werun-blocks-community' ),
								'placeholder' => 'app-ab12.marketo.com',
								'description' => __( 'The host only, without https://.', 'werun-blocks-community' ),
							),
							'forms.marketo_munchkin' => array(
								'type'        => 'text',
								'label'       => __( 'Munchkin ID', 'werun-blocks-community' ),
								'placeholder' => '123-ABC-456',
							),
						),
					),
					'pardot'         => array(
						'title'  => __( 'Account Engagement (Pardot)', 'werun-blocks-community' ),
						'fields' => array(
							'forms.pardot_domain' => array(
								'type'        => 'text',
								'label'       => __( 'Tracker domain', 'werun-blocks-community' ),
								'placeholder' => 'go.example.com',
								'description' => __( 'The domain your Pardot forms are served from, without https://.', 'werun-blocks-community' ),
							),
						),
					),
					'dynamics'       => array(
						'title'  => __( 'Dynamics 365 Customer Insights', 'werun-blocks-community' ),
						'fields' => array(
							'forms.dynamics_org'    => array(
								'type'        => 'text',
								'label'       => __( 'Organization ID', 'werun-blocks-community' ),
								'placeholder' => '00000000-0000-0000-0000-000000000000',
								'description' => __( 'The GUID in the form’s embed code (data-form-api-url).', 'werun-blocks-community' ),
							),
							'forms.dynamics_region' => array(
								'type'    => 'select',
								'label'   => __( 'Region', 'werun-blocks-community' ),
								'options' => array(
									'public-usa' => __( 'United States', 'werun-blocks-community' ),
									'public-eur' => __( 'Europe', 'werun-blocks-community' ),
									'public-gbr' => __( 'United Kingdom', 'werun-blocks-community' ),
									'public-can' => __( 'Canada', 'werun-blocks-community' ),
									'public-aus' => __( 'Australia', 'werun-blocks-community' ),
									'public-jpn' => __( 'Japan', 'werun-blocks-community' ),
									'public-ind' => __( 'India', 'werun-blocks-community' ),
									'public-fra' => __( 'France', 'werun-blocks-community' ),
								),
								'show_if' => array( 'forms.dynamics_org' => Settings_Fields::FILLED ),
							),
						),
					),
					'activecampaign' => array(
						'title'  => 'ActiveCampaign',
						'fields' => array(
							'forms.activecampaign' => array(
								'type'        => 'text',
								'label'       => __( 'Account name', 'werun-blocks-community' ),
								'placeholder' => 'yourcompany',
								'description' => __( 'The first part of yourcompany.activehosted.com.', 'werun-blocks-community' ),
							),
						),
					),
					'zoho'           => array(
						'title'  => __( 'Zoho Forms', 'werun-blocks-community' ),
						'fields' => array(
							'forms.zoho_dc' => array(
								'type'        => 'select',
								'label'       => __( 'Data center', 'werun-blocks-community' ),
								'options'     => array(
									'com'    => __( 'United States (.com)', 'werun-blocks-community' ),
									'eu'     => __( 'Europe (.eu)', 'werun-blocks-community' ),
									'in'     => __( 'India (.in)', 'werun-blocks-community' ),
									'com.au' => __( 'Australia (.com.au)', 'werun-blocks-community' ),
									'jp'     => __( 'Japan (.jp)', 'werun-blocks-community' ),
								),
								'description' => __( 'Where your Zoho account lives (the domain you sign in to).', 'werun-blocks-community' ),
							),
						),
					),
					'plugins'        => array(
						'title'       => __( 'Form plugins on this site', 'werun-blocks-community' ),
						'description' => __( 'The form block can also show a form of any of these plugins. They need no settings here.', 'werun-blocks-community' ),
						'fields'      => array(
							'forms.plugins' => array(
								'type'  => 'list',
								'label' => __( 'WordPress form plugins', 'werun-blocks-community' ),
								'items' => self::detected_form_plugins(),
							),
						),
					),
				),
			),
			'jobs'    => array(
				'title'    => __( 'Jobs', 'werun-blocks-community' ),
				'sections' => array(
					'board' => array(
						'title'       => __( 'Job board', 'werun-blocks-community' ),
						'description' => __( 'The default for job blocks; each block can pick another one. Jobs are fetched by this server and cached.', 'werun-blocks-community' ),
						'fields'      => array(
							'jobs.provider' => array(
								'type'    => 'select',
								'label'   => __( 'Default provider', 'werun-blocks-community' ),
								'options' => array(
									'greenhouse'      => 'Greenhouse',
									'lever'           => 'Lever',
									'ashby'           => 'Ashby',
									'workable'        => 'Workable',
									'smartrecruiters' => 'SmartRecruiters',
									'personio'        => 'Personio',
									'teamtailor'      => 'Teamtailor',
									'bamboohr'        => 'BambooHR',
								),
							),
							'jobs.board'    => array(
								'type'        => 'text',
								'label'       => __( 'Board or company', 'werun-blocks-community' ),
								'placeholder' => 'yourcompany',
								'description' => __( 'Greenhouse: board token. Lever, Ashby, Workable, SmartRecruiters, Personio: company slug in your careers URL. BambooHR: company subdomain.', 'werun-blocks-community' ),
								'show_if'     => array( 'jobs.provider' => array( 'greenhouse', 'lever', 'ashby', 'workable', 'smartrecruiters', 'personio', 'bamboohr' ) ),
							),
							'jobs.ttl'      => array(
								'type'        => 'number',
								'label'       => __( 'Refresh the list every', 'werun-blocks-community' ),
								'min'         => 5,
								'max'         => 1440,
								'suffix'      => $minutes,
								'description' => __( 'From 5 minutes to 1 day. Shorter means fresher jobs and more requests.', 'werun-blocks-community' ),
							),
						),
					),
					'keys'  => array(
						'title'       => __( 'API keys', 'werun-blocks-community' ),
						'description' => __( 'Only Teamtailor and BambooHR need a key. Keys are used by this server only and never sent to the browser.', 'werun-blocks-community' ),
						'fields'      => array(
							'teamtailor_key' => array(
								'type'         => 'secret',
								'label'        => __( 'Teamtailor API key', 'werun-blocks-community' ),
								'description'  => __( 'Teamtailor → Settings → API keys, a public key with read access.', 'werun-blocks-community' ),
								'remove_label' => __( 'Remove the saved Teamtailor key', 'werun-blocks-community' ),
							),
							'bamboohr_key'   => array(
								'type'         => 'secret',
								'label'        => __( 'BambooHR API key', 'werun-blocks-community' ),
								'description'  => __( 'BambooHR → your account → API keys.', 'werun-blocks-community' ),
								'remove_label' => __( 'Remove the saved BambooHR key', 'werun-blocks-community' ),
							),
						),
					),
				),
			),
			'gating'  => array(
				'title'    => __( 'Gating', 'werun-blocks-community' ),
				'sections' => array(
					'gating' => array(
						'title'       => __( 'Gated downloads', 'werun-blocks-community' ),
						'description' => __( 'A gated download asks for a form before the file. Soft gating hides the link until the form is sent, but the file keeps a public address that can be shared. Hard gating (chosen on each block) only gives out a signed link that expires, so the file can’t be reached without the form.', 'werun-blocks-community' ),
						'fields'      => array(
							'gating.unlock_minutes' => array(
								'type'        => 'number',
								'label'       => __( 'Download link valid for', 'werun-blocks-community' ),
								'min'         => 1,
								'max'         => 120,
								'suffix'      => $minutes,
								'description' => __( 'How long the signed link works after the form is sent (hard gating).', 'werun-blocks-community' ),
							),
							'gating.remember_days'  => array(
								'type'        => 'number',
								'label'       => __( 'Remember the visitor for', 'werun-blocks-community' ),
								'min'         => 0,
								'max'         => 365,
								'suffix'      => $days,
								'description' => __( 'Visitors who already sent a form get other gated files without it for this long (a signed cookie). 0 asks every time.', 'werun-blocks-community' ),
							),
							'gating.delivery'       => array(
								'type'    => 'select',
								'label'   => __( 'Hard-gated delivery', 'werun-blocks-community' ),
								'options' => array(
									'redirect' => __( 'Redirect to the file', 'werun-blocks-community' ),
									'stream'   => __( 'Stream through WordPress', 'werun-blocks-community' ),
								),
							),
							'gating.note_redirect'  => array(
								'type'    => 'note',
								'label'   => __( 'Redirect: the signed link checks the visitor and then sends the browser to the file. Fast and light on the server, but the file’s real address shows up at the end and could be shared.', 'werun-blocks-community' ),
								'show_if' => array( 'gating.delivery' => 'redirect' ),
							),
							'gating.note_stream'    => array(
								'type'    => 'note',
								'label'   => __( 'Stream: WordPress reads the file and sends it, so its real address is never shown. Safest, but each download keeps a PHP worker busy; prefer it for small and medium files.', 'werun-blocks-community' ),
								'show_if' => array( 'gating.delivery' => 'stream' ),
							),
						),
					),
				),
			),
		);

		if ( ! in_array( true, $cmps, true ) ) {
			$tabs['privacy']['sections']['consent']['fields']['privacy.note_cmp_none'] = array(
				'type'    => 'note',
				'tone'    => 'warn',
				'label'   => __( 'No supported cookie banner is active on this site, so in this mode embeds keep waiting. Install one of the tools below, or load embeds on click.', 'werun-blocks-community' ),
				'show_if' => array( 'privacy.consent' => 'cmp' ),
			);
		}

		return $tabs;
	}

	/**
	 * Renders the screen.
	 */
	public function render(): void {
		if ( ! current_user_can( 'manage_options' ) ) {
			wp_die( esc_html__( 'Sorry, you are not allowed to manage werun.Blocks.', 'werun-blocks-community' ), '', array( 'response' => 403 ) );
		}

		// Read-only flag set by options.php after a successful save.
		$saved = isset( $_GET['settings-updated'] ) && 'true' === sanitize_key( wp_unslash( $_GET['settings-updated'] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended

		$vars = array(
			'tabs'   => self::tabs(),
			'values' => self::values(),
			'hosts'  => self::hosts(),
			'saved'  => $saved,
			'option' => Integrations::OPTION,
		);
		include WERUN_BLOCKS_COMMUNITY_DIR . 'templates/admin/integrations-page.php';
	}
}
