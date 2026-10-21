<?php
/**
 * Render context: the background each block is drawn on, so a block knows
 * it sits inside a dark section, group or cover even when the colour
 * belongs to an ancestor (wrbc_context_background(), wrbc_surface()).
 *
 * A block that paints a background (wrbc_block_surface()) pushes it when
 * WordPress starts rendering it — render_block_data runs before its inner
 * blocks render — and pops it when it's done (render_block, the last thing
 * WP_Block::render() does). Entries carry an id, so a render that skips a
 * filter can't leave a stale colour behind for the next block.
 *
 * Editor twin: useSurface() in src/shared/contrast.js (reads the parents
 * from the block editor store).
 *
 * @package werun-blocks-community
 */

defined( 'ABSPATH' ) || exit;

/**
 * The context stack: array( array( id, colour ), … ).
 *
 * @param string     $op    get | push | pop.
 * @param array|int  $entry Entry to push, or id to pop (with everything above it).
 */
function wrbc_context_stack( $op = 'get', $entry = null ) {
	static $stack = array();
	if ( 'push' === $op && is_array( $entry ) ) {
		$stack[] = $entry;
	} elseif ( 'pop' === $op ) {
		for ( $i = count( $stack ) - 1; $i >= 0; $i-- ) {
			if ( $stack[ $i ][0] === $entry ) {
				array_splice( $stack, $i );
				break;
			}
		}
	}
	return $stack;
}

/**
 * The background around a block: the nearest painted ancestor's, or the
 * page's. A block's render.php runs after its inner blocks and before it
 * pops its own entry, so pass $block to look past its own background.
 *
 * @param WP_Block|null $block The block asking (its own entry is skipped).
 */
function wrbc_context_background( $block = null ) {
	$stack = wrbc_context_stack();
	$own   = ( $block instanceof WP_Block && isset( $block->parsed_block['wrbcContext'] ) ) ? (int) $block->parsed_block['wrbcContext'] : 0;
	for ( $i = count( $stack ) - 1; $i >= 0; $i-- ) {
		if ( $own && $stack[ $i ][0] >= $own ) {
			continue;
		}
		return $stack[ $i ][1];
	}
	return wrbc_page_colors()['background'];
}

add_filter( 'render_block_data', 'wrbc_context_push', 20 );
/**
 * Pushes the background of a block that paints one. Runs after the other
 * render_block_data filters (priority 20), so it sees the final attributes.
 *
 * @param array $parsed_block Block being rendered.
 */
function wrbc_context_push( $parsed_block ) {
	static $next = 0;
	if ( ! is_array( $parsed_block ) || empty( $parsed_block['blockName'] ) ) {
		return $parsed_block;
	}
	$surface = wrbc_block_surface( $parsed_block['attrs'] ?? array(), (string) $parsed_block['blockName'] );
	if ( '' !== $surface ) {
		$id                         = ++$next;
		$parsed_block['wrbcContext'] = $id;
		wrbc_context_stack( 'push', array( $id, $surface ) );
	}
	return $parsed_block;
}

add_filter( 'render_block', 'wrbc_context_pop', 999, 2 );
/**
 * Pops it once the block (and everything inside it) has rendered.
 *
 * @param string $content      Rendered block.
 * @param array  $parsed_block Block that rendered.
 */
function wrbc_context_pop( $content, $parsed_block ) {
	if ( isset( $parsed_block['wrbcContext'] ) ) {
		wrbc_context_stack( 'pop', (int) $parsed_block['wrbcContext'] );
	}
	return $content;
}

add_filter( 'render_block', 'wrbc_mark_link_color', 10, 2 );
/**
 * Adds wrbc-has-link-color to a werun block whose Color panel sets a link
 * colour (normal or hover): WordPress only prints wp-elements-N, and the
 * shared dark-context link rule (assets/shared.css) must leave the
 * author's colour alone. Editor twin: src/shared/editor-hooks.js.
 *
 * @param string $content      Rendered block.
 * @param array  $parsed_block Block that rendered.
 */
function wrbc_mark_link_color( $content, $parsed_block ) {
	if ( '' === $content || 0 !== strpos( (string) ( $parsed_block['blockName'] ?? '' ), 'werun-community/' ) ) {
		return $content;
	}
	$link = $parsed_block['attrs']['style']['elements']['link'] ?? null;
	if ( ! is_array( $link ) || ( empty( $link['color']['text'] ) && empty( $link[':hover']['color']['text'] ) ) ) {
		return $content;
	}
	$tags = new WP_HTML_Tag_Processor( $content );
	if ( $tags->next_tag() ) {
		$tags->add_class( 'wrbc-has-link-color' );
		return $tags->get_updated_html();
	}
	return $content;
}
