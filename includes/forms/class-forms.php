<?php
/**
 * Forms: the provider registry, the consent wrapper for third-party embeds
 * and the hidden gate-ticket field native form plugins print while the form
 * block renders them.
 *
 * @package werun-blocks-community
 */

namespace Werun\BlocksCommunity\Forms;

use Werun\BlocksCommunity\Integrations\Integrations;

defined( 'ABSPATH' ) || exit;

/**
 * Forms.
 */
final class Forms {

	/** Provider classes, SaaS first, in the order the editor lists them. */
	private const PROVIDERS = array(
		Providers\HubSpot::class,
		Providers\Marketo::class,
		Providers\Pardot::class,
		Providers\Dynamics::class,
		Providers\Typeform::class,
		Providers\Jotform::class,
		Providers\Mailchimp::class,
		Providers\ActiveCampaign::class,
		Providers\Zoho::class,
		Providers\Calendly::class,
		Providers\GravityForms::class,
		Providers\WPForms::class,
		Providers\ContactForm7::class,
		Providers\FluentForms::class,
		Providers\NinjaForms::class,
		Providers\Formidable::class,
	);

	/** Field name of the gate ticket in native form submissions. */
	public const TICKET_FIELD = 'wrbc_gate_ticket';

	/** @var Provider[]|null */
	private static $providers = null;

	/** Ticket of the form being rendered right now ('' outside the block). */
	private static $ticket = '';

	/** Hooks. */
	public static function register(): void {
		// Hidden ticket field, only while the block renders a gated native form.
		add_filter( 'wpcf7_form_hidden_fields', array( __CLASS__, 'cf7_hidden' ) );
		add_filter( 'gform_form_tag', array( __CLASS__, 'append_hidden' ), 10, 1 );
		add_action( 'wpforms_display_submit_before', array( __CLASS__, 'echo_hidden' ) );
		add_action( 'fluentform/form_element_start', array( __CLASS__, 'echo_hidden' ) );
		add_action( 'frm_entry_form', array( __CLASS__, 'echo_hidden' ) );
		// Ninja Forms renders with JS: view.js adds the ticket to its "extra" data.
	}

	/**
	 * Every provider, by id. Filter wrbc_form_providers to add one (an object
	 * extending Provider).
	 *
	 * @return Provider[]
	 */
	public static function providers(): array {
		if ( null === self::$providers ) {
			self::$providers = array();
			foreach ( self::PROVIDERS as $class ) {
				$p                           = new $class();
				self::$providers[ $p->id() ] = $p;
			}
			foreach ( (array) apply_filters( 'wrbc_form_providers', array() ) as $p ) {
				if ( $p instanceof Provider && preg_match( '/^[a-z0-9-]{2,32}$/', $p->id() ) ) {
					self::$providers[ $p->id() ] = $p;
				}
			}
		}
		return self::$providers;
	}

	/**
	 * A provider by id, or null.
	 *
	 * @param mixed $id Provider id.
	 */
	public static function get( $id ): ?Provider {
		$id = wrbc_text( $id );
		return self::providers()[ $id ] ?? null;
	}

	/**
	 * The consent mode for an embed: the block's override or Integrations.
	 *
	 * @param mixed $override inherit | click | cmp | none.
	 */
	public static function consent_mode( $override ): string {
		if ( function_exists( 'wrbc_consent_mode' ) ) {
			return wrbc_consent_mode( $override ); // includes/modules/consent.php.
		}
		$override = wrbc_text( $override );
		return in_array( $override, array( 'click', 'cmp', 'none' ), true ) ? $override : (string) Integrations::get( 'privacy.consent' );
	}

	/**
	 * A third-party embed behind the consent placeholder: the embed markup
	 * waits inert in a <template> next to it; the form's view.js asks
	 * wrbc.consent.request( 'forms', placeholder ) and copies it in once
	 * allowed (it then loads the provider's script itself, so the template
	 * isn't handed to the placeholder's own "content" mechanism).
	 *
	 * @param Provider $provider Provider.
	 * @param string   $embed    Embed markup.
	 * @param string   $mode     click | cmp | none.
	 * @param string   $host     The host the embed loads from (Provider::consent_host()); '' = the provider's first.
	 */
	public static function behind_consent( Provider $provider, string $embed, string $mode, string $host = '' ): string {
		if ( 'none' === $mode || ! $provider->needs_consent() ) {
			return $embed;
		}
		$hosts = $provider->hosts();
		$host  = '' !== $host ? $host : (string) ( $hosts[0] ?? '' );
		$label = $provider->consent_label();
		if ( function_exists( 'wrbc_consent_placeholder' ) ) {
			$placeholder = wrbc_consent_placeholder( 'forms', $host, $label, array( 'mode' => $mode ) );
		} else {
			// Until the shared module exists: the same button, handled by the form's view.js.
			$placeholder = sprintf(
				'<div class="wrbc-consent" data-wrbc-consent="forms"><button type="button" class="wrbc-btn wrbc-btn--outline" data-wrbc-form-load>%1$s</button><p class="wrbc-consent__note">%2$s</p></div>',
				esc_html( $label ),
				/* translators: %s: host name, e.g. js.hsforms.net. */
				esc_html( sprintf( __( 'The form loads from %s, which may set cookies.', 'werun-blocks-community' ), $host ) )
			);
		}
		return '<template class="wrbc-form__tpl">' . $embed . '</template>' . $placeholder;
	}

	/**
	 * Runs a native form's render with the gate ticket set, so the plugin's
	 * hooks print it as a hidden field.
	 *
	 * @param string   $ticket Gate ticket or ''.
	 * @param callable $render Returns the markup.
	 */
	public static function with_ticket( string $ticket, callable $render ): string {
		$previous     = self::$ticket;
		self::$ticket = $ticket;
		try {
			return (string) $render();
		} finally {
			self::$ticket = $previous;
		}
	}

	/** The hidden input, or ''. */
	public static function hidden_input(): string {
		return '' === self::$ticket ? '' : sprintf( '<input type="hidden" name="%1$s" value="%2$s">', self::TICKET_FIELD, esc_attr( self::$ticket ) );
	}

	/**
	 * CF7 hidden fields.
	 *
	 * @param mixed $fields name => value.
	 */
	public static function cf7_hidden( $fields ) {
		$fields = is_array( $fields ) ? $fields : array();
		if ( '' !== self::$ticket ) {
			$fields[ self::TICKET_FIELD ] = self::$ticket;
		}
		return $fields;
	}

	/**
	 * Appends the input after a form's opening tag (Gravity Forms).
	 *
	 * @param mixed $tag Opening <form> tag.
	 */
	public static function append_hidden( $tag ) {
		return wrbc_text( $tag ) . self::hidden_input();
	}

	/** Prints the input inside the form (WPForms, Fluent Forms, Formidable). */
	public static function echo_hidden(): void {
		echo self::hidden_input(); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped in hidden_input().
	}
}
