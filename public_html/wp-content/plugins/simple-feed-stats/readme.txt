=== Simple Feed Stats ===

Plugin Name: Simple Feed Stats
Plugin URI: https://perishablepress.com/simple-feed-stats/
Description: Tracks your feeds, adds custom content, and displays your feed statistics on your site.
Tags: feed, feeds, stats, statistics, feedburner, tracking, subscribers
Author: Jeff Starr
Author URI: http://monzilla.biz/
Donate link: http://m0n.co/donate
Contributors: specialk
Requires at least: 3.9
Tested up to: 4.2
Stable tag: trunk
Version: 20150507
Text Domain: sfs
Domain Path: /languages/
License: GPL v2 or later

Simple Feed Stats makes it easy to track your feeds, add custom content, and display your feed statistics on your site.

== Description ==

[Simple Feed Stats](https://perishablepress.com/simple-feed-stats/) (SFS) tracks your feeds automatically using a variety of methods, and provides a wealth of tools and options for further configuration and management. Also displays your subscriber count via template tag or shortcode. Fully configurable. Visit the "Simple Feed Stats" settings page for stats, tools, and more info.

**Features**

* Dashboard widget - provides quick overview of your feed stats
* Custom feed content - embellish your feed with graphics, markup &amp; text
* Custom feed count - display any number or text for your feed count
* Custom CSS - use your own styles to customize your feed stats
* Shortcodes and template tags to display daily, total, RSS2, and comment stats
* Clear, reset, restore, delete - options to clear the cache, reset your stats, restore default settings, and delete the SFS database table
* Automatically tracks custom feeds built with the WordPress API
* NEW "strict mode" reporting option for more accurate feed count
* NEW custom key/value tracking parameters

**Tracking methods**

Simple Feed Stats provides three four different ways to track your feeds:

* Default tracking - tracks directly via feed request
* Custom tracking - tracks via embedded post image
* Alternate tracking - tracks via embedded feed image
* Open tracking - open tracking via embedded image

**Collected data**

Simple Feed Stats tracks the following data for each feed request:

* Feed type
* IP address
* Referrer
* Requested URL
* User-agent
* Date and more

== Installation ==

Upload the `/simple-feed-stats/` directory to your `/plugins/` folder and activate in the WP Admin. Then visit the Simple Feed Stats Settings page to view your stats, customize options, grab shortcodes, and more. Everything works automatically out of the box, with plenty of tools and options to customize and manage your feed stats.


[More info on installing WP plugins](http://codex.wordpress.org/Managing_Plugins#Installing_Plugins)

**Shortcodes**

Display feed count as plain-text number:

`[sfs_subscriber_count]`

Display feed stats with a FeedBurner-style badge:

`[sfs_count_badge]`

Display RSS2 stats in plain-text:

`[sfs_rss2_count]`

Display Comment stats in plain-text:

`[sfs_comments_count]`

See the plugin settings page for more infos.

**Template Tags**

Display daily stats as plain-text number:

`<?php if(function_exists('sfs_display_subscriber_count')) sfs_display_subscriber_count(); ?>`

Display daily stats as a nice FeedBurner-style badge:

`<?php if(function_exists('sfs_display_count_badge')) sfs_display_count_badge(); ?>`

Display total stats as plain-text:

`<?php if(function_exists('sfs_display_total_count')) sfs_display_total_count(); ?>`

**Testing**

To verify that the plugin is working properly, do the following:

1. Visit the "Your Info / More Info" panel in the plugin's settings
2. Click on each of "Your feed URLs" and refresh the settings page
3. In the "Tools and Options" panel, click "clear cache"
4. Refresh the settings page

After performing these steps, your "Current Feed Stats" and "Total Feed Stats" should both display some numbers, based on the feed URLs that you clicked in step 2. This means that the plugin is working using its default settings. Similar testing should be done for other feed-tracking options. Note that not all tracking methods (or browsers/devices) work for all types of feeds; for example, the "Alt Tracking" method is required to record hits for RDF feeds. 

**Notes**

To update your feed stats at any time (without waiting for the automatic 12-hour interval), click the "clear cache" link in the "Tools and Options" settings panel.

Also, this plugin uses WP Cron functionality to store feed data. Unfortunately, not all hosts/servers support WP Cron (e.g., Media Temple dv servers). If this is the case with your server, the total number of subscribers will not change from day to day. Fortunately there are a couple of workarounds/solutions:

* Click the "Clear cache" button (located in the plugin settings) once or twice per day
* Use a [free cron service](https://www.setcronjob.com/) to request manually `wp-cron.php` once or twice per day

See the plugin settings page for more infos.

== Upgrade Notice ==

To upgrade, simply upload the new version and you should be good to go.

== Screenshots ==

Screenshots and more info available at the [SFS Homepage](https://perishablepress.com/simple-feed-stats/).

== Changelog ==

= 20150507 =

* Tested with WP 4.2 + 4.3 (alpha)
* Changed a few "http" links to "https"
* Update: fixed stats for https sites
* Update: fixed multisite stats

= 20150317 =

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

= 20140925 =

* Tested on latest version of WordPress (4.0)
* Increased min-version requirement to WP 3.7
* Replaced 'UTF-8' with get_option('blog_charset') in sfs_clean()
* Added option to ignore the most common bots (googlebot, bingbot, et al)
* Updated i18n mo/po templates

= 20140308 =

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

= 20140123 =

* Tested plugin with latest version of WordPress (3.8)
* Added trailing slash to load_plugin_textdomain()
* Fixed 3 incorrect _e() tags in core file

= 20131106 =

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

= 20130715 =

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

= 20130104 =

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

= Previous versions =

* 20121031: Added MultiSite compatibility.
* 20121029: Renamed the wp-version check function to prefix with "sfs_". Fixed toggle panels, added easyTooltip jQuery plugin.
* 20121027: Fixed some PHP warnings and notices for undefined index and variables.
* 20121025: Added option to filter by referrer
* 20121010: Initial plugin release

== Frequently Asked Questions ==

Question: "How can I monitor a custom feed, such as one at http://example.com/feed/podcast/"

Answer: If you use WordPress API for the [custom feed template](https://digwp.com/2011/08/custom-feeds/), and include the usual template tags for feeds, the SFS plugin will automatically track the custom feed. 

Question: "What's up with 'strict mode' reporting?"

Answer: It has to do with how SFS reports your feed stats. For example, in normal reporting mode (strict mode = off), each feed request is reported as unique. With strict mode enabled, feed requests are filtered by IP address, so that if Mary requests your comments feed five times per day, it's counted as "1" subscriber rather than "5". It's more accurate, but feed counts are usually lower with strict mode enabled. Note also that SFS still records all requests, so if you're reporting in strict mode the individual request data is still recorded. In other words, strict mode determines how recorded data is reported, not collected.

Question: "How can I use the the custom key/value parameters?"

Answer: If you don't already know, you probably don't need it. Basically it's a requested feature that enables the inclusion of a custom URL parameter (key/value) in either "custom" or "alt" tracking methods. You know, for stuff like Google Analytics. The plan is to introduce the feature, collect more feedback, and then improve it. If you have any ideas, drop a line via the link below.

Question: "The stats are showing zero for the shortcodes and template tags, even though there are requests recorded in the Feed Stats panel. Why?"

Answer: During the first 12 hours, data is collected. Then the cache is refreshed to show the latest stats for the previous 12 hours. If your stats are showing zero or you would just like to update the count, visit the "Tools and Options" panel and click the "Clear cache" link.

To ask a question, visit the [SFS Homepage](https://perishablepress.com/simple-feed-stats/) or [contact me](https://perishablepress.com/contact/).

== Donations ==

I created this plugin with love for the WP community. To show support, you can [make a donation](http://m0n.co/donate) or purchase one of my books: 

* [The Tao of WordPress](https://wp-tao.com/)
* [Digging into WordPress](https://digwp.com/)
* [.htaccess made easy](https://htaccessbook.com/)
* [WordPress Themes In Depth](https://wp-tao.com/wordpress-themes-book/)

Links, tweets and likes also appreciated. Thanks! :)
