<?php
/**
 * ActiveCampaign: the form id from the block and the account name from
 * Integrations; the embed script comes from <account>.activehosted.com.
 *
 * @package werun-blocks-community
 */

namespace Werun\BlocksCommunity\Forms\Providers;

use Werun\BlocksCommunity\Forms\Provider;
use Werun\BlocksCommunity\Integrations\Integrations;

defined( 'ABSPATH' ) || exit;

/**
 * ActiveCampaign.
 */
final class ActiveCampaign extends Provider {

	public function id(): string {
		return 'activecampaign';
	}

	public function label(): string {
		return 'ActiveCampaign';
	}

	public function hosts(): array {
		$account = (string) Integrations::get( 'forms.activecampaign' );
		return array( '' !== $account ? $account . '.activehosted.com' : 'activehosted.com' );
	}

	public function defaults(): array {
		return array( 'activecampaign' => '' !== Integrations::get( 'forms.activecampaign' ) );
	}

	public function hint(): string {
		return __( 'Form ID (digits), from the embed code: …/f/embed.php?id=12.', 'werun-blocks-community' );
	}

	public function validate( array $args ): ?array {
		$form    = self::match( $args['formId'] ?? '', '/^[1-9]\d{0,8}$/' );
		$account = self::match( Integrations::get( 'forms.activecampaign' ), '/^[a-z0-9-]{2,63}$/' );
		return ( null === $form || null === $account ) ? null : array(
			'form'    => (int) $form,
			'account' => $account,
		);
	}

	protected function markup( array $v, array $args ): string {
		return $this->mount(
			array(
				'type' => 'script',
				'src'  => 'https://' . $v['account'] . '.activehosted.com/f/embed.php?id=' . $v['form'],
			),
			sprintf( '<div class="_form_%d"></div>', $v['form'] )
		);
	}
}
