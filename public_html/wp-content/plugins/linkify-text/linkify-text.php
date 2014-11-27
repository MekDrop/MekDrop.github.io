<?php
/**
 * @package Linkify_Text
 * @author Scott Reilly
 * @version 1.5
 */
/*
Plugin Name: Linkify Text
Version: 1.5
Plugin URI: http://coffee2code.com/wp-plugins/linkify-text/
Author: Scott Reilly
Author URI: http://coffee2code.com/
Text Domain: linkify-text
Domain Path: /lang/
License: GPLv2 or later
License URI: http://www.gnu.org/licenses/gpl-2.0.html
Description: Automatically hyperlink words or phrases in your posts.

Compatible with WordPress 3.6 through 3.8+.

=>> Read the accompanying readme.txt file for instructions and documentation.
=>> Also, visit the plugin's homepage for additional information and updates.
=>> Or visit: http://wordpress.org/plugins/linkify-text/

TODO
	* Allow links to point to other text entries so a link can be defined once:
	    WP => http://wordpress.org
	    WordPress => WP
	    start blogging => WP
*/

/*
	Copyright (c) 2011-2014 by Scott Reilly (aka coffee2code)

	This program is free software; you can redistribute it and/or
	modify it under the terms of the GNU General Public License
	as published by the Free Software Foundation; either version 2
	of the License, or (at your option) any later version.

	This program is distributed in the hope that it will be useful,
	but WITHOUT ANY WARRANTY; without even the implied warranty of
	MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
	GNU General Public License for more details.

	You should have received a copy of the GNU General Public License
	along with this program; if not, write to the Free Software
	Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
*/


if ( ! class_exists( 'c2c_LinkifyText' ) ) :

require_once( dirname( __FILE__ ) . DIRECTORY_SEPARATOR . 'c2c-plugin.php' );

class c2c_LinkifyText extends C2C_Plugin_037 {

	/**
	 * @var c2c_AddAdminCSS The one true instance
	 */
	private static $instance;

	/**
	 * Get singleton instance.
	 *
	 * @since 1.5
	 */
	public static function get_instance() {
		if ( ! isset( self::$instance ) )
			self::$instance = new self();

		return self::$instance;
	}

	/**
	 * Constructor.
	 */
	protected function __construct() {
		parent::__construct( '1.5', 'linkify-text', 'c2c', __FILE__, array() );
		register_activation_hook( __FILE__, array( __CLASS__, 'activation' ) );

		return self::$instance = $this;
	}

	/**
	 * Handles activation tasks, such as registering the uninstall hook.
	 *
	 * @return void
	 */
	public function activation() {
		register_uninstall_hook( __FILE__, array( __CLASS__, 'uninstall' ) );
	}

	/**
	 * Handles uninstallation tasks, such as deleting plugin options.
	 *
	 * @return void
	 */
	public static function uninstall() {
		delete_option( 'c2c_linkify_text' );
	}

	/**
	 * Initializes the plugin's configuration and localizable text variables.
	 *
	 * @return void
	 */
	protected function load_config() {
		$this->name      = __( 'Linkify Text', $this->textdomain );
		$this->menu_name = __( 'Linkify Text', $this->textdomain );

		$this->config = array(
			'text_to_link' => array( 'input' => 'inline_textarea', 'datatype' => 'hash', 'default' => array(
					"WordPress"   => "http://wordpress.org",
					"coffee2code" => "http://coffee2code.com"
				),
				'allow_html' => true, 'no_wrap' => true, 'input_attributes' => 'rows="15" cols="40"',
				'label' => __( 'Text and Links', $this->textdomain ),
				'help' => __( 'Define only one text and associated link per line, and don\'t span lines.', $this->textdomain )
			),
			'linkify_text_comments' => array( 'input' => 'checkbox', 'default' => false,
					'label' => __( 'Enable text linkification in comments?', $this->textdomain ),
					'help' => ''
			),
			'replace_once' => array( 'input' => 'checkbox', 'default' => false,
				'label' => __( 'Limit linkifications to once per term per post?', $this->textdomain ),
				'help' => __( 'If checked, then each term will only be linkified the first time it appears in a post.', $this->textdomain )
			),
			'case_sensitive' => array( 'input' => 'checkbox', 'default' => false,
					'label' => __( 'Case sensitive text matching?', $this->textdomain ),
					'help' => __( 'If checked, then linkification of WordPress would also affect wordpress.', $this->textdomain )
			)
		);
	}

	/**
	 * Override the plugin framework's register_filters() to actually hook actions and filters.
	 */
	public function register_filters() {
		$filters = apply_filters( 'c2c_linkify_text_filters', array( 'the_content', 'the_excerpt', 'widget_text' ) );
		foreach ( (array) $filters as $filter )
			add_filter( $filter, array( $this, 'linkify_text' ), 2 );

		add_filter( 'get_comment_text',    array( $this, 'linkify_comment_text' ), 11 );
		add_filter( 'get_comment_excerpt', array( $this, 'linkify_comment_text' ), 11 );
	}

	/**
	 * Outputs the text above the setting form
	 *
	 * @param string $localized_heading_text (optional) Localized page heading text.
	 * @return void (Text will be echoed.)
	 */
	public function options_page_description( $localized_heading_text = '' ) {
		parent::options_page_description( __( 'Linkify Text Settings', $this->textdomain ) );

		echo '<p>' . __( 'Description: Automatically hyperlink words or phrases in your posts.', $this->textdomain ) . '</p>';
		echo '<p>' . __( 'Define text and the URL they should be linked to in the field below. The format should be like this:', $this->textdomain ) . '</p>';
		echo "<blockquote><code>WordPress => http://wordpress.org</code></blockquote>";
		echo '<p>' . __( 'Where <code>WordPress</code> is the text you want to get linked and <code>http://wordpress.org</code> would be what the target for that link.', $this->textdomain ) . '</p>';
		echo '<p>' . __( 'You can link multiple terms to the same link and only have to define the link once. Simply provide the link for a given term, then for subsequent terms sharing the same link, use the original term prepended with a colon as the link, e.g.', $this->textdomain ) . '</p>';
		echo '<blockquote><pre><code>WP => http://wordpress.org
WordPress => :WP
dotorg => :WP
</code></pre></blockquote>';
		echo '<p>' . sprintf( __( 'All of the above terms would link to %s.', $this->textdomain ), 'http://wordpress.org' ) . '</p>';
		echo '<p>' . __( 'NOTE: A referenced term must have a link; it cannot be a reference to another term.', $this->textdomain ) . '</p>';
		echo '<p>' . __( 'Other considerations:', $this->textdomain ) . '</p>';
		echo '<ul class="c2c-plugin-list"><li>';
		echo __( 'List the more specific matches early to avoid stomping on another of your links. For example, if you have both <code>WordPress</code> and <code>WordPress Support Forums</code> as text to be linked, put <code>WordPress Support Forums</code> first; otherwise, the <code>WordPress</code> entry will match first, preventing the phrase <code>WordPress Support Forums</code> from ever being found.', $this->textdomain );
		echo '</li><li>';
		echo __( 'Text must represent a whole word or phrase, not a partial string.', $this->textdomain );
		echo '</li><li>';
		echo __( 'If the protocol is not specified, then \'http://\' is assumed.', $this->textdomain );
		echo '</li></ul>';
	}

	/**
	 * Linkifies comment text if enabled.
	 *
	 * @since 1.5
	 *
	 * @param string $text The comment text
	 * @return string
	 */
	public function linkify_comment_text( $text ) {
		// Note that the priority must be set high enough to avoid links inserted by the plugin from
		// getting omitted as a result of any link stripping that may be performed.
		$options = $this->get_options();
		if ( apply_filters( 'c2c_linkify_text_comments', $options['linkify_text_comments'] ) ) {
			$text = $this->linkify_text( $text );
		}

		return $text;
	}

	/**
	 * Perform text linkification.
	 *
	 * @param string $text Text to be processed for text linkification
	 * @return string Text with replacements already processed
	 */
	public function linkify_text( $text ) {
		$options         = $this->get_options();
		$text_to_link    = apply_filters( 'c2c_linkify_text',                $options['text_to_link'] );
		$case_sensitive  = apply_filters( 'c2c_linkify_text_case_sensitive', $options['case_sensitive'] );
		$limit           = apply_filters( 'c2c_linkify_text_replace_once',   $options['replace_once'] ) === true ? '1' : '-1';
		$preg_flags      = $case_sensitive ? 's' : 'si';

		$text = ' ' . $text . ' ';
		if ( ! empty( $text_to_link ) ) {
			foreach ( $text_to_link as $old_text => $link ) {

				// If the link starts with a colon, treat it as a special shortcut to the
				// link for the referenced term. Nested referencing is not supported.
				if ( ':' === $link[0] ) {
					$link = $text_to_link[ substr( $link, 1 ) ];
				}

				// If link is empty, or is another term reference, don't linkify
				if ( empty( $link ) || ':' === $link[0] ) {
					continue;
				}

				// If the link does not contain a protocol and isn't absolute, prepend 'http://'
				// Sorry, not supporting non-root relative paths.
				if ( strpos( $link, '://' ) === false && ! path_is_absolute( $link ) ) {
					$link = 'http://' . $link;
				}

				$new_text = '<a href="' . esc_url( $link ) . '">' . $old_text . '</a>';
				$new_text = apply_filters( 'c2c_linkify_text_linked_text', $new_text, $old_text, $link );

				$text = preg_replace( "|(?!<.*?)\b$old_text\b(?![^<>]*?>)|$preg_flags", $new_text, $text, $limit );
			}
			// Remove links within links
			$text = preg_replace( "#(<a [^>]+>)(.*)<a [^>]+>([^<]*)</a>([^>]*)</a>#iU", "$1$2$3$4</a>" , $text );
		}

		return trim( $text );
	} //end linkify_text()

} // end c2c_LinkifyText

c2c_LinkifyText::get_instance();

endif; // end if !class_exists()
