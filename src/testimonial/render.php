<?php
/**
 * Testimonial: one quote, its author and rating. The markup is
 * wrbc_testimonial_card() (card.php), the same the testimonials block prints
 * for each post when its source is a post type.
 *
 * @var array    $attributes Block attributes.
 * @var string   $content    Unused.
 * @var WP_Block $block      Block instance.
 *
 * @package werun-blocks-community
 */

defined( 'ABSPATH' ) || exit;

require_once __DIR__ . '/card.php';

$a   = $attributes;
$ctx = array();
foreach ( (array) $block->context as $key => $value ) {
	if ( 0 === strpos( (string) $key, 'werun-community/testimonials/' ) ) {
		$ctx[ substr( (string) $key, strlen( 'werun-community/testimonials/' ) ) ] = $value;
	}
}
// What the cards sit on: the testimonials block's background, or the one around it.
$ctx['surface'] = wrbc_context_background( $block );

echo wrbc_testimonial_card( // phpcs:ignore -- escaped inside
	array(
		'id'         => wrbc_uid( $a, 'wrbc-testi' ),
		'wrapper'    => 'block',
		'quote'      => $a['quote'] ?? '',
		'name'       => $a['name'] ?? '',
		'role'       => $a['role'] ?? '',
		'rating'     => $a['rating'] ?? 0,
		'avatarId'   => $a['avatarId'] ?? 0,
		'avatarUrl'  => $a['avatarUrl'] ?? '',
		'hideRating' => ! empty( $a['hideRating'] ),
		'hideAvatar' => ! empty( $a['hideAvatar'] ),
		'ownBg'      => wrbc_block_colors( $a )['background'],
		'ownText'    => wrbc_block_colors( $a )['text'],
	),
	wrbc_testimonial_ctx( $ctx )
);
