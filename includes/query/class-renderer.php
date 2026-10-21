<?php
/**
 * The one source of markup for werun-community/query: render.php, the editor preview
 * (POST wrbc/v1/query/preview) and the public route (GET wrbc/v1/query) all
 * print what this returns, so the editor shows exactly what the page shows.
 *
 * - body(): visitor filters + result region + live status (inside the
 *   block's <section>, after the section header).
 * - region(): the inside of the result region (map, cards, empty text,
 *   pagination): what the public route returns as "html".
 *
 * @package werun-blocks-community
 */

namespace Werun\BlocksCommunity\Query;

use Werun\BlocksCommunity\Security\Signer;
use Werun\BlocksCommunity\Integrations\Integrations;

defined( 'ABSPATH' ) || exit;

/**
 * Renderer.
 */
final class Renderer {

	/** The light land colour of the default map tiles (OpenStreetMap), what a pin sits on. Twin: MAP_LAND in colors.js. */
	public const MAP_LAND = '#f2efe9';

	/**
	 * Everything render.php needs for one instance.
	 *
	 * @param array $attributes Block attributes.
	 * @param array $ctx        { postId: int, input: array|null (null = read $_GET), rest: bool, uid: string (the block's id) }.
	 * @return array{html:string,view:array,key:string,token:string,result:array}
	 */
	public static function build( array $attributes, array $ctx ): array {
		$post_id = absint( $ctx['postId'] ?? 0 );
		// Card titles one level below the section title, before signing: the
		// public route re-renders the same levels from the signed view.
		$view    = self::title_levels( View::from_attributes( $attributes ), $attributes );
		$signed  = self::payload( $view, $post_id );
		$key     = Signer::id( $signed );
		$uid     = self::uid( $ctx['uid'] ?? '', $key );
		$input   = $ctx['input'] ?? null;
		$raw     = is_array( $input ) ? $input : Request::from_get( $key );

		list( $request ) = Request::from( $view, $raw );
		$result          = Runner::run( $view, $request, $post_id );
		$rest            = ! empty( $ctx['rest'] );
		$token           = View::interactive( $view ) ? Signer::sign( $signed, 'query' ) : '';

		$html = self::filters( $view, $request, $key, $rest, $uid );
		if ( $token ) {
			// Live region for "N results", "N more loaded" and errors. Before the
			// results, so an error view.js makes visible sits next to the filters.
			$html .= '<p class="wrbc-query__status wrbc-sr-only" data-wrbc-query-status aria-live="polite" aria-atomic="true"></p>';
		}
		$html .= '<div class="wrbc-query__results" id="' . esc_attr( $uid ) . '-results" data-wrbc-query-results>';
		$html .= self::region( $view, $result, $request, $key, $post_id, $rest, $uid );
		$html .= '</div>';

		return array(
			'html'   => $html,
			'view'   => $view,
			'key'    => $key,
			'token'  => $token,
			'result' => $result,
		);
	}

	/**
	 * The level of the section title the block prints (wrbc_section_header()),
	 * or 0 when it prints none. Twin: headerTitleLevel() in panels-display.js.
	 *
	 * @param array $a Block attributes.
	 */
	public static function header_level( array $a ): int {
		if ( ! wrbc_on( $a, 'showHeader', true ) || '' === trim( wp_strip_all_tags( wrbc_text( $a['title'] ?? '' ) ) ) ) {
			return 0;
		}
		return isset( $a['titleLevel'] ) ? max( 2, min( 4, (int) $a['titleLevel'] ) ) : 2;
	}

	/**
	 * The prefix of every id an instance prints (results, cards, track,
	 * fields): the block's own id (wrbc_uid(): its anchor or a per-request
	 * one), so two blocks showing the same view on one page never share an
	 * id and their aria-controls / label references stay right. The public
	 * route gets it from view.js. Same characters as wrbc_uid() keeps.
	 *
	 * @param mixed  $uid The block's id.
	 * @param string $key Instance key (fallback).
	 */
	public static function uid( $uid, string $key ): string {
		$uid = substr( (string) preg_replace( '/[^A-Za-z0-9_:.-]/', '', wrbc_text( $uid ) ), 0, 64 );
		return '' !== $uid ? $uid : 'wrbc-q-' . $key;
	}

	/**
	 * Card titles follow the section title (WCAG 1.3.1: no card heading at or
	 * above the block's own heading, no skipped level). Without a section
	 * title the field's own level (2–6) applies.
	 *
	 * @param array $view View::from_attributes().
	 * @param array $a    Block attributes.
	 */
	private static function title_levels( array $view, array $a ): array {
		$level = self::header_level( $a );
		if ( $level ) {
			foreach ( $view['card']['fields'] as $i => $field ) {
				if ( 'title' === $field['type'] ) {
					$view['card']['fields'][ $i ]['level'] = $level + 1;
				}
			}
		}
		return $view;
	}

	/**
	 * What the token signs: the view and the post it is shown on.
	 *
	 * @param array $view    View.
	 * @param int   $post_id Post id.
	 */
	public static function payload( array $view, int $post_id ): array {
		return array(
			'v'    => 1,
			'view' => $view,
			'post' => $post_id,
		);
	}

	/**
	 * The modules this view needs on the page (handles), for render.php to enqueue.
	 *
	 * @param array $view View.
	 * @return string[]
	 */
	public static function modules( array $view ): array {
		$out = array();
		if ( 'carousel' === $view['layout'] ) {
			$out[] = 'wrbc-carousel';
		}
		if ( 'map' === $view['layout'] ) {
			$out[] = 'wrbc-map';
		}
		if ( $view['gate']['enabled'] && self::has_download( $view ) ) {
			$out[] = 'wrbc-gate';
		}
		return $out;
	}

	/** Whether a card field delivers a file through the gate. */
	public static function has_download( array $view ): bool {
		foreach ( $view['card']['fields'] as $field ) {
			if ( 'meta' === $field['type'] && 'download' === $field['format'] ) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Inside of the result region.
	 *
	 * @param array  $view    View.
	 * @param array  $result  Runner::run().
	 * @param array  $request Request.
	 * @param string $key     Instance key.
	 * @param int    $post_id Post id.
	 * @param bool   $rest    Links relative to the page (REST / preview).
	 * @param string $uid     The block's id, prefix of the ids printed here (Renderer::uid()).
	 */
	public static function region( array $view, array $result, array $request, string $key, int $post_id, bool $rest, string $uid = '' ): string {
		$uid = self::uid( $uid, $key );
		$ids = $result['ids'];
		if ( ! $ids ) {
			$text = '' !== $view['texts']['empty'] ? $view['texts']['empty'] : __( 'Nothing to show yet.', 'werun-blocks-community' );
			return '<p class="wrbc-query__empty">' . esc_html( $text ) . '</p>';
		}
		self::prime( $ids, $view );

		// "Show on the map" buttons, not for a list only screen readers get (listPosition none).
		$focus = 'map' === $view['layout'] && 'none' !== $view['map']['listPosition'] ? self::point_index( $view, $ids ) : array();
		$items = '';
		$count = 0;
		foreach ( $ids as $index => $id ) {
			$post = get_post( $id );
			if ( ! $post || 'publish' !== $post->post_status ) {
				continue;
			}
			$items .= self::item( $post, $view, $post_id, $index, $uid, $focus[ $id ] ?? null );
			++$count;
		}

		$layout = $view['layout'];
		$out    = '';
		if ( 'carousel' === $layout ) {
			$out .= self::carousel( $view, $items, $uid, $count );
		} elseif ( 'map' === $layout ) {
			$position = $view['map']['listPosition'];
			$list     = '<ul class="wrbc-query__items" role="list">' . $items . '</ul>';
			$out     .= '<div class="wrbc-query__map-layout wrbc-query__map-layout--' . esc_attr( $position ) . '">';
			// No point with coordinates (keys not chosen yet, empty fields): no map, no placeholder for nothing.
			$out     .= self::map( $view, $ids );
			// The list is always printed: without the map (no consent, no JS) it is the content.
			// "Hidden" keeps it for screen readers and shows it while a link in it has
			// keyboard focus (WCAG 2.4.7: never focus on something invisible).
			// Beside the map the list scrolls at the map's height: a named group in the
			// tab order, so the keyboard can scroll it even when the cards hold no
			// link (WCAG 2.1.1); view.js keeps that only while it really overflows.
			if ( 'none' === $position ) {
				$out .= '<div class="wrbc-query__map-list wrbc-query__map-list--hidden">' . $list . '</div>';
			} elseif ( 'side' === $position ) {
				$out .= '<div class="wrbc-query__map-list" role="group" aria-label="' . esc_attr( self::type_label( $view ) ) . '" tabindex="0" data-wrbc-query-scroller>' . $list . '</div>';
			} else {
				$out .= '<div class="wrbc-query__map-list">' . $list . '</div>';
			}
			$out .= '</div>';
		} else {
			$out .= '<ul class="wrbc-query__items" role="list">' . $items . '</ul>';
		}

		return $out . self::pagination( $view, $result, $request, $key, $rest );
	}

	/**
	 * Loads posts, meta, terms and thumbnails for every card in a few queries.
	 *
	 * @param int[] $ids  Post ids.
	 * @param array $view View.
	 */
	private static function prime( array $ids, array $view ): void {
		_prime_post_caches( $ids, false, true );
		update_object_term_cache( $ids, $view['query']['postType'] );
		$thumbs = array();
		foreach ( $ids as $id ) {
			$thumb = (int) get_post_meta( $id, '_thumbnail_id', true );
			if ( $thumb ) {
				$thumbs[] = $thumb;
			}
		}
		if ( $thumbs ) {
			_prime_post_caches( $thumbs, false, true );
		}
	}

	/**
	 * One card in its list item.
	 *
	 * @param \WP_Post $post    Post.
	 * @param array    $view    View.
	 * @param int      $page_id Post the block is on.
	 * @param int      $index   Position.
	 * @param string   $uid     The block's id (id prefix).
	 * @param int|null $point   Index of its pin on the map.
	 */
	private static function item( \WP_Post $post, array $view, int $page_id, int $index, string $uid, ?int $point = null ): string {
		$card       = $view['card'];
		$link       = $card['link'];
		$url        = get_permalink( $post );
		$title      = wp_strip_all_tags( get_the_title( $post ) );
		$title      = '' !== trim( $title ) ? $title : __( '(no title)', 'werun-blocks-community' );
		$protected  = '' !== $post->post_password;
		$fields     = $card['fields'];
		$has_title  = false;
		foreach ( $fields as $f ) {
			$has_title = $has_title || 'title' === $f['type'];
		}
		if ( $protected ) {
			// Password posts (only with "title only"): title and link, nothing else.
			$fields    = array( array( 'type' => 'title', 'level' => self::title_level( $fields ) ) );
			$has_title = true;
		}

		$media = '';
		$body  = '';
		// Events: the date and whether it's upcoming, happening or past, right
		// under the title (or first, without one).
		$event = $protected ? '' : self::event( $post, $view, $fields );
		foreach ( $fields as $i => $field ) {
			$part = self::field( $field, $post, $view, $url, $title, $page_id );
			if ( '' === $part ) {
				continue;
			}
			if ( 'image' === $field['type'] && 0 === $i ) {
				$media = $part;
			} else {
				$body .= $part;
			}
			if ( '' !== $event && 'title' === $field['type'] ) {
				$body .= $event;
				$event = '';
			}
		}
		$body = $event . $body;
		if ( 'card' === $link && ! $has_title ) {
			$body .= '<a class="wrbc-query__stretched" href="' . esc_url( $url ) . '"><span class="wrbc-sr-only">' . esc_html( $title ) . '</span></a>';
		}
		if ( 'map' === $view['layout'] && ! $protected ) {
			// The list is the map's text alternative (WCAG 1.1.1): it carries the
			// address the pin's popup shows, unless a card field prints it already.
			$body .= self::address( $post, $view, $fields );
		}
		if ( null !== $point ) {
			// wrbc-map moves the map to this point and opens its popup.
			$body .= '<p class="wrbc-query__locate"><button type="button" class="wrbc-query__locate-btn" data-wrbc-map-focus="' . (int) $point . '">' . wrbc_icon( 'map-pin' ) . '<span>' . esc_html__( 'Show on the map', 'werun-blocks-community' ) . '<span class="wrbc-sr-only">: ' . esc_html( $title ) . '</span></span></button></p>';
		}

		$classes = array( 'wrbc-query__card' );
		if ( 'card' === $link ) {
			$classes[] = 'is-card-link';
		}
		if ( $media ) {
			$classes[] = 'has-media';
		}
		if ( $protected ) {
			$classes[] = 'is-protected';
		}
		// Carousel slides are <div>s in a <div> track: wrbc-carousel makes each
		// one a "slide, 3 of 8" group (the carousel replaces the list semantics).
		$tag   = 'carousel' === $view['layout'] ? 'div' : 'li';
		$slide = 'carousel' === $view['layout'] ? ' data-wrbc-slide' : '';
		return sprintf(
			'<%8$s class="wrbc-query__item"%1$s data-wrbc-index="%2$d"><article class="%3$s" id="%4$s-item-%5$d">%6$s<div class="wrbc-query__body">%7$s</div></article></%8$s>',
			$slide,
			(int) $index,
			esc_attr( implode( ' ', $classes ) ),
			esc_attr( $uid ),
			(int) $post->ID,
			$media,
			$body,
			$tag
		);
	}

	/**
	 * A location's address for the list next to the map: the map's address
	 * field, or the address of a combined (ACF map) field. '' when a meta
	 * field of the card already shows that key, or there is none.
	 *
	 * @param \WP_Post $post   Post.
	 * @param array    $view   View.
	 * @param array    $fields Card fields.
	 */
	private static function address( \WP_Post $post, array $view, array $fields ): string {
		$map = $view['map'];
		foreach ( $fields as $field ) {
			if ( 'meta' === $field['type'] && in_array( $field['key'], array_filter( array( $map['addressKey'], $map['combinedKey'] ) ), true ) ) {
				return '';
			}
		}
		$address = '';
		if ( '' !== $map['addressKey'] ) {
			$address = Format::text( get_post_meta( $post->ID, $map['addressKey'], true ) );
		} elseif ( '' !== $map['combinedKey'] ) {
			$point   = Format::point( (int) $post->ID, $map );
			$address = $point['address'] ?? '';
		}
		$address = trim( wp_strip_all_tags( $address ) );
		return '' === $address ? '' : '<address class="wrbc-query__address">' . esc_html( $address ) . '</address>';
	}

	/**
	 * An event's date and state for its card, when the query lists events by
	 * their date field (orderBy "upcoming"): "Upcoming", "Happening now" or
	 * "Past event" in words (never only a colour, WCAG 1.4.1), and the start
	 * (and end) date in <time> elements, unless a card field already prints
	 * the start date. '' for other queries or without a readable start date.
	 *
	 * @param \WP_Post $post   Event.
	 * @param array    $view   View.
	 * @param array    $fields Card fields.
	 */
	private static function event( \WP_Post $post, array $view, array $fields ): string {
		$q = $view['query'];
		if ( 'upcoming' !== $q['orderBy'] || '' === $q['upcoming']['startKey'] ) {
			return '';
		}
		$u     = $q['upcoming'];
		$start = Format::date( get_post_meta( $post->ID, $u['startKey'], true ) );
		if ( ! $start ) {
			return '';
		}
		$end = '' !== $u['endKey'] ? Format::date( get_post_meta( $post->ID, $u['endKey'], true ) ) : null;
		$end = $end && $end >= $start ? $end : null;
		// Days in the site's time zone, as the upcoming window counts them (Builder).
		$today = wp_date( 'Y-m-d' );
		$from  = $start->format( 'Y-m-d' );
		$to    = $end ? $end->format( 'Y-m-d' ) : $from;
		if ( $to < $today ) {
			$state = 'past';
			$label = __( 'Past event', 'werun-blocks-community' );
		} elseif ( $from > $today ) {
			$state = 'upcoming';
			$label = __( 'Upcoming', 'werun-blocks-community' );
		} else {
			$state = 'now';
			$label = __( 'Happening now', 'werun-blocks-community' );
		}

		$date = '';
		$shown = false;
		foreach ( $fields as $f ) {
			$shown = $shown || ( 'meta' === $f['type'] && $u['startKey'] === $f['key'] && 'date' === $f['format'] );
		}
		if ( ! $shown ) {
			$format = (string) get_option( 'date_format' );
			$date   = '<time datetime="' . esc_attr( $from ) . '">' . esc_html( wp_date( $format, $start->getTimestamp() ) ) . '</time>';
			if ( $end && $to !== $from ) {
				$date .= ' <span aria-hidden="true">–</span><span class="wrbc-sr-only">' . esc_html_x( 'to', 'date range', 'werun-blocks-community' ) . '</span> '
					. '<time datetime="' . esc_attr( $to ) . '">' . esc_html( wp_date( $format, $end->getTimestamp() ) ) . '</time>';
			}
			$date = ' <span class="wrbc-query__event-date">' . $date . '</span>';
		}
		return '<p class="wrbc-query__event wrbc-query__event--' . $state . '"><span class="wrbc-query__event-state">' . esc_html( $label ) . '</span>' . $date . '</p>';
	}

	/**
	 * What the cards paint, and how their colours stay readable on it
	 * (docs/accessibility.md). A card's background is the block's card colour
	 * (not on plain cards), else its style's (shadow: white; filled: 4 % of
	 * the text colour); a transparent card shows the block's surface.
	 * - class wrbc-query--cards-dark|light + --wrbc-card-text: the cards' own text
	 *   colour. With a text colour chosen on the block: that colour where it
	 *   reads on the card, else the closest one that does (wrbc_readable_color(),
	 *   the stored value untouched). Without one: white or ink (wrbc_on_color())
	 *   when the card's background is the author's card colour or of the other
	 *   tone than the surface (white shadow cards in a dark section).
	 *   --wrbc-card-muted where 76/85 % of that text is under 4.5:1 (mid-tones);
	 * - --wrbc-card-accent-text (+ wrbc-query--cards-accent without a tone class):
	 *   the accent as text and focus ring made readable on the card when the
	 *   block's own (made for the surface) doesn't fit;
	 * - --wrbc-query-term: term chips' text, the accent made readable on its
	 *   12 % tint over the card.
	 * They go on the block root, not on each card, so the cards the public
	 * route sends later get them too. Twin: cardColors() in src/query/colors.js.
	 *
	 * @param array  $a       Block attributes.
	 * @param string $style   Card style (View: plain, bordered, filled, shadow).
	 * @param string $surface What the block sits on (wrbc_surface()).
	 * @return array{ class: string, vars: array }
	 */
	public static function card_colors( array $a, string $style, string $surface ): array {
		$white = array( 255.0, 255.0, 255.0, 1.0 );
		$under = wrbc_color_rgba( $surface );
		$under = null === $under ? $white : wrbc_color_over( $under, $white );
		$bg    = null;
		if ( 'plain' !== $style ) {
			$bg = wrbc_color_rgba( wrbc_text( $a['cardBg'] ?? '' ) );
			if ( null === $bg && 'shadow' === $style ) {
				$bg = $white;
			} elseif ( null === $bg && 'filled' === $style ) {
				// --wrbc-surface: 4 % of the text colour, light on a dark surface and dark on a light one.
				$bg = true === wrbc_is_dark_color( $under ) ? array( 255.0, 255.0, 255.0, 0.04 ) : array( 0.0, 0.0, 0.0, 0.04 );
			}
		}
		$under_hex = wrbc_color_hex( $under );
		$bg_hex    = null === $bg ? $under_hex : wrbc_color_hex( wrbc_color_over( $bg, $under ) );
		$dark      = wrbc_is_dark_color( $bg_hex );

		$class  = '';
		$vars   = array();
		$kept   = wrbc_block_colors( $a )['text'];
		$picked = 'plain' !== $style && null !== wrbc_color_rgba( wrbc_text( $a['cardBg'] ?? '' ) );
		$card_text = '';
		if ( '' !== $kept ) {
			// The block's text colour stays where it reads on the cards.
			$card_text = wrbc_contrast_ratio( $kept, $bg_hex ) < WERUN_BLOCKS_COMMUNITY_AA_TEXT ? wrbc_readable_color( $kept, $bg_hex, WERUN_BLOCKS_COMMUNITY_AA_TEXT ) : '';
		} elseif ( $picked || $dark !== wrbc_is_dark_color( $under_hex ) ) {
			$card_text = wrbc_on_color( $bg_hex );
		}
		if ( '' !== $card_text ) {
			$class = 'wrbc-query--cards-' . ( $dark ? 'dark' : 'light' );
			$muted = wrbc_color_mix( wrbc_color_rgba( $bg_hex ), wrbc_color_rgba( $card_text ), $dark ? 0.85 : 0.76 );

			$vars['--wrbc-card-text'] = $card_text;
			if ( wrbc_contrast_ratio( $muted, $bg_hex ) < WERUN_BLOCKS_COMMUNITY_AA_TEXT ) {
				$vars['--wrbc-card-muted'] = $card_text;
			}
		}

		$accent = wrbc_text( $a['accentColor'] ?? '' );
		$base   = '' !== $accent && null !== wrbc_color_rgba( $accent ) ? $accent : WERUN_BLOCKS_COMMUNITY_ACCENT;
		$text   = wrbc_readable_color( $base, $bg_hex, WERUN_BLOCKS_COMMUNITY_AA_TEXT );
		if ( '' !== $class || strtolower( $text ) !== strtolower( wrbc_readable_color( $base, $under_hex, WERUN_BLOCKS_COMMUNITY_AA_TEXT ) ) ) {
			$vars['--wrbc-card-accent-text'] = $text;
			$class                          = '' !== $class ? $class : 'wrbc-query--cards-accent';
		}
		$rgb  = wrbc_color_rgba( $base );
		$tint = wrbc_color_over( array( $rgb[0], $rgb[1], $rgb[2], 0.12 ), wrbc_color_rgba( $bg_hex ) );
		$term = wrbc_readable_color( $base, wrbc_color_hex( $tint ), WERUN_BLOCKS_COMMUNITY_AA_TEXT );
		if ( strtolower( $term ) !== strtolower( $text ) ) {
			$vars['--wrbc-query-term'] = $term;
		}
		return array(
			'class' => $class,
			'vars'  => $vars,
		);
	}

	/** Heading level of the first title field (3 without one). */
	private static function title_level( array $fields ): int {
		foreach ( $fields as $f ) {
			if ( 'title' === $f['type'] ) {
				return (int) $f['level'];
			}
		}
		return 3;
	}

	/**
	 * One field of a card.
	 *
	 * @param array    $field   Field.
	 * @param \WP_Post $post    Post.
	 * @param array    $view    View.
	 * @param string   $url     Permalink.
	 * @param string   $title   Plain title.
	 * @param int      $page_id Post the block is on.
	 */
	private static function field( array $field, \WP_Post $post, array $view, string $url, string $title, int $page_id ): string {
		$link = $view['card']['link'];
		switch ( $field['type'] ) {
			case 'title':
				$level = (int) $field['level'];
				$text  = esc_html( $title );
				if ( 'card' === $link ) {
					$text = '<a class="wrbc-query__stretched" href="' . esc_url( $url ) . '">' . $text . '</a>';
				} elseif ( 'title' === $link ) {
					// A class: a heading link is no link in running text (the shared underline rule skips wrbc-*).
					$text = '<a class="wrbc-query__title-link" href="' . esc_url( $url ) . '">' . $text . '</a>';
				}
				return sprintf( '<h%1$d class="wrbc-query__title">%2$s</h%1$d>', $level, $text );

			case 'image':
				$thumb = (int) get_post_thumbnail_id( $post );
				if ( ! $thumb ) {
					return '';
				}
				// The title next to it (or the card link's name) already names the
				// card: the image is decorative. A card without either is named by
				// its image: the image's alt text, else the item's title (WCAG 1.1.1).
				$named = 'card' === $view['card']['link'];
				foreach ( $view['card']['fields'] as $f ) {
					$named = $named || 'title' === $f['type'];
				}
				$alt = '';
				if ( ! $named ) {
					$alt = trim( wp_strip_all_tags( (string) get_post_meta( $thumb, '_wp_attachment_image_alt', true ) ) );
					$alt = '' !== $alt ? $alt : $title;
				}
				$img = wp_get_attachment_image(
					$thumb,
					$view['card']['imageSize'],
					false,
					array(
						'class'   => 'wrbc-query__img',
						'loading' => 'lazy',
						'alt'     => $alt,
					)
				);
				if ( ! $img ) {
					return '';
				}
				$ratio = $view['card']['imageRatio'];
				$style = 'auto' === $ratio ? '' : ' style="aspect-ratio:' . esc_attr( str_replace( '/', ' / ', $ratio ) ) . '"';
				// A <div>, not a <figure>: the image is decorative and has no caption,
				// so a figure would only add an empty "figure" for screen readers.
				return '<div class="wrbc-query__media"' . $style . '>' . $img . '</div>';

			case 'date':
				$format = '' !== $field['dateFormat'] ? $field['dateFormat'] : get_option( 'date_format' );
				$mod    = 'modified' === $field['source'];
				$text   = $mod ? get_the_modified_date( $format, $post ) : get_the_date( $format, $post );
				$iso    = $mod ? get_the_modified_date( 'c', $post ) : get_the_date( 'c', $post );
				return '<p class="wrbc-query__date"><time datetime="' . esc_attr( $iso ) . '">' . esc_html( $text ) . '</time></p>';

			case 'excerpt':
				$source = has_excerpt( $post ) ? $post->post_excerpt : $post->post_content;
				$text   = wp_trim_words( wp_strip_all_tags( strip_shortcodes( $source ) ), (int) $field['words'], '…' );
				return '' === trim( $text ) ? '' : '<p class="wrbc-query__excerpt">' . esc_html( $text ) . '</p>';

			case 'terms':
				$terms = get_the_terms( $post, $field['taxonomy'] );
				if ( ! is_array( $terms ) || ! $terms ) {
					return '';
				}
				$items = '';
				foreach ( array_slice( $terms, 0, (int) $field['max'] ) as $term ) {
					$href   = $field['link'] ? get_term_link( $term ) : '';
					$items .= ( $href && ! is_wp_error( $href ) )
						? '<li><a class="wrbc-query__term" href="' . esc_url( $href ) . '">' . esc_html( $term->name ) . '</a></li>'
						: '<li><span class="wrbc-query__term">' . esc_html( $term->name ) . '</span></li>';
				}
				return '<ul class="wrbc-query__terms" role="list">' . $items . '</ul>';

			case 'author':
				$author = (int) $post->post_author;
				$name   = $author ? get_the_author_meta( 'display_name', $author ) : '';
				if ( '' === $name ) {
					return '';
				}
				$avatar = $field['avatar'] ? get_avatar( $author, 32, '', '', array( 'class' => 'wrbc-query__avatar' ) ) : '';
				return '<p class="wrbc-query__author">' . $avatar . '<span>' . esc_html( $name ) . '</span></p>';

			case 'readingTime':
				$words   = str_word_count( wp_strip_all_tags( strip_shortcodes( $post->post_content ) ) );
				$minutes = max( 1, (int) ceil( $words / (int) $field['wpm'] ) );
				/* translators: %d: minutes */
				return '<p class="wrbc-query__reading">' . esc_html( sprintf( _n( '%d min read', '%d min read', $minutes, 'werun-blocks-community' ), $minutes ) ) . '</p>';

			case 'button':
				$text = '' !== $view['texts']['button'] ? $view['texts']['button'] : __( 'Read more', 'werun-blocks-community' );
				return '<p class="wrbc-query__action"><a class="wrbc-btn wrbc-btn--outline wrbc-query__button" href="' . esc_url( $url ) . '">' . esc_html( $text ) . '<span class="wrbc-sr-only">: ' . esc_html( $title ) . '</span></a></p>';

			case 'meta':
				return self::meta( $field, $post, $view, $title, $page_id );
		}
		return '';
	}

	/**
	 * A meta field, formatted.
	 *
	 * @param array    $field   Field.
	 * @param \WP_Post $post    Post.
	 * @param array    $view    View.
	 * @param string   $title   Plain title.
	 * @param int      $page_id Post the block is on.
	 */
	private static function meta( array $field, \WP_Post $post, array $view, string $title, int $page_id ): string {
		$value  = get_post_meta( $post->ID, $field['key'], true );
		$format = $field['format'];
		$html   = Format::value( $value, $field );
		$gated  = false;
		if ( in_array( $format, array( 'file', 'download' ), true ) ) {
			$attachment = Format::attachment_id( $value );
			if ( ! $attachment ) {
				return '';
			}
			if ( 'download' === $format && $view['gate']['enabled'] ) {
				$html  = self::gate( $post, $attachment, $page_id, $view, $title );
				$gated = true;
			}
		}
		if ( '' === $html ) {
			return '';
		}
		$label = '' !== $field['label'] ? '<span class="wrbc-query__meta-label">' . esc_html( $field['label'] ) . '</span> ' : '';
		// The gate holds a block-level status box (and wrbc-gate adds the link and
		// messages to it): a <div>, not a <p>.
		$tag = $gated ? 'div' : 'p';
		return '<' . $tag . ' class="wrbc-query__meta wrbc-query__meta--' . esc_attr( $format ) . '">' . $label . $html . '</' . $tag . '>';
	}

	/**
	 * Gated download: a signed ticket in the wrbc-gate markup instead of the
	 * file URL. includes/gate/ (form owner) verifies it with
	 * Signer::verify( $ticket, 'gate' ) and hands out the file after unlock.
	 *
	 * Ticket payload: r = resource post id, p = page id the block is on,
	 * f = attachment id, n = random nonce (8 chars), m = hard|soft,
	 * exp = +2 hours.
	 *
	 * @param \WP_Post $post       Resource.
	 * @param int      $attachment Attachment id.
	 * @param int      $page_id    Page id.
	 * @param array    $view       View.
	 * @param string   $title      Plain title.
	 */
	private static function gate( \WP_Post $post, int $attachment, int $page_id, array $view, string $title ): string {
		$ticket = Signer::sign(
			array(
				'r' => (int) $post->ID,
				'p' => $page_id,
				'f' => $attachment,
				'n' => wp_generate_password( 8, false ),
				// Read by includes/gate (Gate::read_ticket): hard needs the form's own check.
				'm' => $view['gate']['mode'],
			),
			'gate',
			2 * HOUR_IN_SECONDS
		);
		$data   = wp_json_encode(
			array(
				'ticket'   => $ticket,
				'mode'     => $view['gate']['mode'],
				'provider' => '',
				// Texts wrbc-gate shows (translated here, its fallbacks are English).
				'labels'   => array(
					'download'  => __( 'Download the file', 'werun-blocks-community' ),
					'unlocking' => __( 'Preparing your download…', 'werun-blocks-community' ),
					'error'     => __( 'The download could not be unlocked. Please try again.', 'werun-blocks-community' ),
				),
			)
		);
		// The button needs wrbc-gate: printed hidden, wrbc-gate shows it (soft mode).
		// The status box exists before anything is written to it, so screen
		// readers announce "Preparing…", the link and errors (WCAG 4.1.3).
		return '<div class="wrbc-query__gate" data-wrbc-gate="' . esc_attr( $data ) . '">'
			. '<button type="button" class="wrbc-btn wrbc-query__gate-btn" data-wrbc-gate-skip hidden>' . esc_html__( 'Get the file', 'werun-blocks-community' ) . '<span class="wrbc-sr-only">: ' . esc_html( $title ) . '</span></button>'
			. '<div class="wrbc-query__gate-result" data-wrbc-gate-result role="status"></div>'
			. '<noscript><span class="wrbc-query__gate-nojs">' . esc_html__( 'Turn on JavaScript to download this file.', 'werun-blocks-community' ) . '</span></noscript>'
			. '</div>';
	}

	/**
	 * Carousel markup (wrbc-carousel contract).
	 *
	 * @param array  $view  View.
	 * @param string $items Slides.
	 * @param string $uid   The block's id (id prefix).
	 * @param int    $count Number of slides.
	 */
	private static function carousel( array $view, string $items, string $uid, int $count ): string {
		$c        = $view['carousel'];
		$root_id  = $uid . '-carousel';
		$track_id = $root_id . '-track';
		$top      = 'top' === $c['controlsPosition'];
		$style    = wrbc_css_vars(
			array(
				'--wrbc-pv-d' => $view['cols'][0],
				'--wrbc-pv-t' => $view['cols'][1],
				'--wrbc-pv-m' => $view['cols'][2],
			)
		);

		$name = self::type_label( $view );
		// Shared helpers (includes/modules/carousel.php) when present, the same markup otherwise.
		if ( function_exists( 'wrbc_carousel_attrs' ) ) {
			$attrs = wrbc_carousel_attrs( $c, array( 'label' => $name ) );
		} else {
			$attrs = array(
				'aria-roledescription' => __( 'carousel', 'werun-blocks-community' ),
				'data-wrbc-carousel'    => wp_json_encode(
					array(
						'loop'         => $c['loop'],
						'autoplay'     => $c['autoplay'],
						'interval'     => $c['interval'],
						'pauseOnHover' => $c['pauseOnHover'],
						'labels'       => array(
							'slide'      => __( 'slide', 'werun-blocks-community' ),
							/* translators: %d: slide number */
							'dotLabel'   => __( 'Go to slide %d', 'werun-blocks-community' ),
							/* translators: 1: slide number, 2: number of slides */
							'slideLabel' => __( '%1$d of %2$d', 'werun-blocks-community' ),
							'play'       => __( 'Play the slides', 'werun-blocks-community' ),
							'pause'      => __( 'Pause the slides', 'werun-blocks-community' ),
						),
					)
				),
			);
		}
		if ( function_exists( 'wrbc_carousel_controls' ) ) {
			$controls = (string) wrbc_carousel_controls(
				array(
					'attributes' => $c,
					'track_id'   => $track_id,
					'prefix'     => 'wrbc-query',
				)
			);
		} else {
			$controls = self::carousel_controls( $c, $track_id );
		}

		// The root is the carousel (wrbc-carousel contract: role, the "carousel"
		// role description, a name), named after what it shows ("Team members,
		// carousel"). A group, not a region: the block's own <section> is already
		// the landmark named by the title, a second one would repeat it.
		$attrs['role']       = 'group';
		$attrs['aria-label'] = $name;
		unset( $attrs['aria-labelledby'] );
		$html_attrs = '';
		foreach ( $attrs as $attr => $value ) {
			$html_attrs .= ' ' . sanitize_key( $attr ) . '="' . esc_attr( (string) $value ) . '"';
		}
		// A scroller is a named group in the tab order, so the arrow keys scroll it
		// even when the cards hold no link (wrbc-carousel drops the Tab stop when
		// every slide has a link of its own). One slide has nothing to scroll.
		$track_a11y = '';
		if ( $count > 1 ) {
			$track_a11y = ' role="group" tabindex="0" aria-label="' . esc_attr(
				sprintf(
					/* translators: %s: what the slides are, e.g. "Posts" or "Team members" */
					__( '%s, use the arrow keys to move', 'werun-blocks-community' ),
					$name
				)
			) . '"';
		}
		$track = '<div class="wrbc-carousel__track wrbc-query__items" id="' . esc_attr( $track_id ) . '" data-wrbc-track' . $track_a11y . '>' . $items . '</div>';
		return '<div class="wrbc-carousel wrbc-carousel--controls-' . ( $top ? 'top' : 'bottom' ) . ' wrbc-query__carousel" id="' . esc_attr( $root_id ) . '"' . $html_attrs . ' style="' . esc_attr( $style ) . '">'
			. ( $top ? $controls : '' ) . $track . ( $top ? '' : $controls ) . '</div>';
	}

	/**
	 * What the items are, for accessible names: the post type's plural label.
	 *
	 * @param array $view View.
	 */
	private static function type_label( array $view ): string {
		$type  = get_post_type_object( $view['query']['postType'] );
		$label = $type ? trim( wp_strip_all_tags( (string) $type->labels->name ) ) : '';
		return '' !== $label ? $label : __( 'Items', 'werun-blocks-community' );
	}

	/**
	 * Controls row like wrbc_carousel_controls() (prefix wrbc-query), for builds without the modules area.
	 *
	 * @param array  $c        Carousel settings.
	 * @param string $track_id Track id.
	 */
	private static function carousel_controls( array $c, string $track_id ): string {
		if ( ! $c['showArrows'] && ! $c['showDots'] && ! $c['autoplay'] ) {
			return '';
		}
		$cls = static function ( $element ) {
			return 'wrbc-carousel__' . $element . ' wrbc-query__' . $element;
		};
		$out = '<div class="' . $cls( 'controls' ) . '">';
		if ( $c['autoplay'] ) {
			$out .= '<button type="button" class="' . $cls( 'btn' ) . ' ' . $cls( 'play' ) . '" data-wrbc-play aria-label="' . esc_attr__( 'Pause the slides', 'werun-blocks-community' ) . '">' . wrbc_icon( 'pause', array( 'class' => $cls( 'when-playing' ) ) ) . wrbc_icon( 'play', array( 'class' => $cls( 'when-paused' ) ) ) . '</button>';
		}
		if ( $c['showDots'] ) {
			$out .= '<div class="' . $cls( 'dots' ) . '" role="group" aria-label="' . esc_attr__( 'Choose a slide', 'werun-blocks-community' ) . '" data-wrbc-dots></div>';
		}
		if ( $c['showArrows'] ) {
			$out .= '<div class="' . $cls( 'arrows' ) . '">'
				. '<button type="button" class="' . $cls( 'btn' ) . ' wrbc-anim-host" data-wrbc-prev aria-controls="' . esc_attr( $track_id ) . '" aria-label="' . esc_attr__( 'Previous slide', 'werun-blocks-community' ) . '">' . wrbc_icon( $c['prevIcon'] ) . '</button>'
				. '<button type="button" class="' . $cls( 'btn' ) . ' wrbc-anim-host" data-wrbc-next aria-controls="' . esc_attr( $track_id ) . '" aria-label="' . esc_attr__( 'Next slide', 'werun-blocks-community' ) . '">' . wrbc_icon( $c['nextIcon'] ) . '</button>'
				. '</div>';
		}
		return $out . '</div>';
	}

	/**
	 * Map markup (wrbc-map contract), with the consent placeholder.
	 *
	 * @param array $view View.
	 * @param int[] $ids  Post ids.
	 */
	private static function map( array $view, array $ids ): string {
		$m      = $view['map'];
		$points = array();
		foreach ( $ids as $id ) {
			$point = Format::point( $id, $m );
			if ( $point ) {
				$point['title'] = wp_strip_all_tags( get_the_title( $id ) );
				$point['url']   = get_permalink( $id );
				$points[]       = $point;
			}
		}
		return $points ? self::map_markup( $view, $points ) : '';
	}

	/**
	 * Points of the posts that have coordinates, post id => index in the map.
	 *
	 * @param array $view View.
	 * @param int[] $ids  Post ids.
	 */
	private static function point_index( array $view, array $ids ): array {
		$out = array();
		foreach ( $ids as $id ) {
			if ( Format::point( $id, $view['map'] ) ) {
				$out[ $id ] = count( $out );
			}
		}
		return $out;
	}

	/**
	 * The map element.
	 *
	 * @param array $view   View.
	 * @param array $points Points.
	 */
	private static function map_markup( array $view, array $points ): string {
		$m = $view['map'];
		$provider = 'default' === $m['provider'] ? (string) Integrations::get( 'maps.provider', 'leaflet' ) : $m['provider'];
		if ( 'google' === $provider && '' === (string) Integrations::get( 'maps.google_key', '' ) ) {
			$provider = 'leaflet';
		}
		$host    = 'google' === $provider ? 'maps.googleapis.com' : (string) wp_parse_url( (string) Integrations::get( 'maps.tiles', '' ), PHP_URL_HOST );
		// No tile server set in Integrations: wrbc-map loads OpenStreetMap's, so the placeholder names it.
		$host    = '' !== $host ? $host : 'tile.openstreetmap.org';
		// Where the list is, for the error message (a hidden list can't be pointed at).
		$errors  = array(
			'below' => __( 'The map could not be loaded. The locations are listed below.', 'werun-blocks-community' ),
			'side'  => __( 'The map could not be loaded. The locations are listed next to it.', 'werun-blocks-community' ),
			'none'  => __( 'The map could not be loaded.', 'werun-blocks-community' ),
		);
		$options = array(
			'provider'    => $provider,
			'zoom'        => $m['zoom'],
			'fitBounds'   => $m['fitBounds'],
			'cluster'     => $m['cluster'],
			'height'      => $m['height'],
			// The pins carry meaning: the author's colour, made 3:1 against the map's
			// light land colour when it isn't (WCAG 1.4.11; the stored value stays).
			'markerColor' => '' !== $m['markerColor'] ? wrbc_readable_color( $m['markerColor'], self::MAP_LAND, WERUN_BLOCKS_COMMUNITY_AA_UI ) : '',
			'labels'      => array(
				'map'     => __( 'Map of the locations listed', 'werun-blocks-community' ),
				'error'   => $errors[ $m['listPosition'] ] ?? $errors['below'],
				/* translators: %d: number of a pin that has no title or address */
				'point'   => __( 'Location %d', 'werun-blocks-community' ),
				/* translators: %d: number of locations grouped under one pin */
				'cluster' => __( '%d locations, zoom in', 'werun-blocks-community' ),
			),
		);
		$label   = __( 'Load the map', 'werun-blocks-community' );
		if ( function_exists( 'wrbc_consent_placeholder' ) ) {
			$placeholder = (string) wrbc_consent_placeholder( 'maps', $host, $label );
		} else {
			/* translators: 1: "Load the map", 2: host name */
			$placeholder = '<button type="button" class="wrbc-consent wrbc-query__consent" data-wrbc-consent-load="maps">' . esc_html( sprintf( __( '%1$s (from %2$s)', 'werun-blocks-community' ), $label, $host ) ) . '</button>';
		}
		$json = wp_json_encode( $points, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT );
		// No landmark here: wrbc-map names the map itself (a region, labels.map) once
		// it loads; a second region around it would announce the same thing twice.
		return '<div class="wrbc-query__map" data-wrbc-map="' . esc_attr( (string) wp_json_encode( $options ) ) . '" style="--wrbc-map-h:' . (int) $m['height'] . 'px">'
			. '<script type="application/json" data-wrbc-map-points>' . $json . '</script>'
			. $placeholder
			. '</div>';
	}

	/**
	 * Term chips, search box and sort select.
	 *
	 * @param array  $view    View.
	 * @param array  $request Request.
	 * @param string $key     Instance key.
	 * @param bool   $rest    Relative links.
	 * @param string $uid     The block's id (id prefix).
	 */
	private static function filters( array $view, array $request, string $key, bool $rest, string $uid ): string {
		$f   = $view['filters'];
		$out = '';
		if ( '' !== $f['taxonomy'] ) {
			$limit = Request::chip_limit( $view );
			$terms = get_terms(
				array(
					'taxonomy'   => $f['taxonomy'],
					'hide_empty' => true,
					'include'    => $limit,
					'number'     => 30,
					'orderby'    => $limit ? 'include' : 'name',
				)
			);
			$tax   = get_taxonomy( $f['taxonomy'] );
			if ( is_array( $terms ) && $terms ) {
				$active = $request['term']['id'] ?? 0;
				$base   = array(
					'q'    => $request['q'],
					'sort' => $request['sort'],
				);
				/* translators: %s: taxonomy name, e.g. "Departments" */
				$out .= '<nav class="wrbc-query__chips" aria-label="' . esc_attr( sprintf( __( 'Filter by %s', 'werun-blocks-community' ), $tax ? $tax->labels->name : '' ) ) . '"><ul role="list">';
				if ( $f['showAll'] ) {
					$all  = '' !== $view['texts']['all'] ? $view['texts']['all'] : __( 'All', 'werun-blocks-community' );
					$out .= '<li><a class="wrbc-query__chip" data-wrbc-query-term="0" href="' . esc_url( self::url( $key, $base, $rest ) ) . '"' . ( $active ? '' : ' aria-current="true"' ) . '>' . esc_html( $all ) . '</a></li>';
				}
				foreach ( $terms as $term ) {
					$current = (int) $term->term_id === (int) $active;
					$out    .= '<li><a class="wrbc-query__chip" data-wrbc-query-term="' . (int) $term->term_id . '" href="' . esc_url( self::url( $key, array_merge( $base, array( 'term' => $term->term_id ) ), $rest ) ) . '"' . ( $current ? ' aria-current="true"' : '' ) . '>' . esc_html( $term->name ) . '</a></li>';
				}
				$out .= '</ul></nav>';
			}
		}

		if ( $f['search'] || $f['sort'] ) {
			$action = $rest ? '' : remove_query_arg( self::params( $key ) );
			// A search landmark only with the search box, named after what it searches
			// (two blocks on a page give two different names).
			$role   = $f['search']
				/* translators: %s: what is searched, e.g. "Resources" */
				? ' role="search" aria-label="' . esc_attr( sprintf( __( 'Search %s', 'werun-blocks-community' ), self::type_label( $view ) ) ) . '"'
				: '';
			$out   .= '<form class="wrbc-query__tools" method="get"' . $role . ' action="' . esc_url( $action ) . '" data-wrbc-query-form>';
			if ( $request['term'] ) {
				$out .= '<input type="hidden" name="wrbc_t_' . esc_attr( $key ) . '" value="' . (int) $request['term']['id'] . '">';
			}
			// A GET form drops the query string of its action: keep the page's other
			// parameters (plain permalinks, other blocks' state) as hidden fields.
			if ( ! $rest ) {
				$out .= self::keep_params( $key );
			}
			if ( $f['search'] ) {
				$id   = $uid . '-search';
				// The magnifier stays visible once the placeholder is gone (WCAG 3.3.2);
				// the label names the field for screen readers.
				$out .= '<p class="wrbc-query__search"><label class="wrbc-sr-only" for="' . esc_attr( $id ) . '">' . esc_html__( 'Search', 'werun-blocks-community' ) . '</label>'
					. wrbc_icon( 'search', array( 'class' => 'wrbc-query__search-icon' ) )
					. '<input type="search" id="' . esc_attr( $id ) . '" name="wrbc_q_' . esc_attr( $key ) . '" value="' . esc_attr( $request['q'] ) . '" minlength="2" maxlength="100" placeholder="' . esc_attr__( 'Search…', 'werun-blocks-community' ) . '" data-wrbc-query-search></p>';
			}
			if ( $f['sort'] ) {
				$labels = self::sort_labels();
				$id     = $uid . '-sort';
				$out   .= '<p class="wrbc-query__sort"><label for="' . esc_attr( $id ) . '">' . esc_html__( 'Sort by', 'werun-blocks-community' ) . '</label> <select id="' . esc_attr( $id ) . '" name="wrbc_s_' . esc_attr( $key ) . '" data-wrbc-query-sort>';
				$out   .= '<option value="">' . esc_html__( 'Default', 'werun-blocks-community' ) . '</option>';
				foreach ( $f['sort'] as $sort ) {
					$out .= '<option value="' . esc_attr( $sort ) . '"' . selected( $request['sort'], $sort, false ) . '>' . esc_html( $labels[ $sort ] ) . '</option>';
				}
				$out .= '</select></p>';
			}
			$out .= '<button type="submit" class="wrbc-btn wrbc-btn--outline wrbc-query__apply">' . esc_html__( 'Apply', 'werun-blocks-community' ) . '</button></form>';
		}

		return '' === $out ? '' : '<div class="wrbc-query__filters">' . $out . '</div>';
	}

	/**
	 * Hidden fields for the current URL's parameters, minus this instance's.
	 *
	 * @param string $key Instance key.
	 */
	private static function keep_params( string $key ): string {
		$out  = '';
		$skip = self::params( $key );
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- echoed back escaped, read-only.
		foreach ( array_slice( $_GET, 0, 20, true ) as $name => $value ) {
			if ( ! is_string( $name ) || ! is_string( $value ) || in_array( $name, $skip, true ) || ! preg_match( '/^[A-Za-z0-9_\-]{1,64}$/', $name ) ) {
				continue;
			}
			$out .= '<input type="hidden" name="' . esc_attr( $name ) . '" value="' . esc_attr( sanitize_text_field( wp_unslash( $value ) ) ) . '">';
		}
		return $out;
	}

	/** Visitor sort labels. */
	public static function sort_labels(): array {
		return array(
			'newest'  => __( 'Newest first', 'werun-blocks-community' ),
			'oldest'  => __( 'Oldest first', 'werun-blocks-community' ),
			'az'      => __( 'Title, A to Z', 'werun-blocks-community' ),
			'za'      => __( 'Title, Z to A', 'werun-blocks-community' ),
			'updated' => __( 'Recently updated', 'werun-blocks-community' ),
		);
	}

	/**
	 * Pagination: numbers, previous/next or "load more".
	 *
	 * @param array  $view    View.
	 * @param array  $result  Result.
	 * @param array  $request Request.
	 * @param string $key     Instance key.
	 * @param bool   $rest    Relative links.
	 */
	private static function pagination( array $view, array $result, array $request, string $key, bool $rest ): string {
		$mode  = $view['pagination'];
		$pages = (int) $result['pages'];
		$page  = (int) $result['page'];
		if ( 'none' === $mode || $pages < 2 ) {
			return '';
		}
		$base = array(
			'term' => $request['term']['id'] ?? 0,
			'q'    => $request['q'],
			'sort' => $request['sort'],
		);
		$link = function ( $n ) use ( $key, $base, $rest ) {
			return esc_url( self::url( $key, array_merge( $base, array( 'page' => $n ) ), $rest ) );
		};

		if ( 'loadMore' === $mode ) {
			if ( $page >= $pages ) {
				return '';
			}
			$text = '' !== $view['texts']['more'] ? $view['texts']['more'] : __( 'Load more', 'werun-blocks-community' );
			return '<nav class="wrbc-query__pagination wrbc-query__pagination--more" aria-label="' . esc_attr__( 'More results', 'werun-blocks-community' ) . '"><a class="wrbc-btn wrbc-btn--outline wrbc-query__more" href="' . $link( $page + 1 ) . '" data-wrbc-query-page="' . ( $page + 1 ) . '" data-wrbc-query-more>' . esc_html( $text ) . '</a></nav>';
		}

		$out = '<nav class="wrbc-query__pagination wrbc-query__pagination--' . esc_attr( strtolower( $mode ) ) . '" aria-label="' . esc_attr__( 'Pagination', 'werun-blocks-community' ) . '"><ul role="list">';
		// "Previous page" / "Next page" for screen readers; the name holds the visible word (WCAG 2.5.3).
		if ( $page > 1 ) {
			$out .= '<li><a class="wrbc-query__page wrbc-query__prev" rel="prev" href="' . $link( $page - 1 ) . '" data-wrbc-query-page="' . ( $page - 1 ) . '" aria-label="' . esc_attr__( 'Previous page', 'werun-blocks-community' ) . '">' . wrbc_icon( 'chevron-left' ) . '<span>' . esc_html__( 'Previous', 'werun-blocks-community' ) . '</span></a></li>';
		}
		if ( 'numbers' === $mode ) {
			$last = 0;
			for ( $n = 1; $n <= $pages; $n++ ) {
				if ( 1 !== $n && $pages !== $n && abs( $n - $page ) > 1 ) {
					continue;
				}
				if ( $last && $n - $last > 1 ) {
					$out .= '<li><span class="wrbc-query__gap" aria-hidden="true">…</span></li>';
				}
				$out .= $n === $page
					/* translators: %d: page number */
					? '<li><span class="wrbc-query__page is-current" aria-current="page"><span class="wrbc-sr-only">' . esc_html__( 'Page', 'werun-blocks-community' ) . ' </span>' . $n . '</span></li>'
					: '<li><a class="wrbc-query__page" href="' . $link( $n ) . '" data-wrbc-query-page="' . $n . '"><span class="wrbc-sr-only">' . esc_html__( 'Page', 'werun-blocks-community' ) . ' </span>' . $n . '</a></li>';
				$last = $n;
			}
		} else {
			/* translators: 1: current page, 2: number of pages */
			$out .= '<li><span class="wrbc-query__count">' . esc_html( sprintf( __( 'Page %1$d of %2$d', 'werun-blocks-community' ), $page, $pages ) ) . '</span></li>';
		}
		if ( $page < $pages ) {
			$out .= '<li><a class="wrbc-query__page wrbc-query__next" rel="next" href="' . $link( $page + 1 ) . '" data-wrbc-query-page="' . ( $page + 1 ) . '" aria-label="' . esc_attr__( 'Next page', 'werun-blocks-community' ) . '"><span>' . esc_html__( 'Next', 'werun-blocks-community' ) . '</span>' . wrbc_icon( 'chevron-right' ) . '</a></li>';
		}
		return $out . '</ul></nav>';
	}

	/** The four no-JS parameter names of an instance. */
	public static function params( string $key ): array {
		return array( 'wrbc_p_' . $key, 'wrbc_t_' . $key, 'wrbc_q_' . $key, 'wrbc_s_' . $key );
	}

	/**
	 * A link to a state of the instance. On the page: the current URL with
	 * the instance's parameters replaced; from REST: a relative "?…".
	 *
	 * @param string $key   Instance key.
	 * @param array  $state { page, term, q, sort }.
	 * @param bool   $rest  Relative.
	 */
	public static function url( string $key, array $state, bool $rest ): string {
		$args = array();
		if ( ! empty( $state['page'] ) && (int) $state['page'] > 1 ) {
			$args[ 'wrbc_p_' . $key ] = (int) $state['page'];
		}
		if ( ! empty( $state['term'] ) ) {
			$args[ 'wrbc_t_' . $key ] = (int) $state['term'];
		}
		if ( ! empty( $state['q'] ) ) {
			$args[ 'wrbc_q_' . $key ] = rawurlencode( (string) $state['q'] );
		}
		if ( ! empty( $state['sort'] ) ) {
			$args[ 'wrbc_s_' . $key ] = (string) $state['sort'];
		}
		if ( $rest ) {
			return $args ? '?' . build_query( $args ) : '?';
		}
		return add_query_arg( $args, remove_query_arg( self::params( $key ) ) );
	}
}
