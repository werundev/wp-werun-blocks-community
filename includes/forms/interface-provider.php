<?php
/**
 * A form provider: a SaaS embed (HubSpot, Marketo…) or a form plugin
 * installed on the site (Gravity Forms, WPForms…).
 *
 * @package werun-blocks-community
 */

namespace Werun\BlocksCommunity\Forms;

defined( 'ABSPATH' ) || exit;

/**
 * Provider_Interface.
 */
interface Provider_Interface {

	/** Slug stored in the block's "provider" attribute. */
	public function id(): string;

	/** Name shown in the editor. */
	public function label(): string;

	/** Whether it can be used here (plugin active; SaaS: always). */
	public function is_available(): bool;

	/**
	 * Forms the editor can pick from: list of array( 'id' => string, 'title' => string ).
	 * Empty when the provider has no listing (the editor types an id instead).
	 */
	public function list_forms(): array;

	/**
	 * The embed markup, built only from validated values and fixed hosts.
	 * '' when the values don't validate.
	 *
	 * @param array $args { formId, region, extra (array), uid, ticket }.
	 */
	public function render( array $args ): string;

	/** Hosts the embed loads from (consent placeholder, postMessage origins). */
	public function hosts(): array;

	/**
	 * How the front end learns that a submission succeeded, as
	 * "<channel>:<name>": dom:<event> (DOM event), jquery:<event>,
	 * message:<type> (postMessage from hosts()), callback (the embed API's
	 * own callback), nf (Ninja Forms radio). '' when it can't be known.
	 */
	public function client_event(): string;

	/**
	 * hard: the server sees the submission and verifies the gate ticket;
	 * soft: only the browser reports success (can't be verified);
	 * none: success can't be detected, so it can't gate.
	 */
	public function gating(): string;
}
