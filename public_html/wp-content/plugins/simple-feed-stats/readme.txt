=== Simple Feed Stats ===

Plugin Name: Simple Feed Stats
Plugin URI: https://perishablepress.com/simple-feed-stats/
Description: Tracks your feeds, adds custom content, and displays your feed statistics on your site.
Tags: atom, comments, count, feed, feedburner, feeds, posts, rdf, rss, stats, statistics, subscribers, tracking
Author: Jeff Starr
Author URI: http://monzilla.biz/
Donate link: http://m0n.co/donate
Contributors: specialk
Requires at least: 4.1
Tested up to: 4.5
Stable tag: trunk
Version: 20160409
Text Domain: sfs
Domain Path: /languages/
License: GPL v2 or later

Tracks your feeds and displays your feed count via shortcode.



== Description ==

[Simple Feed Stats](https://perishablepress.com/simple-feed-stats/) (SFS) tracks your feeds automatically using a variety of methods, and provides a wealth of tools and options for further configuration and management. Also displays your subscriber count via template tag or shortcode. Fully configurable. Visit the "Simple Feed Stats" settings page for stats, tools, and more info.

**Fast & Free**

* __100% Free__ - forget paying 3rd-party fees, track your own with SFS!
* __Fast & Secure__ - built with WP API for optimal performance & security
* __Code Complete__ - squeaky-clean, error-free code makes it all good :)

**Core Features**

* __Daily & Total__ - collect daily stats and total stats for each feed
* __Beautiful Stats__ - view all of your feed stats via the plugin settings
* __Dashboard Widget__ - provides a quick overview of your feed statistics
* __Custom Feed Count__ - display any number or text for your feed count
* __Custom Content__ - embellish your feed with graphics, markup & text
* __Custom CSS__ - use your own styles to customize your feed stats

**More Features**

* Shortcodes & Template Tags to display your feed count anywhere
* Display your daily feed counts for post feeds and comments feeds
* Options to clear cache, reset stats, and restore default settings
* Automatically track custom feeds generated via the WordPress API
* Enable "Strict Mode" reporting for more accurate feed counts
* Track feeds using custom key/value tracking parameters

**Tracking Methods**

Simple Feed Stats provides four ways to track your feeds:

* __Default Tracking__ - tracks feeds directly via URI request
* __Custom Tracking__ - tracks feeds via embedded post image
* __Alternate Tracking__ - tracks feeds via embedded feed image
* __Open Tracking__ - tracks feeds via your own custom image

**Collected Data**

Simple Feed Stats tracks the following data for each feed request:

* Feed type
* Tracking type
* Requested URL
* User-agent
* IP address
* Referrer
* Date
* ID

You can view these data at any time by visiting the plugin settings. All feed data are displayed via beautiful, easy-to-use interface. [View screenshots&nbsp;&raquo;](https://wordpress.org/plugins/simple-feed-stats/screenshots/)



== Installation ==

**Installation**

1. Upload the plugin to your blog and activate
2. Visit the settings page to configure your options

[More info on installing WP plugins](http://codex.wordpress.org/Managing_Plugins#Installing_Plugins)


**Usage**

Everything is configured to work out of the box. Once the plugin is activated on your site, it will begin tracking how many times your feed is accessed each day. You can visit the SFS settings to customize tracking method, custom count, shortcodes and more.

To display your daily feed count or total feed count, you can use the various shortcodes and template tags. More information about the shortcodes and template tags can be found in the SFS settings and also further down on this page.


**Testing**

To verify that the plugin is working properly, do the following:

1. Visit the "Your Feed Information" panel in the plugin's settings
2. Click on each of "Your feed URLs" a few times to collect some data
3. In the "Tools and Options" panel, click "clear cache"

After performing these steps, your "Current Feed Stats" and "Total Feed Stats" will display some numbers, based on the feed links that you clicked in step 2. This shows that the plugin is working normally using its default settings. Similar testing may be done for other feed-tracking methods and options.

Note that not all tracking methods (or browsers/devices) work for all types of feeds; for example, the "Alt Tracking" method is required to record hits for RDF feeds. If in doubt, roll with the default options &mdash; they are tuned for robust, everyday feed tracking.


**Shortcodes**

Display daily count for all feeds in plain-text:

	[sfs_subscriber_count]

Display daily count for all feeds with a FeedBurner-style badge:

	[sfs_count_badge]

Display daily count for RSS2 feeds in plain-text:

	[sfs_rss2_count]

Display daily count for comment feeds in plain-text:

	[sfs_comments_count]

See the plugin settings page for more options and infos.


**Template Tags**

Display daily count for all feeds in plain-text:

	<?php if (function_exists('sfs_display_subscriber_count')) sfs_display_subscriber_count(); ?>

Display daily count for all feeds with a FeedBurner-style badge:

	<?php if (function_exists('sfs_display_count_badge')) sfs_display_count_badge(); ?>

Display total count for all feeds as plain-text:

	<?php if (function_exists('sfs_display_total_count')) sfs_display_total_count(); ?>

See the plugin settings page for more options and infos.


**Notes**

To update your feed stats at any time (without waiting for the automatic 12-hour interval), click the "clear cache" link in the "Tools and Options" settings panel.

Also, this plugin uses WP Cron functionality to store feed data. Unfortunately, not all hosts/servers support WP Cron (e.g., Media Temple dv servers). If this is the case with your server, the total number of subscribers will not change from day to day. Fortunately there are a few possible solutions:

* Click the "Clear cache" button (located in the plugin settings) once or twice per day
* Add `define('ALTERNATE_WP_CRON', true);` to your WordPress configuration file, `wp-config.php`
* Use a [free cron service](https://www.setcronjob.com/) to request manually `http://example.com/wp-cron.php?setcronjob` once or twice per day (change the domain portion of the URL to match your own).

Any of these methods are suitable workarounds if WP Cron does not run automatically.



**Upgrades**

To upgrade SFS, remove the old version and replace with the new version. Or just click "Update" from the Plugins screen and let WordPress do it for you automatically.

__Note:__ uninstalling the plugin from the WP Plugins screen results in the _removal of all settings and feed stats_ from the WP database. 


**Restore Default Options**

To restore default plugin options, either uninstall/reinstall the plugin, or visit the plugin settings &gt; "Restore default settings".


**Uninstalling**

Simple Feed Stats cleans up after itself. All plugin options, transients, feed stats, and cron jobs will be removed from your database when the plugin is uninstalled via the Plugins screen. To delete the feed-stats table without uninstalling the plugin, visit the plugin settings &gt; "Delete database table". Likewise, to reset your feed stats without deleting the table, visit the plugin settings &gt; "Reset feed stats".



== Upgrade Notice ==

To upgrade SFS, remove the old version and replace with the new version. Or just click "Update" from the Plugins screen and let WordPress do it for you automatically.

__Note:__ uninstalling the plugin from the WP Plugins screen results in the _removal of all settings and feed stats_ from the WP database. 



== Screenshots ==

1. Simple Feed Stats: Plugin options
2. Simple Feed Stats: Feed Count Table
3. Simple Feed Stats: Feed Stats Table
4. Simple Feed Stats: FeedBurner-style count badge
5. Simple Feed Stats: Dashboard Widget
6. Simple Feed Stats: Full plugin settings page

More screenshots and info available at the [SFS Homepage](https://perishablepress.com/simple-feed-stats/).



== Frequently Asked Questions ==

__Question:__ "How can I monitor a custom feed, such as one at `http://example.com/feed/podcast/`?"

__Answer:__ If you use WordPress API for the [custom feed template](https://digwp.com/2011/08/custom-feeds/), and include the usual template tags for feeds, the SFS plugin will automatically track the custom feed. 


__Question:__ "The plugin seems to be recording hits, but the feed counts don't seem to be updating."

__Answer:__ The plugin uses WP Cron functionality to handle the updating of feed counts. Unfortunately, WP Cron does not work automatically on all servers/setups. Please check out the "Notes" section on the [plugin's Installation page](https://wordpress.org/plugins/simple-feed-stats/installation/) for a list of solutions and more information.


__Question:__ "What's up with 'strict mode' reporting?"

__Answer:__ It has to do with how SFS reports your feed stats. For example, in normal reporting mode (strict mode = off), each feed request is reported as unique. With strict mode enabled, feed requests are filtered by IP address, so that if "Pat" requests your comments feed five times per day, it's counted as "1" subscriber rather than "5". So strict mode is more accurate, but feed counts are usually lower with strict mode enabled. 

Note also that SFS still records all requests, so if you're reporting in strict mode the individual request data is still recorded and available in the Feed Stats table. In other words, strict mode determines how recorded data is reported, not collected.


__Question:__ "How can I use the the custom key/value parameters?"

__Answer:__ If you don't already know, you probably don't need it. Basically it's a requested feature that enables the inclusion of a custom URL parameter (key/value) in either "custom" or "alt" tracking methods. You know, for stuff like Google Analytics.


__Question:__ "The stats are showing zero for the shortcodes and template tags, even though there are requests recorded in the Feed Stats panel. Why?"

__Answer:__ During the first 12 hours, data is collected. Then the cache is refreshed to show the latest stats for the previous 12 hours. If your stats are showing zero or you would just like to update the count, visit the "Tools and Options" panel and click the "Clear cache" link.


Send any questions or feedback via my [contact form](https://perishablepress.com/contact/). Thanks! :)



== Support development of this plugin ==

I develop and maintain this free plugin with love for the WordPress community. To show support, you can [make a cash donation](http://m0n.co/donate), [bitcoin donation](http://m0n.co/bitcoin), or purchase one of my books: 

* [The Tao of WordPress](https://wp-tao.com/)
* [Digging into WordPress](https://digwp.com/)
* [.htaccess made easy](https://htaccessbook.com/)
* [WordPress Themes In Depth](https://wp-tao.com/wordpress-themes-book/)

And/or purchase one of my premium WordPress plugins:

* [BBQ Pro](https://plugin-planet.com/bbq-pro/) - Pro version of Block Bad Queries
* [SES Pro](https://plugin-planet.com/ses-pro/) - Super-simple &amp; flexible email signup forms
* [USP Pro](https://plugin-planet.com/usp-pro/) - Pro version of User Submitted Posts

Links, tweets and likes also appreciated. Thanks! :)



== Changelog ==

**20160409**

* Modified CSS to make more specific in Dashboard Widget
* Now using wp-load.php to call WP in tracker.php
* Renamed "Your Info / More Info" to "Your Feed Information"
* Changed "Number of results" setting input to number type
* Swapped "Your Feed Information" with "Shortcodes" section
* Improved "Shortcodes & Template Tags" information
* Added sfs_cron_three_minutes() for internal use
* Defined default tracking value in tracker.php
* Placed relative path as parameter into plugins_url() funtions
* Replaced one instance of admin_url() with get_admin_url()
* Streamlined badge functions
* Streamlined badge default styles
* Added box-sizing property to badge styles
* Replaced icon with retina version
* Added screenshot to readme/docs
* Added retina version of banner
* Reorganized and refreshed readme.txt
* General code cleanup and organization
* Updated sfs.pot translation template
* Tested on WordPress version 4.5 beta

**20151111**

* Admin notices now are dismissible
* Added sfs_clear_cache() function
* Added sfs_reset_stats() function
* Improved functionality of clear cache feature
* Improved functionality of reset stats feature
* Refined functionality of plugin settings page
* Updated some text in the plugin settings popup tips
* Refined the Subscriber Count panels in the plugin settings
* Removed unnecessary global variables from sfs_create_table()
* Added setting to enable shortcodes in widgets
* Change default stat value from "n/a" to "0"
* Added tip to total subscriber count panel
* Updated heading hierarchy in plugin settings
* Updated minimum version requirement
* Updated translation template file
* Tested on WordPress 4.4 beta

**20150808**

* Tested on WordPress 4.3
* Updated minimum version requirement

**20150507**

* Tested with WP 4.2 + 4.3 (alpha)
* Changed a few "http" links to "https"
* Update: fixed stats for https sites
* Update: fixed multisite stats

**20150317**

* Tested with latest version of WP (4.1)
* Increased minimum version to WP 3.8
* Added $sfs_wp_vers for version check
* Streamline/fine-tune plugin code
* Added Text Domain and Domain Path to file header
* Added alert panel in plugin setttings
* Replaced __FILE__ with page slug for settings URL
* Added UTF-8 as default for get_option() in htmlspecialchars()
* Plugin now removes scheduled cron event on uninstall
* Now scheduling cron event only on plugin activation
* Replaced default .mo/.po templates with .pot template

**20140925**

* Tested on latest version of WordPress (4.0)
* Increased min-version requirement to WP 3.7
* Replaced 'UTF-8' with get_option('blog_charset') in sfs_clean()
* Added option to ignore the most common bots (googlebot, bingbot, et al)
* Updated i18n mo/po templates

**20140308**

* Summary: revamped plugin to make better use of the WP API
* Improved logic for sfs_create_table for better performance
* Bugfix: removed mysql_real_escape_string from sfs_clean
* Added is_feed to simple_feed_stats, now hooks at wp
* Improved localization support, added mo/po templates
* Rewrote all database calls to use the WP API
* sfs_require_wp_version only runs on plugin activation
* sfs_feed_tracking improved logic, refined code
* Rewrote tracker.php with cleaner code, improved security
* Replaced default/PHP time/date with WP defaults
* Completely revamped plugin settings page for latest WP
* Added some missing transients to uninstall.php
* Improved default, custom, alt, and open tracking methods
* Updated feed-tracking XML for Alt Tracking method
* Replaced word "Custom" for "Open" when displaying stats
* Removed Firefox-specific conditional tracking
* Dropped support for WP-deprecated comments RDF feed
* Dropped support for WP-deprecated RSS1 (RSS) feeds
* Updated Dashboard widget styles
* General code check and clean
* Extensive testing on default WP install

**20140123**

* Tested plugin with latest version of WordPress (3.8)
* Added trailing slash to load_plugin_textdomain()
* Fixed 3 incorrect _e() tags in core file

**20131106**

* Added uninstall.php file
* Added "rate this plugin" links
* Improved "Overview" panel
* Added line to prevent direct loading of the script
* Add i18n support
* Improved database setup: `TIMESTAMP(8)` to `TIMESTAMP`
* Removed closing `?>` from simple-feed-stats.php
* Added "strict reporting" option
* Made some improvements to the settings page
* Replace `$options` with `$sfs_options`
* Added custom key/value parameter for "custom" or "alt" tracking methods
* Fixed filtering of "Feed Statistics"
* Fixed some PHP notices
* Cleaned up `simple_feed_stats` function
* Cleaned up `tracker.php` file
* Deprecated `$feed_rss` default tracking
* Improved sanitization of POST vars
* General code cleanup and maintenance
* Tested plugin with latest version of WordPress (3.7)

**20130715**

* Improved localization support
* Resolved numerous PHP Warnings
* Replaced deprecated WP functions
* Added additional info to readme.txt
* Removed filter_cron_schedules()
* Added cleanup of scheduled chron jobs upon deactivation
* Tightened security of tracker file
* Added default timezone (UTC)
* Overview and Updates admin panels toggled open by default
* General code check n clean

**20130104**

* Implemented WP Cron to improve caching
* Updated database queries according to new protocols
* Added margins to submit buttons (now required as WP 3.5)
* Added sfs_display_total_count() template tag for "all-time" stats
* Renamed external file used for current info and news
* Added shortcode to display daily RSS2 stats: [sfs_rss2_count]
* Added shortcode to display daily Comment stats: [sfs_comments_count]
* Renamed "truncate" function to "sfs_truncate"
* Disabled tracking for RSS feeds, which auto-redirect to RSS2
* Fixed bug causing occasional display of "0" for feed count

**20121031**

* Added MultiSite compatibility

**20121029**

* Renamed the wp-version check function to prefix with "sfs_"
* Added easyTooltip jQuery plugin
* Fixed toggle panels

**20121027**

* Fixed some PHP warnings and notices for undefined index and variables

**20121025**

* Added option to filter by referrer

**20121010**

* Initial plugin release


