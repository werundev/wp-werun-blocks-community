<?php
/**
 * Query configuration: the ONLY way from block attributes (or a signed
 * token) into WP_Query. Every value is checked against a whitelist and
 * clamped; anything unknown is dropped. Builder::args() only ever reads the
 * array this returns.
 *
 * Twin (limits and enums): src/query/constants.js.
 *
 * @package werun-blocks-community
 */

namespace Werun\BlocksCommunity\Query;

defined( 'ABSPATH' ) || exit;

/**
 * Config.
 */
final class Config {

	public const META_KEY_RE  = '/^[A-Za-z0-9_:.\-]{1,64}$/';
	public const SENSITIVE_RE = '/pass|token|secret|api[_-]?key|private[_-]?key|auth[_-]?key|salt|nonce|session|credential/i';

	public const TAX_OPERATORS = array( 'IN', 'NOT IN', 'AND', 'EXISTS', 'NOT EXISTS' );
	public const COMPARES      = array( '=', '!=', '>', '>=', '<', '<=', 'LIKE', 'NOT LIKE', 'IN', 'NOT IN', 'BETWEEN', 'NOT BETWEEN', 'EXISTS', 'NOT EXISTS' );
	public const META_TYPES    = array( 'CHAR', 'NUMERIC', 'DECIMAL', 'DATE', 'DATETIME', 'TIME' );
	public const ORDER_BY      = array( 'date', 'modified', 'title', 'menu_order', 'rand', 'comment_count', 'meta', 'upcoming', 'post__in' );
	public const DATE_FORMATS  = array( 'Ymd', 'Y-m-d', 'Y-m-d H:i:s', 'timestamp' );
	public const VARIANTS      = array( 'posts', 'related', 'team', 'events', 'locations', 'resources', 'cases', 'custom' );

	/** Post-type name fragments each variant looks for when no type is chosen (twin: SUGGEST in constants.js). */
	public const SUGGEST = array(
		'team'      => array( 'team', 'staff', 'people', 'member' ),
		'events'    => array( 'event' ),
		'locations' => array( 'location', 'office', 'store' ),
		'resources' => array( 'resource', 'download', 'whitepaper' ),
		'cases'     => array( 'case', 'case-study', 'case_study', 'project', 'portfolio' ),
	);

	/**
	 * Post types a query may read: public, minus attachments and presets.
	 *
	 * @return string[]
	 */
	public static function post_types(): array {
		$types = array_values( array_diff( get_post_types( array( 'public' => true ) ), array( 'attachment', 'wrbc_preset' ) ) );
		/**
		 * Filters the post types werun-community/query may list.
		 *
		 * @param string[] $types Public post type names.
		 */
		$types = (array) apply_filters( 'wrbc_query_post_types', $types );
		// The filter may only narrow: never attachments, presets or non-public types.
		return array_values(
			array_filter(
				array_map( 'strval', $types ),
				static function ( $type ) {
					$object = get_post_type_object( $type );
					return $object && $object->public && ! in_array( $type, array( 'attachment', 'wrbc_preset' ), true );
				}
			)
		);
	}

	/**
	 * A post type that fits a variant by its name, or ''.
	 *
	 * @param string $variant Variant.
	 */
	public static function suggest_type( string $variant ): string {
		if ( empty( self::SUGGEST[ $variant ] ) ) {
			return '';
		}
		foreach ( self::SUGGEST[ $variant ] as $needle ) {
			foreach ( self::post_types() as $type ) {
				$object = get_post_type_object( $type );
				$label  = $object ? strtolower( (string) $object->labels->name ) : '';
				if ( false !== strpos( $type, $needle ) || false !== strpos( $label, str_replace( array( '-', '_' ), ' ', $needle ) ) ) {
					return $type;
				}
			}
		}
		return '';
	}

	/**
	 * Whether a taxonomy can filter a post type: public and attached to it.
	 *
	 * @param mixed  $taxonomy Taxonomy name.
	 * @param string $type     Post type.
	 */
	public static function taxonomy_ok( $taxonomy, string $type ): bool {
		if ( ! is_string( $taxonomy ) || '' === $taxonomy ) {
			return false;
		}
		$object = get_taxonomy( $taxonomy );
		return $object && $object->public && in_array( $type, (array) $object->object_type, true );
	}

	/**
	 * Whether a meta key may be read, filtered or ordered by.
	 *
	 * @param mixed  $key  Meta key.
	 * @param string $type Post type.
	 */
	public static function meta_key_ok( $key, string $type ): bool {
		if ( ! is_string( $key ) || ! preg_match( self::META_KEY_RE, $key ) ) {
			return false;
		}
		/**
		 * Meta keys werun-community/query may always use (on top of the automatic rules).
		 *
		 * @param string[] $keys Keys.
		 * @param string   $type Post type.
		 */
		$allowed = (array) apply_filters( 'wrbc_query_allowed_meta_keys', array(), $type );
		if ( in_array( $key, $allowed, true ) ) {
			return true;
		}
		if ( self::registered_rest_key( $key, $type ) ) {
			return true;
		}
		return ! is_protected_meta( $key, 'post' ) && ! preg_match( self::SENSITIVE_RE, $key );
	}

	/**
	 * Whether a key is registered for the type (or every post type) with show_in_rest.
	 *
	 * @param string $key  Meta key.
	 * @param string $type Post type.
	 */
	public static function registered_rest_key( string $key, string $type ): bool {
		$registered = array_merge( get_registered_meta_keys( 'post', '' ), get_registered_meta_keys( 'post', $type ) );
		return isset( $registered[ $key ] ) && ! empty( $registered[ $key ]['show_in_rest'] );
	}

	/** Defaults of the normalized config. */
	public static function defaults(): array {
		return array(
			'postType'      => 'post',
			'mode'          => 'query',
			'include'       => array(),
			'taxQuery'      => array( 'relation' => 'AND', 'rules' => array() ),
			'metaQuery'     => array( 'relation' => 'AND', 'rules' => array() ),
			'orderBy'       => 'date',
			'order'         => 'DESC',
			'orderMeta'     => array( 'key' => '', 'type' => 'CHAR' ),
			'upcoming'      => array( 'startKey' => '', 'endKey' => '', 'format' => 'Ymd', 'when' => 'upcoming', 'includeOngoing' => true ),
			'perPage'       => 6,
			'offset'        => 0,
			'maxPages'      => 10,
			'excludeCurrent' => true,
			'exclude'       => array(), // phpcs:ignore WordPressVIPMinimum.Performance.WPQueryParams.PostNotIn_exclude -- a block setting, not a WP_Query argument.
			'related'       => array( 'taxonomies' => array() ),
			'author'        => array( 'mode' => 'any', 'ids' => array() ),
			'sticky'        => 'include',
			'hasImage'      => false,
			'parent'        => 0,
			'search'        => '',
			'passwordPosts' => 'exclude',
		);
	}

	/**
	 * Normalizes a raw query config.
	 *
	 * @param mixed $raw     Raw config (block attribute "query" or a signed copy).
	 * @param array $context { @type int $postId Post the block is shown on, @type string $variant }.
	 * @return array Normalized config; postType '' when no readable type is left (Builder runs nothing).
	 */
	public static function normalize( $raw, array $context = array() ): array {
		$raw     = is_array( $raw ) ? $raw : array();
		$d       = self::defaults();
		$variant = in_array( $context['variant'] ?? '', self::VARIANTS, true ) ? $context['variant'] : 'posts';
		$c       = array();

		// Post type: public and readable, else the variant's suggestion, else nothing.
		$types = self::post_types();
		$type  = is_string( $raw['postType'] ?? null ) ? $raw['postType'] : '';
		if ( '' === $type ) {
			$type = self::suggest_type( $variant );
			if ( '' === $type && in_array( $variant, array( 'posts', 'related', 'custom' ), true ) ) {
				$type = 'post';
			}
		}
		$c['postType'] = in_array( $type, $types, true ) ? $type : '';
		$type          = $c['postType'];

		$c['mode']    = 'handpicked' === ( $raw['mode'] ?? '' ) ? 'handpicked' : 'query';
		$c['include'] = self::ids( $raw['include'] ?? array(), 50 );

		// Taxonomy rules.
		$c['taxQuery'] = array( 'relation' => self::relation( $raw['taxQuery']['relation'] ?? '' ), 'rules' => array() );
		foreach ( self::rows( $raw['taxQuery']['rules'] ?? array(), 5 ) as $rule ) {
			$tax = $rule['taxonomy'] ?? '';
			if ( ! self::taxonomy_ok( $tax, $type ) ) {
				continue;
			}
			$operator = in_array( $rule['operator'] ?? 'IN', self::TAX_OPERATORS, true ) ? $rule['operator'] : 'IN';
			$terms    = in_array( $operator, array( 'EXISTS', 'NOT EXISTS' ), true ) ? array() : self::ids( $rule['terms'] ?? array(), 50 );
			if ( ! $terms && ! in_array( $operator, array( 'EXISTS', 'NOT EXISTS' ), true ) ) {
				continue;
			}
			$c['taxQuery']['rules'][] = array(
				'taxonomy'        => $tax,
				'terms'           => $terms,
				'operator'        => $operator,
				'includeChildren' => is_taxonomy_hierarchical( $tax ) && in_array( $operator, array( 'IN', 'AND' ), true ) && ! empty( $rule['includeChildren'] ),
			);
		}

		// Meta rules.
		$c['metaQuery'] = array( 'relation' => self::relation( $raw['metaQuery']['relation'] ?? '' ), 'rules' => array() );
		foreach ( self::rows( $raw['metaQuery']['rules'] ?? array(), 5 ) as $rule ) {
			$key = $rule['key'] ?? '';
			if ( ! self::meta_key_ok( $key, $type ) ) {
				continue;
			}
			$compare = in_array( $rule['compare'] ?? '=', self::COMPARES, true ) ? $rule['compare'] : '=';
			$mtype   = in_array( $rule['type'] ?? 'CHAR', self::META_TYPES, true ) ? $rule['type'] : 'CHAR';
			$mode    = in_array( $rule['valueMode'] ?? 'fixed', array( 'fixed', 'today', 'now' ), true ) && in_array( $mtype, array( 'DATE', 'DATETIME', 'NUMERIC' ), true ) ? ( $rule['valueMode'] ?? 'fixed' ) : 'fixed';
			$value   = self::meta_value( $rule['value'] ?? '', $compare );
			if ( null === $value && 'fixed' === $mode ) {
				continue;
			}
			if ( in_array( $compare, array( 'IN', 'NOT IN', 'BETWEEN', 'NOT BETWEEN' ), true ) && 'fixed' !== $mode ) {
				$mode = 'fixed'; // "today" is one value.
			}
			$c['metaQuery']['rules'][] = array(
				'key'       => $key,
				'compare'   => $compare,
				'value'     => null === $value ? '' : $value,
				'valueMode' => $mode,
				'type'      => $mtype,
			);
		}

		// Order.
		$order_by = in_array( $raw['orderBy'] ?? '', self::ORDER_BY, true ) ? $raw['orderBy'] : $d['orderBy'];
		$c['order']     = 'ASC' === strtoupper( wrbc_text( $raw['order'] ?? '' ) ) ? 'ASC' : 'DESC';
		$c['orderMeta'] = array(
			'key'  => self::meta_key_ok( $raw['orderMeta']['key'] ?? '', $type ) ? $raw['orderMeta']['key'] : '',
			'type' => in_array( $raw['orderMeta']['type'] ?? '', self::META_TYPES, true ) ? $raw['orderMeta']['type'] : 'CHAR',
		);
		$up               = is_array( $raw['upcoming'] ?? null ) ? $raw['upcoming'] : array();
		$c['upcoming']    = array(
			'startKey'       => self::meta_key_ok( $up['startKey'] ?? '', $type ) ? $up['startKey'] : '',
			'endKey'         => self::meta_key_ok( $up['endKey'] ?? '', $type ) ? $up['endKey'] : '',
			'format'         => in_array( $up['format'] ?? '', self::DATE_FORMATS, true ) ? $up['format'] : 'Ymd',
			'when'           => in_array( $up['when'] ?? '', array( 'upcoming', 'past', 'all' ), true ) ? $up['when'] : 'upcoming',
			'includeOngoing' => array_key_exists( 'includeOngoing', $up ) ? (bool) $up['includeOngoing'] : true,
		);
		if ( 'meta' === $order_by && '' === $c['orderMeta']['key'] ) {
			$order_by = 'date';
		}
		if ( 'upcoming' === $order_by && '' === $c['upcoming']['startKey'] ) {
			$order_by = 'date';
		}
		if ( 'post__in' === $order_by && 'handpicked' !== $c['mode'] ) {
			$order_by = 'date';
		}
		$c['orderBy'] = $order_by;

		// Limits.
		$c['perPage']  = self::clamp( $raw['perPage'] ?? $d['perPage'], 1, 'rand' === $order_by ? 12 : 24 );
		$c['offset']   = self::clamp( $raw['offset'] ?? 0, 0, 50 );
		$c['maxPages'] = self::clamp( $raw['maxPages'] ?? $d['maxPages'], 1, 50 );
		$c['excludeCurrent'] = array_key_exists( 'excludeCurrent', $raw ) ? (bool) $raw['excludeCurrent'] : true;
		$c['exclude']  = self::ids( $raw['exclude'] ?? array(), 50 ); // phpcs:ignore WordPressVIPMinimum.Performance.WPQueryParams.PostNotIn_exclude -- a block setting (at most 50 ids), not a WP_Query argument.

		$related = array();
		foreach ( array_slice( (array) ( $raw['related']['taxonomies'] ?? array() ), 0, 3 ) as $tax ) {
			if ( self::taxonomy_ok( $tax, $type ) && ! in_array( $tax, $related, true ) ) {
				$related[] = $tax;
			}
		}
		$c['related'] = array( 'taxonomies' => $related );

		$author_mode = in_array( $raw['author']['mode'] ?? '', array( 'any', 'current', 'ids' ), true ) ? $raw['author']['mode'] : 'any';
		$author_ids  = self::ids( $raw['author']['ids'] ?? array(), 20 );
		if ( 'ids' === $author_mode && ! $author_ids ) {
			$author_mode = 'any';
		}
		$c['author'] = array( 'mode' => $author_mode, 'ids' => 'ids' === $author_mode ? $author_ids : array() );

		$c['sticky']   = 'post' === $type && in_array( $raw['sticky'] ?? '', array( 'include', 'exclude', 'only' ), true ) ? $raw['sticky'] : 'include';
		$c['hasImage'] = ! empty( $raw['hasImage'] );

		$parent = $raw['parent'] ?? 0;
		if ( 'current' !== $parent ) {
			$parent = is_numeric( $parent ) ? max( 0, (int) $parent ) : 0;
		}
		$c['parent'] = is_post_type_hierarchical( $type ) ? $parent : 0;

		$search      = sanitize_text_field( wrbc_text( $raw['search'] ?? '' ) );
		$c['search'] = function_exists( 'mb_substr' ) ? mb_substr( $search, 0, 100 ) : substr( $search, 0, 100 );

		$c['passwordPosts'] = 'titleOnly' === ( $raw['passwordPosts'] ?? '' ) ? 'titleOnly' : 'exclude';

		return $c;
	}

	/** AND | OR. */
	private static function relation( $value ): string {
		return 'OR' === $value ? 'OR' : 'AND';
	}

	/**
	 * Up to $max arrays from a list.
	 *
	 * @param mixed $rows Raw rows.
	 * @param int   $max  Limit.
	 */
	private static function rows( $rows, int $max ): array {
		return array_slice( array_values( array_filter( is_array( $rows ) ? $rows : array(), 'is_array' ) ), 0, $max );
	}

	/**
	 * Positive integer ids, unique, at most $max.
	 *
	 * @param mixed $ids Raw list.
	 * @param int   $max Limit.
	 */
	public static function ids( $ids, int $max ): array {
		if ( ! is_array( $ids ) ) {
			return array();
		}
		$out = array();
		foreach ( $ids as $id ) {
			if ( is_numeric( $id ) && (int) $id > 0 && ! in_array( (int) $id, $out, true ) ) {
				$out[] = absint( $id );
			}
			if ( count( $out ) >= $max ) {
				break;
			}
		}
		return $out;
	}

	/**
	 * An integer within bounds.
	 *
	 * @param mixed $value Raw.
	 * @param int   $min   Min.
	 * @param int   $max   Max.
	 */
	public static function clamp( $value, int $min, int $max ): int {
		return max( $min, min( $max, is_numeric( $value ) ? (int) $value : $min ) );
	}

	/**
	 * A meta rule value: a string, or a list of up to 20 strings for IN/BETWEEN.
	 * Null when the compare needs a value and there is none.
	 *
	 * @param mixed  $value   Raw.
	 * @param string $compare Compare.
	 * @return string|string[]|null
	 */
	private static function meta_value( $value, string $compare ) {
		if ( in_array( $compare, array( 'EXISTS', 'NOT EXISTS' ), true ) ) {
			return '';
		}
		$list = in_array( $compare, array( 'IN', 'NOT IN', 'BETWEEN', 'NOT BETWEEN' ), true );
		if ( $list ) {
			$values = array();
			foreach ( array_slice( is_array( $value ) ? $value : explode( ',', wrbc_text( $value ) ), 0, 20 ) as $v ) {
				$v = self::short( $v );
				if ( '' !== $v ) {
					$values[] = $v;
				}
			}
			if ( in_array( $compare, array( 'BETWEEN', 'NOT BETWEEN' ), true ) ) {
				return 2 === count( array_slice( $values, 0, 2 ) ) ? array_slice( $values, 0, 2 ) : null;
			}
			return $values ? $values : null;
		}
		$value = self::short( is_array( $value ) ? '' : $value );
		return '' === $value ? null : $value;
	}

	/** A scalar as a trimmed string of at most 200 characters. */
	private static function short( $value ): string {
		$value = trim( sanitize_text_field( wrbc_text( $value ) ) );
		return function_exists( 'mb_substr' ) ? mb_substr( $value, 0, 200 ) : substr( $value, 0, 200 );
	}
}
