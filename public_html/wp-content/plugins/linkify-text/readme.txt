=== Linkify Text ===
Contributors: coffee2code
Donate link: https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=6ARCFJ9TX3522
Tags: text, link, hyperlink, autolink, replace, shortcut, shortcuts, post, post content, coffee2code
License: GPLv2 or later
License URI: http://www.gnu.org/licenses/gpl-2.0.html
Requires at least: 3.6
Tested up to: 3.8
Stable tag: 1.5

Automatically hyperlink words or phrases in your posts.

== Description ==

This plugin allows you to define words or phrases that, whenever they appear in your posts or pages, get automatically linked to the URLs of your choosing. For instance, wherever you may mention the word "WordPress", that can get automatically linked as "[WordPress](http://wordpress.org)".

Additional features of the plugin controlled via settings and filters:

* Text linkification can be enabled for comments (it isn't by default)
* Text linkification can be made case sensitive (it isn't by default)
* Text linkification can be limited to doing only one linkification per term, per post (by default, all occurrences of a term are linkified)

You can also link multiple terms to the same link and only define that link once in the settings via use of a special link syntax.

Links: [Plugin Homepage](http://coffee2code.com/wp-plugins/linkify-text/) | [Plugin Directory Page](http://wordpress.org/plugins/linkify-text/) | [Author Homepage](http://coffee2code.com)


== Installation ==

1. Unzip `linkify-text.zip` inside the `/wp-content/plugins/` directory (or install via the built-in WordPress plugin installer)
1. Activate the plugin through the 'Plugins' admin menu in WordPress
1. (optional) Go to the `Settings` -> `Linkify Text` admin options page and define text and the URLs they should point to


== Frequently Asked Questions ==

= Does this plugin modify the post content in the database? =

No. The plugin filters post content on-the-fly.

= Will this work for posts I wrote prior to installing this plugin? =

Yes, if they include terms that you have defined to be linkified.

= What post fields get handled by this plugin? =

By default, the plugin filters the post content, post excerpt fields, widget text, and optionally comments and comment excerpts. You can use the 'c2c_linkify_text_filters' filter to modify that behavior (see Filters section). There is a setting you can change to make text linkifications apply to comments as well.

= Is the plugin case sensitive? =

By default, yes. There is a setting you can change to make it case insensitive. Or if you are a coder, you can use the 'c2c_linkify_text_case_sensitive' filter (see Filters section).

= What if the word or phrase is already linked in a post? =

Already linked text will not get linked again by this plugin (regardless of what the link may be).

= Will all instances of a given term be linked in a single post? =

By default, yes. There is a setting you can change so that only the first occurrence of the term in the post gets linked. Or if you are a coder, you can use the 'c2c_linkify_text_replace_once' filter (see Filters section).

= Is there an efficient way to link multiple terms to the same link without repeating the link in the settings field (which can be tedious and prone to errors)? =

Yes. You can reference another term by specifying its link as another term in the list prepended with a colon (':'). For instance:

`
WP => http://wordpress.org,
WordPress => :WP
dotorg => :WP
.org => :WP
`

Given the above terms to link, all terms would link to 'http://wordpress.org'. The latter three all reference the link used for the term "WP".

NOTE: The referenced term must have an actual link defined and not be a reference to another term. (Basically, nested references are not currently supported.)

= How can I get text linkification to apply for custom fields (or something not linkified by default)? =

You can add to the list of filters that get text linkified using something like this (added to your theme's functions.php file, for instance):

`
// Enable text linkification for custom fields
add_filter( 'c2c_linkify_text_filters', 'more_text_replacements' );
function more_text_replacements( $filters ) {
	$filters[] = 'the_meta'; // Here you could put in the name of any filter you want
	return $filters;
}
`

= Does this plugin include unit tests? =

Yes.


== Screenshots ==

1. A screenshot of the admin options page for the plugin, where you define the text and their related links, as well as customize various settings.


== Filters ==

The plugin exposes five filters for hooking. Typically, the code to utilize these hooks would go inside your active theme's functions.php file. Bear in mind that all of the features controlled by these filters are configurable via the plugin's settings page. These filters are likely only of interest to advanced users able to code.

= c2c_linkify_text_filters (filter) =

The 'c2c_linkify_text_filters' hook allows you to customize what hooks get text linkification applied to them.

Arguments:

* $hooks (array): Array of hooks that will be text linkified.

Example:

`
// Enable text linkification for custom fields
add_filter( 'c2c_linkify_text_filters', 'more_text_replacements' );
function more_text_replacements( $filters ) {
	$filters[] = 'the_meta'; // Here you could put in the name of any filter you want
	return $filters;
}
`

= c2c_linkify_text_comments (filter) =

The 'c2c_linkify_text_comments' hook allows you to customize or override the setting indicating if text linkification should be enabled in comments.

Arguments:

* $state (bool): Either true or false indicating if text linkification is enabled for comments. The default value will be the value set via the plugin's settings page.

Example:

`// Prevent text linkification from ever being enabled in comments.
add_filter( 'c2c_linkify_text_comments', '__return_false' );`

= c2c_linkify_text (filter) =

The 'c2c_linkify_text' hook allows you to customize or override the setting defining all of the text phrases and their associated links.

Arguments:

* $linkify_text_array (array): Array of text and their associated links. The default value will be the value set via the plugin's settings page.

Example:

`
// Add more text to be linked
add_filter( 'c2c_linkify_text', 'my_text_linkifications' );
function my_text_linkifications( $replacements ) {
	// Add text link
	$replacements['Matt Mullenweg'] => 'http://ma.tt';
	// Unset a text link that we never want defined
	if ( isset( $replacements['WordPress'] ) )
		unset( $replacements['WordPress'] );
	// Important!
	return $replacements;
}
`

= c2c_linkify_text_case_sensitive (filter) =

The 'c2c_linkify_text_case_sensitive' hook allows you to customize or override the setting indicating if text matching for potential text linkification should be case sensitive or not.

Arguments:

* $state (bool): Either true or false indicating if text matching is case sensitive. The default value will be the value set via the plugin's settings page.

Example:

`// Prevent text matching from ever being case sensitive.
add_filter( 'c2c_linkify_text_case_sensitive', '__return_false' );`

= c2c_linkify_text_replace_once (filter) =

The 'c2c_linkify_text_replace_once' hook allows you to customize or override the setting indicating if text linkification should be limited to once per term per piece of text being processed regardless of how many times the term appears.

Arguments:

* $state (bool): Either true or false indicating if text linkification is to only occur once per term. The default value will be the value set via the plugin's settings page.

Example:

`// Only linkify a term once per post.
add_filter( 'c2c_linkify_text_replace_once', '__return_true' );`


== Changelog ==

= 1.5 (2014-01-04) =
* Add setting to allow limiting linkification to once per term per text
* Add filter 'c2c_linkify_text_replace_once'
* Add ability for a term to use another term's link
* Change to just-in-time (rather than on init) determination if comments should be filtered
* Add linkify_comment_text()
* Add get_instance() static method for returning/creating singleton instance
* Made static variable 'instance' private
* Validate post is either int or string before handling
* Add unit tests
* Omit output of empty 'title' attribute for links
* Update plugin framework to 037
* Use explicit path for require_once()
* For options_page_description(), match method signature of parent class
* Discontinue use of explicit pass-by-reference for objects
* Code tweaks (spacing, bracing, rearranging)
* Documentation enhancements, additions, and tweaks
* Note compatibility through WP 3.8+
* Drop compatibility with version of WP older than 3.6
* Update copyright date (2014)
* Regenerate .pot
* Change donate link
* Add assets directory to plugin repository checkout
* Add banner
* Add screenshot

= 1.0.1 (unreleased) =
* Re-license as GPLv2 or later (from X11)
* Add 'License' and 'License URI' header tags to readme.txt and plugin file
* Add 'Upgrade Notice' section to readme.txt
* Remove ending PHP close tag
* Note compatibility through WP 3.4+
* Update copyright date (2012)

= 1.0 =
* Initial release


== Upgrade Notice ==

= 1.5 =
Recommended update: added ability to reference another term's link; added setting to allow limiting linkification to once per term per post; improved validation of data received; added unit tests; noted compatibility through WP 3.8+

= 1.0.1 =
Trivial update: noted compatibility through WP 3.4+; explicitly stated license
