<?php
/**
 * WP_Query arguments from a normalized config (Config::normalize()) and the
 * visitor's request (page, term, search, sort, already validated by
 * Request::from()). Status, fields and permissions are fixed here and never
 * read from input.
 *
 * @package werun-blocks-community
 */

namespace Werun\BlocksCommunity\Query;

defined( 'ABSPATH' ) || exit;

/**
 * Builder.
 */
final class Builder {

	/** Visitor sort choices → orderby/order. Twin: SORTS in src/query/constants.js. */
	public const SORTS = array(
		'newest'  => array( 'date', 'DESC' ),
		'oldest'  => array( 'date', 'ASC' ),
		'az'      => array( 'title', 'ASC' ),
		'za'      => array( 'title', 'DESC' ),
		'updated' => array( 'modified', 'DESC' ),
	);

	/**
	 * WP_Query args, or null when the config can't return anything.
	 *
	 * @param array $c       Normalized config.
	 * @param array $request { page, term: {taxonomy,id}|null, q, sort, postId, paginate }.
	 */
	public static function args( array $c, array $request = array() ): ?array {
		if ( '' === ( $c['postType'] ?? '' ) ) {
			return null;
		}
		$post_id  = absint( $request['postId'] ?? 0 );
		$page     = max( 1, (int) ( $request['page'] ?? 1 ) );
		$paginate = ! empty( $request['paginate'] );

		$args = array(
			'post_type'              => $c['postType'],
			'post_status'            => 'publish',
			'posts_per_page'         => $c['perPage'],
			'ignore_sticky_posts'    => true,
			'suppress_filters'       => false,
			'no_found_rows'          => ! $paginate,
			'fields'                 => 'ids',
			'update_post_term_cache' => false,
			'update_post_meta_cache' => false,
			'has_password'           => 'titleOnly' === $c['passwordPosts'] ? null : false,
		);

		$not_in = $c['exclude'];
		if ( $c['excludeCurrent'] && $post_id ) {
			$not_in[] = $post_id;
		}

		if ( 'handpicked' === $c['mode'] ) {
			if ( ! $c['include'] ) {
				return null;
			}
			$args['post__in']       = array_values( array_diff( $c['include'], $not_in ) );
			$args['posts_per_page'] = count( $c['include'] );
			$args['no_found_rows']  = true;
			if ( ! $args['post__in'] ) {
				return null;
			}
			self::order( $args, $c, $request );
			return $args;
		}

		if ( $not_in ) {
			$args['post__not_in'] = array_values( array_unique( $not_in ) ); // phpcs:ignore WordPressVIPMinimum.Performance.WPQueryParams.PostNotIn_post__not_in -- the editor's own exclusions: at most 50 ids plus the current post.
		}

		// Taxonomies: the editor's rules, related terms of the current post, the visitor's chip.
		$tax = array();
		foreach ( $c['taxQuery']['rules'] as $rule ) {
			$clause = array(
				'taxonomy' => $rule['taxonomy'],
				'operator' => $rule['operator'],
			);
			if ( $rule['terms'] ) {
				$clause['field']            = 'term_id';
				$clause['terms']            = $rule['terms'];
				$clause['include_children'] = $rule['includeChildren'];
			}
			$tax[] = $clause;
		}
		if ( count( $tax ) > 1 ) {
			$tax['relation'] = $c['taxQuery']['relation'];
		}
		$extra = array();
		if ( $c['related']['taxonomies'] && $post_id ) {
			$related = array( 'relation' => 'OR' );
			foreach ( $c['related']['taxonomies'] as $taxonomy ) {
				$terms = wp_get_post_terms( $post_id, $taxonomy, array( 'fields' => 'ids' ) );
				if ( ! is_wp_error( $terms ) && $terms ) {
					$related[] = array(
						'taxonomy' => $taxonomy,
						'field'    => 'term_id',
						'terms'    => array_map( 'intval', $terms ),
					);
				}
			}
			if ( count( $related ) > 1 ) {
				$extra[] = $related;
			}
		}
		if ( ! empty( $request['term']['taxonomy'] ) && ! empty( $request['term']['id'] ) ) {
			$extra[] = array(
				'taxonomy' => $request['term']['taxonomy'],
				'field'    => 'term_id',
				'terms'    => array( (int) $request['term']['id'] ),
			);
		}
		if ( $extra ) {
			$tax = $tax ? array_merge( array( 'relation' => 'AND', $tax ), $extra ) : array_merge( array( 'relation' => 'AND' ), $extra );
		}
		if ( $tax ) {
			$args['tax_query'] = $tax; // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_tax_query
		}

		// Meta: the editor's rules, "has an image", the upcoming window and meta order.
		$meta = array();
		foreach ( $c['metaQuery']['rules'] as $rule ) {
			$clause = array(
				'key'     => $rule['key'],
				'compare' => $rule['compare'],
				'type'    => $rule['type'],
			);
			if ( ! in_array( $rule['compare'], array( 'EXISTS', 'NOT EXISTS' ), true ) ) {
				$clause['value'] = 'fixed' === $rule['valueMode'] ? $rule['value'] : self::now_value( $rule['type'], $rule['valueMode'] );
			}
			$meta[] = $clause;
		}
		if ( count( $meta ) > 1 ) {
			$meta['relation'] = $c['metaQuery']['relation'];
		}
		$meta_and = array();
		if ( $meta ) {
			$meta_and[] = $meta;
		}
		if ( $c['hasImage'] ) {
			$meta_and[] = array(
				'key'     => '_thumbnail_id',
				'compare' => 'EXISTS',
			);
		}
		if ( '' !== $c['upcoming']['startKey'] && 'upcoming' === $c['orderBy'] ) {
			$meta_and = array_merge( $meta_and, self::upcoming( $c['upcoming'] ) );
		}
		if ( 'meta' === $c['orderBy'] ) {
			$meta_and['wrbc_order'] = array(
				'key'     => $c['orderMeta']['key'],
				'compare' => 'EXISTS',
				'type'    => $c['orderMeta']['type'],
			);
		}
		if ( $meta_and ) {
			$args['meta_query'] = array_merge( array( 'relation' => 'AND' ), $meta_and ); // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_query
		}

		// Author: "current" is the author of the post the block is shown on.
		if ( 'current' === $c['author']['mode'] ) {
			$author = $post_id ? (int) get_post_field( 'post_author', $post_id ) : 0;
			if ( ! $author ) {
				return null;
			}
			$args['author__in'] = array( $author );
		} elseif ( 'ids' === $c['author']['mode'] ) {
			$args['author__in'] = $c['author']['ids'];
		}

		if ( 'post' === $c['postType'] && 'include' !== $c['sticky'] ) {
			$sticky = array_map( 'intval', (array) get_option( 'sticky_posts', array() ) );
			if ( 'only' === $c['sticky'] ) {
				if ( ! $sticky ) {
					return null;
				}
				$args['post__in'] = $sticky;
			} elseif ( $sticky ) {
				$args['post__not_in'] = array_values( array_unique( array_merge( $args['post__not_in'] ?? array(), $sticky ) ) ); // phpcs:ignore WordPressVIPMinimum.Performance.WPQueryParams.PostNotIn_post__not_in -- "exclude sticky posts": only the site's sticky posts.
			}
		}

		if ( 'current' === $c['parent'] ) {
			if ( ! $post_id ) {
				return null;
			}
			$args['post_parent'] = $post_id;
		} elseif ( $c['parent'] > 0 ) {
			$args['post_parent'] = $c['parent'];
		}

		$search = trim( $c['search'] . ' ' . ( $request['q'] ?? '' ) );
		if ( '' !== $search ) {
			$args['s'] = $search;
		}

		// Offset with pagination: WP ignores "paged" once "offset" is set.
		$offset = $c['offset'] + ( $page - 1 ) * $c['perPage'];
		if ( $offset > 0 ) {
			$args['offset'] = $offset;
		}

		self::order( $args, $c, $request );
		return $args;
	}

	/**
	 * Orderby/order, with the visitor's sort when one was chosen.
	 *
	 * @param array $args    Args (by reference).
	 * @param array $c       Config.
	 * @param array $request Request.
	 */
	private static function order( array &$args, array $c, array $request ): void {
		$sort = $request['sort'] ?? '';
		if ( isset( self::SORTS[ $sort ] ) ) {
			$args['orderby'] = array( self::SORTS[ $sort ][0] => self::SORTS[ $sort ][1] );
			return;
		}
		switch ( $c['orderBy'] ) {
			case 'meta':
				$args['orderby'] = array(
					'wrbc_order' => $c['order'],
					'date'      => 'DESC',
				);
				break;
			case 'upcoming':
				$args['orderby'] = array(
					'wrbc_start' => 'past' === $c['upcoming']['when'] ? 'DESC' : 'ASC',
					'date'      => 'DESC',
				);
				break;
			case 'rand':
			case 'post__in':
				$args['orderby'] = $c['orderBy'];
				break;
			default:
				$args['orderby'] = array( $c['orderBy'] => $c['order'] );
				if ( 'date' !== $c['orderBy'] ) {
					$args['orderby']['date'] = 'DESC';
				}
		}
		if ( 'handpicked' === $c['mode'] && 'post__in' === $c['orderBy'] ) {
			$args['orderby'] = 'post__in';
		}
	}

	/**
	 * "Today"/"now" for a meta rule, in the site's time zone.
	 * NUMERIC: today = Ymd (ACF date pickers), now = Unix time.
	 *
	 * @param string $type Meta type.
	 * @param string $mode today|now.
	 */
	public static function now_value( string $type, string $mode ) {
		$tz = wp_timezone();
		if ( 'NUMERIC' === $type ) {
			return 'now' === $mode ? time() : (int) wp_date( 'Ymd', null, $tz );
		}
		if ( 'DATETIME' === $type ) {
			return 'now' === $mode ? wp_date( 'Y-m-d H:i:s', null, $tz ) : wp_date( 'Y-m-d', null, $tz ) . ' 00:00:00';
		}
		return wp_date( 'Y-m-d', null, $tz );
	}

	/**
	 * Today in a stored date format, with the meta type to compare it as.
	 *
	 * @param string $format Ymd|Y-m-d|Y-m-d H:i:s|timestamp.
	 * @return array{0:string|int,1:string}
	 */
	public static function today( string $format ): array {
		$tz = wp_timezone();
		switch ( $format ) {
			case 'timestamp':
				return array( ( new \DateTimeImmutable( 'today', $tz ) )->getTimestamp(), 'NUMERIC' );
			case 'Y-m-d':
				return array( wp_date( 'Y-m-d', null, $tz ), 'DATE' );
			case 'Y-m-d H:i:s':
				return array( wp_date( 'Y-m-d', null, $tz ) . ' 00:00:00', 'DATETIME' );
			default:
				return array( wp_date( 'Ymd', null, $tz ), 'NUMERIC' );
		}
	}

	/**
	 * Meta clauses for upcoming / past / all, plus the named start clause
	 * ("wrbc_start") the order uses.
	 *
	 * @param array $u Upcoming config.
	 */
	private static function upcoming( array $u ): array {
		list( $today, $type ) = self::today( $u['format'] );
		$start = $u['startKey'];
		$end   = $u['endKey'];
		$out   = array(
			'wrbc_start' => array(
				'key'     => $start,
				'compare' => 'EXISTS',
				'type'    => $type,
			),
		);
		if ( 'upcoming' === $u['when'] ) {
			if ( $end && $u['includeOngoing'] ) {
				$out[] = array(
					'relation' => 'OR',
					array( 'key' => $start, 'value' => $today, 'compare' => '>=', 'type' => $type ),
					array( 'key' => $end, 'value' => $today, 'compare' => '>=', 'type' => $type ),
				);
			} else {
				$out[] = array( 'key' => $start, 'value' => $today, 'compare' => '>=', 'type' => $type );
			}
		} elseif ( 'past' === $u['when'] ) {
			if ( $end ) {
				$out[] = array(
					'relation' => 'OR',
					array( 'key' => $end, 'value' => $today, 'compare' => '<', 'type' => $type ),
					array(
						'relation' => 'AND',
						array( 'key' => $end, 'compare' => 'NOT EXISTS' ),
						array( 'key' => $start, 'value' => $today, 'compare' => '<', 'type' => $type ),
					),
				);
			} else {
				$out[] = array( 'key' => $start, 'value' => $today, 'compare' => '<', 'type' => $type );
			}
		}
		return $out;
	}
}
