<?php
/**
 * Hard gating: the form plugins' own "submission saved/sent" hooks read the
 * gate ticket the form carried (hidden field wrbc_gate_ticket, printed by
 * Forms::with_ticket() or added by the browser), verify it and mark it as
 * submitted for 15 minutes. POST wrbc/v1/gate/unlock then requires that mark
 * for hard tickets, and uses it once.
 *
 * @package werun-blocks-community
 */

namespace Werun\BlocksCommunity\Gate;

use Werun\BlocksCommunity\Forms\Forms;

defined( 'ABSPATH' ) || exit;

/**
 * Hard.
 */
final class Hard {

	/** How long a verified submission waits for its unlock call. */
	public const TTL = 15 * MINUTE_IN_SECONDS;

	/** Hooks. */
	public static function register(): void {
		add_action( 'gform_after_submission', array( __CLASS__, 'gravity' ), 10, 2 );
		add_action( 'wpforms_process_complete', array( __CLASS__, 'wpforms' ), 10, 4 );
		add_action( 'wpcf7_mail_sent', array( __CLASS__, 'cf7' ), 10, 1 );
		add_action( 'fluentform/submission_inserted', array( __CLASS__, 'fluent' ), 10, 3 );
		add_action( 'ninja_forms_after_submission', array( __CLASS__, 'ninja' ), 10, 1 );
		add_action( 'frm_after_create_entry', array( __CLASS__, 'formidable' ), 30, 2 );
	}

	/**
	 * The transient key of a ticket.
	 *
	 * @param string $ticket Ticket.
	 */
	public static function key( string $ticket ): string {
		return 'wrbc_gate_' . substr( hash( 'sha256', $ticket ), 0, 32 );
	}

	/** The ticket field from the request body, or ''. */
	private static function posted(): string {
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- the ticket is signed; the form plugin verified its own request.
		return isset( $_POST[ Forms::TICKET_FIELD ] ) ? sanitize_text_field( wp_unslash( $_POST[ Forms::TICKET_FIELD ] ) ) : '';
	}

	/**
	 * Marks a ticket as submitted when it is valid and was issued for this form.
	 *
	 * @param mixed  $ticket   Ticket from the submission.
	 * @param string $provider Provider id.
	 * @param mixed  $form_id  The form that was submitted.
	 */
	public static function mark( $ticket, string $provider, $form_id ): bool {
		$ticket = wrbc_text( $ticket );
		$t      = '' === $ticket ? null : Gate::read_ticket( $ticket );
		if ( null === $t || $t['k'] !== $provider . ':' . (int) $form_id || ! Gate::file_matches( (int) $t['r'], (int) $t['f'] ) ) {
			return false;
		}
		set_transient( self::key( $ticket ), 1, self::TTL );
		// A form that reloads the page (no AJAX) finds the link on the next render.
		Gate::remember( $t['r'], true );
		return true;
	}

	/**
	 * Gravity Forms.
	 *
	 * @param mixed $entry Entry.
	 * @param mixed $form  Form.
	 */
	public static function gravity( $entry, $form ): void {
		self::mark( self::posted(), 'gravity', is_array( $form ) ? ( $form['id'] ?? 0 ) : 0 );
	}

	/**
	 * WPForms.
	 *
	 * @param mixed $fields    Fields.
	 * @param mixed $entry     Entry.
	 * @param mixed $form_data Form data.
	 * @param mixed $entry_id  Entry id.
	 */
	public static function wpforms( $fields, $entry, $form_data, $entry_id = 0 ): void {
		self::mark( self::posted(), 'wpforms', is_array( $form_data ) ? ( $form_data['id'] ?? 0 ) : 0 );
	}

	/**
	 * Contact Form 7.
	 *
	 * @param mixed $contact_form WPCF7_ContactForm.
	 */
	public static function cf7( $contact_form ): void {
		self::mark( self::posted(), 'cf7', is_object( $contact_form ) && method_exists( $contact_form, 'id' ) ? $contact_form->id() : 0 );
	}

	/**
	 * Fluent Forms: the AJAX request posts the form serialized in "data", and
	 * $form_data keeps only the form's own fields, so the ticket is read from
	 * that raw string.
	 *
	 * @param mixed $insert_id Entry id.
	 * @param mixed $form_data Submitted fields.
	 * @param mixed $form      Form.
	 */
	public static function fluent( $insert_id, $form_data, $form ): void {
		$ticket = self::posted();
		// phpcs:ignore WordPress.Security.NonceVerification.Missing -- Fluent verified its own nonce; the ticket is signed.
		if ( '' === $ticket && isset( $_POST['data'] ) && is_string( $_POST['data'] ) ) {
			parse_str( wp_unslash( $_POST['data'] ), $raw ); // phpcs:ignore WordPress.Security.NonceVerification.Missing, WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- Fluent verified its own nonce; only one field is read, and sanitised.
			$ticket = isset( $raw[ Forms::TICKET_FIELD ] ) && is_string( $raw[ Forms::TICKET_FIELD ] ) ? sanitize_text_field( $raw[ Forms::TICKET_FIELD ] ) : '';
		}
		self::mark( $ticket, 'fluent', is_object( $form ) && isset( $form->id ) ? $form->id : 0 );
	}

	/**
	 * Ninja Forms: the ticket travels in the submission's "extra" data.
	 *
	 * @param mixed $data Submission data.
	 */
	public static function ninja( $data ): void {
		$ticket = is_array( $data ) && isset( $data['extra'][ Forms::TICKET_FIELD ] ) ? $data['extra'][ Forms::TICKET_FIELD ] : self::posted();
		self::mark( $ticket, 'ninja', is_array( $data ) ? ( $data['form_id'] ?? 0 ) : 0 );
	}

	/**
	 * Formidable.
	 *
	 * @param mixed $entry_id Entry id.
	 * @param mixed $form_id  Form id.
	 */
	public static function formidable( $entry_id, $form_id ): void {
		self::mark( self::posted(), 'formidable', $form_id );
	}
}
