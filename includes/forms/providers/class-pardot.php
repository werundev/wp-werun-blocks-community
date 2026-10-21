<?php
/**
 * Salesforce Account Engagement (Pardot) forms: an iframe whose URL must be
 * on the configured tracker domain or go.pardot.com / pi.pardot.com, with a
 * form path (/l/<account>/<date>/<code>).
 *
 * @package werun-blocks-community
 */

namespace Werun\BlocksCommunity\Forms\Providers;

use Werun\BlocksCommunity\Forms\Provider;
use Werun\BlocksCommunity\Integrations\Integrations;

defined( 'ABSPATH' ) || exit;

/**
 * Pardot.
 */
final class Pardot extends Provider {

	public function id(): string {
		return 'pardot';
	}

	public function label(): string {
		return __( 'Salesforce Account Engagement (Pardot)', 'werun-blocks-community' );
	}

	public function hosts(): array {
		return array_values( array_unique( array_filter( array( (string) Integrations::get( 'forms.pardot_domain' ), 'go.pardot.com', 'pi.pardot.com' ) ) ) );
	}

	public function defaults(): array {
		return array( 'pardot_domain' => '' !== Integrations::get( 'forms.pardot_domain' ) );
	}

	public function hint(): string {
		return __( 'The form URL, e.g. https://go.pardot.com/l/123456/2024-01-31/abc12.', 'werun-blocks-community' );
	}

	/** The pasted URL's own host (the tracker domain, go. or pi.pardot.com). */
	public function consent_host( array $v ): string {
		$host = (string) wp_parse_url( (string) ( $v['src'] ?? '' ), PHP_URL_HOST );
		return '' !== $host ? $host : parent::consent_host( $v );
	}

	public function validate( array $args ): ?array {
		$p = self::url_parts( $args['formId'] ?? '', $this->hosts() );
		if ( null === $p || ! preg_match( '#^/l/\d{1,10}/\d{4}-\d{2}-\d{2}/[A-Za-z0-9]{1,20}$#', $p['path'] ) ) {
			return null;
		}
		$extra = is_array( $args['extra'] ?? null ) ? $args['extra'] : array();
		return array(
			'src'    => 'https://' . $p['host'] . $p['path'],
			'height' => self::height( $extra, 600 ),
		);
	}

	protected function markup( array $v, array $args ): string {
		return $this->iframe( $v['src'], $this->frame_title( $args ), $v['height'] );
	}
}
