<?php
/**
 * The normalized job, and the cleaning every adapter's output goes through:
 * plain text with a length cap, ISO dates, a known employment type key,
 * http(s) URLs only, apply links only on the provider (or a careers
 * subdomain of the posting's site), descriptions through wp_kses_post().
 *
 * @package werun-blocks-community
 */

namespace Werun\BlocksCommunity\Jobs;

defined( 'ABSPATH' ) || exit;

/**
 * Job.
 */
final class Job {

	/** Employment type keys the block translates; anything else stays as the provider's label. */
	public const TYPES = array( 'full-time', 'part-time', 'contract', 'temporary', 'internship', 'freelance', 'volunteer' );

	/** Longest description kept per job (characters of HTML). */
	public const MAX_DESCRIPTION = 20000;

	/** Subdomains that count as a site's careers site for apply links. */
	private const CAREERS = array( 'careers', 'jobs', 'apply', 'join', 'karriere', 'empleos', 'work' );

	/**
	 * A job with every field, cleaned. Null when it has no title or no link.
	 *
	 * @param array   $job     What normalize() returned.
	 * @param Adapter $adapter The adapter (hosts for the apply link).
	 */
	public static function finish( array $job, Adapter $adapter ): ?array {
		$title = self::text( $job['title'] ?? '' );
		$url   = self::url( $job['url'] ?? '' );
		if ( '' === $title || '' === $url ) {
			return null;
		}
		$location  = self::text( $job['location'] ?? '' );
		$locations = array();
		foreach ( (array) ( $job['locations'] ?? array() ) as $place ) {
			$place = self::text( $place );
			if ( '' !== $place && ! in_array( $place, $locations, true ) && count( $locations ) < 20 ) {
				$locations[] = $place;
			}
		}
		if ( '' !== $location && ! in_array( $location, $locations, true ) ) {
			array_unshift( $locations, $location );
		}
		if ( '' === $location && $locations ) {
			$location = $locations[0];
		}
		$out = array(
			'id'             => substr( self::text( $job['id'] ?? '' ), 0, 64 ),
			'title'          => $title,
			'department'     => self::text( $job['department'] ?? '' ),
			'team'           => self::text( $job['team'] ?? '' ),
			'location'       => $location,
			'locations'      => $locations,
			'remote'         => ! empty( $job['remote'] ),
			'employmentType' => self::type( $job['employmentType'] ?? '' ),
			'url'            => $url,
			'applyUrl'       => self::apply_url( $job['applyUrl'] ?? '', $url, $adapter->hosts() ),
			'postedAt'       => self::date( $job['postedAt'] ?? '' ),
			'compensation'   => self::text( $job['compensation'] ?? '' ),
			'description'    => self::html( $job['description'] ?? '' ),
		);
		if ( '' === $out['id'] ) {
			$out['id'] = substr( md5( $url ), 0, 12 );
		}
		return $out;
	}

	/** Plain text from any scalar, entities decoded, tags stripped, capped. */
	public static function text( $value, int $max = 200 ): string {
		if ( ! is_scalar( $value ) || is_bool( $value ) ) {
			return '';
		}
		$value = html_entity_decode( (string) $value, ENT_QUOTES | ENT_HTML5, 'UTF-8' );
		$value = trim( preg_replace( '/\s+/u', ' ', wp_strip_all_tags( $value ) ) );
		return mb_substr( $value, 0, $max );
	}

	/** HTML through wp_kses_post(), capped. */
	public static function html( $value ): string {
		if ( ! is_string( $value ) || '' === trim( $value ) ) {
			return '';
		}
		$html = trim( wp_kses_post( $value ) );
		if ( strlen( $html ) > self::MAX_DESCRIPTION ) {
			// Too long to cut safely as HTML: keep the words.
			$html = '<p>' . esc_html( wp_trim_words( wp_strip_all_tags( $html ), 400 ) ) . '</p>';
		}
		return $html;
	}

	/** ISO 8601 (UTC) from a date string or a Unix time in seconds or ms. */
	public static function date( $value ): string {
		if ( is_numeric( $value ) ) {
			$time = (float) $value;
			$time = $time > 1e11 ? (int) ( $time / 1000 ) : (int) $time;
		} elseif ( is_string( $value ) && '' !== trim( $value ) ) {
			$time = strtotime( $value );
		} else {
			return '';
		}
		return ( $time && $time > 0 ) ? gmdate( 'c', $time ) : '';
	}

	/** A known type key (full-time, …) or the provider's own label. */
	public static function type( $value ): string {
		$label = self::text( $value, 60 );
		$k     = strtolower( preg_replace( '/[^a-z]/i', '', $label ) );
		$map   = array(
			'fulltime'       => 'full-time',
			'permanent'      => 'full-time',
			'regular'        => 'full-time',
			'parttime'       => 'part-time',
			'workingstudent' => 'part-time',
			'contract'       => 'contract',
			'contractor'     => 'contract',
			'temporary'      => 'temporary',
			'temp'           => 'temporary',
			'seasonal'       => 'temporary',
			'intern'         => 'internship',
			'internship'     => 'internship',
			'trainee'        => 'internship',
			'apprenticeship' => 'internship',
			'freelance'      => 'freelance',
			'freelancer'     => 'freelance',
			'volunteer'      => 'volunteer',
		);
		if ( isset( $map[ $k ] ) ) {
			return $map[ $k ];
		}
		// Longer labels ("Regular Full Time (Salary)"): the first known word wins.
		foreach ( array( 'parttime' => 'part-time', 'fulltime' => 'full-time', 'intern' => 'internship', 'contract' => 'contract', 'freelanc' => 'freelance', 'temporar' => 'temporary', 'volunteer' => 'volunteer' ) as $needle => $type ) {
			if ( false !== strpos( $k, $needle ) ) {
				return $type;
			}
		}
		return $label;
	}

	/** Translated label of a type key, or the label itself. */
	public static function type_label( string $type ): string {
		$labels = array(
			'full-time'  => __( 'Full-time', 'werun-blocks-community' ),
			'part-time'  => __( 'Part-time', 'werun-blocks-community' ),
			'contract'   => __( 'Contract', 'werun-blocks-community' ),
			'temporary'  => __( 'Temporary', 'werun-blocks-community' ),
			'internship' => __( 'Internship', 'werun-blocks-community' ),
			'freelance'  => __( 'Freelance', 'werun-blocks-community' ),
			'volunteer'  => __( 'Volunteer', 'werun-blocks-community' ),
		);
		return $labels[ $type ] ?? $type;
	}

	/** Whether any of the texts says the job is remote. */
	public static function looks_remote( ...$texts ): bool {
		foreach ( $texts as $text ) {
			if ( is_string( $text ) && preg_match( '/\b(remote|anywhere|remoto|home\s?office|telecommut)/i', $text ) ) {
				return true;
			}
		}
		return false;
	}

	/** An http(s) URL, or ''. */
	public static function url( $value ): string {
		if ( ! is_string( $value ) || '' === trim( $value ) || strlen( $value ) > 2000 ) {
			return '';
		}
		$url  = esc_url_raw( trim( $value ), array( 'https', 'http' ) );
		$host = (string) wp_parse_url( $url, PHP_URL_HOST );
		return ( '' !== $url && '' !== $host ) ? $url : '';
	}

	/**
	 * The apply link when it is https and on one of the provider's domains,
	 * or on a careers subdomain (careers., jobs., …) of the posting's site;
	 * otherwise the posting URL.
	 *
	 * @param mixed  $apply Raw apply URL.
	 * @param string $url   Clean posting URL.
	 * @param array  $hosts Provider domains.
	 */
	public static function apply_url( $apply, string $url, array $hosts ): string {
		$apply = self::url( $apply );
		if ( '' === $apply || 'https' !== wp_parse_url( $apply, PHP_URL_SCHEME ) ) {
			return $url;
		}
		$host = strtolower( (string) wp_parse_url( $apply, PHP_URL_HOST ) );
		foreach ( $hosts as $domain ) {
			if ( $host === $domain || substr( $host, -strlen( '.' . $domain ) ) === '.' . $domain ) {
				return $apply;
			}
		}
		$parts = explode( '.', $host, 2 );
		// careers.example.com for a posting on (www.)example.com or for this site;
		// an exact match, so careers.com never passes for every .com site.
		if ( 2 === count( $parts ) && in_array( $parts[0], self::CAREERS, true ) && false !== strpos( $parts[1], '.' ) ) {
			foreach ( array( (string) wp_parse_url( $url, PHP_URL_HOST ), (string) wp_parse_url( home_url(), PHP_URL_HOST ) ) as $site ) {
				$site = preg_replace( '/^www\./', '', strtolower( $site ) );
				if ( $parts[1] === $site ) {
					return $apply;
				}
			}
		}
		return $url;
	}

	/** "min – max currency / period" from loose salary parts. */
	public static function salary( $min, $max, $currency = '', $period = '' ): string {
		$fmt = function ( $n ) {
			return is_numeric( $n ) && $n > 0 ? number_format_i18n( (float) $n ) : '';
		};
		$min  = $fmt( $min );
		$max  = $fmt( $max );
		$span = $min && $max && $min !== $max ? $min . ' – ' . $max : ( $min ? $min : $max );
		if ( '' === $span ) {
			return '';
		}
		$out    = trim( self::text( $currency, 8 ) . ' ' . $span );
		// "per-year-salary", "YEAR", "hourly" → year / hour.
		$labels = array(
			'year'  => __( 'year', 'werun-blocks-community' ),
			'month' => __( 'month', 'werun-blocks-community' ),
			'week'  => __( 'week', 'werun-blocks-community' ),
			'day'   => __( 'day', 'werun-blocks-community' ),
			'hour'  => __( 'hour', 'werun-blocks-community' ),
		);
		$period = preg_match( '/(year|annual|month|week|day|daily|hour)/i', self::text( $period, 40 ), $m ) ? strtolower( $m[1] ) : '';
		$period = array( 'annual' => 'year', 'daily' => 'day' )[ $period ] ?? $period;
		return isset( $labels[ $period ] ) ? $out . ' / ' . $labels[ $period ] : $out;
	}
}
