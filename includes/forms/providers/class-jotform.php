<?php
/**
 * Jotform: the numeric form id and the data region (com, eu, hipaa), in an
 * iframe on that region's fixed host.
 *
 * @package werun-blocks-community
 */

namespace Werun\BlocksCommunity\Forms\Providers;

use Werun\BlocksCommunity\Forms\Provider;

defined( 'ABSPATH' ) || exit;

/**
 * Jotform.
 */
final class Jotform extends Provider {

	private const HOSTS = array(
		'com'   => 'form.jotform.com',
		'eu'    => 'eu.jotform.com',
		'hipaa' => 'hipaa.jotform.com',
	);

	public function id(): string {
		return 'jotform';
	}

	public function label(): string {
		return 'Jotform';
	}

	public function regions(): array {
		return array(
			'com'   => __( 'Global (jotform.com)', 'werun-blocks-community' ),
			'eu'    => __( 'EU (eu.jotform.com)', 'werun-blocks-community' ),
			'hipaa' => __( 'HIPAA (hipaa.jotform.com)', 'werun-blocks-community' ),
		);
	}

	public function hosts(): array {
		return array_values( self::HOSTS );
	}

	public function client_event(): string {
		return 'message:submission-completed';
	}

	public function gating(): string {
		return 'soft';
	}

	public function hint(): string {
		return __( 'Form ID: the digits at the end of the form\'s URL.', 'werun-blocks-community' );
	}

	/** The region's host (eu.jotform.com, …), not always the first one. */
	public function consent_host( array $v ): string {
		return self::HOSTS[ $v['region'] ?? 'com' ] ?? parent::consent_host( $v );
	}

	public function validate( array $args ): ?array {
		$id = self::match( $args['formId'] ?? '', '/^\d{8,20}$/' );
		if ( null === $id ) {
			return null;
		}
		$extra = is_array( $args['extra'] ?? null ) ? $args['extra'] : array();
		return array(
			'id'     => $id,
			'region' => $this->region( $args['region'] ?? '' ),
			'height' => self::height( $extra, 640 ),
		);
	}

	protected function markup( array $v, array $args ): string {
		return $this->iframe( 'https://' . self::HOSTS[ $v['region'] ] . '/' . $v['id'], $this->frame_title( $args ), $v['height'] );
	}
}
