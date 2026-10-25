<?php
/**
 * The block's view: every attribute the result region needs (query, card,
 * layout, carousel, map, gate, visitor filters, pagination, texts), checked
 * and clamped. It is what render.php, the editor preview and the public
 * REST route render from, and what the signed token carries.
 *
 * Twin (enums and limits): src/query/constants.js.
 *
 * @package werun-blocks-community
 */

namespace Werun\BlocksCommunity\Query;

defined( 'ABSPATH' ) || exit;

/**
 * View.
 */
final class View {

	public const LAYOUTS     = array( 'grid', 'list', 'carousel', 'map' );
	public const CARD_STYLES = array( 'plain', 'bordered', 'filled', 'shadow' );
	public const CARD_LINKS  = array( 'card', 'title', 'button', 'none' );
	public const RATIOS      = array( 'auto', '1/1', '4/3', '3/2', '16/9', '3/4', '2/3' );
	public const FIELD_TYPES = array( 'title', 'image', 'date', 'excerpt', 'terms', 'author', 'meta', 'button', 'readingTime' );
	public const FORMATS     = array( 'text', 'number', 'currency', 'date', 'url', 'email', 'phone', 'image', 'file', 'download' );
	public const PAGINATIONS = array( 'none', 'numbers', 'prevNext', 'loadMore' );
	public const MAX_FIELDS  = 12;

	/**
	 * The view from block attributes.
	 *
	 * @param mixed $a Block attributes.
	 */
	public static function from_attributes( $a ): array {
		$a       = is_array( $a ) ? $a : array();
		$variant = in_array( $a['variant'] ?? '', Config::VARIANTS, true ) ? $a['variant'] : 'posts';
		$query   = Config::normalize( $a['query'] ?? array(), array( 'variant' => $variant ) );
		$type    = $query['postType'];
		$layout  = in_array( $a['layout'] ?? '', self::LAYOUTS, true ) ? $a['layout'] : 'grid';

		// Effective pagination (twin: effectivePagination() in constants.js):
		// a carousel and handpicked items never paginate; a map can't append.
		$pagination = in_array( $a['pagination'] ?? '', self::PAGINATIONS, true ) ? $a['pagination'] : 'none';
		if ( 'carousel' === $layout || 'handpicked' === $query['mode'] ) {
			$pagination = 'none';
		} elseif ( 'map' === $layout && 'loadMore' === $pagination ) {
			$pagination = 'numbers';
		}
		if ( 'numbers' === $pagination ) {
			// Numbered pages and an offset don't mix (twin: the editor hides offset).
			$query['offset'] = 0;
		}

		$card    = is_array( $a['card'] ?? null ) ? $a['card'] : array();
		$filters = is_array( $a['filters'] ?? null ) ? $a['filters'] : array();
		$map     = is_array( $a['map'] ?? null ) ? $a['map'] : array();
		$gate    = is_array( $a['gate'] ?? null ) ? $a['gate'] : array();

		$sorts = array();
		foreach ( (array) ( $filters['sort'] ?? array() ) as $sort ) {
			if ( is_string( $sort ) && isset( Builder::SORTS[ $sort ] ) && ! in_array( $sort, $sorts, true ) ) {
				$sorts[] = $sort;
			}
		}
		$filter_tax = Config::taxonomy_ok( $filters['taxonomy'] ?? '', $type ) ? $filters['taxonomy'] : '';
		if ( 'handpicked' === $query['mode'] ) {
			$filter_tax = '';
			$sorts      = array();
		}

		$sizes = array_merge( get_intermediate_image_sizes(), array( 'full' ) );

		return array(
			'variant'    => $variant,
			'query'      => $query,
			'layout'     => $layout,
			'cols'       => array(
				// Same ranges as ResponsiveColumns (max 4 here).
				Config::clamp( $a['columnsDesktop'] ?? 3, 1, 4 ),
				Config::clamp( $a['columnsTablet'] ?? 2, 1, 4 ),
				Config::clamp( $a['columnsMobile'] ?? 1, 1, 2 ),
			),
			'card'       => array(
				'style'      => in_array( $card['style'] ?? '', self::CARD_STYLES, true ) ? $card['style'] : 'bordered',
				'link'       => in_array( $card['link'] ?? '', self::CARD_LINKS, true ) ? $card['link'] : 'card',
				'imageRatio' => in_array( $card['imageRatio'] ?? '', self::RATIOS, true ) ? $card['imageRatio'] : '3/2',
				'imageSize'  => in_array( $card['imageSize'] ?? '', $sizes, true ) ? $card['imageSize'] : 'medium_large',
				'fields'     => self::fields( $card['fields'] ?? null, $type ),
			),
			'filters'    => array(
				'taxonomy' => $filter_tax,
				'showAll'  => array_key_exists( 'showAll', $filters ) ? (bool) $filters['showAll'] : true,
				'search'   => ! empty( $filters['search'] ) && 'handpicked' !== $query['mode'],
				'sort'     => $sorts,
			),
			'pagination' => $pagination,
			'carousel'   => array(
				'loop'             => wrbc_on( $a, 'loop', true ),
				'autoplay'         => wrbc_on( $a, 'autoplay', false ),
				'interval'         => max( 2, min( 20, is_numeric( $a['interval'] ?? null ) ? (float) $a['interval'] : 6 ) ),
				'pauseOnHover'     => wrbc_on( $a, 'pauseOnHover', true ),
				'showArrows'       => wrbc_on( $a, 'showArrows', true ),
				'showDots'         => wrbc_on( $a, 'showDots', true ),
				'controlsPosition' => 'top' === ( $a['controlsPosition'] ?? '' ) ? 'top' : 'bottom',
				'prevIcon'         => self::icon( $a['prevIcon'] ?? null, 'arrow-left' ),
				'nextIcon'         => self::icon( $a['nextIcon'] ?? null, 'arrow-right' ),
			),
			'map'        => array(
				'provider'     => in_array( $map['provider'] ?? '', array( 'default', 'leaflet', 'google' ), true ) ? $map['provider'] : 'default',
				'latKey'       => Config::meta_key_ok( $map['latKey'] ?? '', $type ) ? $map['latKey'] : '',
				'lngKey'       => Config::meta_key_ok( $map['lngKey'] ?? '', $type ) ? $map['lngKey'] : '',
				'combinedKey'  => Config::meta_key_ok( $map['combinedKey'] ?? '', $type ) ? $map['combinedKey'] : '',
				'addressKey'   => Config::meta_key_ok( $map['addressKey'] ?? '', $type ) ? $map['addressKey'] : '',
				'height'       => Config::clamp( $map['height'] ?? 420, 200, 900 ),
				'zoom'         => Config::clamp( $map['zoom'] ?? 12, 1, 20 ),
				'fitBounds'    => array_key_exists( 'fitBounds', $map ) ? (bool) $map['fitBounds'] : true,
				'cluster'      => array_key_exists( 'cluster', $map ) ? (bool) $map['cluster'] : true,
				'markerColor'  => wrbc_css_value( $map['markerColor'] ?? '' ) && preg_match( '/^#[0-9a-fA-F]{3,8}$/', (string) $map['markerColor'] ) ? (string) $map['markerColor'] : '',
				'listPosition' => in_array( $map['listPosition'] ?? '', array( 'below', 'side', 'none' ), true ) ? $map['listPosition'] : 'below',
			),
			'gate'       => array(
				'enabled' => ! empty( $gate['enabled'] ),
				// Query cards have no form of their own: always soft (a signed, short-lived link per click).
				// A form-first download is the Form block's "Gated download".
				'mode'    => 'soft',
			),
			'texts'      => array(
				'empty'  => self::label( $a['emptyText'] ?? '', 200 ),
				'all'    => self::label( $a['allLabel'] ?? '', 60 ),
				'button' => self::label( $a['buttonText'] ?? '', 60 ),
				'more'   => self::label( $a['loadMoreText'] ?? '', 60 ),
			),
		);
	}

	/** Whether visitors can change the results (pages, chips, search, sort). */
	public static function interactive( array $view ): bool {
		return 'none' !== $view['pagination'] || '' !== $view['filters']['taxonomy'] || $view['filters']['search'] || $view['filters']['sort'];
	}

	/**
	 * Card fields, checked one by one; the default set when none is given.
	 *
	 * @param mixed  $fields Raw list.
	 * @param string $type   Post type.
	 */
	public static function fields( $fields, string $type ): array {
		if ( ! is_array( $fields ) ) {
			$fields = array( array( 'type' => 'image' ), array( 'type' => 'date' ), array( 'type' => 'title' ), array( 'type' => 'excerpt' ) );
		}
		$out = array();
		foreach ( $fields as $f ) {
			if ( ! is_array( $f ) || ! in_array( $f['type'] ?? '', self::FIELD_TYPES, true ) ) {
				continue;
			}
			$field = array( 'type' => $f['type'] );
			switch ( $f['type'] ) {
				case 'title':
					$field['level'] = Config::clamp( $f['level'] ?? 3, 2, 6 );
					break;
				case 'date':
					$field['source']     = 'modified' === ( $f['source'] ?? '' ) ? 'modified' : 'published';
					$field['dateFormat'] = self::date_format( $f['dateFormat'] ?? '' );
					break;
				case 'excerpt':
					$field['words'] = Config::clamp( $f['words'] ?? 20, 5, 80 );
					break;
				case 'terms':
					if ( ! Config::taxonomy_ok( $f['taxonomy'] ?? '', $type ) ) {
						continue 2;
					}
					$field['taxonomy'] = $f['taxonomy'];
					$field['max']      = Config::clamp( $f['max'] ?? 3, 1, 10 );
					$field['link']     = ! empty( $f['link'] );
					break;
				case 'author':
					$field['avatar'] = ! empty( $f['avatar'] );
					break;
				case 'meta':
					if ( ! Config::meta_key_ok( $f['key'] ?? '', $type ) ) {
						continue 2;
					}
					$field['key']        = $f['key'];
					$field['format']     = in_array( $f['format'] ?? '', self::FORMATS, true ) ? $f['format'] : 'text';
					$field['label']      = self::label( $f['label'] ?? '', 60 );
					$field['prefix']     = self::label( $f['prefix'] ?? '', 20 );
					$field['suffix']     = self::label( $f['suffix'] ?? '', 20 );
					$field['decimals']   = Config::clamp( $f['decimals'] ?? ( 'currency' === $field['format'] ? 2 : 0 ), 0, 4 );
					$field['dateFormat'] = self::date_format( $f['dateFormat'] ?? '' );
					break;
				case 'readingTime':
					$field['wpm'] = Config::clamp( $f['wpm'] ?? 200, 100, 400 );
					break;
			}
			$out[] = $field;
			if ( count( $out ) >= self::MAX_FIELDS ) {
				break;
			}
		}
		return $out;
	}

	/**
	 * A PHP date format, letters and punctuation only.
	 *
	 * @param mixed $value Raw.
	 */
	private static function date_format( $value ): string {
		return substr( (string) preg_replace( '/[^A-Za-z\s\-\/.,:]/', '', wrbc_text( $value ) ), 0, 20 );
	}

	/**
	 * Plain text, trimmed to a length.
	 *
	 * @param mixed $value Raw.
	 * @param int   $max   Length.
	 */
	private static function label( $value, int $max ): string {
		$value = sanitize_text_field( wrbc_text( $value ) );
		return function_exists( 'mb_substr' ) ? mb_substr( $value, 0, $max ) : substr( $value, 0, $max );
	}

	/**
	 * An icon object for wrbc_icon().
	 *
	 * @param mixed  $icon     Raw.
	 * @param string $fallback Name.
	 */
	private static function icon( $icon, string $fallback ): array {
		$icon = is_array( $icon ) ? $icon : array();
		return array(
			'name'    => sanitize_key( wrbc_text( $icon['name'] ?? $fallback ) ) ?: $fallback,
			'lib'     => 'animated' === ( $icon['lib'] ?? '' ) ? 'animated' : 'lucide',
			'anim'    => sanitize_key( wrbc_text( $icon['anim'] ?? 'none' ) ),
			'trigger' => sanitize_key( wrbc_text( $icon['trigger'] ?? 'hover' ) ),
		);
	}
}
