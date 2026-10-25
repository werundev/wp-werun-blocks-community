<?php
/**
 * Base for providers: validation helpers and the markup pieces they share
 * (an iframe, a "mount" element view.js turns into a script embed).
 *
 * The block's JS twin of every rule here is src/form/providers.js.
 *
 * @package werun-blocks-community
 */

namespace Werun\BlocksCommunity\Forms;

defined( 'ABSPATH' ) || exit;

/**
 * Provider.
 */
abstract class Provider implements Provider_Interface {

	/** UUID / GUID (HubSpot, Dynamics form ids). */
	public const GUID = '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i';

	/** saas (third-party embed, behind consent) or native (a plugin on this site). */
	public function kind(): string {
		return 'saas';
	}

	/** SaaS embeds are always available: they need nothing installed. */
	public function is_available(): bool {
		return true;
	}

	public function list_forms(): array {
		return array();
	}

	public function hosts(): array {
		return array();
	}

	public function client_event(): string {
		return '';
	}

	public function gating(): string {
		return 'none';
	}

	/** Region choices, value => label. Empty: the provider has no regions. */
	public function regions(): array {
		return array();
	}

	/** The region used when the block doesn't set one. */
	public function default_region(): string {
		$regions = array_keys( $this->regions() );
		return $regions ? (string) $regions[0] : '';
	}

	/**
	 * Which Integrations defaults this provider needs and whether each is
	 * set: key => bool. Never the values of secrets.
	 */
	public function defaults(): array {
		return array();
	}

	/** Whether the embed loads anything from a third party (consent placeholder). */
	public function needs_consent(): bool {
		return 'saas' === $this->kind();
	}

	/** Shown in the editor under the form field: what to paste. */
	public function hint(): string {
		return '';
	}

	/** The consent placeholder's button: what loads. */
	public function consent_label(): string {
		/* translators: %s: provider name, e.g. HubSpot. */
		return sprintf( __( 'Load the %s form', 'werun-blocks-community' ), $this->label() );
	}

	/**
	 * The host the consent placeholder names: where this embed loads from
	 * (a region's or a pasted URL's own host where it differs). Providers
	 * with one host keep the first of hosts().
	 *
	 * @param array $v Output of validate().
	 */
	public function consent_host( array $v ): string {
		$hosts = $this->hosts();
		return (string) ( $hosts[0] ?? '' );
	}

	/**
	 * The accessible name of the embed's frame (WCAG 4.1.2): the block's title
	 * (render.php passes it), else "Form from <provider>".
	 *
	 * @param array $args Block args (title).
	 */
	public function frame_title( array $args ): string {
		$title = trim( wp_strip_all_tags( wrbc_text( $args['title'] ?? '' ) ) );
		/* translators: %s: provider name, e.g. Jotform. */
		return '' !== $title ? $title : sprintf( __( 'Form from %s', 'werun-blocks-community' ), $this->label() );
	}

	/**
	 * The block's values, validated and normalised, or null.
	 *
	 * @param array $args { formId, region, extra }.
	 */
	abstract public function validate( array $args ): ?array;

	/**
	 * Markup from validated values.
	 *
	 * @param array $v    Output of validate().
	 * @param array $args Block args (uid, ticket).
	 */
	abstract protected function markup( array $v, array $args ): string;

	public function render( array $args ): string {
		$v = $this->validate( $args );
		return null === $v ? '' : $this->markup( $v, $args );
	}

	/**
	 * The region asked for, if this provider has it, else the default.
	 *
	 * @param mixed  $value    Block value.
	 * @param string $fallback Default (e.g. from Integrations).
	 */
	protected function region( $value, string $fallback = '' ): string {
		$value = wrbc_text( $value );
		if ( isset( $this->regions()[ $value ] ) ) {
			return $value;
		}
		return isset( $this->regions()[ $fallback ] ) ? $fallback : $this->default_region();
	}

	/**
	 * A string that matches a pattern, or null.
	 *
	 * @param mixed  $value   Raw value.
	 * @param string $pattern Regex.
	 */
	protected static function match( $value, string $pattern ): ?string {
		$value = trim( wrbc_text( $value ) );
		return ( '' !== $value && strlen( $value ) <= 300 && preg_match( $pattern, $value ) ) ? $value : null;
	}

	/**
	 * The parts of an https URL whose host is one of $hosts (exact) or ends
	 * with one of $suffixes. No user info, no port.
	 *
	 * @param mixed $url      Pasted URL.
	 * @param array $hosts    Exact hosts.
	 * @param array $suffixes Host suffixes, with the leading dot.
	 * @return array|null { host, path, query }
	 */
	protected static function url_parts( $url, array $hosts, array $suffixes = array() ): ?array {
		$url = trim( wrbc_text( $url ) );
		if ( '' === $url || strlen( $url ) > 500 || preg_match( '/[\s"\'<>\\\\]/', $url ) ) {
			return null;
		}
		$p = wp_parse_url( $url );
		if ( ! is_array( $p ) || ( $p['scheme'] ?? '' ) !== 'https' || empty( $p['host'] ) || isset( $p['user'] ) || isset( $p['pass'] ) || isset( $p['port'] ) ) {
			return null;
		}
		$host = strtolower( $p['host'] );
		$ok   = in_array( $host, $hosts, true );
		foreach ( $suffixes as $suffix ) {
			$ok = $ok || ( strlen( $host ) > strlen( $suffix ) && substr( $host, -strlen( $suffix ) ) === $suffix && preg_match( '/^[a-z0-9.-]+$/', $host ) );
		}
		return $ok ? array(
			'host'  => $host,
			'path'  => (string) ( $p['path'] ?? '' ),
			'query' => (string) ( $p['query'] ?? '' ),
		) : null;
	}

	/**
	 * A height in px from extra, clamped.
	 *
	 * @param array $extra    Block extra.
	 * @param int   $fallback Default.
	 */
	protected static function height( array $extra, int $fallback ): int {
		$h = isset( $extra['height'] ) && is_numeric( $extra['height'] ) ? (int) $extra['height'] : $fallback;
		return max( 200, min( 2000, $h ) );
	}

	/**
	 * An element view.js turns into the embed (loads the script, calls its API).
	 *
	 * @param array  $config { type, src (https, built here from fixed hosts), … }.
	 * @param string $inner  Markup inside (e.g. the target div the script fills).
	 */
	protected function mount( array $config, string $inner = '' ): string {
		$config['provider'] = $this->id();
		return sprintf(
			'<div class="wrbc-form__mount" data-wrbc-form-mount="%1$s">%2$s</div>',
			esc_attr( (string) wp_json_encode( $config ) ),
			$inner
		);
	}

	/**
	 * An iframe embed.
	 *
	 * @param string $src    https URL built from validated parts.
	 * @param string $title  Accessible title.
	 * @param int    $height Height in px.
	 */
	protected function iframe( string $src, string $title, int $height ): string {
		return sprintf(
			'<iframe class="wrbc-form__frame" src="%1$s" title="%2$s" height="%3$d" style="height:%3$dpx" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation"></iframe>',
			esc_url( $src ),
			esc_attr( $title ),
			$height
		);
	}
}
