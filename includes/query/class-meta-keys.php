<?php
/**
 * Meta keys a post type uses, for the editor's field pickers:
 * - registered: register_post_meta() with show_in_rest (for the type or all).
 * - detected: ONE prepared query over the meta of the latest 200 published
 *   posts of the type; "_"-prefixed (protected) and sensitive keys are left
 *   out, serialized values are never unserialized, at most 3 short string
 *   samples per key. Cached 12 hours in a transient (not autoloaded).
 *
 * @package werun-blocks-community
 */

namespace Werun\BlocksCommunity\Query;

defined( 'ABSPATH' ) || exit;

/**
 * Meta_Keys.
 */
final class Meta_Keys {

	/**
	 * Registered and detected keys of a type.
	 *
	 * @param string $type    Post type (already checked).
	 * @param bool   $refresh Skip the cache.
	 * @return array{registered:array,detected:array}
	 */
	public static function for_type( string $type, bool $refresh = false ): array {
		$cache_key = 'wrbc_qmk_' . md5( $type );
		$cached    = $refresh ? false : get_transient( $cache_key );
		if ( is_array( $cached ) && isset( $cached['detected'] ) ) {
			$detected = $cached['detected'];
		} else {
			$detected = self::detect( $type );
			set_transient( $cache_key, array( 'detected' => $detected ), 12 * HOUR_IN_SECONDS );
		}

		$registered = array();
		$by_key     = array_column( $detected, null, 'key' );
		$all        = array_merge( get_registered_meta_keys( 'post', '' ), get_registered_meta_keys( 'post', $type ) );
		foreach ( $all as $key => $args ) {
			if ( empty( $args['show_in_rest'] ) || ! preg_match( Config::META_KEY_RE, (string) $key ) ) {
				continue;
			}
			$seen         = $by_key[ $key ] ?? null;
			$registered[] = array(
				'key'         => (string) $key,
				// What the values look like wins over the declared schema type ("string" dates).
				'guess'       => $seen ? $seen['guess'] : self::schema_guess( (string) ( $args['type'] ?? 'string' ) ),
				'samples'     => $seen ? $seen['samples'] : array(),
				'count'       => $seen ? $seen['count'] : 0,
				'description' => wp_strip_all_tags( (string) ( $args['description'] ?? '' ) ),
			);
		}
		$names = wp_list_pluck( $registered, 'key' );

		return array(
			'registered' => $registered,
			// A registered key is listed once, with its registration.
			'detected'   => array_values(
				array_filter(
					$detected,
					static function ( $row ) use ( $names ) {
						return ! in_array( $row['key'], $names, true );
					}
				)
			),
		);
	}

	/**
	 * Keys found in the latest published posts.
	 *
	 * @param string $type Post type.
	 */
	private static function detect( string $type ): array {
		global $wpdb;
		// phpcs:ignore WordPress.DB.DirectDatabaseQuery -- one bounded read for the editor, cached above.
		$rows = $wpdb->get_results(
			$wpdb->prepare(
				"SELECT pm.meta_key, LEFT(pm.meta_value, 400) AS meta_value
				FROM {$wpdb->postmeta} pm
				INNER JOIN (
					SELECT ID FROM {$wpdb->posts}
					WHERE post_type = %s AND post_status = 'publish'
					ORDER BY post_date DESC
					LIMIT 200
				) p ON p.ID = pm.post_id
				WHERE pm.meta_key NOT LIKE %s
				LIMIT 5000",
				$type,
				$wpdb->esc_like( '_' ) . '%'
			),
			ARRAY_A
		);

		$keys = array();
		foreach ( (array) $rows as $row ) {
			$key = (string) $row['meta_key'];
			if ( ! preg_match( Config::META_KEY_RE, $key ) || is_protected_meta( $key, 'post' ) || preg_match( Config::SENSITIVE_RE, $key ) ) {
				continue;
			}
			if ( ! isset( $keys[ $key ] ) ) {
				$keys[ $key ] = array(
					'key'     => $key,
					'count'   => 0,
					'samples' => array(),
					'kinds'   => array(),
				);
			}
			$value = (string) $row['meta_value'];
			++$keys[ $key ]['count'];
			$kind                     = self::kind( $value );
			$keys[ $key ]['kinds'][]  = $kind;
			if ( 'array' !== $kind && 'latlng-array' !== $kind && '' !== trim( $value ) && count( $keys[ $key ]['samples'] ) < 3 ) {
				$sample = function_exists( 'mb_substr' ) ? mb_substr( wp_strip_all_tags( $value ), 0, 40 ) : substr( wp_strip_all_tags( $value ), 0, 40 );
				if ( ! in_array( $sample, $keys[ $key ]['samples'], true ) ) {
					$keys[ $key ]['samples'][] = $sample;
				}
			}
		}

		$out = array();
		foreach ( $keys as $row ) {
			$kinds = array_values( array_unique( array_diff( $row['kinds'], array( 'empty' ) ) ) );
			$guess = 1 === count( $kinds ) ? $kinds[0] : ( array_diff( $kinds, array( 'numeric', 'attachment' ) ) ? 'text' : 'numeric' );
			if ( 'numeric' === $guess && self::attachments( $row['samples'] ) ) {
				$guess = 'attachment';
			}
			$out[] = array(
				'key'     => $row['key'],
				'count'   => $row['count'],
				'samples' => $row['samples'],
				'guess'   => 'latlng-array' === $guess ? 'latlng' : ( 'array' === $guess ? 'text' : $guess ),
				'array'   => in_array( 'array', $kinds, true ) || in_array( 'latlng-array', $kinds, true ),
			);
		}
		usort(
			$out,
			static function ( $a, $b ) {
				return $b['count'] <=> $a['count'] ?: strcmp( $a['key'], $b['key'] );
			}
		);
		return array_slice( $out, 0, 100 );
	}

	/**
	 * What a raw value looks like, without unserializing it.
	 *
	 * @param string $value Raw meta_value.
	 */
	private static function kind( string $value ): string {
		$value = trim( $value );
		if ( '' === $value ) {
			return 'empty';
		}
		if ( is_serialized( $value ) ) {
			// An ACF Google Map field: a serialized array with lat and lng keys.
			return ( false !== strpos( $value, 's:3:"lat"' ) && false !== strpos( $value, 's:3:"lng"' ) ) ? 'latlng-array' : 'array';
		}
		if ( preg_match( '/^(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/', $value ) || preg_match( '/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}(:\d{2})?)?$/', $value ) ) {
			return 'date';
		}
		if ( preg_match( '/^-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?$/', $value ) ) {
			return 'latlng';
		}
		if ( is_numeric( $value ) ) {
			return 'numeric';
		}
		if ( preg_match( '#^https?://#i', $value ) ) {
			return 'url';
		}
		if ( is_email( $value ) ) {
			return 'email';
		}
		return 'text';
	}

	/**
	 * Whether every numeric sample is an attachment id.
	 *
	 * @param string[] $samples Samples.
	 */
	private static function attachments( array $samples ): bool {
		if ( ! $samples ) {
			return false;
		}
		foreach ( $samples as $sample ) {
			if ( ! ctype_digit( $sample ) || 'attachment' !== get_post_type( (int) $sample ) ) {
				return false;
			}
		}
		return true;
	}

	/** Registered schema type → editor guess. */
	private static function schema_guess( string $type ): string {
		return in_array( $type, array( 'number', 'integer' ), true ) ? 'numeric' : 'text';
	}
}
