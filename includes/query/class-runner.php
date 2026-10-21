<?php
/**
 * Runs a view's query: ids, total and pages, cached in the object cache
 * (group wrbc_query) on config + request + context + locale + the posts and
 * terms "last changed" stamps. Random order is never cached.
 *
 * @package werun-blocks-community
 */

namespace Werun\BlocksCommunity\Query;

defined( 'ABSPATH' ) || exit;

/**
 * Runner.
 */
final class Runner {

	public const GROUP = 'wrbc_query';

	/**
	 * Result for a view and a request.
	 *
	 * @param array $view    View::from_attributes().
	 * @param array $request Request::from()[0].
	 * @param int   $post_id Post the block is shown on (0 in templates without one).
	 * @return array{ids:int[],total:int,pages:int,page:int}
	 */
	public static function run( array $view, array $request, int $post_id ): array {
		$config   = $view['query'];
		$paginate = 'none' !== $view['pagination'];
		$args     = Builder::args(
			$config,
			array_merge(
				$request,
				array(
					'postId'   => $post_id,
					'paginate' => $paginate,
				)
			)
		);
		$empty    = array(
			'ids'   => array(),
			'total' => 0,
			'pages' => 0,
			'page'  => (int) $request['page'],
		);
		if ( null === $args ) {
			return $empty;
		}

		$cache = 'rand' !== $config['orderBy'];
		$key   = '';
		if ( $cache ) {
			$key   = 'r:' . md5(
				(string) wp_json_encode(
					array(
						$args,
						$post_id,
						// Plugins may filter WP_Query by user (memberships): one user's ids never serve another.
						get_current_user_id(),
						determine_locale(),
						wp_cache_get_last_changed( 'posts' ),
						wp_cache_get_last_changed( 'terms' ),
						// "Today" moves the upcoming window and today/now rules.
						wp_date( 'Ymd' ),
					)
				)
			);
			$found = wp_cache_get( $key, self::GROUP );
			if ( is_array( $found ) ) {
				return $found;
			}
		}

		$query = new \WP_Query( $args );
		$ids   = array_map( 'intval', $query->posts );
		if ( $paginate ) {
			$total = max( 0, (int) $query->found_posts - $config['offset'] );
			$pages = min( $config['maxPages'], (int) ceil( $total / max( 1, $config['perPage'] ) ) );
		} else {
			$total = count( $ids );
			$pages = $ids ? 1 : 0;
		}
		$result = array(
			'ids'   => $ids,
			'total' => $total,
			'pages' => $pages,
			'page'  => (int) $request['page'],
		);
		if ( $cache ) {
			wp_cache_set( $key, $result, self::GROUP, HOUR_IN_SECONDS );
		}
		return $result;
	}
}
