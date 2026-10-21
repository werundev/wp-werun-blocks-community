<?php
/**
 * Testimonials from a post type (source "query"): the query goes through
 * the werun-community/query engine only (Config::normalize → Builder → Runner, with
 * its cache: public types, published posts, safe meta keys), and every post
 * becomes the same card a manual testimonial prints (wrbc_testimonial_card()).
 *
 * Map (attribute "map", which post data fills each part of the card):
 *   quote  'excerpt' | 'content' | 'meta:<key>'   (excerpt/content: plain text, `words` long)
 *   name   'title' | 'meta:<key>'
 *   role   '' | 'meta:<key>'
 *   avatar 'featured' | 'meta:<key>' (attachment id) | ''
 *   rating '' | 'meta:<key>' (number, rounded and clamped to 0–5)
 *   words  5–80
 * Twin (defaults, choices and limits): MAP_DEFAULTS / normalizeMap() in edit.js.
 *
 * @package werun-blocks-community
 */

defined( 'ABSPATH' ) || exit;

require_once dirname( __DIR__ ) . '/testimonial/card.php';

if ( ! function_exists( 'wrbc_testimonials_map' ) ) {
	/**
	 * The field map, checked: unknown choices fall back to the default, meta
	 * keys only when the query engine allows them for the type
	 * (Config::meta_key_ok: no protected or sensitive keys).
	 *
	 * @param mixed  $raw  Attribute "map".
	 * @param string $type Normalized post type.
	 * @return array{quote:string,name:string,role:string,avatar:string,rating:string,words:int}
	 */
	function wrbc_testimonials_map( $raw, string $type ) {
		$raw     = is_array( $raw ) ? $raw : array();
		$choices = array(
			// part => [ default, fixed choices, value when a meta key is refused ].
			'quote'  => array( 'excerpt', array( 'excerpt', 'content' ), 'excerpt' ),
			'name'   => array( 'title', array( 'title' ), 'title' ),
			'role'   => array( '', array( '' ), '' ),
			'avatar' => array( 'featured', array( 'featured', '' ), '' ),
			'rating' => array( '', array( '' ), '' ),
		);
		$out = array();
		foreach ( $choices as $part => $rule ) {
			$value = array_key_exists( $part, $raw ) && is_string( $raw[ $part ] ) ? $raw[ $part ] : $rule[0];
			if ( 0 === strpos( $value, 'meta:' ) ) {
				$key          = substr( $value, 5 );
				$out[ $part ] = \Werun\BlocksCommunity\Query\Config::meta_key_ok( $key, $type ) ? 'meta:' . $key : $rule[2];
			} else {
				$out[ $part ] = in_array( $value, $rule[1], true ) ? $value : $rule[0];
			}
		}
		$out['words'] = is_numeric( $raw['words'] ?? null ) ? \Werun\BlocksCommunity\Query\Config::clamp( $raw['words'], 5, 80 ) : 40;
		return $out;
	}
}

if ( ! function_exists( 'wrbc_testimonials_meta' ) ) {
	/**
	 * The meta key of a mapped part ('' when the part isn't a meta field).
	 *
	 * @param string $value Map value.
	 */
	function wrbc_testimonials_meta( string $value ) {
		return 0 === strpos( $value, 'meta:' ) ? substr( $value, 5 ) : '';
	}
}

if ( ! function_exists( 'wrbc_testimonials_plain' ) ) {
	/**
	 * Post text as a plain quote: no blocks markup, shortcodes or tags, at most `$words` words.
	 *
	 * @param string $text  Content or excerpt.
	 * @param int    $words Words.
	 */
	function wrbc_testimonials_plain( string $text, int $words ) {
		$text = excerpt_remove_blocks( strip_shortcodes( $text ) );
		$text = trim( preg_replace( '/\s+/', ' ', wp_strip_all_tags( $text ) ) );
		return wp_trim_words( $text, $words, '…' );
	}
}

if ( ! function_exists( 'wrbc_testimonials_item' ) ) {
	/**
	 * Card data (wrbc_testimonial_card()) for one post. Only what the card shows is read.
	 *
	 * @param WP_Post $post Post.
	 * @param array   $map  wrbc_testimonials_map().
	 * @param array   $ctx  wrbc_testimonial_ctx().
	 */
	function wrbc_testimonials_item( WP_Post $post, array $map, array $ctx ) {
		$text = static function ( $key ) use ( $post ) {
			return \Werun\BlocksCommunity\Query\Format::text( get_post_meta( $post->ID, $key, true ) );
		};

		// Quote: plain text from the post, or a field with its inline emphasis only
		// (the quote is one <p>; the card prints it through wp_kses_post too).
		$key = wrbc_testimonials_meta( $map['quote'] );
		if ( '' !== $key ) {
			$quote = wp_kses(
				strip_shortcodes( $text( $key ) ),
				array(
					'strong' => array(),
					'em'     => array(),
					'b'      => array(),
					'i'      => array(),
					'br'     => array(),
				)
			);
		} else {
			$source = ( 'excerpt' === $map['quote'] && has_excerpt( $post ) ) ? $post->post_excerpt : $post->post_content;
			$quote  = esc_html( wrbc_testimonials_plain( (string) $source, $map['words'] ) );
		}

		$key  = wrbc_testimonials_meta( $map['name'] );
		$name = '' !== $key ? $text( $key ) : wp_strip_all_tags( get_the_title( $post ) );

		$role = '';
		$key  = wrbc_testimonials_meta( $map['role'] );
		if ( '' !== $key && $ctx['showRole'] ) {
			$role = $text( $key );
		}

		$avatar = 0;
		if ( $ctx['showAvatar'] ) {
			$key    = wrbc_testimonials_meta( $map['avatar'] );
			$avatar = 'featured' === $map['avatar'] ? (int) get_post_thumbnail_id( $post ) : ( '' !== $key ? \Werun\BlocksCommunity\Query\Format::attachment_id( get_post_meta( $post->ID, $key, true ) ) : 0 );
			$avatar = ( $avatar && wp_attachment_is_image( $avatar ) ) ? $avatar : 0;
		}

		$rating = 0;
		$key    = wrbc_testimonials_meta( $map['rating'] );
		if ( '' !== $key && $ctx['showRating'] ) {
			$value  = get_post_meta( $post->ID, $key, true );
			$rating = is_numeric( $value ) ? max( 0, min( 5, (int) round( (float) $value ) ) ) : 0;
		}

		return array(
			'quote'    => $quote,
			'name'     => esc_html( $name ),
			'role'     => esc_html( $role ),
			'rating'   => $rating,
			'avatarId' => $avatar,
		);
	}
}

if ( ! function_exists( 'wrbc_testimonials_query' ) ) {
	/**
	 * The cards of a testimonials block whose source is a post type.
	 *
	 * @param array  $a       Block attributes.
	 * @param int    $post_id Post the block is shown on (0 without one).
	 * @param string $surface The block's background (wrbc_surface()), for the cards' colours.
	 * @return array{html:string,count:int,type:string}
	 */
	function wrbc_testimonials_query( array $a, int $post_id, string $surface = '' ) {
		$out = array(
			'html'  => '',
			'count' => 0,
			'type'  => '',
		);
		if ( ! class_exists( '\Werun\BlocksCommunity\Query\Runner' ) ) {
			return $out;
		}
		$config = \Werun\BlocksCommunity\Query\Config::normalize( $a['query'] ?? array() );
		// A card has no "title only" form: password-protected posts never show.
		$config['passwordPosts'] = 'exclude';
		$out['type']             = $config['postType'];

		$result = \Werun\BlocksCommunity\Query\Runner::run(
			array(
				'query'      => $config,
				'pagination' => 'none',
			),
			array(
				'page' => 1,
				'term' => null,
				'q'    => '',
				'sort' => '',
			),
			$post_id
		);
		$ids = $result['ids'];
		if ( ! $ids ) {
			return $out;
		}
		_prime_post_caches( $ids, false, true );

		$map            = wrbc_testimonials_map( $a['map'] ?? array(), $config['postType'] );
		$ctx            = wrbc_testimonial_ctx( $a );
		$ctx['surface'] = $surface;
		foreach ( $ids as $id ) {
			$post = get_post( $id );
			if ( ! $post || 'publish' !== $post->post_status || '' !== $post->post_password ) {
				continue;
			}
			$item = wrbc_testimonials_item( $post, $map, $ctx );
			// A post with nothing to quote (only blocks that aren't text, an empty field) gives no card.
			if ( '' === trim( wp_strip_all_tags( $item['quote'] ) ) ) {
				continue;
			}
			$out['html'] .= wrbc_testimonial_card( $item, $ctx );
			++$out['count'];
		}
		return $out;
	}
}
