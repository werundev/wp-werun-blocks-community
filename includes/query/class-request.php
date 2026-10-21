<?php
/**
 * The visitor's state for one instance (page, term chip, search, sort),
 * from the public REST route or from the no-JS links
 * (?wrbc_p_{key}=N&wrbc_t_{key}=ID&wrbc_q_{key}=…&wrbc_s_{key}=…), checked
 * against the view: page ≤ maxPages, the term in the signed filter
 * taxonomy (and in the chips when the editor limited them), search only
 * when the search box is on, sort only one of the offered ones.
 *
 * @package werun-blocks-community
 */

namespace Werun\BlocksCommunity\Query;

defined( 'ABSPATH' ) || exit;

/**
 * Request.
 */
final class Request {

	/**
	 * Validates raw values. Returns the clean request and the names of the
	 * values that were rejected (the REST route answers 400 for those; the
	 * page simply ignores them).
	 *
	 * @param array $view View::from_attributes().
	 * @param array $raw  { page, term, q, sort } as strings.
	 * @return array{0:array,1:string[]}
	 */
	public static function from( array $view, array $raw ): array {
		$errors = array();
		$out    = array(
			'page' => 1,
			'term' => null,
			'q'    => '',
			'sort' => '',
		);

		if ( isset( $raw['page'] ) && '' !== $raw['page'] ) {
			$page = is_numeric( $raw['page'] ) ? (int) $raw['page'] : 0;
			if ( $page >= 1 && $page <= $view['query']['maxPages'] && 'none' !== $view['pagination'] ) {
				$out['page'] = $page;
			} elseif ( 1 !== $page ) {
				$errors[] = 'page';
			}
		}

		if ( isset( $raw['term'] ) && '' !== $raw['term'] && '0' !== (string) $raw['term'] ) {
			$tax  = $view['filters']['taxonomy'];
			$id   = is_numeric( $raw['term'] ) ? absint( $raw['term'] ) : 0;
			$term = ( $tax && $id ) ? get_term( $id, $tax ) : null;
			$ok   = $term instanceof \WP_Term && Config::taxonomy_ok( $tax, $view['query']['postType'] );
			if ( $ok ) {
				$limit = self::chip_limit( $view );
				$ok    = ! $limit || in_array( $id, $limit, true );
			}
			if ( $ok ) {
				$out['term'] = array(
					'taxonomy' => $tax,
					'id'       => $id,
				);
			} else {
				$errors[] = 'term';
			}
		}

		if ( isset( $raw['q'] ) && '' !== $raw['q'] ) {
			$q   = trim( sanitize_text_field( wrbc_text( $raw['q'] ) ) );
			$len = function_exists( 'mb_strlen' ) ? mb_strlen( $q ) : strlen( $q );
			if ( $view['filters']['search'] && $len >= 2 && $len <= 100 ) {
				$out['q'] = $q;
			} else {
				$errors[] = 'q';
			}
		}

		if ( isset( $raw['sort'] ) && '' !== $raw['sort'] ) {
			if ( in_array( $raw['sort'], $view['filters']['sort'], true ) ) {
				$out['sort'] = $raw['sort'];
			} else {
				$errors[] = 'sort';
			}
		}

		return array( $out, $errors );
	}

	/**
	 * The terms the chips are limited to: those of an IN rule on the filter
	 * taxonomy, if the editor wrote one. Empty = every term.
	 *
	 * @param array $view View.
	 * @return int[]
	 */
	public static function chip_limit( array $view ): array {
		foreach ( $view['query']['taxQuery']['rules'] as $rule ) {
			if ( $rule['taxonomy'] === $view['filters']['taxonomy'] && 'IN' === $rule['operator'] && ! $rule['includeChildren'] ) {
				return $rule['terms'];
			}
		}
		return array();
	}

	/**
	 * The no-JS parameters of an instance from $_GET.
	 *
	 * @param string $key Instance key.
	 */
	public static function from_get( string $key ): array {
		$raw = array();
		foreach ( array( 'p' => 'page', 't' => 'term', 'q' => 'q', 's' => 'sort' ) as $short => $name ) {
			$param = 'wrbc_' . $short . '_' . $key;
			// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- public, read-only, validated against the view.
			if ( isset( $_GET[ $param ] ) && is_string( $_GET[ $param ] ) ) {
				$raw[ $name ] = sanitize_text_field( wp_unslash( $_GET[ $param ] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			}
		}
		return $raw;
	}
}
