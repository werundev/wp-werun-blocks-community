<?php
/**
 * Saved styles (presets): the styles and options of a configured block, saved
 * with a name and applied later to the same block on any page. Content (texts,
 * images, links: attributes with "role": "content" in block.json) is never
 * saved, so applying a preset keeps the page's own content.
 *
 * Stored as posts of the non-public type wrbc_preset (title = name, meta =
 * block name and attributes as JSON). "publish", not "private": authors can
 * edit and delete their own published posts, not their own private ones. The
 * type has no URL, screen or REST of its own. REST: /wrbc/v1/presets.
 *
 * @package werun-blocks-community
 */

namespace Werun\BlocksCommunity\Presets;

use WP_Block_Type_Registry;
use WP_Error;
use WP_Post;
use WP_REST_Request;
use WP_REST_Response;

defined( 'ABSPATH' ) || exit;

/**
 * Presets.
 */
final class Presets {

	public const POST_TYPE  = 'wrbc_preset';
	public const META_BLOCK = '_wrbc_preset_block';
	public const META_ATTRS = '_wrbc_preset_attributes';

	/**
	 * Whether a block offers presets: every werun-community/* block that isn't a child
	 * (no "parent" or "ancestor"), unless block.json opts out with
	 * "supports": { "wrbcPresets": false }. Twin: supports() in src/presets/index.js.
	 *
	 * @param string $name Block name.
	 */
	public static function supports( string $name ): bool {
		$type = WP_Block_Type_Registry::get_instance()->get_registered( $name );
		$ok   = 0 === strpos( $name, 'werun-community/' )
			&& $type
			&& empty( $type->parent )
			&& empty( $type->ancestor )
			&& false !== ( $type->supports['wrbcPresets'] ?? true );
		/**
		 * Whether a block offers saved styles.
		 *
		 * @param bool   $ok   Default answer.
		 * @param string $name Block name.
		 */
		return (bool) apply_filters( 'wrbc_presets_supports', $ok, $name );
	}

	/** Attributes never saved, whatever their role: identity and editor state. */
	private const SKIP = array( 'anchor', 'metadata', 'lock' );

	/** Largest attributes JSON accepted, in bytes. */
	private const MAX_BYTES = 65536;

	/**
	 * Hooks.
	 */
	public static function register(): void {
		add_action( 'init', array( __CLASS__, 'register_post_type' ) );
		add_action( 'rest_api_init', array( __CLASS__, 'register_routes' ) );
	}

	/**
	 * Non-public post type, no screens of its own: presets are managed from the block.
	 */
	public static function register_post_type(): void {
		register_post_type(
			self::POST_TYPE,
			array(
				'labels'          => array(
					'name'          => __( 'Saved block styles', 'werun-blocks-community' ),
					'singular_name' => __( 'Saved block style', 'werun-blocks-community' ),
				),
				'public'          => false,
				'show_ui'         => false,
				'show_in_rest'    => false,
				'rewrite'         => false,
				'query_var'       => false,
				'supports'        => array( 'title', 'author' ),
				'capability_type' => 'post',
				'map_meta_cap'    => true,
			)
		);
	}

	/**
	 * GET/POST /wrbc/v1/presets, PUT/DELETE /wrbc/v1/presets/{id}.
	 */
	public static function register_routes(): void {
		register_rest_route(
			'wrbc/v1',
			'/presets',
			array(
				array(
					'methods'             => 'GET',
					'callback'            => array( __CLASS__, 'list' ),
					'permission_callback' => array( __CLASS__, 'can_use' ),
					'args'                => array(
						'block' => array(
							'type'     => 'string',
							'required' => true,
						),
					),
				),
				array(
					'methods'             => 'POST',
					'callback'            => array( __CLASS__, 'create' ),
					'permission_callback' => array( __CLASS__, 'can_use' ),
					'args'                => array(
						'block'      => array(
							'type'     => 'string',
							'required' => true,
						),
						'name'       => array(
							'type'     => 'string',
							'required' => true,
						),
						'attributes' => array(
							'type'     => 'object',
							'required' => true,
						),
					),
				),
			)
		);
		register_rest_route(
			'wrbc/v1',
			'/presets/(?P<id>\d+)',
			array(
				array(
					'methods'             => 'PUT',
					'callback'            => array( __CLASS__, 'update' ),
					'permission_callback' => array( __CLASS__, 'can_edit' ),
					'args'                => array(
						'name'       => array( 'type' => 'string' ),
						'attributes' => array( 'type' => 'object' ),
					),
				),
				array(
					'methods'             => 'DELETE',
					'callback'            => array( __CLASS__, 'delete' ),
					'permission_callback' => array( __CLASS__, 'can_edit' ),
				),
			)
		);
	}

	/**
	 * Anyone who edits posts can list, apply and save presets.
	 */
	public static function can_use(): bool {
		return current_user_can( 'edit_posts' );
	}

	/**
	 * Updating or deleting needs the right on that preset (its author, or editors).
	 *
	 * @param WP_REST_Request $request Request.
	 * @return bool|WP_Error
	 */
	public static function can_edit( WP_REST_Request $request ) {
		$post = self::preset( (int) $request['id'] );
		if ( ! $post ) {
			return new WP_Error( 'wrbc_preset_not_found', __( 'That saved style doesn’t exist any more.', 'werun-blocks-community' ), array( 'status' => 404 ) );
		}
		$cap = 'DELETE' === $request->get_method() ? 'delete_post' : 'edit_post';
		return current_user_can( $cap, $post->ID );
	}

	/**
	 * Presets of one block, by name.
	 *
	 * @param WP_REST_Request $request Request.
	 */
	public static function list( WP_REST_Request $request ) {
		$block = (string) $request['block'];
		if ( ! self::supports( $block ) ) {
			return new WP_REST_Response( array() );
		}
		$posts = get_posts(
			array(
				'post_type'      => self::POST_TYPE,
				'post_status'    => 'publish',
				'posts_per_page' => 200,
				'orderby'        => 'title',
				'order'          => 'ASC',
				'meta_key'       => self::META_BLOCK, // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_key
				'meta_value'     => $block, // phpcs:ignore WordPress.DB.SlowDBQuery.slow_db_query_meta_value
			)
		);
		return new WP_REST_Response( array_map( array( __CLASS__, 'shape' ), $posts ) );
	}

	/**
	 * Saves a new preset.
	 *
	 * @param WP_REST_Request $request Request.
	 */
	public static function create( WP_REST_Request $request ) {
		$block = (string) $request['block'];
		if ( ! self::supports( $block ) ) {
			return new WP_Error( 'wrbc_preset_block', __( 'This block can’t save styles.', 'werun-blocks-community' ), array( 'status' => 400 ) );
		}
		$name = self::clean_name( $request['name'] );
		if ( '' === $name ) {
			return new WP_Error( 'wrbc_preset_name', __( 'Give the style a name.', 'werun-blocks-community' ), array( 'status' => 400 ) );
		}
		$json = self::encode( $block, (array) $request['attributes'] );
		if ( is_wp_error( $json ) ) {
			return $json;
		}
		$id = wp_insert_post(
			array(
				'post_type'   => self::POST_TYPE,
				'post_status' => 'publish',
				'post_title'  => $name,
				'post_author' => get_current_user_id(),
			),
			true
		);
		if ( is_wp_error( $id ) ) {
			return $id;
		}
		update_post_meta( $id, self::META_BLOCK, $block );
		update_post_meta( $id, self::META_ATTRS, wp_slash( $json ) );
		return new WP_REST_Response( self::shape( get_post( $id ) ), 201 );
	}

	/**
	 * Renames a preset or replaces its settings with the block's current ones.
	 *
	 * @param WP_REST_Request $request Request.
	 */
	public static function update( WP_REST_Request $request ) {
		$post  = self::preset( (int) $request['id'] );
		$block = (string) get_post_meta( $post->ID, self::META_BLOCK, true );
		if ( null !== $request['name'] ) {
			$name = self::clean_name( $request['name'] );
			if ( '' === $name ) {
				return new WP_Error( 'wrbc_preset_name', __( 'Give the style a name.', 'werun-blocks-community' ), array( 'status' => 400 ) );
			}
			wp_update_post(
				array(
					'ID'         => $post->ID,
					'post_title' => $name,
				)
			);
		}
		if ( null !== $request['attributes'] ) {
			$json = self::encode( $block, (array) $request['attributes'] );
			if ( is_wp_error( $json ) ) {
				return $json;
			}
			update_post_meta( $post->ID, self::META_ATTRS, wp_slash( $json ) );
		}
		return new WP_REST_Response( self::shape( get_post( $post->ID ) ) );
	}

	/**
	 * Deletes a preset (for good: it's a setting, not content).
	 *
	 * @param WP_REST_Request $request Request.
	 */
	public static function delete( WP_REST_Request $request ) {
		$post = self::preset( (int) $request['id'] );
		wp_delete_post( $post->ID, true );
		return new WP_REST_Response( array( 'deleted' => true ) );
	}

	/**
	 * The attributes a preset may hold for a block: the block's own and its
	 * supports' attributes, minus content and SKIP.
	 *
	 * @param string $block Block name.
	 * @return string[]
	 */
	public static function style_keys( string $block ): array {
		$type = WP_Block_Type_Registry::get_instance()->get_registered( $block );
		if ( ! $type ) {
			return array();
		}
		$keys = array();
		foreach ( (array) $type->attributes as $key => $schema ) {
			$role = $schema['role'] ?? ( $schema['__experimentalRole'] ?? '' );
			if ( 'content' !== $role && ! in_array( $key, self::SKIP, true ) ) {
				$keys[] = (string) $key;
			}
		}
		return $keys;
	}

	/**
	 * JSON of the allowed attributes, or an error.
	 *
	 * @param string $block Block name.
	 * @param array  $attributes Submitted attributes.
	 * @return string|WP_Error
	 */
	private static function encode( string $block, array $attributes ) {
		$keep = array_intersect_key( $attributes, array_flip( self::style_keys( $block ) ) );
		$json = (string) wp_json_encode( (object) $keep );
		if ( strlen( $json ) > self::MAX_BYTES ) {
			return new WP_Error( 'wrbc_preset_size', __( 'These settings are too large to save.', 'werun-blocks-community' ), array( 'status' => 400 ) );
		}
		return $json;
	}

	/**
	 * A preset post, or null.
	 *
	 * @param int $id Post id.
	 */
	private static function preset( int $id ): ?WP_Post {
		$post = get_post( $id );
		return $post instanceof WP_Post && self::POST_TYPE === $post->post_type ? $post : null;
	}

	/**
	 * A name: plain text, at most 80 characters.
	 *
	 * @param mixed $name Raw name.
	 */
	private static function clean_name( $name ): string {
		return mb_substr( trim( sanitize_text_field( is_scalar( $name ) ? (string) $name : '' ) ), 0, 80 );
	}

	/**
	 * A preset for the editor.
	 *
	 * @param WP_Post $post Preset.
	 */
	private static function shape( WP_Post $post ): array {
		$attributes = json_decode( (string) get_post_meta( $post->ID, self::META_ATTRS, true ), true );
		return array(
			'id'         => $post->ID,
			'name'       => $post->post_title,
			'block'      => (string) get_post_meta( $post->ID, self::META_BLOCK, true ),
			'attributes' => is_array( $attributes ) ? (object) $attributes : new \stdClass(),
			'author'     => get_the_author_meta( 'display_name', (int) $post->post_author ),
			'canEdit'    => current_user_can( 'edit_post', $post->ID ),
		);
	}
}
