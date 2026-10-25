<?php
/**
 * Integrations settings: maps, privacy (consent), form providers, jobs (ATS)
 * and resource gating. One option (wrbc_integrations, small, autoloaded) for
 * the plain values; API tokens go to Secret (encrypted, one option each,
 * autoload off, wp-config constant override). The screen that edits them is
 * includes/admin/integrations/.
 *
 * Read a value with Integrations::get( 'forms.hubspot_portal' ). The schema
 * is the single list of keys, types, defaults and limits; sanitize() and the
 * screen both use it.
 *
 * @package werun-blocks-community
 */

namespace Werun\BlocksCommunity\Integrations;

defined( 'ABSPATH' ) || exit;

/**
 * Integrations.
 */
final class Integrations {

	public const OPTION = 'wrbc_integrations';

	/** Secret names (Secret::named()): never printed, never sent to the browser. */
	public const SECRETS = array( 'hubspot_token', 'teamtailor_key', 'bamboohr_key' );

	/**
	 * Sections → fields: type (text|url|select|switch|number), default,
	 * options (select), min/max (number), pattern (text, a regex the value must
	 * match or it is dropped), public (sent to the front end in wrbcModules).
	 */
	public static function schema(): array {
		return array(
			'maps'    => array(
				'provider'    => array( 'type' => 'select', 'default' => 'leaflet', 'options' => array( 'leaflet', 'google' ), 'public' => true ),
				'tiles'       => array( 'type' => 'url', 'default' => 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', 'public' => true ),
				'attribution' => array( 'type' => 'text', 'default' => '© OpenStreetMap contributors', 'public' => true ),
				// Browser key: public by design, restrict it by HTTP referrer in Google Cloud.
				'google_key'  => array( 'type' => 'text', 'default' => '', 'pattern' => '/^[A-Za-z0-9_-]{20,60}$/', 'public' => true ),
				'google_map_id' => array( 'type' => 'text', 'default' => '', 'pattern' => '/^[A-Za-z0-9_-]{4,64}$/', 'public' => true ),
			),
			'privacy' => array(
				// click: each embed loads on click; cmp: follow the consent banner (WP Consent API, Complianz, CookieYes, Cookiebot); none: load right away.
				'consent'       => array( 'type' => 'select', 'default' => 'click', 'options' => array( 'click', 'cmp', 'none' ), 'public' => true ),
				'remember_days' => array( 'type' => 'number', 'default' => 180, 'min' => 0, 'max' => 730, 'public' => true ),
			),
			'forms'   => array(
				'hubspot_portal'    => array( 'type' => 'text', 'default' => '', 'pattern' => '/^\d{3,12}$/' ),
				'hubspot_region'    => array( 'type' => 'select', 'default' => 'na1', 'options' => array( 'na1', 'na2', 'eu1', 'ap1' ) ),
				'marketo_base'      => array( 'type' => 'text', 'default' => '', 'pattern' => '#^(app-[a-z0-9]+\.marketo\.com|[a-z0-9.-]+\.[a-z]{2,})$#' ),
				'marketo_munchkin'  => array( 'type' => 'text', 'default' => '', 'pattern' => '/^\d{3}-[A-Z]{3}-\d{3}$/' ),
				'pardot_domain'     => array( 'type' => 'text', 'default' => '', 'pattern' => '/^[a-z0-9.-]+\.[a-z]{2,}$/' ),
				'dynamics_org'      => array( 'type' => 'text', 'default' => '', 'pattern' => '/^[0-9a-f-]{36}$/' ),
				'dynamics_region'   => array( 'type' => 'select', 'default' => 'public-usa', 'options' => array( 'public-usa', 'public-eur', 'public-gbr', 'public-can', 'public-aus', 'public-jpn', 'public-ind', 'public-fra' ) ),
				'activecampaign'    => array( 'type' => 'text', 'default' => '', 'pattern' => '/^[a-z0-9-]{2,63}$/' ),
				'zoho_dc'           => array( 'type' => 'select', 'default' => 'com', 'options' => array( 'com', 'eu', 'in', 'com.au', 'jp' ) ),
			),
			'jobs'    => array(
				'provider' => array( 'type' => 'select', 'default' => 'greenhouse', 'options' => array( 'greenhouse', 'lever', 'ashby', 'workable', 'smartrecruiters', 'personio', 'teamtailor', 'bamboohr' ) ),
				'board'    => array( 'type' => 'text', 'default' => '', 'pattern' => '/^[A-Za-z0-9_-]{1,64}$/' ),
				'ttl'      => array( 'type' => 'number', 'default' => 60, 'min' => 5, 'max' => 1440 ),
			),
			'gating'  => array(
				'unlock_minutes' => array( 'type' => 'number', 'default' => 10, 'min' => 1, 'max' => 120 ),
				'remember_days'  => array( 'type' => 'number', 'default' => 30, 'min' => 0, 'max' => 365 ),
				'delivery'       => array( 'type' => 'select', 'default' => 'redirect', 'options' => array( 'redirect', 'stream' ) ),
			),
		);
	}

	/**
	 * A value by "section.key", sanitized, or the schema default.
	 *
	 * @param string $path    "section.key".
	 * @param mixed  $default Fallback for unknown keys.
	 * @return mixed
	 */
	public static function get( string $path, $default = null ) {
		list( $section, $key ) = array_pad( explode( '.', $path, 2 ), 2, '' );
		$schema                = self::schema();
		if ( ! isset( $schema[ $section ][ $key ] ) ) {
			return $default;
		}
		$stored = get_option( self::OPTION, array() );
		$value  = is_array( $stored ) && isset( $stored[ $section ][ $key ] ) ? $stored[ $section ][ $key ] : $schema[ $section ][ $key ]['default'];
		return self::clean( $schema[ $section ][ $key ], $value );
	}

	/**
	 * A decrypted secret, for server-side requests only.
	 *
	 * @param string $name One of SECRETS.
	 */
	public static function secret( string $name ): string {
		return in_array( $name, self::SECRETS, true ) ? Secret::named( $name )->get() : '';
	}

	/**
	 * Sanitizes a whole submitted settings array against the schema.
	 *
	 * @param mixed $input Submitted values.
	 */
	public static function sanitize( $input ): array {
		$input = is_array( $input ) ? $input : array();
		$out   = array();
		foreach ( self::schema() as $section => $fields ) {
			foreach ( $fields as $key => $field ) {
				$raw                     = $input[ $section ][ $key ] ?? ( 'switch' === $field['type'] ? false : $field['default'] );
				$out[ $section ][ $key ] = self::clean( $field, $raw );
			}
		}
		return $out;
	}

	/**
	 * Values the front end may see (window.wrbcModules.integrations).
	 */
	public static function public_settings(): array {
		$out = array();
		foreach ( self::schema() as $section => $fields ) {
			foreach ( $fields as $key => $field ) {
				if ( ! empty( $field['public'] ) ) {
					$out[ $section ][ $key ] = self::get( $section . '.' . $key );
				}
			}
		}
		return $out;
	}

	/**
	 * What the block editor needs: every plain value, and only whether each
	 * secret exists.
	 */
	public static function editor_settings(): array {
		$out = array();
		foreach ( self::schema() as $section => $fields ) {
			foreach ( array_keys( $fields ) as $key ) {
				$out[ $section ][ $key ] = self::get( $section . '.' . $key );
			}
		}
		foreach ( self::SECRETS as $name ) {
			$out['secrets'][ $name ] = Secret::named( $name )->exists();
		}
		return $out;
	}

	/**
	 * One value against its field.
	 *
	 * @param array $field Schema field.
	 * @param mixed $value Raw value.
	 * @return mixed
	 */
	private static function clean( array $field, $value ) {
		switch ( $field['type'] ) {
			case 'switch':
				return (bool) $value;
			case 'number':
				$value = is_numeric( $value ) ? (int) $value : (int) $field['default'];
				return max( (int) ( $field['min'] ?? PHP_INT_MIN ), min( (int) ( $field['max'] ?? PHP_INT_MAX ), $value ) );
			case 'select':
				return in_array( $value, $field['options'], true ) ? $value : $field['default'];
			case 'url':
				// Tile templates keep their {z} {x} {y} {s} {r} placeholders: esc_url_raw() drops braces.
				$marks = array( '{z}' => 'WRBZ', '{x}' => 'WRBX', '{y}' => 'WRBY', '{s}' => 'WRBS', '{r}' => 'WRBR' );
				$value = is_scalar( $value ) ? strtr( trim( (string) $value ), $marks ) : '';
				$value = strtr( esc_url_raw( $value, array( 'https' ) ), array_flip( $marks ) );
				return '' !== $value && strlen( $value ) <= 200 ? $value : $field['default'];
			default:
				$value = is_scalar( $value ) ? trim( sanitize_text_field( (string) $value ) ) : '';
				if ( '' !== $value && isset( $field['pattern'] ) && ! preg_match( $field['pattern'], $value ) ) {
					return $field['default'];
				}
				return mb_substr( $value, 0, 200 );
		}
	}
}
