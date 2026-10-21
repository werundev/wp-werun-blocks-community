<?php
/**
 * Renders schema-driven settings fields with the werun-blocks-community-ui-* kit.
 *
 * Twin of werun.Toolkit's includes/admin/class-settings-fields.php (same
 * markup and classes with the werun-blocks-community prefix, same show_if contract).
 * Differences, because werun.Blocks.Community stores nested options:
 *   - field keys are paths, "section.key" → option[section][key];
 *   - type "secret" (a Secret: option[secrets][name] + option[secrets_clear][name]);
 *   - type "list" (read-only rows with an Active / Not found badge) and
 *     type "note" (a read-only notice that can carry its own show_if);
 *   - show_if accepts Settings_Fields::FILLED ("the other field isn't empty");
 *   - no sanitize(): the option's sanitize_callback validates (Integrations::sanitize()).
 * Color and checkbox-tree controls are left out (no field uses them).
 *
 * Schema: section_id => { title, description?, show_if?, notice?, fields: key => {
 *   type, label, description?, options?, min?, max?, step?, placeholder?, suffix?, show_if? } }
 * Types: text, number, url, select, switch, secret, list, note.
 *
 * show_if: { other_key => value | [values] } shows a section or field only
 * while another field of the same form has one of those values (a switch is
 * "1"/"0"). Hidden fields still submit, so their saved values are kept.
 *
 * @package werun-blocks-community
 */

namespace Werun\BlocksCommunity\Admin\Integrations;

use Werun\BlocksCommunity\Admin\Ui;
use Werun\BlocksCommunity\Integrations\Secret;

defined( 'ABSPATH' ) || exit;

/**
 * Settings fields.
 */
final class Settings_Fields {

	/** show_if value meaning "the other field has any value". */
	public const FILLED = '__filled__';

	/**
	 * Input name of a field key.
	 *
	 * @param string $option Option name.
	 * @param string $key    "section.key", or a secret name for type "secret".
	 * @param string $type   Field type.
	 */
	public static function name( string $option, string $key, string $type = 'text' ): string {
		if ( 'secret' === $type ) {
			return $option . '[secrets][' . $key . ']';
		}
		$parts = explode( '.', $key );
		return $option . '[' . implode( '][', $parts ) . ']';
	}

	/**
	 * Element id of a field key.
	 *
	 * @param string $key Field key.
	 */
	public static function id( string $key ): string {
		return 'werun-blocks-community-field-' . sanitize_html_class( str_replace( array( '.', '_' ), '-', $key ) );
	}

	/**
	 * Sections that render: with a title and at least one field or a notice.
	 *
	 * @param array $sections Field schema.
	 */
	public static function visible_sections( array $sections ): array {
		return array_filter(
			$sections,
			static fn( $section ) => is_array( $section ) && '' !== (string) ( $section['title'] ?? '' ) && ( ! empty( $section['fields'] ) || ! empty( $section['notice'] ) )
		);
	}

	/**
	 * Active tab from ?tab=, or the first one.
	 *
	 * @param array $tabs Tabs keyed by id.
	 */
	public static function active_tab( array $tabs ): string {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only navigation.
		$tab = isset( $_GET['tab'] ) ? sanitize_key( wp_unslash( $_GET['tab'] ) ) : '';
		return isset( $tabs[ $tab ] ) ? $tab : (string) array_key_first( $tabs );
	}

	/**
	 * show_if markup: the data attribute (keyed by input name) and a class
	 * that hides the element while the condition isn't met (no flash before
	 * the script runs).
	 *
	 * @param array  $schema Section or field schema.
	 * @param array  $values Current values by field key.
	 * @param string $option Option name.
	 * @return array{0:string,1:string} Attribute (escaped, with a leading space) and class ('' when shown).
	 */
	public static function condition( array $schema, array $values, string $option ): array {
		if ( empty( $schema['show_if'] ) || ! is_array( $schema['show_if'] ) ) {
			return array( '', '' );
		}
		$map = array();
		$met = true;
		foreach ( $schema['show_if'] as $key => $allowed ) {
			$allowed                            = array_map( array( __CLASS__, 'condition_value' ), is_array( $allowed ) ? $allowed : array( $allowed ) );
			$map[ self::name( $option, $key ) ] = array_values( $allowed );
			$current                            = self::condition_value( $values[ $key ] ?? '' );
			$met                                = $met && ( in_array( $current, $allowed, true ) || ( in_array( self::FILLED, $allowed, true ) && '' !== trim( $current ) ) );
		}
		return array(
			' data-werun-blocks-community-show-if="' . esc_attr( (string) wp_json_encode( $map ) ) . '"',
			$met ? '' : 'werun-blocks-community-is-condition-hidden',
		);
	}

	/**
	 * A value as the form submits it: switches are "1" or "0".
	 *
	 * @param mixed $value Value.
	 */
	private static function condition_value( $value ): string {
		if ( is_bool( $value ) ) {
			return $value ? '1' : '0';
		}
		return is_scalar( $value ) ? (string) $value : '';
	}

	/**
	 * Renders every section as a card.
	 *
	 * @param array  $sections Field schema.
	 * @param string $option   Option name (field name prefix).
	 * @param array  $values   Current values by field key.
	 */
	public static function render_sections( array $sections, string $option, array $values ): void {
		foreach ( self::visible_sections( $sections ) as $section_id => $section ) {
			$heading_id                 = 'werun-blocks-community-section-' . sanitize_html_class( (string) $section_id );
			[ $cond_attr, $cond_class ] = self::condition( (array) $section, $values, $option );
			echo '<section class="werun-blocks-community-ui-card werun-blocks-community-settings-section' . ( $cond_class ? ' ' . esc_attr( $cond_class ) : '' ) . '" aria-labelledby="' . esc_attr( $heading_id ) . '"' . $cond_attr . '>'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- $cond_attr is escaped in condition().
			echo '<header class="werun-blocks-community-settings-section-header">';
			echo '<h2 class="werun-blocks-community-ui-eyebrow" id="' . esc_attr( $heading_id ) . '">' . esc_html( (string) ( $section['title'] ?? '' ) ) . '</h2>';
			if ( ! empty( $section['description'] ) ) {
				echo '<p class="werun-blocks-community-settings-section-description">' . esc_html( (string) $section['description'] ) . '</p>';
			}
			echo '</header>';
			if ( ! empty( $section['notice'] ) ) {
				self::render_notice( (array) $section['notice'] );
			}
			if ( ! empty( $section['fields'] ) ) {
				echo '<div class="werun-blocks-community-settings-fields">';
				foreach ( (array) $section['fields'] as $key => $field ) {
					self::render_field( (string) $key, (array) $field, $option, $values[ $key ] ?? null, $values );
				}
				echo '</div>';
			}
			echo '</section>';
		}
	}

	/**
	 * Section notice: a message and an optional link button.
	 *
	 * @param array $notice { text, tone?: info|good|warn, action?: { label, url } }.
	 */
	public static function render_notice( array $notice ): void {
		$tone  = in_array( $notice['tone'] ?? 'info', array( 'info', 'good', 'warn' ), true ) ? (string) ( $notice['tone'] ?? 'info' ) : 'info';
		$icons = array(
			'info' => 'circle-info',
			'good' => 'circle-check',
			'warn' => 'triangle-exclamation',
		);
		echo '<div class="werun-blocks-community-ui-notice werun-blocks-community-ui-notice-' . esc_attr( $tone ) . ' werun-blocks-community-settings-notice">';
		echo Ui::icon( $icons[ $tone ] ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped in icon().
		echo '<span>' . esc_html( (string) ( $notice['text'] ?? '' ) ) . '</span>';
		$action = (array) ( $notice['action'] ?? array() );
		if ( ! empty( $action['url'] ) && ! empty( $action['label'] ) ) {
			echo '<a class="werun-blocks-community-ui-button werun-blocks-community-ui-button-outline werun-blocks-community-ui-button-sm werun-blocks-community-settings-notice-action" href="' . esc_url( (string) $action['url'] ) . '">' . esc_html( (string) $action['label'] ) . '</a>';
		}
		echo '</div>';
	}

	/**
	 * Renders one field.
	 *
	 * @param string $key    Field key.
	 * @param array  $field  Field schema.
	 * @param string $option Option name.
	 * @param mixed  $value  Current value.
	 * @param array  $values Every current value (for show_if).
	 */
	public static function render_field( string $key, array $field, string $option, $value, array $values = array() ): void {
		$type    = (string) ( $field['type'] ?? 'text' );
		$id      = self::id( $key );
		$name    = self::name( $option, $key, $type );
		$label   = (string) ( $field['label'] ?? $key );
		$desc    = (string) ( $field['description'] ?? '' );
		$hint_id = $desc ? $id . '-hint' : '';
		$hint    = $desc ? '<p class="werun-blocks-community-ui-hint" id="' . esc_attr( $hint_id ) . '">' . esc_html( $desc ) . '</p>' : '';
		$descby  = $hint_id ? ' aria-describedby="' . esc_attr( $hint_id ) . '"' : '';
		$wide    = ! empty( $field['wide'] ) || in_array( $type, array( 'list', 'note' ), true );

		[ $cond_attr, $cond_class ] = self::condition( $field, $values, $option );
		echo '<div class="werun-blocks-community-ui-field werun-blocks-community-ui-field-' . esc_attr( $type ) . ( $wide ? ' werun-blocks-community-integrations-wide' : '' ) . ( $cond_class ? ' ' . esc_attr( $cond_class ) : '' ) . '"' . $cond_attr . '>'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- $cond_attr is escaped in condition().

		switch ( $type ) {
			case 'switch':
				echo '<label class="werun-blocks-community-ui-switch-row" for="' . esc_attr( $id ) . '">';
				echo '<span class="werun-blocks-community-ui-switch-text"><span class="werun-blocks-community-ui-switch-label">' . esc_html( $label ) . '</span></span>';
				echo '<input type="checkbox" role="switch" class="werun-blocks-community-ui-switch-input" id="' . esc_attr( $id ) . '" name="' . esc_attr( $name ) . '" value="1"' . checked( (bool) $value, true, false ) . $descby . '>'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- $descby is escaped above.
				echo '<span class="werun-blocks-community-ui-switch-track" aria-hidden="true"><span class="werun-blocks-community-ui-switch-thumb"></span></span>';
				echo '</label>';
				echo $hint; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped above.
				break;

			case 'select':
				echo '<label class="werun-blocks-community-ui-label" for="' . esc_attr( $id ) . '">' . esc_html( $label ) . '</label>';
				echo '<div class="werun-blocks-community-ui-select-wrap">';
				echo '<select class="werun-blocks-community-ui-input werun-blocks-community-ui-select" id="' . esc_attr( $id ) . '" name="' . esc_attr( $name ) . '"' . $descby . '>'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped above.
				foreach ( (array) ( $field['options'] ?? array() ) as $opt_value => $opt_label ) {
					echo '<option value="' . esc_attr( (string) $opt_value ) . '"' . selected( (string) $value, (string) $opt_value, false ) . '>' . esc_html( (string) $opt_label ) . '</option>';
				}
				echo '</select></div>';
				echo $hint; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped above.
				break;

			case 'secret':
				self::secret( $key, $field, $option, $id, $name, $label, $hint, $hint_id );
				break;

			case 'list':
				echo '<p class="werun-blocks-community-ui-label">' . esc_html( $label ) . '</p>';
				echo '<ul class="werun-blocks-community-integrations-detect"' . $descby . '>'; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped above.
				foreach ( (array) ( $field['items'] ?? array() ) as $item_label => $active ) {
					echo '<li class="werun-blocks-community-integrations-detect-item">';
					echo '<span>' . esc_html( (string) $item_label ) . '</span>';
					if ( $active ) {
						echo '<span class="werun-blocks-community-ui-badge werun-blocks-community-ui-badge-good"><span class="werun-blocks-community-ui-badge-dot" aria-hidden="true"></span>' . esc_html__( 'Active', 'werun-blocks-community' ) . '</span>';
					} else {
						echo '<span class="werun-blocks-community-ui-badge">' . esc_html__( 'Not found', 'werun-blocks-community' ) . '</span>';
					}
					echo '</li>';
				}
				echo '</ul>';
				echo $hint; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped above.
				break;

			case 'note':
				self::render_notice(
					array(
						'text' => $label,
						'tone' => $field['tone'] ?? 'info',
					)
				);
				break;

			default:
				$input_type = in_array( $type, array( 'number', 'url' ), true ) ? $type : 'text';
				$attrs      = ' spellcheck="false"';
				foreach ( array( 'min', 'max', 'step', 'placeholder' ) as $attr ) {
					if ( isset( $field[ $attr ] ) ) {
						$attrs .= ' ' . $attr . '="' . esc_attr( (string) $field[ $attr ] ) . '"';
					}
				}
				echo '<label class="werun-blocks-community-ui-label" for="' . esc_attr( $id ) . '">' . esc_html( $label ) . '</label>';
				$input = '<input type="' . esc_attr( $input_type ) . '" class="werun-blocks-community-ui-input" id="' . esc_attr( $id ) . '" name="' . esc_attr( $name ) . '" value="' . esc_attr( is_scalar( $value ) ? (string) $value : '' ) . '"' . $attrs . $descby . '>';
				if ( isset( $field['suffix'] ) ) {
					echo '<div class="werun-blocks-community-ui-input-group">';
					echo $input; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped above.
					echo '<span class="werun-blocks-community-ui-input-suffix">' . esc_html( (string) $field['suffix'] ) . '</span></div>';
				} else {
					echo $input; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped above.
				}
				echo $hint; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped above.
		}

		echo '</div>';
	}

	/**
	 * A secret: a password box that never prints the stored value, a show /
	 * hide button, "Remove the saved …" when one is stored, and an optional
	 * test button. A wp-config.php constant makes it read-only (and it isn't
	 * submitted).
	 *
	 * @param string $key     Secret name.
	 * @param array  $field   Field schema (remove_label, test?).
	 * @param string $option  Option name.
	 * @param string $id      Input id.
	 * @param string $name    Input name.
	 * @param string $label   Label.
	 * @param string $hint    Escaped hint markup.
	 * @param string $hint_id Hint id.
	 */
	private static function secret( string $key, array $field, string $option, string $id, string $name, string $label, string $hint, string $hint_id ): void {
		$secret   = Secret::named( $key );
		$locked   = $secret->from_constant();
		$has      = $secret->exists();
		$state_id = $id . '-state';
		$descby   = trim( $state_id . ' ' . $hint_id );

		if ( $locked ) {
			$placeholder = __( 'Defined in wp-config.php', 'werun-blocks-community' );
		} elseif ( $has ) {
			$placeholder = __( 'Saved. Leave blank to keep it.', 'werun-blocks-community' );
		} else {
			$placeholder = (string) ( $field['placeholder'] ?? '' );
		}

		echo '<label class="werun-blocks-community-ui-label" for="' . esc_attr( $id ) . '">' . esc_html( $label ) . '</label>';
		echo '<div class="werun-blocks-community-integrations-secret">';
		echo '<input type="password" class="werun-blocks-community-ui-input" id="' . esc_attr( $id ) . '"' . ( $locked ? ' readonly' : ' name="' . esc_attr( $name ) . '"' ) . ' value="" autocomplete="new-password" spellcheck="false" placeholder="' . esc_attr( $placeholder ) . '" aria-describedby="' . esc_attr( $descby ) . '" data-secret-input>';
		if ( ! $locked ) {
			/* translators: %s: field label. */
			$show = sprintf( __( 'Show %s', 'werun-blocks-community' ), $label );
			/* translators: %s: field label. */
			$hide = sprintf( __( 'Hide %s', 'werun-blocks-community' ), $label );
			echo '<button type="button" class="werun-blocks-community-ui-icon-button werun-blocks-community-integrations-secret-toggle" data-secret-toggle aria-pressed="false" aria-controls="' . esc_attr( $id ) . '" aria-label="' . esc_attr( $show ) . '" data-label-show="' . esc_attr( $show ) . '" data-label-hide="' . esc_attr( $hide ) . '">';
			echo Ui::icon( 'eye' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped in icon().
			echo '</button>';
		}
		echo '</div>';

		echo '<p class="werun-blocks-community-ui-hint" id="' . esc_attr( $state_id ) . '">';
		if ( $locked ) {
			/* translators: %s: constant name. */
			echo esc_html( sprintf( __( 'Defined in wp-config.php (%s). Change it there.', 'werun-blocks-community' ), $secret->constant_name() ) );
		} elseif ( $has ) {
			esc_html_e( 'A value is saved (encrypted). It is never shown again.', 'werun-blocks-community' );
		} else {
			/* translators: %s: constant name. */
			echo esc_html( sprintf( __( 'Not set. You can also define %s in wp-config.php.', 'werun-blocks-community' ), $secret->constant_name() ) );
		}
		echo '</p>';
		echo $hint; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped by the caller.

		if ( ! empty( $field['test'] ) ) {
			$test = (array) $field['test'];
			echo '<div class="werun-blocks-community-integrations-secret-actions">';
			echo '<button type="button" class="werun-blocks-community-ui-button werun-blocks-community-ui-button-outline werun-blocks-community-ui-button-sm" data-secret-test="' . esc_attr( (string) ( $test['path'] ?? '' ) ) . '"' . disabled( ! $has, true, false ) . '>';
			echo Ui::icon( 'plug' ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped in icon().
			echo '<span data-secret-test-label>' . esc_html( (string) ( $test['label'] ?? __( 'Test', 'werun-blocks-community' ) ) ) . '</span>';
			echo '</button>';
			if ( ! $has ) {
				echo '<span class="werun-blocks-community-ui-hint">' . esc_html__( 'Save a value first to test it.', 'werun-blocks-community' ) . '</span>';
			}
			echo '</div>';
		}

		if ( $has && ! $locked ) {
			$remove_id = $id . '-remove';
			/* translators: %s: field label. */
			$remove = (string) ( $field['remove_label'] ?? sprintf( __( 'Remove the saved %s', 'werun-blocks-community' ), $label ) );
			echo '<label class="werun-blocks-community-ui-switch-row werun-blocks-community-integrations-secret-remove" for="' . esc_attr( $remove_id ) . '">';
			echo '<span class="werun-blocks-community-ui-switch-text"><span class="werun-blocks-community-ui-switch-label">' . esc_html( $remove ) . '</span></span>';
			echo '<input type="checkbox" role="switch" class="werun-blocks-community-ui-switch-input" id="' . esc_attr( $remove_id ) . '" name="' . esc_attr( $option . '[secrets_clear][' . $key . ']' ) . '" value="1">';
			echo '<span class="werun-blocks-community-ui-switch-track" aria-hidden="true"><span class="werun-blocks-community-ui-switch-thumb"></span></span>';
			echo '</label>';
		}
	}
}
