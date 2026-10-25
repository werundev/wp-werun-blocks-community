<?php
/**
 * Table of contents: the headings of a post, and ids for the ones that
 * have none.
 *
 * Toc::headings() walks the post's blocks (inner blocks and synced patterns
 * too) in document order and gives every heading an id: its own (HTML
 * anchor) when it has one, otherwise sanitize_title() of its text, made
 * unique on the page. The werun-community/toc block lists them; the render_block
 * filter below writes the generated ids into the headings, so the links
 * land. It only runs on a singular view while that post's content renders,
 * and only when the content holds a werun-community/toc block (or a TOC already
 * rendered on the page, e.g. in a template); it never replaces an id.
 *
 * Twin of the editor preview: src/toc/headings.js.
 *
 * @package werun-blocks-community
 */

namespace Werun\BlocksCommunity\Toc;

defined( 'ABSPATH' ) || exit;

final class Toc {

	/** Class that keeps a heading out of every table of contents. */
	const SKIP_CLASS = 'wrbc-toc-skip';

	/** Synced patterns followed inside each other, at most. */
	const MAX_PATTERN_DEPTH = 3;

	/** @var array<int, array> Headings per post id. */
	private static $cache = array();

	/** @var array<int, array<string, string[]>> Generated ids per post, by heading key, in document order. */
	private static $generated = array();

	/** @var array<int, array<string, string[]>> Of those, the ones still to write in this rendering of the content. */
	private static $pending = array();

	/** @var int[] Stack of "is this the_content call the queried post's?" (the_content can nest). */
	private static $stack = array();

	/** @var bool A werun-community/toc block rendered on this request. */
	private static $toc_rendered = false;

	public static function register() {
		add_filter( 'the_content', array( __CLASS__, 'content_start' ), 8 );
		add_filter( 'the_content', array( __CLASS__, 'content_end' ), 10 );
		add_filter( 'render_block_core/heading', array( __CLASS__, 'add_id' ), 10, 2 );
	}

	/** Called by the werun-community/toc block when it renders. */
	public static function mark_rendered() {
		self::$toc_rendered = true;
	}

	/**
	 * Headings of a post, in document order.
	 *
	 * @param int $post_id Post id.
	 * @return array[] { level: int, text: string, id: string, skip: bool }
	 */
	public static function headings( $post_id ) {
		$post_id = (int) $post_id;
		if ( isset( self::$cache[ $post_id ] ) ) {
			return self::$cache[ $post_id ];
		}
		$post = $post_id ? get_post( $post_id ) : null;
		if ( ! $post ) {
			return array();
		}

		$found = array();
		self::walk( parse_blocks( (string) $post->post_content ), $found, 0, array() );

		// Ids the page already uses first, so a generated one never repeats them.
		$used = array();
		foreach ( $found as $heading ) {
			if ( '' !== $heading['id'] ) {
				$used[ $heading['id'] ] = true;
			}
		}
		$pending = array();
		foreach ( $found as $i => $heading ) {
			if ( '' !== $heading['id'] ) {
				continue;
			}
			$base = sanitize_title( $heading['text'] );
			$base = '' !== $base ? $base : 'section';
			$id   = $base;
			for ( $n = 2; isset( $used[ $id ] ); $n++ ) {
				$id = $base . '-' . $n;
			}
			$used[ $id ]       = true;
			$found[ $i ]['id'] = $id;
			if ( '' !== $heading['key'] ) {
				$pending[ $heading['key'] ][] = $id;
			}
		}
		foreach ( $found as $i => $heading ) {
			unset( $found[ $i ]['key'] );
		}

		self::$generated[ $post_id ] = $pending;
		self::$cache[ $post_id ]     = $found;
		return $found;
	}

	/**
	 * Collects headings from a block list, depth first.
	 *
	 * @param array $blocks   Parsed blocks.
	 * @param array $found    Headings so far.
	 * @param int   $depth    Synced-pattern depth.
	 * @param int[] $patterns Pattern ids already open (no loops).
	 */
	private static function walk( array $blocks, array &$found, $depth, array $patterns ) {
		foreach ( $blocks as $block ) {
			$name  = isset( $block['blockName'] ) ? (string) $block['blockName'] : '';
			$attrs = isset( $block['attrs'] ) && is_array( $block['attrs'] ) ? $block['attrs'] : array();

			if ( 'core/heading' === $name ) {
				$heading = self::core_heading( $block );
				if ( $heading ) {
					$found[] = $heading;
				}
			} elseif ( 0 === strpos( $name, 'werun-community/' ) ) {
				$heading = self::werun_heading( $name, $attrs );
				if ( $heading ) {
					$found[] = $heading;
				}
			} elseif ( 'core/block' === $name && ! empty( $attrs['ref'] ) && $depth < self::MAX_PATTERN_DEPTH ) {
				$ref     = (int) $attrs['ref'];
				$pattern = get_post( $ref );
				if ( $pattern && 'wp_block' === $pattern->post_type && 'publish' === $pattern->post_status && ! in_array( $ref, $patterns, true ) ) {
					self::walk( parse_blocks( (string) $pattern->post_content ), $found, $depth + 1, array_merge( $patterns, array( $ref ) ) );
				}
			}

			if ( ! empty( $block['innerBlocks'] ) && is_array( $block['innerBlocks'] ) ) {
				self::walk( $block['innerBlocks'], $found, $depth, $patterns );
			}
		}
	}

	/** A core/heading as an entry: its id when it has one, the key the filter matches it by. */
	private static function core_heading( array $block ) {
		$attrs = isset( $block['attrs'] ) && is_array( $block['attrs'] ) ? $block['attrs'] : array();
		$html  = isset( $block['innerHTML'] ) ? (string) $block['innerHTML'] : '';
		$text  = self::plain( $html );
		if ( '' === $text ) {
			return null;
		}
		$level = isset( $attrs['level'] ) ? max( 1, min( 6, (int) $attrs['level'] ) ) : 2;

		$id = '';
		$p  = new \WP_HTML_Tag_Processor( $html );
		if ( $p->next_tag() && preg_match( '/^H[1-6]$/', $p->get_tag() ) ) {
			$id = trim( (string) $p->get_attribute( 'id' ) );
		}

		return array(
			'level' => $level,
			'text'  => $text,
			'id'    => $id,
			'skip'  => self::has_skip_class( $attrs ),
			'key'   => '' === $id ? self::key( $block ) : '',
		);
	}

	/**
	 * The title of a werun block's section header (or the hero heading). Its
	 * id is "<anchor>-title" / "<anchor>-heading", so only blocks with an
	 * HTML anchor are listed: without one the id is generated per request.
	 * Twin: wrbc_section_header() and src/hero/render.php.
	 */
	private static function werun_heading( $name, array $attrs ) {
		$anchor = preg_replace( '/[^A-Za-z0-9_:.-]/', '', wrbc_text( $attrs['anchor'] ?? '' ) );
		if ( '' === $anchor ) {
			return null;
		}
		$type = \WP_Block_Type_Registry::get_instance()->get_registered( $name );
		if ( ! $type ) {
			return null;
		}
		$a = $type->prepare_attributes_for_render( $attrs );

		if ( isset( $type->attributes['showHeader'], $type->attributes['title'] ) ) {
			if ( empty( $a['showHeader'] ) ) {
				return null;
			}
			$text  = self::plain( wrbc_text( $a['title'] ?? '' ) );
			$level = isset( $a['titleLevel'] ) ? max( 2, min( 4, (int) $a['titleLevel'] ) ) : 2;
			$id    = $anchor . '-title';
		} elseif ( 'werun-community/hero' === $name ) {
			$text  = self::plain( wrbc_text( $a['heading'] ?? '' ) );
			$level = max( 1, min( 3, (int) ( $a['headingLevel'] ?? 1 ) ) );
			$id    = $anchor . '-heading';
		} else {
			return null;
		}
		if ( '' === $text ) {
			return null;
		}
		return array(
			'level' => $level,
			'text'  => $text,
			'id'    => $id,
			'skip'  => self::has_skip_class( $attrs ),
			'key'   => '',
		);
	}

	private static function has_skip_class( array $attrs ) {
		$classes = preg_split( '/\s+/', wrbc_text( $attrs['className'] ?? '' ) );
		return in_array( self::SKIP_CLASS, $classes, true );
	}

	/** Text of some HTML, entities decoded, whitespace collapsed. */
	private static function plain( $html ) {
		$text = html_entity_decode( wp_strip_all_tags( (string) $html ), ENT_QUOTES | ENT_HTML5, 'UTF-8' );
		return trim( preg_replace( '/\s+/u', ' ', $text ) );
	}

	/** What a heading is matched by when it renders: level and saved text. */
	private static function key( array $block ) {
		$level = isset( $block['attrs']['level'] ) ? (int) $block['attrs']['level'] : 2;
		return $level . '|' . md5( self::plain( $block['innerHTML'] ?? '' ) );
	}

	/** Whether the ids are written on this view, for this post. */
	private static function wanted( $post_id ) {
		if ( ! $post_id || ! is_singular() || (int) get_queried_object_id() !== (int) $post_id ) {
			return false;
		}
		return self::$toc_rendered || has_block( 'werun-community/toc', $post_id );
	}

	/**
	 * the_content, before do_blocks() (priority 9): opens the window in which
	 * headings get their ids.
	 *
	 * @param string $content Post content.
	 */
	public static function content_start( $content ) {
		$post_id = (int) get_the_ID();
		$on      = self::wanted( $post_id );
		if ( $on && ! in_array( $post_id, self::$stack, true ) ) {
			// Every rendering of the content starts over (a plugin may run
			// the_content once before the page does, e.g. for a description).
			self::headings( $post_id );
			self::$pending[ $post_id ] = self::$generated[ $post_id ] ?? array();
		}
		self::$stack[] = $on ? $post_id : 0;
		return $content;
	}

	/** the_content, after do_blocks(): closes it. */
	public static function content_end( $content ) {
		array_pop( self::$stack );
		return $content;
	}

	/**
	 * render_block_core/heading: writes the generated id into a heading of
	 * the post being rendered that has none.
	 *
	 * @param string $html  Rendered heading.
	 * @param array  $block Parsed block.
	 */
	public static function add_id( $html, $block ) {
		$post_id = self::$stack ? (int) end( self::$stack ) : 0;
		if ( ! $post_id || empty( self::$pending[ $post_id ] ) || ! is_string( $html ) || '' === $html ) {
			return $html;
		}
		$key = self::key( is_array( $block ) ? $block : array() );
		if ( empty( self::$pending[ $post_id ][ $key ] ) ) {
			return $html;
		}
		$p = new \WP_HTML_Tag_Processor( $html );
		if ( ! $p->next_tag() || ! preg_match( '/^H[1-6]$/', $p->get_tag() ) || null !== $p->get_attribute( 'id' ) ) {
			return $html;
		}
		$p->set_attribute( 'id', array_shift( self::$pending[ $post_id ][ $key ] ) );
		return $p->get_updated_html();
	}
}
