<?php
/**
 * Plugin Name: WRB A11Y fixtures (local only)
 * Description: Fixture content types, taxonomies and meta for the werun.Blocks.Community accessibility harness, an offline mock of the ATS job boards (board "acme"), a stand-in Contact Form 7 (only while the real plugin is not active) and stock Hello Elementor CSS on fixture pages (?wrbc_a11y_theme=hello|hello-last). Does nothing outside a local development site (environment "local", local host). Remove with: harness/cleanup.sh --all
 * Version: 1.0.0
 * License: GPLv2 or later
 *
 * Installed by the a11y harness as wp-content/mu-plugins/wrbc-a11y-fixtures.php.
 * Source: scratchpad a11y/harness/fixtures-mu.php (edit there, copy again).
 *
 * @package wrbc-a11y-fixtures
 */

defined( 'ABSPATH' ) || exit;

if ( ! function_exists( 'wrbc_a11y_fixtures_enabled' ) ) {
	/**
	 * Only on a local development site: environment "local" and a local host
	 * (localhost, *.localhost, *.local or *.test).
	 */
	function wrbc_a11y_fixtures_enabled() {
		static $on = null;
		if ( null === $on ) {
			$host = strtolower( (string) wp_parse_url( (string) get_option( 'home' ), PHP_URL_HOST ) );
			$on   = function_exists( 'wp_get_environment_type' ) && 'local' === wp_get_environment_type() && 1 === preg_match( '/^(localhost|.+\.(localhost|local|test))$/', $host );
		}
		return $on;
	}
}

/* ── Content types, taxonomies, meta ─────────────────────────────────── */

if ( ! function_exists( 'wrbc_a11y_fixtures_register' ) ) {
	/** Registers the fixture post types, taxonomies and meta. */
	function wrbc_a11y_fixtures_register() {
		$types = array(
			'team'            => array( 'Team members', 'Team member', 'team', true ),
			'event'           => array( 'Events', 'Event', 'events', false ),
			'location'        => array( 'Locations', 'Location', 'locations', false ),
			'resource'        => array( 'Resources', 'Resource', 'resources', false ),
			'case_study'      => array( 'Case studies', 'Case study', 'case-studies', false ),
			'testimonial_cpt' => array( 'Testimonials', 'Testimonial', 'testimonials', false ),
		);
		foreach ( $types as $type => $t ) {
			$supports = array( 'title', 'editor', 'excerpt', 'thumbnail', 'custom-fields', 'revisions' );
			if ( $t[3] ) {
				$supports[] = 'page-attributes'; // menu_order for the "Team" query variation.
			}
			register_post_type(
				$type,
				array(
					'labels'       => array(
						'name'          => $t[0],
						'singular_name' => $t[1],
						'menu_name'     => $t[0] . ' (a11y)',
					),
					'public'       => true,
					'show_in_rest' => true,
					'has_archive'  => false,
					'rewrite'      => array( 'slug' => 'wrbc-a11y-' . $t[2] ),
					'menu_icon'    => 'dashicons-universal-access',
					'supports'     => $supports,
				)
			);
		}

		$taxonomies = array(
			'department'    => array( 'Departments', 'Department', array( 'team', 'case_study' ), true ),
			'event_type'    => array( 'Event types', 'Event type', array( 'event' ), false ),
			'region'        => array( 'Regions', 'Region', array( 'location', 'case_study' ), true ),
			// Not in the original list: the resource library filters by it.
			'resource_type' => array( 'Resource types', 'Resource type', array( 'resource' ), false ),
		);
		foreach ( $taxonomies as $tax => $t ) {
			register_taxonomy(
				$tax,
				$t[2],
				array(
					'labels'            => array(
						'name'          => $t[0],
						'singular_name' => $t[1],
					),
					'public'            => true,
					'show_in_rest'      => true,
					'hierarchical'      => $t[3],
					'show_admin_column' => true,
					'rewrite'           => array( 'slug' => 'wrbc-a11y-' . str_replace( '_', '-', $tax ) ),
				)
			);
		}

		$can  = static function () {
			return current_user_can( 'edit_posts' );
		};
		$meta = array(
			'team'            => array(
				'team_role'     => array( 'string', 'Role or job title.' ),
				'team_email'    => array( 'string', 'Work email.' ),
				'team_linkedin' => array( 'string', 'LinkedIn profile URL.' ),
			),
			'event'           => array(
				'event_start_date' => array( 'string', 'Start date, Ymd (ACF date picker format).' ),
				'event_end_date'   => array( 'string', 'End date, Ymd.' ),
				'event_venue'      => array( 'string', 'Venue or "Online".' ),
				'event_price'      => array( 'number', 'Ticket price.' ),
			),
			'location'        => array(
				'location_lat'     => array( 'number', 'Latitude.' ),
				'location_lng'     => array( 'number', 'Longitude.' ),
				'location_latlng'  => array( 'string', 'Latitude and longitude as "lat,lng".' ),
				'location_address' => array( 'string', 'Street address.' ),
				'location_phone'   => array( 'string', 'Phone number.' ),
				'location_email'   => array( 'string', 'Contact email.' ),
				'location_hours'   => array( 'string', 'Opening hours.' ),
			),
			'resource'        => array(
				// _wrbc_download_id is registered by werun.Blocks.Community itself (edit context only): not here.
				'resource_pages' => array( 'integer', 'Number of pages.' ),
			),
			'case_study'      => array(
				'case_client'  => array( 'string', 'Client name.' ),
				'case_metric'  => array( 'string', 'Headline result.' ),
				'case_logo_id' => array( 'integer', 'Client logo (attachment id).' ),
			),
			'testimonial_cpt' => array(
				'testimonial_rating'  => array( 'number', 'Rating 0-5.' ),
				'testimonial_company' => array( 'string', 'Company.' ),
				'testimonial_role'    => array( 'string', 'Role of the person quoted.' ),
			),
		);
		foreach ( $meta as $type => $keys ) {
			foreach ( $keys as $key => $m ) {
				register_post_meta(
					$type,
					$key,
					array(
						'type'          => $m[0],
						'description'   => $m[1],
						'single'        => true,
						'show_in_rest'  => true,
						'auth_callback' => $can,
					)
				);
			}
		}
	}
}

/* ── Stock Hello Elementor CSS on fixture pages (?wrbc_a11y_theme=hello|hello-last) ──
 * This site doesn't print Hello's stylesheets; a stock Hello site does, and
 * they restyle buttons, links and .alignwide. "hello" prints them first in
 * <head> (block styles come after), "hello-last" at the very end of <body>
 * (after every block style: the realistic worst case).
 */

if ( ! function_exists( 'wrbc_a11y_fixtures_theme_mode' ) ) {
	/** The requested mode on a fixture page, or ''. */
	function wrbc_a11y_fixtures_theme_mode() {
		// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- read-only switch for local test pages.
		$mode = isset( $_GET['wrbc_a11y_theme'] ) ? sanitize_key( wp_unslash( $_GET['wrbc_a11y_theme'] ) ) : '';
		if ( ! in_array( $mode, array( 'hello', 'hello-last' ), true ) || ! is_singular() ) {
			return '';
		}
		return get_post_meta( get_queried_object_id(), '_wrbc_a11y_fixture', true ) ? $mode : '';
	}
}

if ( ! function_exists( 'wrbc_a11y_fixtures_theme_links' ) ) {
	/** Prints Hello's reset.css, theme.css and header-footer.css (those that exist). */
	function wrbc_a11y_fixtures_theme_links() {
		$root = get_theme_root( 'hello-elementor' ) . '/hello-elementor/assets/css/';
		$url  = get_theme_root_uri( 'hello-elementor' ) . '/hello-elementor/assets/css/';
		foreach ( array( 'reset', 'theme', 'header-footer' ) as $name ) {
			if ( file_exists( $root . $name . '.css' ) ) {
				printf( "<link rel='stylesheet' id='wrbc-a11y-hello-%s-css' href='%s' media='all' />\n", esc_attr( $name ), esc_url( $url . $name . '.css?ver=' . filemtime( $root . $name . '.css' ) ) );
			}
		}
	}
}

if ( wrbc_a11y_fixtures_enabled() ) {
	add_action(
		'wp_head',
		static function () {
			if ( 'hello' === wrbc_a11y_fixtures_theme_mode() ) {
				wrbc_a11y_fixtures_theme_links();
			}
		},
		0
	);
	add_action(
		'wp_footer',
		static function () {
			if ( 'hello-last' === wrbc_a11y_fixtures_theme_mode() ) {
				wrbc_a11y_fixtures_theme_links();
			}
		},
		9999
	);
	add_action( 'init', 'wrbc_a11y_fixtures_register', 5 );
	add_filter( 'pre_http_request', 'wrbc_a11y_fixtures_ats', 1, 3 );
	// Fixture pages: no indexing (they are test pages on a local site anyway).
	add_filter(
		'wp_robots',
		static function ( $robots ) {
			if ( is_singular() && get_post_meta( get_queried_object_id(), '_wrbc_a11y_fixture', true ) ) {
				$robots['noindex'] = true;
			}
			return $robots;
		}
	);
}

/* ── Offline ATS mock ────────────────────────────────────────────────────
 * Boards: "acme" = 8 jobs in 3 departments, "acme-empty" = no jobs,
 * "acme-404" = 404. Any other board goes to the network as usual.
 * Teamtailor (no slug) answers only for the API key "wrbc-a11y-fixture".
 */

if ( ! function_exists( 'wrbc_a11y_fixtures_jobs' ) ) {
	/** The canned jobs, provider neutral. */
	function wrbc_a11y_fixtures_jobs() {
		$now  = time();
		$desc = static function ( $title ) {
			return '<p>We are looking for a ' . $title . ' to join a small, friendly team.</p><h3>What you will do</h3><ul><li>Ship work that real customers use every day.</li><li>Pair with designers and engineers across time zones.</li></ul><h3>What we offer</h3><ul><li>Flexible hours</li><li>Learning budget</li></ul>';
		};
		$rows = array(
			array( 'Senior Frontend Engineer', 'Engineering', 'Web Platform', array( 'Buenos Aires, Argentina', 'Remote' ), 'Full-time', true, 90000, 120000, 'USD', 3 ),
			array( 'Backend Engineer (PHP)', 'Engineering', 'Core', array( 'Madrid, Spain' ), 'Full-time', false, 55000, 70000, 'EUR', 9 ),
			array( 'Engineering Intern', 'Engineering', 'Web Platform', array( 'Remote' ), 'Internship', true, 0, 0, '', 15 ),
			array( 'Product Designer', 'Design', 'Product', array( 'Barcelona, Spain' ), 'Full-time', false, 50000, 65000, 'EUR', 5 ),
			array( 'Brand Designer', 'Design', 'Brand', array( 'Remote' ), 'Contract', true, 0, 0, '', 21 ),
			array( 'Account Executive', 'Sales', 'Mid-market', array( 'New York, NY' ), 'Full-time', false, 80000, 110000, 'USD', 2 ),
			array( 'Sales Development Representative', 'Sales', 'Outbound', array( 'Mexico City, Mexico' ), 'Part-time', false, 0, 0, '', 30 ),
			array( 'Partnerships Manager', 'Sales', 'Partners', array( 'London, United Kingdom', 'Remote' ), 'Full-time', true, 70000, 90000, 'GBP', 40 ),
		);
		$jobs = array();
		foreach ( $rows as $i => $r ) {
			$n      = $i + 1;
			$jobs[] = array(
				'n'          => $n,
				'id'         => 4001000 + $n,
				'uuid'       => sprintf( 'a11y0000-0000-4000-8000-%012d', $n ),
				'code'       => 'ACME' . str_pad( (string) $n, 3, '0', STR_PAD_LEFT ),
				'title'      => $r[0],
				'department' => $r[1],
				'team'       => $r[2],
				'locations'  => $r[3],
				'type'       => $r[4],
				'remote'     => $r[5],
				'min'        => $r[6],
				'max'        => $r[7],
				'currency'   => $r[8],
				'posted'     => $now - $r[9] * DAY_IN_SECONDS,
				'html'       => $desc( strtolower( $r[0] ) ),
				'slug'       => sanitize_title( $r[0] ),
			);
		}
		return $jobs;
	}
}

if ( ! function_exists( 'wrbc_a11y_fixtures_ats_payload' ) ) {
	/**
	 * Body and content type a provider would send for the canned jobs.
	 *
	 * @param string $provider Provider id.
	 * @param array  $jobs     wrbc_a11y_fixtures_jobs() or array().
	 * @param string $board    Board slug.
	 * @param string $host     Host asked (Personio).
	 * @return array{0:string,1:string} Body, content type.
	 */
	function wrbc_a11y_fixtures_ats_payload( $provider, array $jobs, $board, $host ) {
		$iso  = static function ( $t ) {
			return gmdate( 'c', $t );
		};
		$json = 'application/json; charset=utf-8';
		$out  = array();
		switch ( $provider ) {
			case 'greenhouse':
				foreach ( $jobs as $j ) {
					$out[] = array(
						'id'              => $j['id'],
						'internal_job_id' => $j['id'] - 1000,
						'title'           => $j['title'],
						'absolute_url'    => 'https://job-boards.greenhouse.io/' . $board . '/jobs/' . $j['id'],
						'location'        => array( 'name' => implode( '; ', $j['locations'] ) ),
						'departments'     => array(
							array( 'id' => crc32( $j['department'] ), 'name' => $j['department'] ),
							array( 'id' => crc32( $j['team'] ), 'name' => $j['team'] ),
						),
						'metadata'        => array( array( 'id' => 1, 'name' => 'Employment Type', 'value' => $j['type'], 'value_type' => 'single_select' ) ),
						'first_published' => $iso( $j['posted'] ),
						'updated_at'      => $iso( $j['posted'] + HOUR_IN_SECONDS ),
						// Greenhouse encodes the HTML entities once more.
						'content'         => htmlspecialchars( $j['html'], ENT_QUOTES ),
					);
				}
				return array( wp_json_encode( array( 'jobs' => $out, 'meta' => array( 'total' => count( $out ) ) ) ), $json );

			case 'lever':
				foreach ( $jobs as $j ) {
					$row = array(
						'id'            => $j['uuid'],
						'text'          => $j['title'],
						'categories'    => array(
							'department'   => $j['department'],
							'team'         => $j['team'],
							'location'     => $j['locations'][0],
							'allLocations' => $j['locations'],
							'commitment'   => $j['type'],
						),
						'workplaceType' => $j['remote'] ? 'remote' : 'onsite',
						'hostedUrl'     => 'https://jobs.lever.co/' . $board . '/' . $j['uuid'],
						'applyUrl'      => 'https://jobs.lever.co/' . $board . '/' . $j['uuid'] . '/apply',
						'createdAt'     => $j['posted'] * 1000,
						'description'   => '<p>We are looking for a ' . esc_html( strtolower( $j['title'] ) ) . '.</p>',
						'lists'         => array(
							array( 'text' => 'What you will do', 'content' => '<li>Ship work that real customers use.</li><li>Pair across time zones.</li>' ),
						),
						'additional'    => '<p>Flexible hours and a learning budget.</p>',
					);
					if ( $j['min'] ) {
						$row['salaryRange'] = array( 'min' => $j['min'], 'max' => $j['max'], 'currency' => $j['currency'], 'interval' => 'per-year-salary' );
					}
					$out[] = $row;
				}
				return array( wp_json_encode( $out ), $json );

			case 'ashby':
				foreach ( $jobs as $j ) {
					$secondary = array();
					foreach ( array_slice( $j['locations'], 1 ) as $place ) {
						$secondary[] = array( 'location' => $place );
					}
					$out[] = array(
						'id'                 => $j['uuid'],
						'title'              => $j['title'],
						'department'         => $j['department'],
						'team'               => $j['team'],
						'location'           => $j['locations'][0],
						'secondaryLocations' => $secondary,
						'isRemote'           => $j['remote'],
						'workplaceType'      => $j['remote'] ? 'Remote' : 'OnSite',
						'employmentType'     => str_replace( '-', '', $j['type'] ),
						'jobUrl'             => 'https://jobs.ashbyhq.com/' . $board . '/' . $j['uuid'],
						'applyUrl'           => 'https://jobs.ashbyhq.com/' . $board . '/' . $j['uuid'] . '/application',
						'publishedAt'        => $iso( $j['posted'] ),
						'isListed'           => true,
						'compensation'       => $j['min'] ? array( 'compensationTierSummary' => $j['currency'] . ' ' . number_format( $j['min'] ) . ' – ' . number_format( $j['max'] ) ) : array(),
						'descriptionHtml'    => $j['html'],
					);
				}
				return array( wp_json_encode( array( 'apiVersion' => '1', 'jobs' => $out ) ), $json );

			case 'workable':
				foreach ( $jobs as $j ) {
					$place = explode( ', ', $j['locations'][0] );
					$locs  = array();
					foreach ( $j['locations'] as $loc ) {
						$p      = explode( ', ', $loc );
						$locs[] = array( 'country' => $p[1] ?? '', 'region' => '', 'city' => $p[0], 'hidden' => false );
					}
					$out[] = array(
						'title'           => $j['title'],
						'shortcode'       => $j['code'],
						'code'            => '',
						'employment_type' => $j['type'],
						'telecommuting'   => $j['remote'],
						'department'      => $j['department'],
						'function'        => $j['team'],
						'url'             => 'https://apply.workable.com/j/' . $j['code'],
						'shortlink'       => 'https://apply.workable.com/j/' . $j['code'],
						'application_url' => 'https://apply.workable.com/j/' . $j['code'] . '/apply',
						'published_on'    => gmdate( 'Y-m-d', $j['posted'] ),
						'created_at'      => gmdate( 'Y-m-d', $j['posted'] ),
						'country'         => $place[1] ?? '',
						'city'            => $place[0],
						'state'           => '',
						'locations'       => $locs,
						'description'     => $j['html'],
					);
				}
				return array( wp_json_encode( array( 'name' => 'Acme', 'description' => '', 'jobs' => $out ) ), $json );

			case 'smartrecruiters':
				foreach ( $jobs as $j ) {
					$place = explode( ', ', $j['locations'][0] );
					$out[] = array(
						'id'               => (string) ( 744000000000 + $j['n'] ),
						'name'             => $j['title'],
						'company'          => array( 'identifier' => $board, 'name' => 'Acme' ),
						'releasedDate'     => $iso( $j['posted'] ),
						'location'         => array(
							'city'         => $place[0],
							'region'       => '',
							'country'      => strtolower( substr( $place[1] ?? 'xx', 0, 2 ) ),
							'remote'       => $j['remote'],
							'fullLocation' => $j['locations'][0],
						),
						'department'       => array( 'id' => (string) crc32( $j['department'] ), 'label' => $j['department'] ),
						'function'         => array( 'id' => (string) crc32( $j['team'] ), 'label' => $j['team'] ),
						'typeOfEmployment' => array( 'id' => sanitize_title( $j['type'] ), 'label' => $j['type'] ),
					);
				}
				return array(
					wp_json_encode(
						array(
							'offset'     => 0,
							'limit'      => 100,
							'totalFound' => count( $out ),
							'content'    => $out,
						)
					),
					$json,
				);

			case 'personio':
				$xml = '<?xml version="1.0" encoding="UTF-8"?>' . "\n" . '<workzag-jobs>';
				foreach ( $jobs as $j ) {
					$x    = static function ( $v ) {
						return htmlspecialchars( (string) $v, ENT_XML1 | ENT_QUOTES, 'UTF-8' );
					};
					$xml .= '<position><id>' . ( 1000 + $j['n'] ) . '</id><subcompany>Acme</subcompany><office>' . $x( $j['locations'][0] ) . '</office>';
					if ( count( $j['locations'] ) > 1 ) {
						$xml .= '<additionalOffices>';
						foreach ( array_slice( $j['locations'], 1 ) as $place ) {
							$xml .= '<office>' . $x( $place ) . '</office>';
						}
						$xml .= '</additionalOffices>';
					}
					$xml .= '<department>' . $x( $j['department'] ) . '</department><name>' . $x( $j['title'] ) . '</name>';
					$xml .= '<jobDescriptions><jobDescription><name>About the role</name><value><![CDATA[' . $j['html'] . ']]></value></jobDescription></jobDescriptions>';
					$xml .= '<employmentType>' . ( 'Contract' === $j['type'] ? 'freelance' : ( 'Internship' === $j['type'] ? 'intern' : 'permanent' ) ) . '</employmentType>';
					$xml .= '<schedule>' . ( 'Part-time' === $j['type'] ? 'part-time' : 'full-time' ) . '</schedule>';
					$xml .= '<createdAt>' . $iso( $j['posted'] ) . '</createdAt></position>';
				}
				$xml .= '</workzag-jobs>';
				return array( $xml, 'text/xml; charset=utf-8' );

			case 'bamboohr':
				foreach ( $jobs as $j ) {
					$place = explode( ', ', $j['locations'][0] );
					$out[] = array(
						'id'                    => (string) ( 100 + $j['n'] ),
						'jobOpeningName'        => $j['title'],
						'departmentId'          => (string) crc32( $j['department'] ),
						'departmentLabel'       => $j['department'],
						'employmentStatusLabel' => $j['type'],
						'location'              => array( 'city' => $place[0], 'state' => null ),
						'atsLocation'           => array( 'country' => $place[1] ?? null, 'state' => null, 'province' => null, 'city' => $place[0] ),
						'isRemote'              => $j['remote'],
						'locationType'          => $j['remote'] ? '1' : '0',
						'datePosted'            => gmdate( 'Y-m-d', $j['posted'] ),
					);
				}
				return array( wp_json_encode( array( 'meta' => array( 'totalCount' => count( $out ) ), 'result' => $out ) ), $json );

			case 'teamtailor':
				$included = array();
				$depts    = array();
				$places   = array();
				foreach ( $jobs as $j ) {
					if ( ! isset( $depts[ $j['department'] ] ) ) {
						$depts[ $j['department'] ] = (string) ( count( $depts ) + 1 );
						$included[]                = array( 'id' => $depts[ $j['department'] ], 'type' => 'departments', 'attributes' => array( 'name' => $j['department'] ) );
					}
					$refs = array();
					foreach ( $j['locations'] as $loc ) {
						if ( ! isset( $places[ $loc ] ) ) {
							$places[ $loc ] = (string) ( count( $places ) + 1 );
							$p              = explode( ', ', $loc );
							$included[]     = array( 'id' => $places[ $loc ], 'type' => 'locations', 'attributes' => array( 'name' => $loc, 'city' => $p[0], 'country' => $p[1] ?? '' ) );
						}
						$refs[] = array( 'id' => $places[ $loc ], 'type' => 'locations' );
					}
					$out[] = array(
						'id'            => (string) $j['n'],
						'type'          => 'jobs',
						'attributes'    => array(
							'title'            => $j['title'],
							'body'             => $j['html'],
							'employment-type'  => strtolower( str_replace( '-', '', $j['type'] ) ),
							'remote-status'    => $j['remote'] ? 'fully' : 'none',
							'created-at'       => $iso( $j['posted'] ),
							'min-salary'       => $j['min'],
							'max-salary'       => $j['max'],
							'currency'         => $j['currency'],
							'salary-time-unit' => 'yearly',
						),
						'links'         => array(
							'careersite-job-url'       => 'https://acme.teamtailor.com/jobs/' . $j['n'] . '-' . $j['slug'],
							'careersite-job-apply-url' => 'https://acme.teamtailor.com/jobs/' . $j['n'] . '-' . $j['slug'] . '/applications/new',
						),
						'relationships' => array(
							'department' => array( 'data' => array( 'id' => $depts[ $j['department'] ], 'type' => 'departments' ) ),
							'locations'  => array( 'data' => $refs ),
						),
					);
				}
				return array( wp_json_encode( array( 'data' => $out, 'included' => $included, 'links' => array(), 'meta' => array( 'record-count' => count( $out ) ) ) ), 'application/vnd.api+json; charset=utf-8' );
		}
		return array( '', $json );
	}
}

if ( ! function_exists( 'wrbc_a11y_fixtures_ats' ) ) {
	/**
	 * pre_http_request: answers the ATS endpoints for the fixture boards.
	 *
	 * @param false|array|WP_Error $pre  Short-circuit value.
	 * @param array                $args Request args.
	 * @param string               $url  URL.
	 * @return false|array
	 */
	function wrbc_a11y_fixtures_ats( $pre, $args, $url ) {
		if ( false !== $pre || ! is_string( $url ) ) {
			return $pre;
		}
		$host  = strtolower( (string) wp_parse_url( $url, PHP_URL_HOST ) );
		$path  = (string) wp_parse_url( $url, PHP_URL_PATH );
		$query = array();
		wp_parse_str( (string) wp_parse_url( $url, PHP_URL_QUERY ), $query );

		$provider = '';
		$board    = '';
		$m        = array();
		if ( 'boards-api.greenhouse.io' === $host && preg_match( '#^/v1/boards/([^/]+)/jobs$#', $path, $m ) ) {
			$provider = 'greenhouse';
			$board    = $m[1];
		} elseif ( in_array( $host, array( 'api.lever.co', 'api.eu.lever.co' ), true ) && preg_match( '#^/v0/postings/([^/]+)$#', $path, $m ) ) {
			$provider = 'lever';
			$board    = $m[1];
		} elseif ( 'api.ashbyhq.com' === $host && preg_match( '#^/posting-api/job-board/([^/]+)$#', $path, $m ) ) {
			$provider = 'ashby';
			$board    = $m[1];
		} elseif ( 'apply.workable.com' === $host && preg_match( '#^/api/v1/widget/accounts/([^/]+)$#', $path, $m ) ) {
			$provider = 'workable';
			$board    = $m[1];
		} elseif ( 'api.smartrecruiters.com' === $host && preg_match( '#^/v1/companies/([^/]+)/postings$#', $path, $m ) ) {
			$provider = 'smartrecruiters';
			$board    = $m[1];
		} elseif ( preg_match( '#^([a-z0-9-]+)\.jobs\.personio\.(de|com)$#', $host, $m ) && '/xml' === $path ) {
			$provider = 'personio';
			$board    = $m[1];
		} elseif ( preg_match( '#^([a-z0-9-]+)\.bamboohr\.com$#', $host, $m ) && '/careers/list' === $path && 'api' !== $m[1] ) {
			$provider = 'bamboohr';
			$board    = $m[1];
		} elseif ( 'api.bamboohr.com' === $host && preg_match( '#^/api/gateway\.php/([^/]+)/v1/applicant_tracking/jobs$#', $path, $m ) ) {
			$provider = 'bamboohr-api';
			$board    = $m[1];
		} elseif ( 'api.teamtailor.com' === $host && '/v1/jobs' === $path ) {
			$auth = is_array( $args['headers'] ?? null ) ? (string) ( $args['headers']['Authorization'] ?? '' ) : '';
			if ( 'Token token=wrbc-a11y-fixture' !== $auth ) {
				return $pre;
			}
			$provider = 'teamtailor';
			$board    = 'acme';
		}
		$board = strtolower( rawurldecode( $board ) );
		if ( '' === $provider || ! in_array( $board, array( 'acme', 'acme-empty', 'acme-404' ), true ) ) {
			return $pre;
		}

		$respond = static function ( $code, $body, $type ) {
			return array(
				'headers'  => array( 'content-type' => $type ),
				'body'     => $body,
				'response' => array(
					'code'    => $code,
					'message' => get_status_header_desc( $code ),
				),
				'cookies'  => array(),
				'filename' => null,
			);
		};
		if ( 'acme-404' === $board ) {
			return $respond( 404, '{"status":404,"error":"Not found"}', 'application/json' );
		}
		if ( 'bamboohr-api' === $provider ) {
			return $respond( 200, '[]', 'application/json' );
		}
		$jobs = 'acme' === $board ? wrbc_a11y_fixtures_jobs() : array();
		// SmartRecruiters / Teamtailor pages after the first are empty.
		if ( ( 'smartrecruiters' === $provider && ! empty( $query['offset'] ) ) || ( 'teamtailor' === $provider && ! empty( $query['page']['number'] ) && (int) $query['page']['number'] > 1 ) ) {
			$jobs = array();
		}
		list( $body, $type ) = wrbc_a11y_fixtures_ats_payload( $provider, $jobs, $board, $host );
		return $respond( 200, $body, $type );
	}
}


/* ── Stand-in Contact Form 7 ─────────────────────────────────────────────
 * No form plugin is installed on this site, so the form block's native
 * provider ("contact" variation) and hard gating can't be seen. This imitates
 * what werun.Blocks.Community relies on (includes/forms/providers/class-cf7.php,
 * includes/forms/class-forms.php, includes/gate/class-hard.php):
 *   - class WPCF7_ContactForm (find(), get_instance(), id(), title()…),
 *     wpcf7_contact_form(), WPCF7_Submission, post type wpcf7_contact_form;
 *   - shortcode [contact-form-7 id="…"] printing CF7 6.x markup: labels,
 *     .wpcf7-form-control fields (name, email, message, acceptance), the
 *     hidden fields incl. the wpcf7_form_hidden_fields filter (the gate
 *     ticket), the screen-reader response, .wpcf7-response-output and
 *     .wpcf7-not-valid-tip errors, CF7's stock CSS;
 *   - submissions: REST POST contact-form-7/v1/contact-forms/{id}/feedback
 *     (CF7's JSON: status, message, invalid_fields, into…) used by a small
 *     copy of CF7's front-end script (status classes, errors, the
 *     wpcf7mailsent / wpcf7invalid / wpcf7submit events, submit disabled
 *     until the acceptance is ticked), and the no-JS POST to the page
 *     (handled on "wp", the result printed in the form). Both fire
 *     wpcf7_before_send_mail and wpcf7_mail_sent (no mail is sent);
 *   - form post meta _wrbc_a11y_state: "invalid" prints the form in its
 *     error state (static audits), "mail_failed" makes sending fail.
 * Only when the real Contact Form 7 is not active (checked on plugins_loaded).
 */

if ( ! function_exists( 'wrbc_a11y_cf7_boot' ) ) {
	/** Declares the stand-in on plugins_loaded, unless the real plugin is there. */
	function wrbc_a11y_cf7_boot() {
		if ( class_exists( 'WPCF7_ContactForm', false ) || defined( 'WPCF7_VERSION' ) || function_exists( 'wpcf7' ) ) {
			return;
		}
		define( 'WRB_A11Y_FAKE_CF7', '6.0-a11y' );

		/** Stand-in for CF7's form class: what werun.Blocks.Community and themes call. */
		class WPCF7_ContactForm { // phpcs:ignore
			/** @var WP_Post */
			private $post;
			/** @var WPCF7_ContactForm|null */
			private static $current = null;
			public static function find( $args = array() ) {
				$posts = get_posts(
					array_merge(
						array(
							'post_type'      => 'wpcf7_contact_form',
							'post_status'    => 'publish',
							'posts_per_page' => -1,
							'orderby'        => 'ID',
							'order'          => 'ASC',
						),
						(array) $args
					)
				);
				return array_map(
					static function ( $p ) {
						return new self( $p );
					},
					$posts
				);
			}
			public static function get_instance( $post ) {
				$post = get_post( $post );
				return ( $post && 'wpcf7_contact_form' === $post->post_type ) ? new self( $post ) : null;
			}
			public static function get_current() {
				return self::$current;
			}
			public static function set_current( $form ) {
				self::$current = $form;
			}
			public function __construct( $post ) {
				$this->post = $post;
			}
			public function id() {
				return (int) $this->post->ID;
			}
			public function title() {
				return $this->post->post_title;
			}
			public function name() {
				return $this->post->post_name;
			}
			public function locale() {
				return 'en_US';
			}
			public function initial() {
				return false;
			}
			public function prop( $name ) {
				return get_post_meta( $this->id(), '_' . $name, true );
			}
			public function is_true( $name ) {
				return in_array( strtolower( (string) $this->prop( $name ) ), array( 'on', 'true', '1' ), true );
			}
			public function shortcode( $args = array() ) {
				return sprintf( '[contact-form-7 id="%1$d" title="%2$s"]', $this->id(), $this->title() );
			}
			public function form_html( $args = array() ) {
				return wrbc_a11y_cf7_html( $this, (array) $args );
			}
		}

		/** Stand-in for CF7's submission object (passed to wpcf7_before_send_mail). */
		class WPCF7_Submission { // phpcs:ignore
			/** @var WPCF7_Submission|null */
			private static $instance = null;
			private $contact_form;
			private $posted_data = array();
			private $status      = 'init';
			private $response    = '';
			public static function get_instance( $contact_form = null, $args = array() ) {
				if ( $contact_form ) {
					self::$instance = new self( $contact_form, (array) $args );
				}
				return self::$instance;
			}
			private function __construct( $contact_form, $args ) {
				$this->contact_form = $contact_form;
				$this->posted_data  = isset( $args['posted_data'] ) ? (array) $args['posted_data'] : array();
			}
			public function get_contact_form() {
				return $this->contact_form;
			}
			public function get_posted_data( $name = '' ) {
				return '' === $name ? $this->posted_data : ( $this->posted_data[ $name ] ?? null );
			}
			public function get_status() {
				return $this->status;
			}
			public function set_status( $status ) {
				$this->status = (string) $status;
			}
			public function get_response() {
				return $this->response;
			}
			public function set_response( $response ) {
				$this->response = (string) $response;
			}
			public function get_meta( $name ) {
				return null;
			}
		}

		if ( ! function_exists( 'wpcf7_contact_form' ) ) {
			/** CF7 API: a form by id. */
			function wpcf7_contact_form( $id ) { // phpcs:ignore
				return WPCF7_ContactForm::get_instance( $id );
			}
		}

		add_action( 'init', 'wrbc_a11y_cf7_init' );
		add_action( 'rest_api_init', 'wrbc_a11y_cf7_routes' );
		add_action( 'wp', 'wrbc_a11y_cf7_nojs' );
		add_action( 'wp_enqueue_scripts', 'wrbc_a11y_cf7_assets' );
	}
}

if ( ! function_exists( 'wrbc_a11y_cf7_init' ) ) {
	/** Post type and shortcodes (CF7 registers both shortcode names). */
	function wrbc_a11y_cf7_init() {
		register_post_type(
			'wpcf7_contact_form',
			array(
				'labels'          => array(
					'name'          => 'Contact Forms',
					'singular_name' => 'Contact Form',
				),
				'public'          => false,
				'show_ui'         => false,
				'rewrite'         => false,
				'query_var'       => false,
				'capability_type' => 'page',
			)
		);
		add_shortcode( 'contact-form-7', 'wrbc_a11y_cf7_shortcode' );
		add_shortcode( 'contact-form', 'wrbc_a11y_cf7_shortcode' );
		wp_register_style( 'contact-form-7', false, array(), WRB_A11Y_FAKE_CF7 );
		wp_add_inline_style( 'contact-form-7', wrbc_a11y_cf7_css() );
		wp_register_script( 'contact-form-7', false, array(), WRB_A11Y_FAKE_CF7, true );
		wp_add_inline_script(
			'contact-form-7',
			'var wpcf7 = ' . wp_json_encode(
				array(
					'api' => array(
						'root'      => esc_url_raw( rest_url() ),
						'namespace' => 'contact-form-7/v1',
					),
				)
			) . ';',
			'before'
		);
		wp_add_inline_script( 'contact-form-7', wrbc_a11y_cf7_js() );
	}
}

if ( ! function_exists( 'wrbc_a11y_cf7_assets' ) ) {
	/** CF7 prints its CSS in <head> and its script in the footer: here on pages with a form. */
	function wrbc_a11y_cf7_assets() {
		$post = is_singular() ? get_post() : null;
		if ( $post && ( has_shortcode( $post->post_content, 'contact-form-7' ) || false !== strpos( $post->post_content, '"provider":"cf7"' ) ) ) {
			wp_enqueue_style( 'contact-form-7' );
			wp_enqueue_script( 'contact-form-7' );
		}
	}
}

if ( ! function_exists( 'wrbc_a11y_cf7_fields' ) ) {
	/** The fields of every stand-in form (CF7's default template). */
	function wrbc_a11y_cf7_fields() {
		return array(
			'your-name'    => array( 'label' => 'Your name', 'type' => 'text', 'required' => true, 'autocomplete' => 'name' ),
			'your-email'   => array( 'label' => 'Your email', 'type' => 'email', 'required' => true, 'autocomplete' => 'email' ),
			'your-message' => array( 'label' => 'Your message (optional)', 'type' => 'textarea', 'required' => false, 'autocomplete' => '' ),
			'acceptance-1' => array( 'label' => 'I agree that my details are used to answer this request.', 'type' => 'acceptance', 'required' => true, 'autocomplete' => '' ),
		);
	}
}

if ( ! function_exists( 'wrbc_a11y_cf7_messages' ) ) {
	/** CF7's default messages. */
	function wrbc_a11y_cf7_messages() {
		return array(
			'mail_sent_ok'     => 'Thank you for your message. It has been sent.',
			'mail_sent_ng'     => 'There was an error trying to send your message. Please try again later.',
			'validation_error' => 'One or more fields have an error. Please check and try again.',
			'accept_terms'     => 'You must accept the terms and conditions before sending your message.',
			'invalid_required' => 'Please fill out this field.',
			'invalid_email'    => 'Please enter an email address.',
			'aborted'          => 'Sending mail has been aborted.',
		);
	}
}

if ( ! function_exists( 'wrbc_a11y_cf7_process' ) ) {
	/**
	 * Validates a submission ($_POST) and fires CF7's hooks.
	 *
	 * @param WPCF7_ContactForm $form Form.
	 * @return array{status:string,message:string,invalid:array,posted:array}
	 */
	function wrbc_a11y_cf7_process( $form ) {
		$m       = wrbc_a11y_cf7_messages();
		$posted  = array();
		$invalid = array();
		// phpcs:disable WordPress.Security.NonceVerification.Missing -- CF7 has no nonce for visitors either.
		foreach ( wrbc_a11y_cf7_fields() as $name => $f ) {
			$raw             = isset( $_POST[ $name ] ) ? wp_unslash( $_POST[ $name ] ) : ''; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
			$posted[ $name ] = 'textarea' === $f['type'] ? sanitize_textarea_field( (string) $raw ) : sanitize_text_field( (string) $raw );
		}
		// phpcs:enable
		if ( '' === trim( $posted['your-name'] ) ) {
			$invalid['your-name'] = $m['invalid_required'];
		}
		if ( '' === trim( $posted['your-email'] ) ) {
			$invalid['your-email'] = $m['invalid_required'];
		} elseif ( ! is_email( $posted['your-email'] ) ) {
			$invalid['your-email'] = $m['invalid_email'];
		}
		WPCF7_ContactForm::set_current( $form );
		$submission = WPCF7_Submission::get_instance( $form, array( 'posted_data' => $posted ) );
		if ( $invalid ) {
			$status  = 'validation_failed';
			$message = $m['validation_error'];
		} elseif ( '' === $posted['acceptance-1'] ) {
			$status  = 'acceptance_missing';
			$message = $m['accept_terms'];
		} else {
			$abort = false;
			do_action_ref_array( 'wpcf7_before_send_mail', array( $form, &$abort, $submission ) );
			if ( $abort ) {
				$status  = 'aborted';
				$message = $m['aborted'];
			} elseif ( 'mail_failed' === get_post_meta( $form->id(), '_wrbc_a11y_state', true ) ) {
				do_action( 'wpcf7_mail_failed', $form );
				$status  = 'mail_failed';
				$message = $m['mail_sent_ng'];
			} else {
				// No mail leaves this site: the hooks are what matters (werun.Blocks.Community' hard gate listens here).
				do_action( 'wpcf7_mail_sent', $form );
				$status  = 'mail_sent';
				$message = $m['mail_sent_ok'];
			}
		}
		$submission->set_status( $status );
		$submission->set_response( $message );
		$result = array(
			'status'  => $status,
			'message' => $message,
			'invalid' => $invalid,
			'posted'  => $posted,
		);
		do_action( 'wpcf7_submit', $form, $result );
		return $result;
	}
}

if ( ! function_exists( 'wrbc_a11y_cf7_routes' ) ) {
	/** CF7's REST endpoint: POST contact-form-7/v1/contact-forms/{id}/feedback. */
	function wrbc_a11y_cf7_routes() {
		register_rest_route(
			'contact-form-7/v1',
			'/contact-forms/(?P<id>\d+)/feedback',
			array(
				'methods'             => 'POST',
				'permission_callback' => '__return_true',
				'callback'            => static function ( WP_REST_Request $request ) {
					$form = WPCF7_ContactForm::get_instance( (int) $request['id'] );
					if ( ! $form ) {
						return new WP_Error( 'wpcf7_not_found', 'The requested contact form was not found.', array( 'status' => 404 ) );
					}
					$r    = wrbc_a11y_cf7_process( $form );
					$unit = isset( $_POST['_wpcf7_unit_tag'] ) ? sanitize_text_field( wp_unslash( $_POST['_wpcf7_unit_tag'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Missing
					$out  = array(
						'contact_form_id'  => $form->id(),
						'status'           => $r['status'],
						'message'          => $r['message'],
						'posted_data_hash' => 'mail_sent' === $r['status'] ? md5( wp_json_encode( $r['posted'] ) ) : '',
						'into'             => '' !== $unit ? '#' . $unit : '',
					);
					if ( $r['invalid'] ) {
						$out['invalid_fields'] = array();
						foreach ( $r['invalid'] as $field => $msg ) {
							$out['invalid_fields'][] = array(
								'field'    => $field,
								'message'  => $msg,
								'idref'    => null,
								'error_id' => $unit . '-ve-' . $field,
							);
						}
					}
					return rest_ensure_response( $out );
				},
			)
		);
	}
}

if ( ! function_exists( 'wrbc_a11y_cf7_nojs' ) ) {
	/** The no-JS submission (a normal POST to the page): processed before the page renders. */
	function wrbc_a11y_cf7_nojs() {
		// phpcs:ignore WordPress.Security.NonceVerification.Missing
		if ( is_admin() || 'POST' !== ( $_SERVER['REQUEST_METHOD'] ?? '' ) || empty( $_POST['_wpcf7'] ) ) {
			return;
		}
		$form = WPCF7_ContactForm::get_instance( absint( $_POST['_wpcf7'] ) ); // phpcs:ignore WordPress.Security.NonceVerification.Missing
		if ( ! $form ) {
			return;
		}
		$unit                                     = isset( $_POST['_wpcf7_unit_tag'] ) ? sanitize_text_field( wp_unslash( $_POST['_wpcf7_unit_tag'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Missing
		$GLOBALS['wrbc_a11y_cf7_result'][ $unit ] = wrbc_a11y_cf7_process( $form );
	}
}

if ( ! function_exists( 'wrbc_a11y_cf7_shortcode' ) ) {
	/**
	 * [contact-form-7 id="…" title="…" html_id="…" html_class="…"].
	 *
	 * @param array|string $atts Attributes.
	 */
	function wrbc_a11y_cf7_shortcode( $atts ) {
		$atts = shortcode_atts(
			array(
				'id'         => 0,
				'title'      => '',
				'html_id'    => '',
				'html_class' => '',
			),
			(array) $atts,
			'contact-form-7'
		);
		$form = WPCF7_ContactForm::get_instance( absint( $atts['id'] ) );
		if ( ! $form ) {
			return '<p class="wpcf7-contact-form-not-found"><strong>Error:</strong> Contact form not found.</p>';
		}
		return wrbc_a11y_cf7_html( $form, $atts );
	}
}

if ( ! function_exists( 'wrbc_a11y_cf7_html' ) ) {
	/**
	 * CF7 6.x markup for a form: init, sent, invalid or failed.
	 *
	 * @param WPCF7_ContactForm $form Form.
	 * @param array             $atts Shortcode attributes.
	 */
	function wrbc_a11y_cf7_html( $form, array $atts ) {
		static $count = 0;
		++$count;
		wp_enqueue_style( 'contact-form-7' );
		wp_enqueue_script( 'contact-form-7' );
		$m         = wrbc_a11y_cf7_messages();
		$container = (int) get_the_ID();
		$unit      = sprintf( 'wpcf7-f%1$d-p%2$d-o%3$d', $form->id(), $container, $count );
		$result    = $GLOBALS['wrbc_a11y_cf7_result'][ $unit ] ?? null;
		if ( null === $result && 'invalid' === get_post_meta( $form->id(), '_wrbc_a11y_state', true ) ) {
			// The error state as CF7 prints it after a failed no-JS submission (static audits).
			$result = array(
				'status'  => 'validation_failed',
				'message' => $m['validation_error'],
				'invalid' => array(
					'your-name'  => $m['invalid_required'],
					'your-email' => $m['invalid_email'],
				),
				'posted'  => array(
					'your-name'    => '',
					'your-email'   => 'not-an-address',
					'your-message' => '',
					'acceptance-1' => '',
				),
			);
		}
		$map     = array(
			'mail_sent'          => 'sent',
			'mail_failed'        => 'failed',
			'validation_failed'  => 'invalid',
			'acceptance_missing' => 'unaccepted',
			'aborted'            => 'aborted',
		);
		$status  = $result ? ( $map[ $result['status'] ] ?? 'failed' ) : 'init';
		$message = $result ? $result['message'] : '';
		$invalid = $result ? $result['invalid'] : array();
		$values  = ( $result && 'mail_sent' !== $result['status'] ) ? $result['posted'] : array();

		$hidden = array(
			'_wpcf7'                  => $form->id(),
			'_wpcf7_version'          => WRB_A11Y_FAKE_CF7,
			'_wpcf7_locale'           => $form->locale(),
			'_wpcf7_unit_tag'         => $unit,
			'_wpcf7_container_post'   => $container,
			'_wpcf7_posted_data_hash' => '',
		);
		// CF7's filter: werun.Blocks.Community adds its gate ticket here.
		$hidden += (array) apply_filters( 'wpcf7_form_hidden_fields', array() );
		$hidden_html = '';
		foreach ( $hidden as $name => $value ) {
			$hidden_html .= sprintf( '<input type="hidden" name="%1$s" value="%2$s" />', esc_attr( $name ), esc_attr( (string) $value ) );
		}

		$rows = '';
		$lis  = '';
		foreach ( wrbc_a11y_cf7_fields() as $name => $f ) {
			$error  = $invalid[ $name ] ?? '';
			$err_id = $unit . '-ve-' . $name;
			$aria   = ' aria-invalid="' . ( '' !== $error ? 'true' : 'false' ) . '"' . ( '' !== $error ? ' aria-describedby="' . esc_attr( $err_id ) . '"' : '' );
			$tip    = '' !== $error ? '<span class="wpcf7-not-valid-tip" aria-hidden="true">' . esc_html( $error ) . '</span>' : '';
			$value  = (string) ( $values[ $name ] ?? '' );
			$not    = '' !== $error ? ' wpcf7-not-valid' : '';
			if ( '' !== $error ) {
				$lis .= '<li id="' . esc_attr( $err_id ) . '">' . esc_html( $error ) . '</li>';
			}
			switch ( $f['type'] ) {
				case 'textarea':
					$control = '<textarea cols="40" rows="10" maxlength="2000" class="wpcf7-form-control wpcf7-textarea' . $not . '"' . $aria . ' name="' . esc_attr( $name ) . '">' . esc_textarea( $value ) . '</textarea>';
					break;
				case 'acceptance':
					$control = '<span class="wpcf7-form-control wpcf7-acceptance' . $not . '"><span class="wpcf7-list-item"><label><input type="checkbox" name="' . esc_attr( $name ) . '" value="1"' . $aria . ( '' !== $value ? ' checked="checked"' : '' ) . ' /><span class="wpcf7-list-item-label">' . esc_html( $f['label'] ) . '</span></label></span></span>';
					break;
				default:
					$classes = 'wpcf7-form-control wpcf7-' . ( 'email' === $f['type'] ? 'email' : 'text' ) . ( $f['required'] ? ' wpcf7-validates-as-required' : '' ) . ( 'email' === $f['type'] ? ' wpcf7-text wpcf7-validates-as-email' : '' ) . $not;
					$control = '<input size="40" maxlength="400" class="' . esc_attr( $classes ) . '"' . ( $f['autocomplete'] ? ' autocomplete="' . esc_attr( $f['autocomplete'] ) . '"' : '' ) . ( $f['required'] ? ' aria-required="true"' : '' ) . $aria . ' value="' . esc_attr( $value ) . '" type="' . esc_attr( $f['type'] ) . '" name="' . esc_attr( $name ) . '" />';
			}
			$wrap = '<span class="wpcf7-form-control-wrap" data-name="' . esc_attr( $name ) . '">' . $control . $tip . '</span>';
			$rows .= 'acceptance' === $f['type']
				? '<p>' . $wrap . "\n</p>\n"
				: '<p><label> ' . esc_html( $f['label'] ) . "<br />\n" . $wrap . " </label>\n</p>\n";
		}

		$action  = esc_url( remove_query_arg( array( 'wrbc_a11y_theme' ), (string) wp_unslash( $_SERVER['REQUEST_URI'] ?? '/' ) ) ); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- escaped.
		$html_id = '' !== $atts['html_id'] ? ' id="' . esc_attr( $atts['html_id'] ) . '"' : '';
		$classes = trim( 'wpcf7-form ' . $status . ' ' . sanitize_html_class( $atts['html_class'] ) );
		return '<div class="wpcf7 no-js" id="' . esc_attr( $unit ) . '" lang="en-US" dir="ltr" data-wpcf7-id="' . (int) $form->id() . '">' . "\n"
			. '<div class="screen-reader-response"><p role="status" aria-live="polite" aria-atomic="true">' . esc_html( $message ) . '</p> <ul>' . $lis . '</ul></div>' . "\n"
			. '<form action="' . $action . '#' . esc_attr( $unit ) . '" method="post" class="' . esc_attr( $classes ) . '"' . $html_id . ' aria-label="' . esc_attr( $form->title() ) . '" novalidate="novalidate" data-status="' . esc_attr( $status ) . '">' . "\n"
			. '<fieldset class="hidden-fields-container">' . $hidden_html . "\n</fieldset>\n"
			. $rows
			. '<p><input class="wpcf7-form-control wpcf7-submit has-spinner" type="submit" value="Send" />' . "\n</p>"
			. '<div class="wpcf7-response-output" aria-hidden="true">' . esc_html( $message ) . "</div>\n"
			. "</form>\n</div>\n";
	}
}

if ( ! function_exists( 'wrbc_a11y_cf7_css' ) ) {
	/** CF7's stock stylesheet (includes/css/styles.css, 6.x). */
	function wrbc_a11y_cf7_css() {
		return '.wpcf7 .screen-reader-response{position:absolute;overflow:hidden;clip:rect(1px,1px,1px,1px);clip-path:inset(50%);height:1px;width:1px;margin:-1px;padding:0;border:0;word-wrap:normal !important}'
			. '.wpcf7 .hidden-fields-container{display:none}'
			. '.wpcf7 form .wpcf7-response-output{margin:2em .5em 1em;padding:.2em 1em;border:2px solid #00a0d2}'
			. '.wpcf7 form.init .wpcf7-response-output,.wpcf7 form.resetting .wpcf7-response-output,.wpcf7 form.submitting .wpcf7-response-output{display:none}'
			. '.wpcf7 form.sent .wpcf7-response-output{border-color:#46b450}'
			. '.wpcf7 form.failed .wpcf7-response-output,.wpcf7 form.aborted .wpcf7-response-output{border-color:#dc3232}'
			. '.wpcf7 form.spam .wpcf7-response-output{border-color:#f56e28}'
			. '.wpcf7 form.invalid .wpcf7-response-output,.wpcf7 form.unaccepted .wpcf7-response-output,.wpcf7 form.payment-required .wpcf7-response-output{border-color:#ffb900}'
			. '.wpcf7-form-control-wrap{position:relative}'
			. '.wpcf7-not-valid-tip{color:#dc3232;font-size:1em;font-weight:normal;display:block}'
			. '.use-floating-validation-tip .wpcf7-not-valid-tip{position:relative;top:-2ex;left:1em;z-index:100;border:1px solid #dc3232;background:#fff;padding:.2em .8em;width:24em}'
			. '.wpcf7-list-item{display:inline-block;margin:0 0 0 1em}'
			. '.wpcf7-list-item-label::before,.wpcf7-list-item-label::after{content:" "}'
			. '.wpcf7-spinner{visibility:hidden;display:inline-block;background-color:#23282d;opacity:.75;width:24px;height:24px;border:none;border-radius:100%;padding:0;margin:0 24px;position:relative}'
			. 'form.submitting .wpcf7-spinner{visibility:visible}'
			. '.wpcf7-spinner::before{content:"";position:absolute;background-color:#fbfbfc;top:4px;left:4px;width:6px;height:6px;border:none;border-radius:100%;transform-origin:8px 8px;animation-name:spin;animation-duration:1000ms;animation-timing-function:linear;animation-iteration-count:infinite}'
			. '@media (prefers-reduced-motion:reduce){.wpcf7-spinner::before{animation-name:blink;animation-duration:2000ms}}'
			. '@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}'
			. '@keyframes blink{from{opacity:0}50%{opacity:1}to{opacity:0}}'
			. '.wpcf7 [inert]{opacity:.5}'
			. '.wpcf7 input[type="file"]{cursor:pointer}'
			. '.wpcf7 input[type="file"]:disabled{cursor:default}'
			. '.wpcf7 .wpcf7-submit:disabled{cursor:not-allowed}'
			. '.wpcf7 input[type="url"],.wpcf7 input[type="email"],.wpcf7 input[type="tel"]{direction:ltr}';
	}
}

if ( ! function_exists( 'wrbc_a11y_cf7_js' ) ) {
	/** The parts of CF7's front-end script the block depends on (status, errors, events, acceptance). */
	function wrbc_a11y_cf7_js() {
		return <<<'JS'
( function () {
	'use strict';
	var STATES = [ 'init', 'validating', 'submitting', 'sent', 'invalid', 'failed', 'spam', 'unaccepted', 'payment-required', 'aborted', 'resetting' ];
	var MAP = { mail_sent: 'sent', mail_failed: 'failed', validation_failed: 'invalid', acceptance_missing: 'unaccepted', spam: 'spam', aborted: 'aborted' };
	var EVENTS = { mail_sent: 'mailsent', mail_failed: 'mailfailed', validation_failed: 'invalid', acceptance_missing: 'unaccepted', spam: 'spam', aborted: 'aborted' };
	function setStatus( form, status ) {
		STATES.forEach( function ( s ) { form.classList.remove( s ); } );
		form.classList.add( status );
		form.setAttribute( 'data-status', status );
	}
	function fire( form, name, detail ) {
		form.dispatchEvent( new CustomEvent( 'wpcf7' + name, { bubbles: true, detail: detail } ) );
	}
	// CF7: the submit button stays disabled until every acceptance box is ticked.
	function toggleSubmit( form ) {
		var submit = form.querySelector( '.wpcf7-submit' );
		if ( ! submit ) { return; }
		var all = Array.prototype.every.call( form.querySelectorAll( '.wpcf7-acceptance input[type="checkbox"]' ), function ( c ) { return c.checked; } );
		submit.disabled = ! all;
	}
	function clear( wrap, form ) {
		form.querySelectorAll( '.wpcf7-not-valid-tip' ).forEach( function ( t ) { t.remove(); } );
		form.querySelectorAll( '[aria-invalid="true"]' ).forEach( function ( c ) { c.setAttribute( 'aria-invalid', 'false' ); c.removeAttribute( 'aria-describedby' ); c.classList.remove( 'wpcf7-not-valid' ); } );
		var sr = wrap.querySelector( '.screen-reader-response' );
		if ( sr ) { sr.querySelector( 'p' ).textContent = ''; sr.querySelector( 'ul' ).innerHTML = ''; }
		var out = form.querySelector( '.wpcf7-response-output' );
		if ( out ) { out.textContent = ''; }
	}
	function send( wrap, form ) {
		clear( wrap, form );
		setStatus( form, 'submitting' );
		var data = new FormData( form );
		var id = data.get( '_wpcf7' );
		var api = window.wpcf7 && window.wpcf7.api;
		var detail = { contactFormId: Number( id ), unitTag: data.get( '_wpcf7_unit_tag' ), containerPostId: Number( data.get( '_wpcf7_container_post' ) ), status: '', inputs: [] };
		data.forEach( function ( value, name ) { if ( name.indexOf( '_' ) !== 0 ) { detail.inputs.push( { name: name, value: value } ); } } );
		window.fetch( api.root + api.namespace + '/contact-forms/' + id + '/feedback', { method: 'POST', body: data, credentials: 'same-origin', headers: { Accept: 'application/json' } } )
			.then( function ( r ) { return r.json(); } )
			.then( function ( res ) {
				detail.status = res.status;
				detail.apiResponse = res;
				setStatus( form, MAP[ res.status ] || 'failed' );
				var sr = wrap.querySelector( '.screen-reader-response' );
				( res.invalid_fields || [] ).forEach( function ( f ) {
					var w = form.querySelector( '.wpcf7-form-control-wrap[data-name="' + f.field + '"]' );
					if ( ! w ) { return; }
					var control = w.querySelector( '.wpcf7-form-control' );
					var input = control && control.matches( 'input, textarea, select' ) ? control : w.querySelector( 'input, textarea, select' );
					if ( input ) { input.setAttribute( 'aria-invalid', 'true' ); input.setAttribute( 'aria-describedby', f.error_id ); }
					if ( control ) { control.classList.add( 'wpcf7-not-valid' ); }
					var tip = document.createElement( 'span' );
					tip.className = 'wpcf7-not-valid-tip';
					tip.setAttribute( 'aria-hidden', 'true' );
					tip.textContent = f.message;
					w.appendChild( tip );
					if ( sr ) { var li = document.createElement( 'li' ); li.id = f.error_id; li.textContent = f.message; sr.querySelector( 'ul' ).appendChild( li ); }
				} );
				if ( sr ) { sr.querySelector( 'p' ).textContent = res.message || ''; }
				var out = form.querySelector( '.wpcf7-response-output' );
				if ( out ) { out.textContent = res.message || ''; }
				if ( EVENTS[ res.status ] ) { fire( form, EVENTS[ res.status ], detail ); }
				fire( form, 'submit', detail );
				if ( res.status === 'mail_sent' ) { form.reset(); toggleSubmit( form ); }
			} )
			.catch( function () {
				setStatus( form, 'failed' );
				var out = form.querySelector( '.wpcf7-response-output' );
				if ( out ) { out.textContent = 'There was an error trying to send your message. Please try again later.'; }
			} );
	}
	function init( wrap ) {
		var form = wrap.querySelector( 'form.wpcf7-form' );
		if ( ! form || form.wpcf7Ready ) { return; }
		form.wpcf7Ready = true;
		wrap.classList.remove( 'no-js' );
		wrap.classList.add( 'js' );
		var submit = form.querySelector( '.has-spinner' );
		if ( submit && ! form.querySelector( '.wpcf7-spinner' ) ) {
			var spinner = document.createElement( 'span' );
			spinner.className = 'wpcf7-spinner';
			submit.insertAdjacentElement( 'afterend', spinner );
		}
		toggleSubmit( form );
		form.addEventListener( 'change', function ( e ) { if ( e.target.closest( '.wpcf7-acceptance' ) ) { toggleSubmit( form ); } } );
		form.addEventListener( 'submit', function ( e ) { e.preventDefault(); send( wrap, form ); } );
	}
	function all() { document.querySelectorAll( '.wpcf7' ).forEach( init ); }
	if ( document.readyState === 'loading' ) { document.addEventListener( 'DOMContentLoaded', all ); } else { all(); }
} )();
JS;
	}
}

if ( wrbc_a11y_fixtures_enabled() ) {
	add_action( 'plugins_loaded', 'wrbc_a11y_cf7_boot', 1 );
}
