<?php
/**
 * Integrations — secret storage (API tokens of form providers and ATSs).
 * Copy of werun.Toolkit's modules/email-delivery/includes/class-secret.php.
 *
 * Each secret lives in its own option (autoload off), encrypted with a key
 * derived from this site's salts when libsodium is available. It is never
 * printed back into a page. A wp-config.php constant overrides the stored
 * value.
 *
 * @package werun-blocks-community
 */

namespace Werun\BlocksCommunity\Integrations;

defined( 'ABSPATH' ) || exit;

/**
 * Secret.
 */
final class Secret {

	/** Option prefix of the stored secrets (one option each, autoload off). */
	public const OPTION_PREFIX = 'wrbc_secret_';

	private const PREFIX_SODIUM = 'sodium:';
	private const PREFIX_PLAIN  = 'plain:';

	private string $option;
	private string $constant;

	/**
	 * Called after the stored value changes.
	 *
	 * @var callable|null
	 */
	private $on_change;

	/**
	 * Constructor.
	 *
	 * @param string        $option    Option name.
	 * @param string        $constant  wp-config.php constant that overrides it.
	 * @param callable|null $on_change Called after the stored value changes.
	 */
	public function __construct( string $option, string $constant, ?callable $on_change = null ) {
		$this->option    = $option;
		$this->constant  = $constant;
		$this->on_change = $on_change;
	}

	/**
	 * A named secret: option wrbc_secret_<name>, constant WERUN_BLOCKS_COMMUNITY_<NAME>.
	 *
	 * @param string $name Secret name, e.g. "hubspot_token".
	 */
	public static function named( string $name ): self {
		$name = sanitize_key( $name );
		return new self( self::OPTION_PREFIX . $name, 'WERUN_BLOCKS_COMMUNITY_' . strtoupper( $name ) );
	}

	/**
	 * Name of the wp-config.php constant.
	 */
	public function constant_name(): string {
		return $this->constant;
	}

	/**
	 * Whether wp-config.php sets the value.
	 */
	public function from_constant(): bool {
		return defined( $this->constant ) && '' !== (string) constant( $this->constant );
	}

	/**
	 * Whether a value is available (constant or stored).
	 */
	public function exists(): bool {
		return $this->from_constant() || '' !== (string) get_option( $this->option, '' );
	}

	/**
	 * The value in clear text, for the mailer only.
	 */
	public function get(): string {
		if ( $this->from_constant() ) {
			return (string) constant( $this->constant );
		}
		$stored = (string) get_option( $this->option, '' );
		if ( str_starts_with( $stored, self::PREFIX_SODIUM ) && function_exists( 'sodium_crypto_secretbox_open' ) ) {
			$raw = base64_decode( substr( $stored, strlen( self::PREFIX_SODIUM ) ), true );
			if ( false === $raw || strlen( $raw ) <= SODIUM_CRYPTO_SECRETBOX_NONCEBYTES ) {
				return '';
			}
			$plain = sodium_crypto_secretbox_open(
				substr( $raw, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES ),
				substr( $raw, 0, SODIUM_CRYPTO_SECRETBOX_NONCEBYTES ),
				$this->key()
			);
			return false === $plain ? '' : $plain;
		}
		if ( str_starts_with( $stored, self::PREFIX_PLAIN ) ) {
			return (string) base64_decode( substr( $stored, strlen( self::PREFIX_PLAIN ) ), true );
		}
		return '';
	}

	/**
	 * Stores a value (autoload off).
	 *
	 * @param string $value Clear text.
	 */
	public function set( string $value ): void {
		if ( function_exists( 'sodium_crypto_secretbox' ) ) {
			$nonce  = random_bytes( SODIUM_CRYPTO_SECRETBOX_NONCEBYTES );
			$stored = self::PREFIX_SODIUM . base64_encode( $nonce . sodium_crypto_secretbox( $value, $nonce, $this->key() ) );
		} else {
			$stored = self::PREFIX_PLAIN . base64_encode( $value );
		}
		delete_option( $this->option );
		add_option( $this->option, $stored, '', false );
		$this->changed();
	}

	/**
	 * Deletes the stored value.
	 */
	public function clear(): void {
		delete_option( $this->option );
		$this->changed();
	}

	/**
	 * Settings sanitizer for the secret field: a new value is stored apart
	 * and the settings array keeps an empty string; blank keeps the old one.
	 *
	 * @param mixed $raw Submitted value.
	 */
	public function sanitize_field( $raw ): string {
		// phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- a secret: sanitizing would change it.
		$value = is_scalar( $raw ) ? trim( (string) $raw ) : '';
		if ( '' !== $value && $value !== $this->get() ) {
			$this->set( $value );
		}
		return '';
	}

	/**
	 * Settings sanitizer for the "Remove the saved …" switch.
	 *
	 * @param mixed $raw Submitted value.
	 */
	public function sanitize_clear( $raw ): bool {
		if ( ! empty( $raw ) ) {
			$this->clear();
		}
		return false;
	}

	/**
	 * Runs the change callback.
	 */
	private function changed(): void {
		if ( $this->on_change ) {
			call_user_func( $this->on_change );
		}
	}

	/**
	 * Encryption key derived from the site salts and the option name.
	 */
	private function key(): string {
		return substr( hash( 'sha256', wp_salt( 'secure_auth' ) . $this->option, true ), 0, SODIUM_CRYPTO_SECRETBOX_KEYBYTES );
	}
}
