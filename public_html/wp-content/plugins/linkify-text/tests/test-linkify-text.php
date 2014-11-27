<?php

class Linkify_Text_Test extends WP_UnitTestCase {

	function setUp() {
		parent::setUp();
		$this->set_option();
	}

	function tearDown() {
		parent::tearDown();

		// Reset options
		$this->set_option();

		remove_filter( 'c2c_linkify_text',                array( $this, 'add_text_to_linkify' ) );
		remove_filter( 'c2c_linkify_text_replace_once',   '__return_true' );
		remove_filter( 'c2c_linkify_text_case_sensitive', '__return_true' );
		remove_filter( 'c2c_linkify_text_comments',       '__return_true' );
	}


	/**
	 *
	 * DATA PROVIDERS
	 *
	 */


	public static function get_default_filters() {
		return array(
			array( 'the_content' ),
			array( 'the_excerpt' ),
			array( 'widget_text' ),
		);
	}


	/**
	 *
	 * HELPER FUNCTIONS
	 *
	 */


	function set_option( $settings = array() ) {
		$defaults = array(
			'text_to_link' => array(
				'coffee2code' => 'http://coffee2code.com',
				'Matt Mullenweg' => 'http://ma.tt',
				'BuddyPress' => 'buddypress.org',
				'my posts' => '/authors/scott',
				'Scott Reilly' => ':coffee2code',
				'c2c' => ':coffee2code',
				'me' => ':c2c',
				'blank' => '',
			),
		);
		$settings = wp_parse_args( $settings, $defaults );
		c2c_LinkifyText::get_instance()->update_option( $settings, true );
	}

	function linkify_text( $text ) {
		return c2c_LinkifyText::get_instance()->linkify_text( $text );
	}

	function expected_link( $text, $link ) {
		return '<a href="' . $link . '">' . $text . '</a>';
	}

	function add_text_to_linkify( $text_to_link ) {
		$text_to_link = (array) $text_to_link;
		$text_to_link['bbPress'] = 'http://bbpress.org';
		return $text_to_link;
	}

	function add_custom_filter( $filters ) {
		$filters[] = 'custom_filter';
		return $filters;
	}


	/**
	 *
	 * TESTS
	 *
	 */


	function test_linkifies_text() {
		$expected = $this->expected_link( 'coffee2code', 'http://coffee2code.com' );

		$this->assertEquals( $expected, $this->linkify_text( 'coffee2code' ) );
		$this->assertEquals( "ends with $expected", $this->linkify_text( 'ends with coffee2code' ) );
		$this->assertEquals( "ends with period $expected.", $this->linkify_text( 'ends with period coffee2code.' ) );
		$this->assertEquals( "$expected starts", $this->linkify_text( 'coffee2code starts' ) );

		$this->assertEquals( $this->expected_link( 'Matt Mullenweg', 'http://ma.tt' ), $this->linkify_text( 'Matt Mullenweg' ) );
	}

	function test_linkifies_single_term_multiple_times() {
		$expected = $this->expected_link( 'coffee2code', 'http://coffee2code.com' );

		$this->assertEquals( "$expected $expected $expected", $this->linkify_text( 'coffee2code coffee2code coffee2code' ) );
	}

	function test_does_not_linkify_substrings() {
		$this->assertEquals( 'xcoffee2code',  $this->linkify_text( 'xcoffee2code' ) );
		$this->assertEquals( 'ycoffee2codey', $this->linkify_text( 'ycoffee2codey' ) );
		$this->assertEquals( 'coffee2codez',  $this->linkify_text( 'coffee2codez' ) );
	}

	function test_does_not_link_within_links() {
		$expected = '<a href="http://coffee2code.net">coffee2code</a>';

		$this->assertEquals( $expected, $this->linkify_text( $expected ) );
	}

	function test_empty_link_does_not_linkify_text() {
		$this->assertEquals( 'blank', $this->linkify_text( 'blank' ) );
	}

	function test_linkifies_with_case_insensitivity() {
		$expected = $this->expected_link( 'coffee2code', 'http://coffee2code.com' );

		$this->assertEquals( $expected, $this->linkify_text( 'coffee2code' ) );
		$this->assertEquals( $expected, $this->linkify_text( 'Coffee2code' ) );
		$this->assertEquals( $expected, $this->linkify_text( 'COFFEE2CODE' ) );
	}

	function test_linkifies_once_via_setting() {
		$expected = $this->expected_link( 'coffee2code', 'http://coffee2code.com' );
		$this->test_linkifies_single_term_multiple_times();
		$this->set_option( array( 'replace_once' => true ) );

		$this->assertEquals( "$expected coffee2code coffee2code", $this->linkify_text( 'coffee2code coffee2code coffee2code' ) );
	}

	function test_linkifies_once_via_filter() {
		$expected = $this->expected_link( 'coffee2code', 'http://coffee2code.com' );
		$this->test_linkifies_single_term_multiple_times();
		add_filter( 'c2c_linkify_text_replace_once', '__return_true' );

		$this->assertEquals( "$expected coffee2code coffee2code", $this->linkify_text( 'coffee2code coffee2code coffee2code' ) );
	}

	function test_linkifies_with_case_sensitivity_via_setting() {
		$expected = $this->expected_link( 'coffee2code', 'http://coffee2code.com' );
		$this->test_linkifies_with_case_insensitivity();
		$this->set_option( array( 'case_sensitive' => true ) );

		$this->assertEquals( $expected, $this->linkify_text( 'coffee2code' ) );
		$this->assertEquals( 'Coffee2code', $this->linkify_text( 'Coffee2code' ) );
		$this->assertEquals( 'COFFEE2CODE', $this->linkify_text( 'COFFEE2CODE' ) );
	}

	function test_linkifies_with_case_sensitivity_via_filter() {
		$expected = $this->expected_link( 'coffee2code', 'http://coffee2code.com' );
		$this->test_linkifies_with_case_insensitivity();
		add_filter( 'c2c_linkify_text_case_sensitive', '__return_true' );

		$this->assertEquals( $expected, $this->linkify_text( 'coffee2code' ) );
		$this->assertEquals( 'Coffee2code', $this->linkify_text( 'Coffee2code' ) );
		$this->assertEquals( 'COFFEE2CODE', $this->linkify_text( 'COFFEE2CODE' ) );
	}

	function test_linkifies_term_added_via_filter() {
		$this->assertEquals( 'bbPress', $this->linkify_text( 'bbPress' ) );
		$expected = $this->expected_link( 'bbPress', 'http://bbpress.org' );
		add_filter( 'c2c_linkify_text', array( $this, 'add_text_to_linkify' ) );

		$this->assertEquals( $expected, $this->linkify_text( 'bbPress' ) );
	}

	function test_linkification_prepends_protocol_if_missing_and_not_root_relative() {
		$expected = $this->expected_link( 'BuddyPress', 'http://buddypress.org' );

		$this->assertEquals( $expected, $this->linkify_text( 'BuddyPress' ) );
	}

	function test_linkification_accepts_root_relative_link() {
		$expected = $this->expected_link( 'my posts', '/authors/scott' );

		$this->assertEquals( $expected, $this->linkify_text( 'my posts' ) );
	}

	function test_linkification_does_not_apply_to_comments_by_default() {
		$this->assertEquals( 'coffee2code', apply_filters( 'get_comment_text', 'coffee2code' ) );
		$this->assertEquals( 'coffee2code', apply_filters( 'get_comment_excerpt', 'coffee2code' ) );
	}

	function test_linkification_applies_to_comments_via_setting() {
		$expected = $this->expected_link( 'coffee2code', 'http://coffee2code.com' );
		$this->test_linkification_does_not_apply_to_comments_by_default();
		$this->set_option( array( 'linkify_text_comments' => true ) );

		$this->assertEquals( $expected, apply_filters( 'get_comment_text', 'coffee2code' ) );
		$this->assertEquals( $expected, apply_filters( 'get_comment_excerpt', 'coffee2code' ) );
	}

	function test_linkification_applies_to_comments_via_filter() {
		$expected = $this->expected_link( 'coffee2code', 'http://coffee2code.com' );
		$this->test_linkification_does_not_apply_to_comments_by_default();
		add_filter( 'c2c_linkify_text_comments', '__return_true' );

		$this->assertEquals( $expected, apply_filters( 'get_comment_text', 'coffee2code' ) );
		$this->assertEquals( $expected, apply_filters( 'get_comment_excerpt', 'coffee2code' ) );
	}

	/**
	 * @dataProvider get_default_filters
	 */
	function test_linkification_applies_to_default_filters( $filter ) {
		$expected = $this->expected_link( 'coffee2code', 'http://coffee2code.com' );

		$this->assertGreaterThan( 0, strpos( apply_filters( $filter, 'a coffee2code' ), $expected ) );
	}

	function test_linkification_applies_to_custom_filter_via_filter() {
		$this->assertEquals( 'coffee2code', apply_filters( 'custom_filter', 'coffee2code' ) );

		add_filter( 'c2c_linkify_text_filters', array( $this, 'add_custom_filter' ) );

		c2c_LinkifyText::get_instance()->register_filters(); // Plugins would typically register their filter before this originally fires

		$this->assertEquals( $this->expected_link( 'coffee2code', 'http://coffee2code.com' ), apply_filters( 'custom_filter', 'coffee2code' ) );
	}

	function test_link_referencing() {
		$this->assertEquals( $this->expected_link( 'Scott Reilly', 'http://coffee2code.com' ), $this->linkify_text( 'Scott Reilly' ) );
	}

	function test_nested_link_referencing_not_supported() {
		$this->assertEquals( 'me', $this->linkify_text( 'me' ) );
	}

}
