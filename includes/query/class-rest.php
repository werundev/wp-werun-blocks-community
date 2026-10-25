<?php
/**
 * REST routes of werun-community/query (namespace wrbc/v1).
 *
 * Editor (edit_posts, plus the post type's own edit_posts cap where a type is given):
 *   GET  /query/sources            post types, their taxonomies and counts
 *   GET  /query/terms              terms of a taxonomy (search / include)
 *   GET  /query/posts              published posts of a type (search / include)
 *   GET  /query/meta-keys          registered + detected meta keys of a type
 *   POST /query/preview            { attributes, postId, uid } → { html } (Renderer)
 *
 * Public (signed input only, runs as an anonymous visitor):
 *   GET  /query?c=&page=&term=&q=&sort=&uid=  → { html, page, totalPages, total }
 *   (uid: the block's id on the page, only a prefix for the ids it prints)
 *
 * @package werun-blocks-community
 */

namespace Werun\BlocksCommunity\Query;

use Werun\BlocksCommunity\Security\Signer;
use WP_Error;
use WP_REST_Request;
use WP_REST_Response;

defined( 'ABSPATH' ) || exit;

/**
 * Rest.
 */
final class Rest {

	public const NS = 'wrbc/v1';

	/**
	 * The last request can_read() answered and its answer.
	 *
	 * @var array{0: WP_REST_Request, 1: true|WP_Error}|null
	 */
	private static $read = null;

	/** Hooks. */
	public static function register(): void {
		add_action( 'rest_api_init', array( __CLASS__, 'routes' ) );
	}

	/** Routes. */
	public static function routes(): void {
		$editor = array( __CLASS__, 'can_edit' );
		$type   = array(
			'type'              => 'string',
			'required'          => true,
			'sanitize_callback' => 'sanitize_key',
		);

		// Registered first: the most specific paths before /query.
		register_rest_route(
			self::NS,
			'/query/meta-keys',
			array(
				'methods'             => 'GET',
				'permission_callback' => array( __CLASS__, 'can_edit_type' ),
				'callback'            => array( __CLASS__, 'meta_keys' ),
				'args'                => array(
					'type'    => $type,
					'refresh' => array( 'type' => 'boolean', 'default' => false ),
				),
			)
		);
		register_rest_route(
			self::NS,
			'/query/sources',
			array(
				'methods'             => 'GET',
				'permission_callback' => $editor,
				'callback'            => array( __CLASS__, 'sources' ),
			)
		);
		register_rest_route(
			self::NS,
			'/query/terms',
			array(
				'methods'             => 'GET',
				'permission_callback' => $editor,
				'callback'            => array( __CLASS__, 'terms' ),
				'args'                => array(
					'taxonomy' => $type,
					'search'   => array( 'type' => 'string', 'default' => '', 'sanitize_callback' => 'sanitize_text_field' ),
					'include'  => array( 'type' => 'string', 'default' => '' ),
				),
			)
		);
		register_rest_route(
			self::NS,
			'/query/posts',
			array(
				'methods'             => 'GET',
				'permission_callback' => array( __CLASS__, 'can_edit_type' ),
				'callback'            => array( __CLASS__, 'posts' ),
				'args'                => array(
					'type'    => $type,
					'search'  => array( 'type' => 'string', 'default' => '', 'sanitize_callback' => 'sanitize_text_field' ),
					'include' => array( 'type' => 'string', 'default' => '' ),
				),
			)
		);
		register_rest_route(
			self::NS,
			'/query/preview',
			array(
				'methods'             => 'POST',
				'permission_callback' => array( __CLASS__, 'can_preview' ),
				'callback'            => array( __CLASS__, 'preview' ),
				'args'                => array(
					'attributes' => array( 'type' => 'object', 'default' => array() ),
					'postId'     => array( 'type' => 'integer', 'default' => 0 ),
					'uid'        => array( 'type' => 'string', 'default' => '' ),
				),
			)
		);
		register_rest_route(
			self::NS,
			'/query',
			array(
				'methods'             => 'GET',
				// Public and read-only (published posts, as an anonymous visitor): the signed c authorises it.
				'permission_callback' => array( __CLASS__, 'can_read' ),
				'callback'            => array( __CLASS__, 'results' ),
				'args'                => array(
					'c'    => array( 'type' => 'string', 'required' => true ),
					'page' => array( 'type' => 'string', 'default' => '' ),
					'term' => array( 'type' => 'string', 'default' => '' ),
					'q'    => array( 'type' => 'string', 'default' => '' ),
					'sort' => array( 'type' => 'string', 'default' => '' ),
					// Cosmetic: the prefix of the ids in the markup (Renderer::uid() keeps [A-Za-z0-9_:.-], 64 at most).
					'uid'  => array( 'type' => 'string', 'default' => '' ),
				),
			)
		);
	}

	/**
	 * Visitors of the public route: within the per-IP limit and with a view
	 * this site signed (purpose "query").
	 *
	 * @param WP_REST_Request $request Request.
	 * @return true|WP_Error
	 */
	public static function can_read( WP_REST_Request $request ) {
		// WordPress asks again after the answer, for the Allow header (rest_send_allow_header()): one request counts once.
		if ( null === self::$read || self::$read[0] !== $request ) {
			$throttled = self::throttle();
			if ( $throttled ) {
				$answer = $throttled;
			} else {
				$answer = null === self::signed( $request )
					? new WP_Error( 'wrbc_query_token', __( 'Invalid or expired request.', 'werun-blocks-community' ), array( 'status' => 403 ) )
					: true;
			}
			self::$read = array( $request, $answer );
		}
		return self::$read[1];
	}

	/**
	 * The verified payload of c, or null.
	 *
	 * @param WP_REST_Request $request Request.
	 */
	private static function signed( WP_REST_Request $request ): ?array {
		$payload = Signer::verify( (string) $request->get_param( 'c' ), 'query' );
		return is_array( $payload ) && 1 === ( $payload['v'] ?? 0 ) && is_array( $payload['view'] ?? null ) ? $payload : null;
	}

	/** Editors. */
	public static function can_edit(): bool {
		return current_user_can( 'edit_posts' );
	}

	/**
	 * Editors who can also edit the requested type.
	 *
	 * @param WP_REST_Request $request Request.
	 */
	public static function can_edit_type( WP_REST_Request $request ): bool {
		$type = (string) $request->get_param( 'type' );
		if ( ! current_user_can( 'edit_posts' ) || ! in_array( $type, Config::post_types(), true ) ) {
			return false;
		}
		$object = get_post_type_object( $type );
		return $object && current_user_can( $object->cap->edit_posts );
	}

	/**
	 * Editors, and for a given post, those who can edit it.
	 *
	 * @param WP_REST_Request $request Request.
	 */
	public static function can_preview( WP_REST_Request $request ): bool {
		$post_id = absint( $request->get_param( 'postId' ) );
		if ( ! current_user_can( 'edit_posts' ) || ( $post_id && ! current_user_can( 'edit_post', $post_id ) ) ) {
			return false;
		}
		// The type it reads, as the other editor routes: one the user can edit.
		$attributes = $request->get_param( 'attributes' );
		$type       = is_array( $attributes ) && is_array( $attributes['query'] ?? null ) && is_string( $attributes['query']['postType'] ?? null ) ? $attributes['query']['postType'] : '';
		$object     = '' !== $type ? get_post_type_object( $type ) : null;
		return ! $object || current_user_can( $object->cap->edit_posts );
	}

	/** GET /query/sources. */
	public static function sources(): WP_REST_Response {
		$out = array();
		foreach ( Config::post_types() as $type ) {
			$object = get_post_type_object( $type );
			if ( ! $object || ! current_user_can( $object->cap->edit_posts ) ) {
				continue;
			}
			$taxonomies = array();
			foreach ( get_object_taxonomies( $type, 'objects' ) as $tax ) {
				if ( Config::taxonomy_ok( $tax->name, $type ) ) {
					$taxonomies[] = array(
						'name'         => $tax->name,
						'label'        => $tax->labels->name,
						'singular'     => $tax->labels->singular_name,
						'hierarchical' => (bool) $tax->hierarchical,
					);
				}
			}
			$counts = wp_count_posts( $type );
			$out[]  = array(
				'name'         => $type,
				'label'        => $object->labels->name,
				'singular'     => $object->labels->singular_name,
				'hierarchical' => (bool) $object->hierarchical,
				'count'        => (int) ( $counts->publish ?? 0 ),
				'taxonomies'   => $taxonomies,
				'supports'     => array(
					'thumbnail' => post_type_supports( $type, 'thumbnail' ),
					'excerpt'   => post_type_supports( $type, 'excerpt' ),
					'author'    => post_type_supports( $type, 'author' ),
					'comments'  => post_type_supports( $type, 'comments' ),
				),
			);
		}
		$suggest = array();
		foreach ( array_keys( Config::SUGGEST ) as $variant ) {
			$suggest[ $variant ] = Config::suggest_type( $variant );
		}
		return new WP_REST_Response(
			array(
				'types'   => $out,
				'suggest' => $suggest,
			)
		);
	}

	/**
	 * GET /query/terms.
	 *
	 * @param WP_REST_Request $request Request.
	 */
	public static function terms( WP_REST_Request $request ) {
		$taxonomy = (string) $request->get_param( 'taxonomy' );
		$object   = get_taxonomy( $taxonomy );
		$usable   = false;
		foreach ( Config::post_types() as $type ) {
			$usable = $usable || Config::taxonomy_ok( $taxonomy, $type );
		}
		if ( ! $object || ! $usable ) {
			return new WP_Error( 'wrbc_query_taxonomy', __( 'Unknown taxonomy.', 'werun-blocks-community' ), array( 'status' => 400 ) );
		}
		$include = Config::ids( explode( ',', (string) $request->get_param( 'include' ) ), 50 );
		$args    = array(
			'taxonomy'   => $taxonomy,
			'hide_empty' => false,
			'number'     => $include ? 0 : 30,
			'orderby'    => 'name',
		);
		if ( $include ) {
			$args['include'] = $include;
		} elseif ( '' !== $request->get_param( 'search' ) ) {
			$args['search'] = (string) $request->get_param( 'search' );
		}
		$terms = get_terms( $args );
		$out   = array();
		foreach ( is_array( $terms ) ? $terms : array() as $term ) {
			$out[] = array(
				'id'     => (int) $term->term_id,
				'name'   => html_entity_decode( $term->name, ENT_QUOTES ),
				'parent' => (int) $term->parent,
				'count'  => (int) $term->count,
			);
		}
		return new WP_REST_Response( $out );
	}

	/**
	 * GET /query/posts: published posts only (the block never shows anything else).
	 *
	 * @param WP_REST_Request $request Request.
	 */
	public static function posts( WP_REST_Request $request ): WP_REST_Response {
		$include = Config::ids( explode( ',', (string) $request->get_param( 'include' ) ), 50 );
		$args    = array(
			'post_type'           => (string) $request->get_param( 'type' ),
			'post_status'         => 'publish',
			'has_password'        => false,
			'posts_per_page'      => $include ? 50 : 20,
			'ignore_sticky_posts' => true,
			'no_found_rows'       => true,
			'suppress_filters'    => false,
		);
		if ( $include ) {
			$args['post__in'] = $include;
			$args['orderby']  = 'post__in';
		} elseif ( '' !== $request->get_param( 'search' ) ) {
			$args['s'] = (string) $request->get_param( 'search' );
		}
		$out = array();
		foreach ( get_posts( $args ) as $post ) {
			$out[] = array(
				'id'    => (int) $post->ID,
				'title' => html_entity_decode( wp_strip_all_tags( get_the_title( $post ) ), ENT_QUOTES ),
				'date'  => get_the_date( 'Y-m-d', $post ),
			);
		}
		return new WP_REST_Response( $out );
	}

	/**
	 * GET /query/meta-keys.
	 *
	 * @param WP_REST_Request $request Request.
	 */
	public static function meta_keys( WP_REST_Request $request ): WP_REST_Response {
		return new WP_REST_Response( Meta_Keys::for_type( (string) $request->get_param( 'type' ), (bool) $request->get_param( 'refresh' ) ) );
	}

	/**
	 * POST /query/preview: the same markup render.php prints inside the section.
	 *
	 * @param WP_REST_Request $request Request.
	 */
	public static function preview( WP_REST_Request $request ): WP_REST_Response {
		$attributes = $request->get_param( 'attributes' );
		$built      = Renderer::build(
			is_array( $attributes ) ? $attributes : array(),
			array(
				'postId' => absint( $request->get_param( 'postId' ) ),
				'input'  => array(),
				'rest'   => true,
				'uid'    => (string) $request->get_param( 'uid' ),
			)
		);
		return new WP_REST_Response(
			array(
				'html'  => $built['html'],
				'total' => $built['result']['total'],
				'type'  => $built['view']['query']['postType'],
			)
		);
	}

	/**
	 * GET /query: the next state of a block on the page.
	 *
	 * @param WP_REST_Request $request Request.
	 */
	public static function results( WP_REST_Request $request ) {
		$payload = self::signed( $request ); // can_read() already refused anything else.
		if ( null === $payload ) {
			return new WP_Error( 'wrbc_query_token', __( 'Invalid or expired request.', 'werun-blocks-community' ), array( 'status' => 403 ) );
		}

		// Anonymous, whatever cookies or nonces came with the request.
		$user = get_current_user_id();
		wp_set_current_user( 0 );

		$post_id = absint( $payload['post'] ?? 0 );
		// Re-run every check on the signed view (signing never replaces validation).
		$view = self::view_from_signed( $payload['view'] );
		// The key the page printed: the id of exactly what was signed.
		$key = Signer::id( Renderer::payload( $payload['view'], $post_id ) );

		list( $state, $errors ) = Request::from(
			$view,
			array(
				'page' => (string) $request->get_param( 'page' ),
				'term' => (string) $request->get_param( 'term' ),
				'q'    => (string) $request->get_param( 'q' ),
				'sort' => (string) $request->get_param( 'sort' ),
			)
		);
		if ( $errors ) {
			wp_set_current_user( $user );
			return new WP_Error( 'wrbc_query_param', __( 'Invalid parameter.', 'werun-blocks-community' ), array( 'status' => 400, 'params' => $errors ) );
		}

		$result = Runner::run( $view, $state, $post_id );
		$html   = Renderer::region( $view, $result, $state, $key, $post_id, true, (string) $request->get_param( 'uid' ) );
		wp_set_current_user( $user );

		$response = new WP_REST_Response(
			array(
				'html'       => $html,
				'page'       => $result['page'],
				'totalPages' => $result['pages'],
				'total'      => $result['total'],
			)
		);
		$response->header( 'Cache-Control', 'public, max-age=300' );
		return $response;
	}

	/**
	 * The view again from a signed copy: View::from_attributes() over the
	 * attributes the view was built from.
	 *
	 * @param array $signed Signed view.
	 */
	public static function view_from_signed( array $signed ): array {
		$cols  = is_array( $signed['cols'] ?? null ) ? $signed['cols'] : array();
		$card  = is_array( $signed['card'] ?? null ) ? $signed['card'] : array();
		$texts = is_array( $signed['texts'] ?? null ) ? $signed['texts'] : array();
		return View::from_attributes(
			array_merge(
				is_array( $signed['carousel'] ?? null ) ? $signed['carousel'] : array(),
				array(
					'variant'        => $signed['variant'] ?? '',
					'query'          => $signed['query'] ?? array(),
					'layout'         => $signed['layout'] ?? '',
					'columnsDesktop' => $cols[0] ?? 3,
					'columnsTablet'  => $cols[1] ?? 2,
					'columnsMobile'  => $cols[2] ?? 1,
					'card'           => $card,
					'filters'        => $signed['filters'] ?? array(),
					'pagination'     => $signed['pagination'] ?? 'none',
					'map'            => $signed['map'] ?? array(),
					'gate'           => $signed['gate'] ?? array(),
					'emptyText'      => $texts['empty'] ?? '',
					'allLabel'       => $texts['all'] ?? '',
					'buttonText'     => $texts['button'] ?? '',
					'loadMoreText'   => $texts['more'] ?? '',
				)
			)
		);
	}

	/**
	 * Soft per-IP limit on the public route (filter wrbc_query_throttle, 0 = off).
	 *
	 * @return WP_Error|null
	 */
	private static function throttle() {
		$limit = (int) apply_filters( 'wrbc_query_throttle', 120 );
		$ip    = isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : '';
		if ( $limit <= 0 || '' === $ip ) {
			return null;
		}
		$key = 'wrbc_qt_' . md5( $ip . '|' . gmdate( 'YmdHi' ) );
		if ( wp_using_ext_object_cache() ) {
			wp_cache_add( $key, 0, 'wrbc_query', 70 );
			$count = (int) wp_cache_incr( $key, 1, 'wrbc_query' );
		} else {
			$count = (int) get_transient( $key ) + 1;
			set_transient( $key, $count, 70 );
		}
		if ( $count > $limit ) {
			return new WP_Error( 'wrbc_query_throttled', __( 'Too many requests. Try again in a minute.', 'werun-blocks-community' ), array( 'status' => 429 ) );
		}
		return null;
	}
}
