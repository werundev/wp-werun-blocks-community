<?php
/**
 * Base for form plugins installed on the site: the editor picks a form from
 * the plugin's own list, the page renders it with the plugin's shortcode,
 * and the server sees the submission (hard gating).
 *
 * @package werun-blocks-community
 */

namespace Werun\BlocksCommunity\Forms;

defined( 'ABSPATH' ) || exit;

/**
 * Native_Provider.
 */
abstract class Native_Provider extends Provider {

	public function kind(): string {
		return 'native';
	}

	public function gating(): string {
		return 'hard';
	}

	/**
	 * Whether a form with that id exists (and is published, where the plugin has a status).
	 *
	 * @param int $id Form id.
	 */
	abstract protected function exists( int $id ): bool;

	/**
	 * The plugin's shortcode for a form.
	 *
	 * @param int $id Form id.
	 */
	abstract protected function shortcode( int $id ): string;

	public function validate( array $args ): ?array {
		$id = self::match( $args['formId'] ?? '', '/^[1-9]\d{0,9}$/' );
		if ( null === $id || ! $this->is_available() || ! $this->exists( (int) $id ) ) {
			return null;
		}
		return array( 'id' => (int) $id );
	}

	protected function markup( array $v, array $args ): string {
		$shortcode = $this->shortcode( $v['id'] );
		return Forms::with_ticket(
			wrbc_text( $args['ticket'] ?? '' ),
			static function () use ( $shortcode ) {
				return do_shortcode( $shortcode );
			}
		);
	}

	/**
	 * Forms as id/title pairs from a list of rows.
	 *
	 * @param iterable $rows  Rows.
	 * @param callable $id    Row → id.
	 * @param callable $title Row → title.
	 */
	protected static function pairs( $rows, callable $id, callable $title ): array {
		$out = array();
		foreach ( $rows as $row ) {
			$out[] = array(
				'id'    => (string) (int) $id( $row ),
				'title' => wp_strip_all_tags( (string) $title( $row ) ),
			);
			if ( count( $out ) >= 200 ) {
				break;
			}
		}
		return $out;
	}
}
