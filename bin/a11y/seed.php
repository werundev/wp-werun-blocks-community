<?php
/**
 * Seeds the fixture content for the werun.Blocks.Community a11y harness. Idempotent:
 * every item has a stable key (_wrbc_a11y_key) and is updated in place on
 * re-runs (event dates move with today). Everything created carries
 * _wrbc_a11y_fixture = 1 (post meta / term meta) so cleanup.php removes it.
 *
 *   cd <wp root> && wp eval-file <harness>/seed.php [images]
 *     images  regenerate the PNG / PDF / video files even when they exist
 *
 * Needs the mu-plugin (wp-content/mu-plugins/wrbc-a11y-fixtures.php) for the
 * fixture post types. Prints a JSON summary between @@WRB_JSON@@ markers.
 *
 * @package wrbc-a11y-fixtures
 */

defined( 'ABSPATH' ) || exit;

if ( ! function_exists( 'wrbc_a11y_fixtures_enabled' ) || ! wrbc_a11y_fixtures_enabled() ) {
	WP_CLI::error( 'The wrbc-a11y-fixtures mu-plugin is not active on this site (copy harness/fixtures-mu.php to wp-content/mu-plugins/wrbc-a11y-fixtures.php).' );
}

require_once ABSPATH . 'wp-admin/includes/image.php';
require_once ABSPATH . 'wp-admin/includes/file.php';
require_once ABSPATH . 'wp-admin/includes/media.php';

// wp eval-file runs this file inside a function: shared state lives in $GLOBALS.
$GLOBALS['wrbc_force_files'] = in_array( 'images', (array) ( $args ?? array() ), true );
$admin           = get_users( array( 'role' => 'administrator', 'number' => 1, 'orderby' => 'ID', 'fields' => 'ID' ) );
wp_set_current_user( $admin ? (int) $admin[0] : 0 );
kses_remove_filters();

$GLOBALS['wrbc_stats'] = array(
	'created' => 0,
	'updated' => 0,
	'files'   => 0,
	'terms'   => 0,
);

/* ── Helpers ─────────────────────────────────────────────────────────── */

/** Post id by fixture key (any type, any status), or 0. */
function wrbc_a11y_find( $key ) {
	global $wpdb;
	// phpcs:ignore WordPress.DB.DirectDatabaseQuery
	return (int) $wpdb->get_var( $wpdb->prepare( "SELECT post_id FROM {$wpdb->postmeta} WHERE meta_key = '_wrbc_a11y_key' AND meta_value = %s ORDER BY post_id ASC LIMIT 1", $key ) );
}

/** Marks a post / attachment as fixture content. */
function wrbc_a11y_mark( $id, $key ) {
	update_post_meta( $id, '_wrbc_a11y_fixture', 1 );
	update_post_meta( $id, '_wrbc_a11y_key', $key );
}

/** A term (created and marked when missing), parent by name. */
function wrbc_a11y_term( $taxonomy, $name, $parent = '' ) {
	global $wrbc_stats;
	$parent_id = 0;
	if ( '' !== $parent ) {
		$parent_id = wrbc_a11y_term( $taxonomy, $parent );
	}
	$found = term_exists( $name, $taxonomy, $parent_id ? $parent_id : null );
	if ( $found ) {
		return (int) ( is_array( $found ) ? $found['term_id'] : $found );
	}
	$made = wp_insert_term( $name, $taxonomy, array( 'parent' => $parent_id ) );
	if ( is_wp_error( $made ) ) {
		WP_CLI::warning( "term $taxonomy/$name: " . $made->get_error_message() );
		return 0;
	}
	update_term_meta( (int) $made['term_id'], '_wrbc_a11y_fixture', 1 );
	++$wrbc_stats['terms'];
	return (int) $made['term_id'];
}

/**
 * Creates or updates a fixture post.
 *
 * @param string $key  Stable key.
 * @param array  $post wp_insert_post() fields (post_type required).
 * @param array  $meta Meta key => value.
 * @param array  $tax  Taxonomy => term ids.
 * @param int    $thumb Featured image id (0 = none).
 */
function wrbc_a11y_post( $key, array $post, array $meta = array(), array $tax = array(), $thumb = 0 ) {
	global $wrbc_stats;
	$id   = wrbc_a11y_find( $key );
	if ( $id && 'attachment' === get_post_type( $id ) ) {
		WP_CLI::error( "fixture key $key belongs to an attachment: post and file keys must differ" );
	}
	$post = array_merge(
		array(
			'post_status'  => 'publish',
			'post_author'  => get_current_user_id(),
			'post_content' => '',
			'post_excerpt' => '',
		),
		$post
	);
	if ( $id ) {
		$post['ID'] = $id;
		$result     = wp_update_post( wp_slash( $post ), true );
		++$wrbc_stats['updated'];
	} else {
		$result = wp_insert_post( wp_slash( $post ), true );
		++$wrbc_stats['created'];
	}
	if ( is_wp_error( $result ) ) {
		WP_CLI::warning( "$key: " . $result->get_error_message() );
		return 0;
	}
	$id = (int) $result;
	wrbc_a11y_mark( $id, $key );
	foreach ( $meta as $k => $v ) {
		update_post_meta( $id, $k, $v );
	}
	foreach ( $tax as $taxonomy => $terms ) {
		wp_set_object_terms( $id, array_map( 'intval', (array) $terms ), $taxonomy, false );
	}
	if ( $thumb ) {
		set_post_thumbnail( $id, $thumb );
	} else {
		delete_post_thumbnail( $id );
	}
	return $id;
}

/** The uploads folder of the fixtures. */
function wrbc_a11y_dir() {
	$up  = wp_upload_dir();
	$dir = trailingslashit( $up['basedir'] ) . 'wrbc-a11y';
	wp_mkdir_p( $dir );
	return array( $dir, trailingslashit( $up['baseurl'] ) . 'wrbc-a11y' );
}

/**
 * Creates (or reuses) an attachment from a file the callback writes.
 *
 * @param string   $key   Stable key.
 * @param string   $name  File name (with extension).
 * @param string   $mime  Mime type.
 * @param string   $title Attachment title.
 * @param string   $alt   Alt text (images).
 * @param callable $write function( $path ): bool.
 */
function wrbc_a11y_file( $key, $name, $mime, $title, $alt, callable $write ) {
	global $wrbc_stats, $wrbc_force_files;
	list( $dir, $url ) = wrbc_a11y_dir();
	$path              = $dir . '/' . $name;
	$id                = wrbc_a11y_find( $key );
	if ( $id && ! $wrbc_force_files && file_exists( (string) get_attached_file( $id ) ) ) {
		update_post_meta( $id, '_wp_attachment_image_alt', $alt );
		return $id;
	}
	if ( ! $write( $path ) || ! file_exists( $path ) ) {
		WP_CLI::warning( "could not write $name" );
		return 0;
	}
	++$wrbc_stats['files'];
	$fields = array(
		'post_mime_type' => $mime,
		'post_title'     => $title,
		'post_content'   => '',
		'post_status'    => 'inherit',
		'guid'           => $url . '/' . $name,
	);
	if ( $id ) {
		$fields['ID'] = $id;
	}
	$id = wp_insert_attachment( $fields, $path, 0, true );
	if ( is_wp_error( $id ) ) {
		WP_CLI::warning( "$name: " . $id->get_error_message() );
		return 0;
	}
	if ( 0 === strpos( $mime, 'image/' ) ) {
		wp_update_attachment_metadata( $id, wp_generate_attachment_metadata( $id, $path ) );
	} else {
		wp_update_attachment_metadata( $id, array( 'filesize' => filesize( $path ) ) );
	}
	update_post_meta( $id, '_wp_attachment_image_alt', $alt );
	wrbc_a11y_mark( $id, $key );
	return (int) $id;
}

/** A TTF font for GD, or '' (built-in bitmap font then). */
function wrbc_a11y_font( $bold = true ) {
	$candidates = $bold
		? array( '/System/Library/Fonts/Supplemental/Arial Bold.ttf', '/Library/Fonts/Arial Bold.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' )
		: array( '/System/Library/Fonts/Supplemental/Arial.ttf', '/Library/Fonts/Arial.ttf', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf' );
	foreach ( $candidates as $file ) {
		if ( file_exists( $file ) ) {
			return $file;
		}
	}
	return '';
}

/** Hex → GD colour (alpha 0–127). */
function wrbc_a11y_color( $im, $hex, $alpha = 0 ) {
	$hex = ltrim( $hex, '#' );
	return imagecolorallocatealpha( $im, hexdec( substr( $hex, 0, 2 ) ), hexdec( substr( $hex, 2, 2 ) ), hexdec( substr( $hex, 4, 2 ) ), $alpha );
}

/** Text with a TTF font (or the bitmap font scaled), anchored at x/baseline y; 'center' x centres it. */
function wrbc_a11y_text( $im, $text, $size, $x, $y, $hex, $bold = true ) {
	$font  = wrbc_a11y_font( $bold );
	$color = wrbc_a11y_color( $im, $hex );
	if ( $font && function_exists( 'imagettftext' ) ) {
		$box = imagettfbbox( $size, 0, $font, $text );
		$w   = abs( $box[2] - $box[0] );
		if ( 'center' === $x ) {
			$x = (int) ( ( imagesx( $im ) - $w ) / 2 );
		}
		imagettftext( $im, $size, 0, (int) $x, (int) $y, $color, $font, $text );
		return $w;
	}
	// Bitmap fallback: draw small, scale up.
	$fw    = imagefontwidth( 5 ) * strlen( $text );
	$fh    = imagefontheight( 5 );
	$tmp   = imagecreatetruecolor( $fw, $fh );
	imagesavealpha( $tmp, true );
	imagefill( $tmp, 0, 0, imagecolorallocatealpha( $tmp, 0, 0, 0, 127 ) );
	imagestring( $tmp, 5, 0, 0, $text, wrbc_a11y_color( $tmp, $hex ) );
	$scale = max( 1, $size / 10 );
	$w     = (int) ( $fw * $scale );
	if ( 'center' === $x ) {
		$x = (int) ( ( imagesx( $im ) - $w ) / 2 );
	}
	imagecopyresampled( $im, $tmp, (int) $x, (int) ( $y - $fh * $scale ), 0, 0, $w, (int) ( $fh * $scale ), $fw, $fh );
	imagedestroy( $tmp );
	return $w;
}

/** Vertical gradient fill. */
function wrbc_a11y_gradient( $im, $top, $bottom ) {
	$h  = imagesy( $im );
	$w  = imagesx( $im );
	$t  = array_map( 'hexdec', str_split( ltrim( $top, '#' ), 2 ) );
	$b  = array_map( 'hexdec', str_split( ltrim( $bottom, '#' ), 2 ) );
	for ( $y = 0; $y < $h; $y++ ) {
		$k = $h > 1 ? $y / ( $h - 1 ) : 0;
		$c = imagecolorallocate( $im, (int) ( $t[0] + ( $b[0] - $t[0] ) * $k ), (int) ( $t[1] + ( $b[1] - $t[1] ) * $k ), (int) ( $t[2] + ( $b[2] - $t[2] ) * $k ) );
		imageline( $im, 0, $y, $w, $y, $c );
	}
}

/** Saves a GD image as PNG. */
function wrbc_a11y_png( $im, $path ) {
	$ok = imagepng( $im, $path, 6 );
	imagedestroy( $im );
	return $ok;
}

/** A person placeholder: coloured background, silhouette, initials. */
function wrbc_a11y_portrait( $path, $name, $bg, $fg ) {
	$im = imagecreatetruecolor( 600, 600 );
	imagefill( $im, 0, 0, wrbc_a11y_color( $im, $bg ) );
	$shape = wrbc_a11y_color( $im, $fg );
	imagefilledellipse( $im, 300, 235, 210, 230, $shape );
	imagefilledellipse( $im, 300, 600, 460, 380, $shape );
	$parts    = preg_split( '/\s+/', $name );
	$initials = strtoupper( mb_substr( $parts[0], 0, 1 ) . mb_substr( end( $parts ), 0, 1 ) );
	wrbc_a11y_text( $im, $initials, 54, 'center', 260, $bg );
	return wrbc_a11y_png( $im, $path );
}

/** An event poster / cover: gradient, big title, small line. */
function wrbc_a11y_poster( $path, $w, $h, $title, $line, $top, $bottom, $ink = '#ffffff' ) {
	$im = imagecreatetruecolor( $w, $h );
	wrbc_a11y_gradient( $im, $top, $bottom );
	// A few soft shapes so it isn't a flat field.
	$soft = wrbc_a11y_color( $im, '#ffffff', 100 );
	imagefilledellipse( $im, (int) ( $w * 0.85 ), (int) ( $h * 0.2 ), (int) ( $w * 0.5 ), (int) ( $w * 0.5 ), $soft );
	imagefilledellipse( $im, (int) ( $w * 0.1 ), (int) ( $h * 0.95 ), (int) ( $w * 0.4 ), (int) ( $w * 0.4 ), $soft );
	$size  = (int) ( $w / 18 );
	$words = explode( ' ', $title );
	$lines = array();
	$cur   = '';
	foreach ( $words as $word ) {
		if ( strlen( $cur . ' ' . $word ) > 18 && '' !== $cur ) {
			$lines[] = $cur;
			$cur     = $word;
		} else {
			$cur = trim( $cur . ' ' . $word );
		}
	}
	$lines[] = $cur;
	$y       = (int) ( $h * 0.42 );
	foreach ( $lines as $l ) {
		wrbc_a11y_text( $im, $l, $size, (int) ( $w * 0.08 ), $y, $ink );
		$y += (int) ( $size * 1.35 );
	}
	wrbc_a11y_text( $im, $line, (int) ( $size * 0.45 ), (int) ( $w * 0.08 ), $y + (int) ( $size * 0.4 ), $ink, false );
	return wrbc_a11y_png( $im, $path );
}

/** A company logo: mark + name on a transparent background. */
function wrbc_a11y_logo( $path, $name, $hex, $shape ) {
	$im = imagecreatetruecolor( 480, 160 );
	imagesavealpha( $im, true );
	imagealphablending( $im, false );
	imagefill( $im, 0, 0, imagecolorallocatealpha( $im, 0, 0, 0, 127 ) );
	imagealphablending( $im, true );
	$c = wrbc_a11y_color( $im, $hex );
	switch ( $shape ) {
		case 'circle':
			imagefilledellipse( $im, 70, 80, 84, 84, $c );
			break;
		case 'square':
			imagefilledrectangle( $im, 30, 40, 110, 120, $c );
			break;
		case 'diamond':
			imagefilledpolygon( $im, array( 70, 34, 116, 80, 70, 126, 24, 80 ), $c );
			break;
		case 'triangle':
			imagefilledpolygon( $im, array( 70, 36, 116, 122, 24, 122 ), $c );
			break;
		case 'ring':
			imagesetthickness( $im, 16 );
			imageellipse( $im, 70, 80, 76, 76, $c );
			imagesetthickness( $im, 1 );
			break;
		default:
			imagefilledrectangle( $im, 30, 56, 110, 104, $c );
	}
	wrbc_a11y_text( $im, $name, 40, 136, 98, $hex );
	return wrbc_a11y_png( $im, $path );
}

/** A product screenshot-like illustration (cards and bars). */
function wrbc_a11y_illustration( $path, $w, $h ) {
	$im = imagecreatetruecolor( $w, $h );
	wrbc_a11y_gradient( $im, '#eef2ff', '#e0e7ff' );
	$white = wrbc_a11y_color( $im, '#ffffff' );
	$ink   = wrbc_a11y_color( $im, '#4f46e5' );
	$grey  = wrbc_a11y_color( $im, '#c7d2fe' );
	imagefilledrectangle( $im, (int) ( $w * 0.08 ), (int) ( $h * 0.1 ), (int) ( $w * 0.92 ), (int) ( $h * 0.9 ), $white );
	imagefilledrectangle( $im, (int) ( $w * 0.08 ), (int) ( $h * 0.1 ), (int) ( $w * 0.92 ), (int) ( $h * 0.18 ), $grey );
	for ( $i = 0; $i < 5; $i++ ) {
		$x0 = (int) ( $w * ( 0.16 + $i * 0.15 ) );
		$bh = (int) ( $h * ( 0.15 + 0.08 * ( ( $i * 3 ) % 5 ) ) );
		imagefilledrectangle( $im, $x0, (int) ( $h * 0.8 ) - $bh, $x0 + (int) ( $w * 0.09 ), (int) ( $h * 0.8 ), $ink );
	}
	wrbc_a11y_text( $im, 'Dashboard', (int) ( $h / 22 ), (int) ( $w * 0.12 ), (int) ( $h * 0.165 ), '#1e1b4b' );
	return wrbc_a11y_png( $im, $path );
}

/** Background "photos" for text-over-image tests. */
function wrbc_a11y_backdrop( $path, $kind ) {
	$w  = 1920;
	$h  = 1080;
	$im = imagecreatetruecolor( $w, $h );
	if ( 'light' === $kind ) {
		// Bright sky: near white at the top, light blue, pale sand.
		wrbc_a11y_gradient( $im, '#ffffff', '#bfdbfe' );
		imagefilledrectangle( $im, 0, (int) ( $h * 0.72 ), $w, $h, wrbc_a11y_color( $im, '#fde68a' ) );
		imagefilledellipse( $im, (int) ( $w * 0.78 ), (int) ( $h * 0.22 ), 260, 260, wrbc_a11y_color( $im, '#fffbeb' ) );
	} elseif ( 'dark' === $kind ) {
		wrbc_a11y_gradient( $im, '#0b1020', '#1e293b' );
		for ( $i = 0; $i < 60; $i++ ) {
			$x = ( $i * 397 ) % $w;
			$y = ( $i * 211 ) % (int) ( $h * 0.6 );
			imagefilledellipse( $im, $x, $y, 4, 4, wrbc_a11y_color( $im, '#e2e8f0' ) );
		}
		imagefilledrectangle( $im, 0, (int) ( $h * 0.8 ), $w, $h, wrbc_a11y_color( $im, '#020617' ) );
	} else {
		// Busy: hard white/black stripes and blocks, the worst case for any overlay.
		imagefill( $im, 0, 0, wrbc_a11y_color( $im, '#ffffff' ) );
		$black = wrbc_a11y_color( $im, '#000000' );
		for ( $x = 0; $x < $w; $x += 160 ) {
			imagefilledrectangle( $im, $x, 0, $x + 79, $h, $black );
		}
		imagefilledrectangle( $im, (int) ( $w * 0.3 ), (int) ( $h * 0.3 ), (int) ( $w * 0.7 ), (int) ( $h * 0.7 ), wrbc_a11y_color( $im, '#f59e0b' ) );
	}
	return wrbc_a11y_png( $im, $path );
}

/** A one-page PDF with a title. */
function wrbc_a11y_pdf( $path, $title ) {
	$text   = str_replace( array( '\\', '(', ')' ), array( '\\\\', '\\(', '\\)' ), $title );
	$stream = "BT /F1 24 Tf 72 760 Td ($text) Tj ET";
	$objs   = array(
		'<< /Type /Catalog /Pages 2 0 R >>',
		'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
		'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
		'<< /Length ' . strlen( $stream ) . " >>\nstream\n$stream\nendstream",
		'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
	);
	$pdf    = "%PDF-1.4\n";
	$offs   = array();
	foreach ( $objs as $i => $o ) {
		$offs[] = strlen( $pdf );
		$pdf   .= ( $i + 1 ) . " 0 obj\n$o\nendobj\n";
	}
	$xref = strlen( $pdf );
	$pdf .= "xref\n0 " . ( count( $objs ) + 1 ) . "\n0000000000 65535 f \n";
	foreach ( $offs as $off ) {
		$pdf .= sprintf( "%010d 00000 n \n", $off );
	}
	$pdf .= "trailer\n<< /Size " . ( count( $objs ) + 1 ) . " /Root 1 0 R >>\nstartxref\n$xref\n%%EOF\n";
	return false !== file_put_contents( $path, $pdf ); // phpcs:ignore WordPress.WP.AlternativeFunctions
}

/** ffmpeg binary, or ''. */
function wrbc_a11y_ffmpeg() {
	foreach ( array( '/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/usr/bin/ffmpeg' ) as $bin ) {
		if ( is_executable( $bin ) ) {
			return $bin;
		}
	}
	return '';
}

/* ── Files ───────────────────────────────────────────────────────────── */

$img = array();

$people = array(
	array( 'Ana García', 'Chief Executive Officer', array( 'Leadership' ), '#fde68a', '#92400e' ),
	array( 'Bruno Silva', 'Chief Technology Officer', array( 'Engineering' ), '#bfdbfe', '#1e3a8a' ),
	array( 'Chen Wei', 'Frontend Engineer', array( 'Engineering', 'Frontend' ), '#bbf7d0', '#14532d' ),
	array( 'Dana Okafor', 'Product Designer', array( 'Design' ), '#fbcfe8', '#831843' ),
	array( 'Elif Yılmaz', 'Brand Designer', array( 'Design' ), '#ddd6fe', '#4c1d95' ),
	array( 'Farah Haddad', 'Head of Sales', array( 'Sales' ), '#fed7aa', '#7c2d12' ),
	array( 'Gabriel Rossi', 'Account Executive', array( 'Sales' ), '#a5f3fc', '#164e63' ),
	array( 'Hana Kobayashi', 'Frontend Engineer', array( 'Engineering', 'Frontend' ), '#e5e7eb', '#111827' ),
);
foreach ( $people as $i => $p ) {
	$n                    = $i + 1;
	$img[ 'person-' . $n ] = wrbc_a11y_file(
		'person-' . $n,
		'person-' . $n . '.png',
		'image/png',
		'Portrait of ' . $p[0],
		$p[0],
		static function ( $path ) use ( $p ) {
			return wrbc_a11y_portrait( $path, $p[0], $p[3], $p[4] );
		}
	);
}

$companies = array(
	array( 'Northwind', '#1d4ed8', 'circle' ),
	array( 'Contoso', '#047857', 'square' ),
	array( 'Fabrikam', '#b91c1c', 'diamond' ),
	array( 'Tailspin', '#7c3aed', 'triangle' ),
	array( 'Lumen Labs', '#c2410c', 'ring' ),
	array( 'Acme Co', '#0f172a', 'bar' ),
);
foreach ( $companies as $i => $c ) {
	$n                  = $i + 1;
	$img[ 'logo-' . $n ] = wrbc_a11y_file(
		'logo-' . $n,
		'logo-' . sanitize_title( $c[0] ) . '.png',
		'image/png',
		$c[0] . ' logo',
		$c[0],
		static function ( $path ) use ( $c ) {
			return wrbc_a11y_logo( $path, $c[0], $c[1], $c[2] );
		}
	);
}

$events = array(
	// title, type, start offset (days), end offset, venue, price, poster colours or null.
	array( 'Accessible design tokens', 'Webinar', 7, 7, 'Online', 0, null ),
	array( 'Building with blocks', 'Workshop', 14, 14, 'Madrid, Spain', 49, array( '#1e3a8a', '#4f46e5' ) ),
	array( 'Design Systems Summit', 'Conference', 30, 31, 'Barcelona, Spain', 299, array( '#7c2d12', '#ea580c' ) ),
	array( 'Performance budgets in practice', 'Webinar', 45, 45, 'Online', 0, array( '#064e3b', '#10b981' ) ),
	array( 'WordPress Growth Day', 'Conference', 60, 60, 'Buenos Aires, Argentina', 120, array( '#581c87', '#c026d3' ) ),
	array( 'Accessibility Week', 'Workshop', -1, 1, 'London, United Kingdom', 0, array( '#0f172a', '#334155' ) ),
	array( 'Writing useful alt text', 'Webinar', -30, -30, 'Online', 0, null ),
	array( 'Frontend Days 2026', 'Conference', -90, -89, 'Berlin, Germany', 199, array( '#713f12', '#facc15' ) ),
);
foreach ( $events as $i => $e ) {
	$n = $i + 1;
	if ( ! $e[6] ) {
		$img[ 'poster-' . $n ] = 0;
		continue;
	}
	$img[ 'poster-' . $n ] = wrbc_a11y_file(
		'poster-' . $n,
		'poster-' . $n . '.png',
		'image/png',
		$e[0] . ' poster',
		'',
		static function ( $path ) use ( $e ) {
			return wrbc_a11y_poster( $path, 1200, 800, $e[0], $e[1] . ' · ' . $e[4], $e[6][0], $e[6][1] );
		}
	);
}

$cases = array(
	array( 'Rebuilding a bank’s public website', 'Northwind', '+38% online applications', array( '#0c4a6e', '#0284c7' ) ),
	array( 'A design system for twelve brands', 'Contoso', '12 sites, one codebase', array( '#14532d', '#22c55e' ) ),
	array( 'Accessible checkout for a retailer', 'Fabrikam', '−22% abandoned carts', array( '#7f1d1d', '#ef4444' ) ),
	array( 'A careers site that hires', 'Tailspin', '3× more applicants', array( '#3b0764', '#a855f7' ) ),
	array( 'Docs portal for a developer platform', 'Lumen Labs', '−40% support tickets', array( '#7c2d12', '#f97316' ) ),
	array( 'Multilingual site for an NGO', 'Acme Co', '9 languages', array( '#0f172a', '#64748b' ) ),
	array( 'Event platform migration', 'Northwind', '0 minutes of downtime', array( '#1e3a8a', '#60a5fa' ) ),
	array( 'Headless shop for a coffee brand', 'Contoso', '+64% mobile revenue', array( '#422006', '#a16207' ) ),
);
foreach ( $cases as $i => $c ) {
	$n = $i + 1;
	if ( $n > 6 ) {
		$img[ 'case-img-' . $n ] = 0; // two cases without an image
		continue;
	}
	// Image keys must never equal post keys (case-N is the case study post).
	$img[ 'case-img-' . $n ] = wrbc_a11y_file(
		'case-img-' . $n,
		'case-' . $n . '.png',
		'image/png',
		$c[0],
		'',
		static function ( $path ) use ( $c ) {
			return wrbc_a11y_poster( $path, 1600, 900, $c[0], $c[1] . ' · ' . $c[2], $c[3][0], $c[3][1] );
		}
	);
}

$resources = array(
	array( 'The accessibility checklist for marketing sites', 'Checklist', 4 ),
	array( 'Choosing an applicant tracking system', 'Guide', 12 ),
	array( 'Design tokens that survive dark mode', 'Whitepaper', 18 ),
	array( 'A content model for corporate sites', 'Guide', 9 ),
	array( 'Measuring Core Web Vitals', 'Whitepaper', 22 ),
	array( 'Launch day checklist', 'Checklist', 2 ),
	array( 'Writing for screen readers', 'Guide', 7 ),
	array( 'Annual report on WordPress agencies', 'Whitepaper', 40 ),
);
$res_colors = array( array( '#1e1b4b', '#4338ca' ), array( '#134e4a', '#14b8a6' ), array( '#4a044e', '#d946ef' ), array( '#172554', '#3b82f6' ), array( '#450a0a', '#dc2626' ), array( '#052e16', '#16a34a' ) );
foreach ( $resources as $i => $r ) {
	$n = $i + 1;
	if ( $n <= 6 ) {
		$img[ 'cover-' . $n ] = wrbc_a11y_file(
			'cover-' . $n,
			'cover-' . $n . '.png',
			'image/png',
			$r[0] . ' cover',
			'',
			static function ( $path ) use ( $r, $res_colors, $i ) {
				return wrbc_a11y_poster( $path, 1200, 900, $r[0], $r[1], $res_colors[ $i ][0], $res_colors[ $i ][1] );
			}
		);
		$img[ 'doc-' . $n ]   = wrbc_a11y_file(
			'doc-' . $n,
			'doc-' . $n . '.pdf',
			'application/pdf',
			$r[0],
			'',
			static function ( $path ) use ( $r ) {
				return wrbc_a11y_pdf( $path, $r[0] );
			}
		);
	} else {
		$img[ 'cover-' . $n ] = 0;
		$img[ 'doc-' . $n ]   = 0;
	}
}

foreach ( array( 'light', 'dark', 'busy' ) as $kind ) {
	$img[ 'bg-' . $kind ] = wrbc_a11y_file(
		'bg-' . $kind,
		'bg-' . $kind . '.png',
		'image/png',
		'Background ' . $kind,
		'',
		static function ( $path ) use ( $kind ) {
			return wrbc_a11y_backdrop( $path, $kind );
		}
	);
}
$img['illustration']        = wrbc_a11y_file(
	'illustration',
	'illustration.png',
	'image/png',
	'Dashboard illustration',
	'A dashboard with a bar chart',
	static function ( $path ) {
		return wrbc_a11y_illustration( $path, 1200, 900 );
	}
);
$img['illustration-square'] = wrbc_a11y_file(
	'illustration-square',
	'illustration-square.png',
	'image/png',
	'Square illustration',
	'A dashboard with a bar chart',
	static function ( $path ) {
		return wrbc_a11y_illustration( $path, 800, 800 );
	}
);

// Video (needs ffmpeg): a 6 s test pattern, its poster and a captions file.
$ffmpeg = wrbc_a11y_ffmpeg();
if ( $ffmpeg ) {
	$img['video'] = wrbc_a11y_file(
		'video',
		'loop.mp4',
		'video/mp4',
		'Test pattern loop',
		'',
		static function ( $path ) use ( $ffmpeg ) {
			$cmd = escapeshellarg( $ffmpeg ) . ' -y -loglevel error -f lavfi -i ' . escapeshellarg( 'testsrc2=size=960x540:rate=24:duration=6' ) . ' -c:v libx264 -pix_fmt yuv420p -movflags +faststart -an ' . escapeshellarg( $path ) . ' 2>&1';
			exec( $cmd, $out, $code ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions
			return 0 === $code;
		}
	);
	$img['video-poster'] = wrbc_a11y_file(
		'video-poster',
		'loop-poster.png',
		'image/png',
		'Test pattern poster',
		'',
		static function ( $path ) use ( $ffmpeg ) {
			$cmd = escapeshellarg( $ffmpeg ) . ' -y -loglevel error -f lavfi -i ' . escapeshellarg( 'testsrc2=size=960x540:rate=1:duration=1' ) . ' -frames:v 1 ' . escapeshellarg( $path ) . ' 2>&1';
			exec( $cmd, $out, $code ); // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions
			return 0 === $code;
		}
	);
} else {
	WP_CLI::warning( 'ffmpeg not found: no fixture video.' );
	$img['video']        = 0;
	$img['video-poster'] = 0;
}
$img['captions'] = wrbc_a11y_file(
	'captions',
	'loop-captions.vtt',
	'text/vtt',
	'Test pattern captions',
	'',
	static function ( $path ) {
		return false !== file_put_contents( $path, "WEBVTT\n\n00:00:00.000 --> 00:00:03.000\nA colour test pattern moves across the screen.\n\n00:00:03.000 --> 00:00:06.000\nThere is no speech; this track exists to test captions.\n" ); // phpcs:ignore
	}
);

/* ── Terms ───────────────────────────────────────────────────────────── */

$t = array();
foreach ( array( 'Leadership', 'Engineering', 'Design', 'Sales' ) as $name ) {
	$t['department'][ $name ] = wrbc_a11y_term( 'department', $name );
}
$t['department']['Frontend'] = wrbc_a11y_term( 'department', 'Frontend', 'Engineering' );
foreach ( array( 'Webinar', 'Conference', 'Workshop' ) as $name ) {
	$t['event_type'][ $name ] = wrbc_a11y_term( 'event_type', $name );
}
foreach ( array( 'Americas', 'Europe', 'Asia-Pacific' ) as $name ) {
	$t['region'][ $name ] = wrbc_a11y_term( 'region', $name );
}
foreach ( array( 'Whitepaper', 'Guide', 'Checklist' ) as $name ) {
	$t['resource_type'][ $name ] = wrbc_a11y_term( 'resource_type', $name );
}
foreach ( array( 'Product updates', 'Guides' ) as $name ) {
	$t['category'][ $name ] = wrbc_a11y_term( 'category', $name );
}
foreach ( array( 'accessibility', 'design systems' ) as $name ) {
	$t['post_tag'][ $name ] = wrbc_a11y_term( 'post_tag', $name );
}

/* ── Posts ───────────────────────────────────────────────────────────── */

$lorem = 'Every part of this text is fixture content for the accessibility harness. It is long enough to wrap onto a few lines in a card and to give the excerpt something to trim.';
$ids   = array();
$now   = time();
$date  = static function ( $days_ago ) use ( $now ) {
	return wp_date( 'Y-m-d H:i:s', $now - (int) ( $days_ago * DAY_IN_SECONDS ) );
};

foreach ( $people as $i => $p ) {
	$n     = $i + 1;
	$terms = array();
	foreach ( $p[2] as $dept ) {
		$terms[] = $t['department'][ $dept ];
	}
	$first                 = strtolower( remove_accents( explode( ' ', $p[0] )[0] ) );
	$ids[ 'team-' . $n ]   = wrbc_a11y_post(
		'team-' . $n,
		array(
			'post_type'    => 'team',
			'post_title'   => $p[0],
			'post_excerpt' => $p[1] . ' based in our ' . ( $n % 2 ? 'Madrid' : 'Buenos Aires' ) . ' office.',
			'post_content' => '<!-- wp:paragraph --><p>' . esc_html( $p[0] ) . ' works as ' . esc_html( strtolower( $p[1] ) ) . '. ' . $lorem . '</p><!-- /wp:paragraph -->',
			'menu_order'   => $n,
			'post_date'    => $date( 40 - $n ),
		),
		array(
			'team_role'     => $p[1],
			'team_email'    => $first . '@example.com',
			'team_linkedin' => 'https://www.linkedin.com/in/example-' . $first,
		),
		array( 'department' => $terms ),
		8 === $n ? 0 : $img[ 'person-' . $n ] // one person without a photo
	);
}

foreach ( $events as $i => $e ) {
	$n                    = $i + 1;
	$ids[ 'event-' . $n ] = wrbc_a11y_post(
		'event-' . $n,
		array(
			'post_type'    => 'event',
			'post_title'   => $e[0],
			'post_excerpt' => $e[1] . ' · ' . $e[4] . '. ' . ( $e[5] ? 'Tickets from ' . $e[5] . ' €.' : 'Free, registration required.' ),
			'post_content' => '<!-- wp:paragraph --><p>' . $lorem . '</p><!-- /wp:paragraph -->',
			'post_date'    => $date( 100 - $n ),
		),
		array(
			'event_start_date' => wp_date( 'Ymd', $now + $e[2] * DAY_IN_SECONDS ),
			'event_end_date'   => wp_date( 'Ymd', $now + $e[3] * DAY_IN_SECONDS ),
			'event_venue'      => $e[4],
			'event_price'      => $e[5],
		),
		array( 'event_type' => array( $t['event_type'][ $e[1] ] ) ),
		$img[ 'poster-' . $n ]
	);
}

$places = array(
	array( 'Buenos Aires', 'Americas', -34.6037, -58.3816, 'Av. Corrientes 1234, C1043 Buenos Aires, Argentina', '+54 11 5555 0101' ),
	array( 'Madrid', 'Europe', 40.4168, -3.7038, 'Calle Gran Vía 28, 28013 Madrid, Spain', '+34 910 555 202' ),
	array( 'Barcelona', 'Europe', 41.3874, 2.1686, 'Passeig de Gràcia 55, 08007 Barcelona, Spain', '+34 930 555 303' ),
	array( 'New York', 'Americas', 40.7128, -74.006, '350 5th Ave, New York, NY 10118, USA', '+1 212 555 0404' ),
	array( 'Mexico City', 'Americas', 19.4326, -99.1332, 'Paseo de la Reforma 222, 06600 Ciudad de México, Mexico', '+52 55 5555 0505' ),
	array( 'London', 'Europe', 51.5072, -0.1276, '1 Poultry, London EC2R 8EJ, United Kingdom', '+44 20 5555 0606' ),
	array( 'Berlin', 'Europe', 52.52, 13.405, 'Friedrichstraße 68, 10117 Berlin, Germany', '+49 30 5555 0707' ),
	array( 'Tokyo', 'Asia-Pacific', 35.6762, 139.6503, '1-1 Marunouchi, Chiyoda City, Tokyo 100-0005, Japan', '+81 3 5555 0808' ),
);
foreach ( $places as $i => $p ) {
	$n                       = $i + 1;
	$slug                    = sanitize_title( $p[0] );
	$ids[ 'location-' . $n ] = wrbc_a11y_post(
		'location-' . $n,
		array(
			'post_type'    => 'location',
			'post_title'   => $p[0] . ' office',
			'post_excerpt' => $p[4],
			'post_content' => '<!-- wp:paragraph --><p>Our ' . esc_html( $p[0] ) . ' office. ' . $lorem . '</p><!-- /wp:paragraph -->',
			'post_date'    => $date( 60 - $n ),
		),
		array(
			'location_lat'     => $p[2],
			'location_lng'     => $p[3],
			'location_latlng'  => $p[2] . ',' . $p[3],
			'location_address' => $p[4],
			'location_phone'   => $p[5],
			'location_email'   => $slug . '@example.com',
			'location_hours'   => 'Mon–Fri 9:00–18:00',
		),
		array( 'region' => array( $t['region'][ $p[1] ] ) ),
		$n <= 2 ? $img[ 'case-img-' . ( $n + 4 ) ] : 0
	);
}

foreach ( $resources as $i => $r ) {
	$n                       = $i + 1;
	$ids[ 'resource-' . $n ] = wrbc_a11y_post(
		'resource-' . $n,
		array(
			'post_type'    => 'resource',
			'post_title'   => $r[0],
			'post_excerpt' => 'A ' . strtolower( $r[1] ) . ' of ' . $r[2] . ' pages. ' . $lorem,
			'post_content' => '<!-- wp:paragraph --><p>' . $lorem . '</p><!-- /wp:paragraph -->',
			'post_date'    => $date( 30 - $n ),
		),
		array(
			'_wrbc_download_id' => (int) $img[ 'doc-' . $n ],
			'resource_pages'   => $r[2],
		),
		array( 'resource_type' => array( $t['resource_type'][ $r[1] ] ) ),
		$img[ 'cover-' . $n ]
	);
	if ( ! $img[ 'doc-' . $n ] ) {
		delete_post_meta( $ids[ 'resource-' . $n ], '_wrbc_download_id' ); // two resources without a file
	}
}

$case_regions = array( 'Europe', 'Americas', 'Europe', 'Americas', 'Asia-Pacific', 'Europe', 'Americas', 'Europe' );
$case_depts   = array( 'Engineering', 'Design', 'Engineering', 'Sales', 'Engineering', 'Design', 'Engineering', 'Sales' );
$logo_by_name = array();
foreach ( $companies as $i => $c ) {
	$logo_by_name[ $c[0] ] = $img[ 'logo-' . ( $i + 1 ) ];
}
foreach ( $cases as $i => $c ) {
	$n                   = $i + 1;
	$ids[ 'case-' . $n ] = wrbc_a11y_post(
		'case-' . $n,
		array(
			'post_type'    => 'case_study',
			'post_title'   => $c[0],
			'post_excerpt' => $c[1] . ': ' . $c[2] . '. ' . $lorem,
			'post_content' => '<!-- wp:paragraph --><p>' . $lorem . '</p><!-- /wp:paragraph -->',
			'post_date'    => $date( 20 - $n ),
		),
		array(
			'case_client'  => $c[1],
			'case_metric'  => $c[2],
			'case_logo_id' => (int) $logo_by_name[ $c[1] ],
		),
		array(
			'region'     => array( $t['region'][ $case_regions[ $i ] ] ),
			'department' => array( $t['department'][ $case_depts[ $i ] ] ),
		),
		$img[ 'case-img-' . $n ]
	);
}

$quotes = array(
	array( 'They rebuilt our site in six weeks and our team can finally edit it without calling a developer.', 5, 'Northwind', 'Head of Marketing', 'Laura Méndez' ),
	array( 'The new careers page doubled our applicants in the first month.', 5, 'Tailspin', 'People Partner', 'Tomás Ruiz' ),
	array( 'Clear plan, fair price and they answered every email the same day.', 4, 'Contoso', 'Operations Lead', 'Priya Natarajan' ),
	array( 'Accessibility was part of the work from day one, not an afterthought.', 4.5, 'Fabrikam', 'Digital Director', 'Marc Dubois' ),
	array( 'Good results, although the first round of designs took longer than planned.', 3, 'Lumen Labs', 'Founder', 'Sara Lindqvist' ),
	array( 'Our docs portal is faster, and support tickets dropped by forty percent.', 5, 'Lumen Labs', 'Developer Relations', 'Kenji Watanabe' ),
	array( 'A reliable partner for a site in nine languages.', 4, 'Acme Co', 'Communications Manager', 'Amina Diallo' ),
	array( 'It works, but we needed more training than we expected.', 2, 'Contoso', 'IT Manager', 'Oliver Brown' ),
);
foreach ( $quotes as $i => $q ) {
	$n                          = $i + 1;
	$ids[ 'testimonial-' . $n ] = wrbc_a11y_post(
		'testimonial-' . $n,
		array(
			'post_type'    => 'testimonial_cpt',
			'post_title'   => $q[4],
			'post_excerpt' => $q[0],
			'post_content' => '<!-- wp:paragraph --><p>' . esc_html( $q[0] ) . ' ' . $lorem . '</p><!-- /wp:paragraph -->',
			'post_date'    => $date( 10 - $n ),
		),
		array(
			'testimonial_rating'  => $q[1],
			'testimonial_company' => $q[2],
			'testimonial_role'    => $q[3],
		),
		array(),
		$n <= 6 ? $img[ 'person-' . $n ] : 0
	);
}

$posts = array(
	array( 'What changed in werun.Blocks.Community 2.0', 'Product updates', 'case-img-1', array( 'design systems' ) ),
	array( 'Five accessibility checks before launch', 'Guides', 'case-img-3', array( 'accessibility' ) ),
	array( 'How we test colour contrast', 'Guides', '', array( 'accessibility', 'design systems' ) ),
	array( 'A faster editor for long pages', 'Product updates', '', array() ),
);
foreach ( $posts as $i => $p ) {
	$n    = $i + 1;
	$tags = array();
	foreach ( $p[3] as $tag ) {
		$tags[] = $t['post_tag'][ $tag ];
	}
	$ids[ 'post-' . $n ] = wrbc_a11y_post(
		'post-' . $n,
		array(
			'post_type'    => 'post',
			'post_title'   => $p[0],
			'post_excerpt' => 'Fixture post for the a11y harness. ' . $lorem,
			'post_content' => '<!-- wp:heading --><h2 class="wp-block-heading">Background</h2><!-- /wp:heading --><!-- wp:paragraph --><p>' . $lorem . ' <a href="#more">An inline link</a> inside running text.</p><!-- /wp:paragraph --><!-- wp:heading --><h2 class="wp-block-heading">What we did</h2><!-- /wp:heading --><!-- wp:paragraph --><p>' . $lorem . '</p><!-- /wp:paragraph -->',
			'post_date'    => $date( 5 - $n ),
		),
		array(),
		array(
			'category' => array( $t['category'][ $p[1] ] ),
			'post_tag' => $tags,
		),
		'' !== $p[2] ? $img[ $p[2] ] : 0
	);
}

/* ── Contact Form 7 forms (the mu-plugin's stand-in, or the real plugin) ── */

$cf7_template = "<label> Your name\n    [text* your-name autocomplete:name] </label>\n\n<label> Your email\n    [email* your-email autocomplete:email] </label>\n\n<label> Your message (optional)\n    [textarea your-message] </label>\n\n[acceptance acceptance-1] I agree that my details are used to answer this request. [/acceptance]\n\n[submit \"Send\"]";
$cf7_forms    = array(
	'cf7-contact'  => array( 'Contact form', '' ),
	'cf7-download' => array( 'Download request', '' ),
	'cf7-invalid'  => array( 'Contact form (error state)', 'invalid' ), // printed with its validation errors
	'cf7-failing'  => array( 'Contact form (sending fails)', 'mail_failed' ), // submissions answer mail_failed
);
foreach ( $cf7_forms as $key => $f ) {
	$ids[ $key ] = wrbc_a11y_post(
		$key,
		array(
			'post_type'    => 'wpcf7_contact_form',
			'post_title'   => $f[0],
			'post_content' => $cf7_template,
		),
		array(
			'_form'           => $cf7_template,
			'_wrbc_a11y_state' => $f[1],
		)
	);
}

/* ── Caches the blocks keep ──────────────────────────────────────────── */

foreach ( array( 'post', 'team', 'event', 'location', 'resource', 'case_study', 'testimonial_cpt' ) as $type ) {
	delete_transient( 'wrbc_qmk_' . md5( $type ) );
}
if ( class_exists( '\Werun\BlocksCommunity\Jobs\Jobs' ) ) {
	foreach ( \Werun\BlocksCommunity\Jobs\Providers::ids() as $provider ) {
		foreach ( array( 'acme', 'acme-empty', 'acme-404', '' ) as $board ) {
			foreach ( array( '', 'eu', 'com' ) as $region ) {
				$key = \Werun\BlocksCommunity\Jobs\Jobs::key( array( 'provider' => $provider, 'slug' => $board, 'region' => $region ) );
				delete_transient( $key );
				delete_transient( $key . '_lock' );
				delete_option( $key . '_stale' );
			}
		}
	}
}
wp_cache_flush();

/* ── Summary ─────────────────────────────────────────────────────────── */

$counts = array();
foreach ( array( 'team', 'event', 'location', 'resource', 'case_study', 'testimonial_cpt', 'post', 'wpcf7_contact_form' ) as $type ) {
	$counts[ $type ] = count(
		get_posts(
			array(
				'post_type'      => $type,
				'post_status'    => 'publish',
				'posts_per_page' => -1,
				'fields'         => 'ids',
				// Only this seed's items (other test posts carry _wrbc_a11y_fixture too).
				'meta_key'       => '_wrbc_a11y_key', // phpcs:ignore WordPress.DB.SlowDBQuery
				'meta_compare'   => 'EXISTS',
			)
		)
	);
}
$counts['attachments'] = count( array_filter( $img ) );
$summary               = array(
	'counts'  => $counts,
	'stats'   => $GLOBALS['wrbc_stats'],
	'files'   => array_filter( $img ),
	'posts'   => $ids,
	'terms'   => $t,
	'uploads' => wrbc_a11y_dir()[1],
);
WP_CLI::log( sprintf( 'Seeded: %s', wp_json_encode( $counts ) ) );
echo '@@WRB_JSON@@' . wp_json_encode( $summary ) . "@@END@@\n";
