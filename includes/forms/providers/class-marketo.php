<?php
/**
 * Marketo forms 2.0: base URL and Munchkin id from Integrations, the form id
 * from the block; view.js loads forms2.min.js from that base and calls
 * MktoForms2.loadForm().
 *
 * @package werun-blocks-community
 */

namespace Werun\BlocksCommunity\Forms\Providers;

use Werun\BlocksCommunity\Forms\Provider;
use Werun\BlocksCommunity\Integrations\Integrations;

defined( 'ABSPATH' ) || exit;

/**
 * Marketo.
 */
final class Marketo extends Provider {

	public function id(): string {
		return 'marketo';
	}

	public function label(): string {
		return 'Marketo';
	}

	public function hosts(): array {
		$base = (string) Integrations::get( 'forms.marketo_base' );
		return array_values( array_filter( array( $base, 'munchkin.marketo.net' ) ) );
	}

	public function client_event(): string {
		return 'callback';
	}

	public function gating(): string {
		return 'soft';
	}

	public function defaults(): array {
		return array(
			'marketo_base'     => '' !== Integrations::get( 'forms.marketo_base' ),
			'marketo_munchkin' => '' !== Integrations::get( 'forms.marketo_munchkin' ),
		);
	}

	public function hint(): string {
		return __( 'Form ID (digits), from the form\'s embed code: MktoForms2.loadForm(…, …, 1234).', 'werun-blocks-community' );
	}

	public function validate( array $args ): ?array {
		$form     = self::match( $args['formId'] ?? '', '/^[1-9]\d{0,8}$/' );
		$base     = self::match( Integrations::get( 'forms.marketo_base' ), '#^(app-[a-z0-9]+\.marketo\.com|[a-z0-9.-]+\.[a-z]{2,})$#' );
		$munchkin = self::match( Integrations::get( 'forms.marketo_munchkin' ), '/^\d{3}-[A-Z]{3}-\d{3}$/' );
		return ( null === $form || null === $base || null === $munchkin ) ? null : array(
			'form'     => (int) $form,
			'base'     => $base,
			'munchkin' => $munchkin,
		);
	}

	protected function markup( array $v, array $args ): string {
		return $this->mount(
			array(
				'type'     => 'marketo',
				'src'      => 'https://' . $v['base'] . '/js/forms2/js/forms2.min.js',
				'base'     => 'https://' . $v['base'],
				'munchkin' => $v['munchkin'],
				'form'     => $v['form'],
			),
			sprintf( '<form id="mktoForm_%d"></form>', $v['form'] )
		);
	}
}
