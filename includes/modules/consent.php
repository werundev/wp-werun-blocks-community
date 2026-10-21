<?php
/**
 * Consent placeholder: what a third-party embed (map, video, form) shows
 * until the visitor allows it. Twin of src/shared/view/consent.js, which
 * reads the same data attributes.
 *
 * @package werun-blocks-community
 */

defined( 'ABSPATH' ) || exit;

if ( ! function_exists( 'wrbc_consent_mode' ) ) {
	/**
	 * The consent mode an embed runs with: a block's own override when it is
	 * one of click | cmp | none, otherwise the Integrations setting
	 * privacy.consent ('' or 'inherit' mean "the site's setting").
	 *
	 * @param mixed $override Block attribute value.
	 * @return string click | cmp | none
	 */
	function wrbc_consent_mode( $override = '' ) {
		$modes    = array( 'click', 'cmp', 'none' );
		$override = is_scalar( $override ) ? (string) $override : '';
		if ( in_array( $override, $modes, true ) ) {
			return $override;
		}
		$site = class_exists( '\Werun\BlocksCommunity\Integrations\Integrations' ) ? \Werun\BlocksCommunity\Integrations\Integrations::get( 'privacy.consent', 'click' ) : 'click';
		return in_array( $site, $modes, true ) ? $site : 'click';
	}
}

if ( ! function_exists( 'wrbc_consent_placeholder' ) ) {
	/**
	 * The placeholder a third-party embed shows first: a short note on where
	 * it loads from, a "Load … (from host)" button and, in click mode, an
	 * "always allow" checkbox that remembers the category for
	 * privacy.remember_days. wrbc-consent wires the button; the module that
	 * owns the embed (wrbc-map, wrbc-video, wrbc-gate) or a <template> inside the
	 * placeholder decides what loads.
	 *
	 * Accessibility: the button's name says what loads and from where (the
	 * visible text) and the note above it describes it (aria-describedby);
	 * the placeholder's status ([data-wrbc-consent-status], role="status",
	 * empty and visually hidden until it has something to say) announces
	 * "Loading…" and load errors; once the embed is in, focus moves from the
	 * button to it (wrbc.consent.loaded()). Over a poster the text is white on
	 * a 62 % black layer (≥ 6:1 on any image).
	 *
	 * The button needs JavaScript, so the placeholder is printed hidden:
	 * wrbc.consent.request() shows it when the embed asks for consent (and
	 * never when it was already given, so it doesn't flash). Without
	 * JavaScript a <noscript> line says so instead.
	 *
	 * @param string $category maps | video | forms.
	 * @param string $host     Where the content comes from, e.g. "youtube.com".
	 * @param string $label    The action, translated, e.g. __( 'Load the map', 'werun-blocks-community' ).
	 * @param array  $args {
	 *     Optional.
	 *
	 *     @type string $mode     The block's override (click | cmp | none), printed as
	 *                            data-wrbc-consent-mode; '' follows the site setting.
	 *     @type string $text     Replaces the note above the button.
	 *     @type bool   $remember Offer "always allow" (click mode only; default true
	 *                            when privacy.remember_days > 0).
	 *     @type bool   $hidden   Hidden on purpose until the module asks (wrbc-video shows it on
	 *                            play in cmp mode): no <noscript> line. Every placeholder is
	 *                            printed hidden; request() shows it.
	 *     @type string $poster   Image URL behind the placeholder (a video's poster, a map preview).
	 *     @type string $class    Extra classes.
	 *     @type string $content  Trusted markup put in <template data-wrbc-consent-template>,
	 *                            inserted once allowed (form embeds). Never visitor input:
	 *                            the caller escapes or wp_kses()es it.
	 * }
	 * @return string Markup, escaped.
	 */
	function wrbc_consent_placeholder( $category, $host, $label, $args = array() ) {
		$category = is_scalar( $category ) ? (string) $category : '';
		if ( ! in_array( $category, array( 'maps', 'video', 'forms' ), true ) ) {
			return '';
		}
		$args = wp_parse_args(
			is_array( $args ) ? $args : array(),
			array(
				'mode'     => '',
				'text'     => '',
				'remember' => null,
				'hidden'   => false,
				'poster'   => '',
				'class'    => '',
				'content'  => '',
			)
		);
		$host  = preg_replace( '/[^A-Za-z0-9.\-]/', '', wrbc_text( $host ) );
		$label = wrbc_text( $label );
		$mode  = wrbc_consent_mode( $args['mode'] );
		if ( '' === $label ) {
			$labels = array(
				'maps'  => __( 'Load the map', 'werun-blocks-community' ),
				'video' => __( 'Load the video', 'werun-blocks-community' ),
				'forms' => __( 'Load the form', 'werun-blocks-community' ),
			);
			$label  = $labels[ $category ];
		}

		$text = wrbc_text( $args['text'] );
		if ( '' === $text ) {
			$text = '' !== $host
				/* translators: %s: a domain, e.g. youtube.com */
				? sprintf( __( 'This content is hosted by %s. Loading it sends your IP address there and may set cookies.', 'werun-blocks-community' ), $host )
				: __( 'This content is hosted by a third party. Loading it sends your IP address there and may set cookies.', 'werun-blocks-community' );
			if ( 'cmp' === $mode ) {
				$text .= ' ' . __( 'You can allow it in the cookie settings, or load it just this once.', 'werun-blocks-community' );
			}
		}

		$button = '' !== $host
			/* translators: 1: an action such as "Load the map", 2: a domain such as openstreetmap.org */
			? sprintf( __( '%1$s (from %2$s)', 'werun-blocks-community' ), $label, $host )
			: $label;

		// "Always" belongs to the consent banner in cmp mode, and needs a number of days to mean anything.
		$days     = class_exists( '\Werun\BlocksCommunity\Integrations\Integrations' ) ? (int) \Werun\BlocksCommunity\Integrations\Integrations::get( 'privacy.remember_days', 180 ) : 180;
		$remember = 'click' === $mode && $days > 0 && ( null === $args['remember'] || ! empty( $args['remember'] ) );
		$always   = array(
			'maps'  => __( 'Always load maps on this site', 'werun-blocks-community' ),
			'video' => __( 'Always load videos on this site', 'werun-blocks-community' ),
			'forms' => __( 'Always load forms on this site', 'werun-blocks-community' ),
		);

		$classes = array( 'wrbc-consent', 'wrbc-consent--' . $category );
		$style   = '';
		$poster  = esc_url( wrbc_text( $args['poster'] ) );
		if ( '' !== $poster ) {
			$classes[] = 'wrbc-consent--poster';
			$style     = "background-image:url('" . $poster . "')";
		}
		foreach ( preg_split( '/\s+/', wrbc_text( $args['class'] ), -1, PREG_SPLIT_NO_EMPTY ) as $extra ) {
			$classes[] = sanitize_html_class( $extra );
		}

		$privacy = function_exists( 'get_privacy_policy_url' ) ? get_privacy_policy_url() : '';
		$note_id = wp_unique_id( 'wrbc-consent-note-' );
		$noscript = array(
			'maps'  => __( 'Turn on JavaScript to load the map.', 'werun-blocks-community' ),
			'video' => __( 'Turn on JavaScript to play the video.', 'werun-blocks-community' ),
			'forms' => __( 'Turn on JavaScript to load the form.', 'werun-blocks-community' ),
		);
		// What wrbc-consent says in the placeholder's live region.
		$labels = wp_json_encode(
			array(
				'loading' => __( 'Loading…', 'werun-blocks-community' ),
				'error'   => __( 'This content could not be loaded. Please try again.', 'werun-blocks-community' ),
			),
			JSON_UNESCAPED_UNICODE
		);

		ob_start();
		if ( empty( $args['hidden'] ) ) :
			?>
			<noscript><p class="wrbc-consent__noscript"><?php echo esc_html( $noscript[ $category ] ); ?></p></noscript>
			<?php
		endif;
		?>
		<div class="<?php echo esc_attr( implode( ' ', array_filter( $classes ) ) ); ?>" data-wrbc-consent="<?php echo esc_attr( $category ); ?>" data-wrbc-consent-labels="<?php echo esc_attr( $labels ); ?>"<?php echo in_array( $args['mode'], array( 'click', 'cmp', 'none' ), true ) ? ' data-wrbc-consent-mode="' . esc_attr( $args['mode'] ) . '"' : ''; ?><?php echo '' !== $style ? ' style="' . esc_attr( $style ) . '"' : ''; ?><?php echo empty( $args['hidden'] ) ? ' data-wrbc-consent-wait' : ''; ?> hidden>
			<div class="wrbc-consent__box">
				<p class="wrbc-consent__text" id="<?php echo esc_attr( $note_id ); ?>">
					<?php echo esc_html( $text ); ?>
					<?php if ( $privacy ) : ?>
						<a href="<?php echo esc_url( $privacy ); ?>"><?php esc_html_e( 'Privacy policy', 'werun-blocks-community' ); ?></a>
					<?php endif; ?>
				</p>
				<button type="button" class="wrbc-btn wrbc-consent__btn" data-wrbc-consent-accept aria-describedby="<?php echo esc_attr( $note_id ); ?>"><?php echo esc_html( $button ); ?></button>
				<?php if ( $remember ) : ?>
					<label class="wrbc-consent__remember"><input type="checkbox" data-wrbc-consent-remember> <?php echo esc_html( $always[ $category ] ); ?></label>
				<?php endif; ?>
				<p class="wrbc-consent__status" role="status" data-wrbc-consent-status></p>
			</div>
			<?php if ( '' !== wrbc_text( $args['content'] ) ) : ?>
				<template data-wrbc-consent-template><?php echo $args['content']; // phpcs:ignore WordPress.Security.EscapeOutput -- trusted markup, see @param ?></template>
			<?php endif; ?>
		</div>
		<?php
		return trim( ob_get_clean() );
	}
}
