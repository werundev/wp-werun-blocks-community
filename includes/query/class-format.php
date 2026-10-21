<?php
/**
 * Meta values as card text: text, number, currency, date, url, email
 * (antispambot), phone, image / file / download (attachment ids), and map
 * points (lat/lng keys, "lat,lng" strings or ACF map arrays). Every output
 * is escaped here.
 *
 * @package werun-blocks-community
 */

namespace Werun\BlocksCommunity\Query;

defined( 'ABSPATH' ) || exit;

/**
 * Format.
 */
final class Format {

	/**
	 * Escaped HTML for a meta value, '' when it doesn't fit the format.
	 *
	 * @param mixed $value Meta value (already unserialized by WordPress).
	 * @param array $field Normalized meta field.
	 */
	public static function value( $value, array $field ): string {
		$wrap = static function ( string $html ) use ( $field ): string {
			return esc_html( $field['prefix'] ) . $html . esc_html( $field['suffix'] );
		};
		switch ( $field['format'] ) {
			case 'number':
			case 'currency':
				return is_numeric( $value ) ? $wrap( esc_html( number_format_i18n( (float) $value, (int) $field['decimals'] ) ) ) : '';

			case 'date':
				$date = self::date( $value );
				if ( ! $date ) {
					return '';
				}
				$format = '' !== $field['dateFormat'] ? $field['dateFormat'] : get_option( 'date_format' );
				return '<time datetime="' . esc_attr( $date->format( 'Y-m-d' ) ) . '">' . esc_html( $field['prefix'] . wp_date( $format, $date->getTimestamp() ) . $field['suffix'] ) . '</time>';

			case 'url':
				// Only absolute http(s) values: esc_url() would turn "Designer" into "http://Designer".
				$url = is_string( $value ) && preg_match( '#^https?://[^\s]+$#i', trim( $value ) ) ? esc_url( trim( $value ), array( 'http', 'https' ) ) : '';
				if ( '' === $url ) {
					return '';
				}
				$text = preg_replace( '#^https?://(www\.)?#i', '', untrailingslashit( trim( $value ) ) );
				return '<a href="' . $url . '" rel="noopener">' . $wrap( esc_html( $text ) ) . '</a>';

			case 'email':
				$email = is_string( $value ) ? trim( $value ) : '';
				// Stricter than is_email(): no characters that need escaping inside the attribute.
				if ( ! is_email( $email ) || ! preg_match( '/^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+$/', $email ) ) {
					return '';
				}
				$coded = antispambot( $email );
				return '<a href="mailto:' . $coded . '">' . $wrap( $coded ) . '</a>';

			case 'phone':
				$text = is_scalar( $value ) ? trim( (string) $value ) : '';
				$tel  = preg_replace( '/[^0-9+]/', '', $text );
				if ( strlen( $tel ) < 5 ) {
					return '';
				}
				return '<a href="' . esc_url( 'tel:' . $tel, array( 'tel' ) ) . '">' . $wrap( esc_html( $text ) ) . '</a>';

			case 'image':
				$id = self::attachment_id( $value );
				if ( ! $id || ! wp_attachment_is_image( $id ) ) {
					return '';
				}
				return (string) wp_get_attachment_image( $id, 'medium', false, array( 'class' => 'wrbc-query__meta-img', 'loading' => 'lazy' ) );

			case 'file':
			case 'download':
				$id  = self::attachment_id( $value );
				$url = $id ? wp_get_attachment_url( $id ) : '';
				if ( ! $url ) {
					return '';
				}
				$file = get_attached_file( $id );
				$size = ( $file && file_exists( $file ) ) ? size_format( (int) filesize( $file ) ) : '';
				$name = get_the_title( $id );
				$name = '' !== $name ? $name : wp_basename( $url );
				$text = esc_html( $name ) . ( $size ? ' <span class="wrbc-query__size">(' . esc_html( $size ) . ')</span>' : '' );
				return '<a href="' . esc_url( $url ) . '"' . ( 'download' === $field['format'] ? ' download' : '' ) . '>' . $wrap( $text ) . '</a>';

			default:
				$text = self::text( $value );
				return '' === $text ? '' : $wrap( esc_html( $text ) );
		}
	}

	/**
	 * Plain text from a value: scalars, lists of scalars, ACF map arrays (address).
	 *
	 * @param mixed $value Value.
	 */
	public static function text( $value ): string {
		if ( is_bool( $value ) ) {
			return '';
		}
		if ( is_scalar( $value ) ) {
			return trim( (string) $value );
		}
		if ( is_array( $value ) ) {
			if ( isset( $value['address'] ) && is_scalar( $value['address'] ) ) {
				return trim( (string) $value['address'] );
			}
			$parts = array_filter( $value, 'is_scalar' );
			if ( count( $parts ) === count( $value ) && array_keys( $value ) === range( 0, count( $value ) - 1 ) ) {
				return implode( ', ', array_map( 'strval', $parts ) );
			}
		}
		return '';
	}

	/**
	 * An attachment id from a number or an ACF array (ID / id).
	 *
	 * @param mixed $value Value.
	 */
	public static function attachment_id( $value ): int {
		if ( is_array( $value ) ) {
			$value = $value['ID'] ?? ( $value['id'] ?? 0 );
		}
		$id = is_numeric( $value ) ? absint( $value ) : 0;
		return ( $id && 'attachment' === get_post_type( $id ) ) ? $id : 0;
	}

	/**
	 * A date from Ymd, Y-m-d, Y-m-d H:i:s or a Unix time, in the site's zone.
	 *
	 * @param mixed $value Value.
	 */
	public static function date( $value ): ?\DateTimeImmutable {
		if ( ! is_scalar( $value ) || '' === trim( (string) $value ) ) {
			return null;
		}
		$value = trim( (string) $value );
		$tz    = wp_timezone();
		if ( preg_match( '/^\d{8}$/', $value ) ) {
			$date = \DateTimeImmutable::createFromFormat( '!Ymd', $value, $tz );
		} elseif ( preg_match( '/^\d{9,11}$/', $value ) ) {
			$date = ( new \DateTimeImmutable( '@' . $value ) )->setTimezone( $tz );
		} elseif ( preg_match( '/^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}(:\d{2})?)?$/', $value ) ) {
			$date = \DateTimeImmutable::createFromFormat( strlen( $value ) > 10 ? ( 16 === strlen( $value ) ? 'Y-m-d H:i' : 'Y-m-d H:i:s' ) : '!Y-m-d', $value, $tz );
		} else {
			return null;
		}
		return $date ? $date : null;
	}

	/**
	 * A map point for a post, or null. Coordinates are clamped to the globe.
	 *
	 * @param int   $id  Post id.
	 * @param array $map View map settings.
	 * @return array{lat:float,lng:float,address?:string}|null
	 */
	public static function point( int $id, array $map ): ?array {
		$lat = null;
		$lng = null;
		$address = '';
		if ( '' !== $map['combinedKey'] ) {
			$value = get_post_meta( $id, $map['combinedKey'], true );
			if ( is_array( $value ) ) {
				$lat     = $value['lat'] ?? null;
				$lng     = $value['lng'] ?? null;
				$address = isset( $value['address'] ) && is_scalar( $value['address'] ) ? (string) $value['address'] : '';
			} elseif ( is_string( $value ) && preg_match( '/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/', $value, $m ) ) {
				$lat = $m[1];
				$lng = $m[2];
			}
		} elseif ( '' !== $map['latKey'] && '' !== $map['lngKey'] ) {
			$lat = get_post_meta( $id, $map['latKey'], true );
			$lng = get_post_meta( $id, $map['lngKey'], true );
		}
		if ( ! is_numeric( $lat ) || ! is_numeric( $lng ) ) {
			return null;
		}
		if ( '' !== $map['addressKey'] ) {
			$address = self::text( get_post_meta( $id, $map['addressKey'], true ) );
		}
		$point = array(
			'lat' => round( max( -90, min( 90, (float) $lat ) ), 6 ),
			'lng' => round( max( -180, min( 180, (float) $lng ) ), 6 ),
		);
		if ( '' !== $address ) {
			$point['address'] = wp_strip_all_tags( $address );
		}
		return $point;
	}
}
