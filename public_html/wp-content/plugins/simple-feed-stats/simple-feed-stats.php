<?php
/*
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
*/

if (!defined('ABSPATH')) die();

$sfs_wp_vers = '4.1';
$sfs_version = '20160409';
$sfs_options = get_option('sfs_options');

// i18n
function sfs_i18n_init() {
	load_plugin_textdomain('sfs', false, dirname(plugin_basename(__FILE__)) . '/languages/');
}
add_action('plugins_loaded', 'sfs_i18n_init');

// cache-busting
function sfs_randomizer() {
	$sfs_randomizer = rand(1000000, 9999999);
	return $sfs_randomizer;
}
$sfs_rand = sfs_randomizer();
global $sfs_rand;

// require minimum version
function sfs_require_wp_version() {
	global $wp_version, $sfs_wp_vers;
	$plugin = plugin_basename(__FILE__);
	$plugin_data = get_plugin_data(__FILE__, false);
	
	if (version_compare($wp_version, $sfs_wp_vers, '<')) {
		if (is_plugin_active($plugin)) {
			deactivate_plugins($plugin);
			$msg  = '<p><strong>'. $plugin_data['Name'] .'</strong> '. __('requires WordPress ', 'sfs') . $sfs_wp_vers . __(' or higher, and has been deactivated! ', 'sfs');
			$msg .= __('Please upgrade WordPress and try again. Return to the', 'sfs') .' <a href="'. get_admin_url() .'update-core.php">'. __('WordPress Admin area', 'sfs') .'</a>.</p>';
			wp_die($msg);
		}
	}
}
if (isset($_GET['activate']) && $_GET['activate'] == 'true') {
	add_action('admin_init', 'sfs_require_wp_version');
}

// create stats table
function sfs_create_table() {
	global $wpdb;
	
	$table_name = $wpdb->prefix . 'simple_feed_stats';
	$check_table = $wpdb->get_var("SHOW TABLES LIKE '$table_name'");
	
	if ($check_table != $table_name) {
		$sql =  "CREATE TABLE " . $table_name . " (
			`id` mediumint(10) unsigned NOT NULL AUTO_INCREMENT,
			`logtime`  varchar(200) NOT NULL default '',
			`request`  varchar(200) NOT NULL default '',
			`referer`  varchar(200) NOT NULL default '',
			`type`     varchar(200) NOT NULL default '',
			`qstring`  varchar(200) NOT NULL default '',
			`address`  varchar(200) NOT NULL default '',
			`tracking` varchar(200) NOT NULL default '',
			`agent`    varchar(200) NOT NULL default '',
			PRIMARY KEY (`id`),
			cur_timestamp TIMESTAMP
		);";
		require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
		if (isset($sql)) dbDelta($sql);
		
		if (!isset($wpdb->feed_stats)) {
			$wpdb->feed_stats = $table_name; 
			$wpdb->tables[] = str_replace($wpdb->prefix, '', $table_name); 
		}
	}
}
if (isset($_GET['activate']) && $_GET['activate'] == 'true') {
	add_action('init', 'sfs_create_table');
}

// enable shortcodes in widgets and post content
if (isset($sfs_options['sfs_enable_shortcodes']) && $sfs_options['sfs_enable_shortcodes']) {
	add_filter('the_content', 'do_shortcode', 10);
	add_filter('widget_text', 'do_shortcode', 10); 
}

// string cleaner
function sfs_clean($string) {
	$string = trim($string); 
	$string = strip_tags($string);
	$string = htmlspecialchars($string, ENT_QUOTES, get_option('blog_charset', 'UTF-8'));
	$string = str_replace("\n", "", $string);
	$string = trim($string); 
	return $string;
}



/*
	Default Tracking
	tracks all feed requests
*/
function simple_feed_stats() {
	global $wpdb, $sfs_options;
	if (($sfs_options['sfs_tracking_method'] == 'sfs_default_tracking') && (is_feed())) {
		
		$protocol = 'http://';
		if (is_ssl()) $protocol = 'https://';
		
		$host = 'n/a'; $request = 'n/a'; $referer = 'n/a'; $qstring = 'n/a'; $address = 'n/a'; $agent = 'n/a';

		if (isset($_SERVER['HTTP_HOST']))       $host    = sfs_clean($_SERVER['HTTP_HOST']);
		if (isset($_SERVER['REQUEST_URI']))     $request = sfs_clean($protocol.$host.$_SERVER['REQUEST_URI']);
		if (isset($_SERVER['HTTP_REFERER']))    $referer = sfs_clean($_SERVER['HTTP_REFERER']);
		if (isset($_SERVER['QUERY_STRING']))    $qstring = sfs_clean($_SERVER['QUERY_STRING']);
		if (isset($_SERVER['REMOTE_ADDR']))     $address = sfs_clean($_SERVER['REMOTE_ADDR']);
		if (isset($_SERVER['HTTP_USER_AGENT'])) $agent   = sfs_clean($_SERVER['HTTP_USER_AGENT']);

		$date_format = get_option('date_format');
		$time_format = get_option('time_format');
		$logtime = date("{$date_format} {$time_format}", current_time('timestamp'));
		
		$feed_rdf       = get_bloginfo('rdf_url');           // RDF feed
		$feed_rss2      = get_bloginfo('rss2_url');          // RSS feed
		$feed_atom      = get_bloginfo('atom_url');          // Atom feed
		$feed_coms      = get_bloginfo('comments_rss2_url'); // RSS2 comments
		$feed_coms_atom = get_bloginfo('comments_atom_url'); // Atom comments

		$wp_feeds = array($feed_rdf, $feed_rss2, $feed_atom, $feed_coms, $feed_coms_atom);

		if     ($request == $feed_rdf)       $type = 'RDF';
		elseif ($request == $feed_rss2)      $type = 'RSS2';
		elseif ($request == $feed_atom)      $type = 'Atom';
		elseif ($request == $feed_coms)      $type = 'Comments';
		elseif ($request == $feed_coms_atom) $type = 'Comments';
		else                                 $type = 'Other';

		$tracking = 'default';
		
		if (in_array($request, $wp_feeds)) {
			$table = $wpdb->prefix . 'simple_feed_stats';
			$wpdb->insert($table, array(
				'logtime'  => $logtime, 
				'request'  => $request, 
				'referer'  => $referer, 
				'type'     => $type, 
				'qstring'  => $qstring, 
				'address'  => $address, 
				'tracking' => $tracking, 
				'agent'    => $agent, 
			));
		}
	}
}
add_action('wp', 'simple_feed_stats');



/*
	Custom Tracking
	Tracks via embedded post image (excludes Atom comments feed)
	Recommended if redirecting your feed to Feedburner using full-text feeds (use "Open Tracking" for Feedburner summary feeds)
*/
function sfs_feed_tracking($content) {
	
	global $wp_query, $sfs_options, $sfs_rand;
	
	if (is_feed()) {
		
		$feed_type = get_query_var('feed');
		$custom    = sfs_custom_parameter();
		$string    = array('sfs_tracking' => 'true', 'feed_type' => $feed_type, 'v' => $sfs_rand, $custom[0] => $custom[1]);
		$url       = plugins_url('/simple-feed-stats/tracker.php?'. http_build_query($string));
		
		if (is_comment_feed() && $feed_type == 'rss2') $feed_type = 'comments';
		
		if (($wp_query->current_post == 0) || ($wp_query->current_comment == 0)) {
			
			return '<img src="'. $url .'" width="1" height="1" alt=""> '. $content;
			
		}
		
	}
	
	return $content;
	
}
function sfs_custom_parameter() {
	global $sfs_options;
	$custom_key = '';
	$custom_value = '';
	if (!empty($sfs_options['sfs_custom_key']) && !empty($sfs_options['sfs_custom_value'])) {
		$custom_key = $sfs_options['sfs_custom_key'];
		$custom_value = $sfs_options['sfs_custom_value'];
	}
	return array($custom_key, $custom_value);
}
if ($sfs_options['sfs_tracking_method'] == 'sfs_custom_tracking') {
	add_filter('the_content', 'sfs_feed_tracking');
	add_filter('the_excerpt', 'sfs_feed_tracking');
	add_filter('comment_text_rss', 'sfs_feed_tracking'); 
	// ^ no equivalent for atom comment feeds (e.g., comment_text_atom)
}



/*
	Alt Tracking
	Tracks via embedded feed image
	Experimental tracking method
*/
function sfs_alt_tracking_rdf() {
	global $sfs_options, $sfs_rand; 
	$custom = sfs_custom_parameter(); 
	$string = array('sfs_tracking' => 'true', 'feed_type' => 'rdf', 'v' => $sfs_rand, $custom[0] => $custom[1]); 
	$url = plugins_url('/simple-feed-stats/tracker.php?'. http_build_query($string, '', '&amp;')); ?>

	<image rdf:resource="<?php echo $url; ?>">
		<title><?php bloginfo_rss('name'); ?></title>
		<url><?php echo $url; ?></url>
		<link><?php bloginfo_rss('url'); ?></link>
		<description><?php bloginfo('description'); ?></description>
	</image>
<?php }

function sfs_alt_tracking_rss() {
	global $sfs_options, $sfs_rand; 
	$custom = sfs_custom_parameter(); 
	$string = array('sfs_tracking' => 'true', 'feed_type' => 'rss2', 'v' => $sfs_rand, $custom[0] => $custom[1]); 
	$url = plugins_url('/simple-feed-stats/tracker.php?'. http_build_query($string, '', '&amp;')); ?>

	<image>
		<title><?php bloginfo_rss('name'); ?></title>
		<url><?php echo $url; ?></url>
		<link><?php bloginfo_rss('url'); ?></link>
		<width>1</width><height>1</height>
		<description><?php bloginfo('description'); ?></description>
	</image>
<?php }

function sfs_alt_tracking_atom() {
	global $sfs_options, $sfs_rand; 
	$custom = sfs_custom_parameter(); 
	$string = array('sfs_tracking' => 'true', 'feed_type' => 'atom', 'v' => $sfs_rand, $custom[0] => $custom[1]); 
	$url = plugins_url('/simple-feed-stats/tracker.php?'. http_build_query($string, '', '&amp;')); ?>

	<icon><?php echo $url; ?></icon>
<?php }

function sfs_alt_tracking_comments_rss() {
	global $sfs_options, $sfs_rand; 
	$custom = sfs_custom_parameter(); 
	$string = array('sfs_tracking' => 'true', 'feed_type' => 'comments', 'v' => $sfs_rand, $custom[0] => $custom[1]); 
	$url = plugins_url('/simple-feed-stats/tracker.php?'. http_build_query($string, '', '&amp;')); ?>

	<image>
		<title><?php _e('Comments for ', 'sfs') . bloginfo_rss('name'); ?></title>
		<url><?php echo $url; ?></url>
		<link><?php bloginfo_rss('url'); ?></link>
		<width>1</width><height>1</height>
		<description><?php bloginfo('description'); ?></description>
	</image>
<?php }

function sfs_alt_tracking_comments_atom() {
	global $sfs_options, $sfs_rand; 
	$custom = sfs_custom_parameter(); 
	$string = array('sfs_tracking' => 'true', 'feed_type' => 'comments', 'v' => $sfs_rand, $custom[0] => $custom[1]); 
	$url = plugins_url('/simple-feed-stats/tracker.php?'. http_build_query($string, '', '&amp;')); ?>

	<icon><?php echo $url; ?></icon>
<?php }

if ($sfs_options['sfs_tracking_method'] == 'sfs_alt_tracking') {
	add_action('rdf_header', 'sfs_alt_tracking_rdf');
	add_action('rss2_head', 'sfs_alt_tracking_rss');
	add_action('atom_head', 'sfs_alt_tracking_atom');
	add_action('commentsrss2_head', 'sfs_alt_tracking_comments_rss');
	add_action('comments_atom_head', 'sfs_alt_tracking_comments_atom'); 
	// ^ comments_atom_head doesn't seem to work = bug?
}



// display settings link on plugin page
function sfs_plugin_action_links($links, $file) {
	if ($file == plugin_basename(__FILE__)) {
		$sfs_links = '<a href="'. get_admin_url() .'options-general.php?page=sfs-options">'. __('Settings', 'sfs') .'</a>';
		array_unshift($links, $sfs_links);
	}
	return $links;
}
add_filter ('plugin_action_links', 'sfs_plugin_action_links', 10, 2);

// rate plugin link
function add_sfs_links($links, $file) {
	if ($file == plugin_basename(__FILE__)) {
		$rate_url = 'http://wordpress.org/support/view/plugin-reviews/'. basename(dirname(__FILE__)) .'?rate=5#postform';
		$links[] = '<a href="'. $rate_url .'" target="_blank" title="'. __('Click here to rate and review this plugin on WordPress.org', 'sfs') .'">'. __('Rate this plugin', 'sfs') .'</a>';
	}
	return $links;
}
add_filter('plugin_row_meta', 'add_sfs_links', 10, 2);

// delete plugin settings
function sfs_delete_options_on_deactivation() {
	delete_option('sfs_options');
}
if ($sfs_options['default_options'] == 1) {
	register_uninstall_hook (__FILE__, 'sfs_delete_options_on_deactivation');
}

// delete stats table
function sfs_delete_table_on_deactivation() {
	global $wpdb;
	$result = $wpdb->query("DROP TABLE " . $wpdb->prefix . "simple_feed_stats");
	sfs_delete_transients();
}
if ($sfs_options['sfs_delete_table'] == 1) {
	register_deactivation_hook(__FILE__, 'sfs_delete_table_on_deactivation');
}

// define default settings
function sfs_add_defaults() {
	$tmp = get_option('sfs_options');
	if (($tmp['default_options'] == '1') || (!is_array($tmp))) {
		$arr = array(
			'sfs_custom'              => '0', // string
			'sfs_custom_enable'       => 0,
			'sfs_number_results'      => '3',
			'sfs_tracking_method'     => 'sfs_default_tracking',
			'sfs_open_image_url'      => plugins_url('/simple-feed-stats/testing.gif'),
			'sfs_delete_table'        => 0,
			'default_options'         => 0,
			'sfs_feed_content_before' => '',
			'sfs_feed_content_after'  => '',
			'sfs_strict_stats'        => 0,
			'sfs_custom_key'          => 'custom_key',
			'sfs_custom_value'        => 'custom_value',
			'sfs_ignore_bots'         => 0,
			'sfs_enable_shortcodes'   => 0,
			'sfs_custom_styles'       => sfs_default_badge_styles(),
		);
		update_option('sfs_options', $arr);
		update_option('sfs_alert', 0);
	}
}
register_activation_hook (__FILE__, 'sfs_add_defaults');

// default badge styles
function sfs_default_badge_styles() {
	
	return '.sfs-subscriber-count, .sfs-count, .sfs-count span, .sfs-stats { -webkit-box-sizing: initial; -moz-box-sizing: initial; box-sizing: initial; }
.sfs-subscriber-count { width: 88px; overflow: hidden; height: 26px; color: #424242; font: 9px Verdana, Geneva, sans-serif; letter-spacing: 1px; }
.sfs-count { width: 86px; height: 17px; line-height: 17px; margin: 0 auto; background: #ccc; border: 1px solid #909090; border-top-color: #fff; border-left-color: #fff; }
.sfs-count span { display: inline-block; height: 11px; line-height: 12px; margin: 2px 1px 2px 2px; padding: 0 2px 0 3px; background: #e4e4e4; border: 1px solid #a2a2a2; border-bottom-color: #fff; border-right-color: #fff; }
.sfs-stats { font-size: 6px; line-height: 6px; margin: 1px 0 0 1px; word-spacing: 2px; text-align: center; text-transform: uppercase; }';
	
}

// define style options
$sfs_tracking_method = array(
	'sfs_disable_tracking' => array(
		'value' => 'sfs_disable_tracking',
		'label' => '<strong>'. __('Disable tracking', 'sfs') .'</strong> &ndash; <em>'. __('disables all tracking', 'sfs') .'</em> <span class="tooltip" title="'. __('Note: no stats or data will be deleted.', 'sfs') .'">?</span>',
	),
	'sfs_default_tracking' => array(
		'value' => 'sfs_default_tracking',
		'label' => '<strong>'. __('Default tracking', 'sfs') .'</strong> &ndash; <em>'. __('tracks via feed requests', 'sfs') .'</em> <span class="tooltip" title="'. __('Recommended if serving your own feeds.', 'sfs') .'">?</span>',
	),
	'sfs_custom_tracking' => array(
		'value' => 'sfs_custom_tracking',
		'label' => '<strong>'. __('Custom tracking', 'sfs') . '</strong> &ndash; <em>'. __('tracks via embedded post image', 'sfs') .'</em> <span class="tooltip" title="'. __('Recommended if redirecting your feed to FeedBurner (using Full-text feeds only; use &ldquo;Open Tracking&rdquo; for FeedBurner Summary feeds).', 'sfs') .'">?</span>'
	),
	'sfs_alt_tracking' => array(
		'value' => 'sfs_alt_tracking',
		'label' => '<strong>'. __('Alternate tracking', 'sfs') .'</strong> &ndash; <em>'. __('tracks via embedded feed image', 'sfs') .'</em> <span class="tooltip" title="'. __('Experimental tracking method.', 'sfs') .'">?</span>'
	),
	'sfs_open_tracking' => array(
		'value' => 'sfs_open_tracking',
		'label' => '<strong>'. __('Open tracking', 'sfs') .'</strong> &ndash; <em>'. __('open tracking via image', 'sfs') .'</em> <span class="tooltip" title="'. __('Track any feed or web page by using the open-tracking URL as the <code>src</code> for any <code>img</code> tag. Tip: this is a good alternate method of tracking your FeedBurner feeds.', 'sfs') .'">?</span>'
	),
);

// sanitize and validate input
function sfs_validate_options($input) {
	global $sfs_tracking_method;
	
	if (!isset($input['sfs_custom_enable'])) $input['sfs_custom_enable'] = null;
	$input['sfs_custom_enable'] = ($input['sfs_custom_enable'] == 1 ? 1 : 0);

	if (!isset($input['sfs_delete_table'])) $input['sfs_delete_table'] = null;
	$input['sfs_delete_table'] = ($input['sfs_delete_table'] == 1 ? 1 : 0);

	if (!isset($input['sfs_strict_stats'])) $input['sfs_strict_stats'] = null;
	$input['sfs_strict_stats'] = ($input['sfs_strict_stats'] == 1 ? 1 : 0);

	if (!isset($input['default_options'])) $input['default_options'] = null;
	$input['default_options'] = ($input['default_options'] == 1 ? 1 : 0);
	
	if (!isset($input['sfs_ignore_bots'])) $input['sfs_ignore_bots'] = null;
	$input['sfs_ignore_bots'] = ($input['sfs_ignore_bots'] == 1 ? 1 : 0);
	
	if (!isset($input['sfs_enable_shortcodes'])) $input['sfs_enable_shortcodes'] = null;
	$input['sfs_enable_shortcodes'] = ($input['sfs_enable_shortcodes'] == 1 ? 1 : 0);
	
	if (!isset($input['sfs_tracking_method'])) $input['sfs_tracking_method'] = null;
	if (!array_key_exists($input['sfs_tracking_method'], $sfs_tracking_method)) $input['sfs_tracking_method'] = null;

	$input['sfs_custom']         = wp_filter_nohtml_kses($input['sfs_custom']);
	$input['sfs_custom_styles']  = wp_filter_nohtml_kses($input['sfs_custom_styles']);
	$input['sfs_number_results'] = wp_filter_nohtml_kses($input['sfs_number_results']);
	$input['sfs_open_image_url'] = wp_filter_nohtml_kses($input['sfs_open_image_url']);
	$input['sfs_custom_key']     = wp_filter_nohtml_kses($input['sfs_custom_key']);
	$input['sfs_custom_value']   = wp_filter_nohtml_kses($input['sfs_custom_value']);

	$input['sfs_feed_content_before'] = wp_kses_post($input['sfs_feed_content_before']);
	$input['sfs_feed_content_after']  = wp_kses_post($input['sfs_feed_content_after']);

	return $input;
}

// whitelist settings
function sfs_init() {
	register_setting('sfs_plugin_options', 'sfs_options', 'sfs_validate_options');
}
add_action('admin_init', 'sfs_init');

// add the options page
function sfs_add_options_page() {
	add_options_page('Simple Feed Stats', 'Simple Feed Stats', 'manage_options', 'sfs-options', 'sfs_render_form');
}
add_action('admin_menu', 'sfs_add_options_page');

// add query-string variable @ http://www.addedbytes.com/code/querystring-functions/
function add_querystring_var($url, $key, $value) { 
	$url = preg_replace('/(.*)(\?|&)' . $key . '=[^&]+?(&)(.*)/i', '$1$2$4', $url . '&'); 
	$url = substr($url, 0, -1);
	if (strpos($url, '?') === false) { 
		return ($url . '?' . $key . '=' . $value); 
	} else { 
		return ($url . '&' . $key . '=' . $value); 
	}
}

// shorten string & add ellipsis (by David Duong)
function sfs_truncate($string, $max = 50, $rep = '') {
    $leave = $max - strlen($rep);
    return substr_replace($string, $rep, $leave);
}

// display total stats template tag
function sfs_display_total_count() {
	global $sfs_options; 
	$all_count = get_transient('all_count');
	if ($all_count) echo $all_count;
	else echo '0';
}

// display daily stats template tag
function sfs_display_subscriber_count() {
	global $sfs_options;
	if ($sfs_options['sfs_custom_enable'] == 1) {
		echo $sfs_options['sfs_custom'];
	} else {
		$feed_count = get_transient('feed_count');	
		if ($feed_count) echo $feed_count;
		else echo '0';
	}
}

// display stats shortcode
function sfs_subscriber_count() { 
	global $sfs_options;
	if ($sfs_options['sfs_custom_enable'] == 1) {
		return $sfs_options['sfs_custom'];
	} else {
		$feed_count = get_transient('feed_count');	
		if ($feed_count) return $feed_count;
		else return '0';
	}
}
add_shortcode('sfs_subscriber_count','sfs_subscriber_count');

// display daily RSS2 stats shortcode
function sfs_rss2_count() { 
	global $sfs_options;
	$feed_count = get_transient('rss2_count');	
	if ($feed_count) return $feed_count;
	else return '0';
}
add_shortcode('sfs_rss2_count','sfs_rss2_count');

// display daily comment stats shortcode
function sfs_comments_count() {
	global $sfs_options;
	$feed_count = get_transient('comment_count');	
	if ($feed_count) return $feed_count;
	else return '0';
}
add_shortcode('sfs_comments_count','sfs_comments_count');

// feed count badge template tag
function sfs_display_count_badge() {
	
	echo sfs_count_badge();
	
}

// feed count badge shortcode
function sfs_count_badge() {
	global $sfs_options;
	$sfs_pre_badge = '<div class="sfs-subscriber-count"><div class="sfs-count"><span>';
	$sfs_post_badge = '</span> readers</div><div class="sfs-stats">'. __('Simple Feed Stats', 'sfs') .'</div></div>';

	if ($sfs_options['sfs_custom_enable']) {
		return $sfs_pre_badge . $sfs_options['sfs_custom'] . $sfs_post_badge;
	} else {
		$feed_count = get_transient('feed_count');	
		if ($feed_count) return $sfs_pre_badge . $feed_count . $sfs_post_badge;
		else return $sfs_pre_badge . '0' . $sfs_post_badge;
	}
}
add_shortcode('sfs_count_badge','sfs_count_badge');

// conditional css inclusion
function sfs_include_badge_styles() {
	global $sfs_options;
	$sfs_badge_styles = esc_textarea($sfs_options['sfs_custom_styles']);
	echo '<style type="text/css">' . "\n";
	echo $sfs_badge_styles . "\n";
	echo '</style>' . "\n";
}
if (!empty($sfs_options['sfs_custom_styles'])) {
	add_action('wp_head', 'sfs_include_badge_styles');
}

// custom footer content
function sfs_feed_content($content) {
	global $wp_query, $sfs_options;
	$custom_before = $sfs_options['sfs_feed_content_before'];
	$custom_after  = $sfs_options['sfs_feed_content_after'];
	if (is_feed()) return $custom_before . $content . $custom_after;
	else return $content;
}
if ((!empty($sfs_options['sfs_feed_content_before'])) || (!empty($sfs_options['sfs_feed_content_after']))) {
	add_filter('the_content', 'sfs_feed_content');
	add_filter('the_excerpt', 'sfs_feed_content');
}



// cron three minute interval
function sfs_cron_three_minutes($schedules) {
	$schedules['three_minutes'] = array('interval' => 180, 'display' => __('Three minutes'));
	return $schedules;
}
add_filter('cron_schedules', 'sfs_cron_three_minutes');

// cron for caching counts
function sfs_cron_activation() {
	if (!wp_next_scheduled('sfs_cron_cache')) {
		wp_schedule_event(time(), 'twicedaily', 'sfs_cron_cache'); // eg: hourly, daily, twicedaily (SFS default), three_minutes
	}
}
register_activation_hook(__FILE__, 'sfs_cron_activation');

// cleanup cron on deactivate
function sfs_cron_cleanup() {
	$timestamp = wp_next_scheduled('sfs_cron_cache');
	wp_unschedule_event($timestamp,'sfs_cron_cache');
}
register_deactivation_hook(__FILE__, 'sfs_cron_cleanup');

// cache feed counts
function sfs_cache_data() {
	global $wpdb, $sfs_options;
	
	if ($sfs_options['sfs_strict_stats']) $count = 'COUNT(DISTINCT address)';
	else $count = 'COUNT(*)';
	
	// all-time stats
	$all_stats = $wpdb->get_row("SELECT " . $count . " FROM " . $wpdb->prefix . "simple_feed_stats", ARRAY_A);
	if (is_array($all_stats)) $all_stats = $all_stats[$count];
	else $all_stats = '0';
	
	// daily stats
	$current_stats = $wpdb->get_row("SELECT " . $count . " FROM " . $wpdb->prefix . "simple_feed_stats WHERE cur_timestamp BETWEEN TIMESTAMP(DATE_SUB(NOW(), INTERVAL 1 DAY)) AND NOW()", ARRAY_A); // AND TYPE != 'Comments'
	if (is_array($current_stats)) $current_stats = $current_stats[$count];
	else $current_stats = '0';
	
	// daily RSS2 stats
	$rss2_stats = $wpdb->get_row("SELECT " . $count . " FROM " . $wpdb->prefix . "simple_feed_stats WHERE type='RSS2' AND cur_timestamp BETWEEN TIMESTAMP(DATE_SUB(NOW(), INTERVAL 1 DAY)) AND NOW()", ARRAY_A);
	if (is_array($rss2_stats)) $rss2_stats = $rss2_stats[$count];
	else $rss2_stats = '0';
	
	// daily comment stats
	$comment_stats = $wpdb->get_row("SELECT " . $count . " FROM " . $wpdb->prefix . "simple_feed_stats WHERE type='Comments' AND cur_timestamp BETWEEN TIMESTAMP(DATE_SUB(NOW(), INTERVAL 1 DAY)) AND NOW()", ARRAY_A);
	if (is_array($comment_stats)) $comment_stats = $comment_stats[$count];
	else $comment_stats = '0';
	
	set_transient('feed_count', $current_stats, 60*60*24); // 12 hour cache 60*60*12 , 24 hour cache = 60*60*24
	$feed_count = get_transient('feed_count');
	set_transient('all_count', $all_stats, 60*60*24); // 12 hour cache 60*60*12 , 24 hour cache = 60*60*24
	$all_count = get_transient('all_count');
	set_transient('rss2_count', $rss2_stats, 60*60*24); // 12 hour cache 60*60*12 , 24 hour cache = 60*60*24
	$rss2_count = get_transient('rss2_count');
	set_transient('comment_count', $comment_stats, 60*60*24); // 12 hour cache 60*60*12 , 24 hour cache = 60*60*24
	$comment_count = get_transient('comment_count');
}
add_action('sfs_cron_cache', 'sfs_cache_data');



// delete transients
function sfs_delete_transients() {
	
	if (is_multisite()) {
		delete_site_transient('feed_count');
		delete_site_transient('all_count');
		delete_site_transient('rss2_count');
		delete_site_transient('comments_count');
		
		delete_site_transient('_transient_timeout_all_count');
		delete_site_transient('_transient_timeout_feed_count');
		delete_site_transient('_transient_timeout_rss2_count');
		delete_site_transient('_transient_timeout_comment_count');
	} else {
		delete_transient('feed_count');
		delete_transient('all_count');
		delete_transient('rss2_count');
		delete_transient('comments_count');
		
		delete_transient('_transient_timeout_all_count');
		delete_transient('_transient_timeout_feed_count');
		delete_transient('_transient_timeout_rss2_count');
		delete_transient('_transient_timeout_comment_count');
	}
}

// clear cache
function sfs_clear_cache() {
	if (isset($_GET['cache']) && $_GET['cache'] === 'clear') {
		if (current_user_can('administrator')) {
			
			sfs_delete_transients();
			sfs_cache_data();
		}
	}
}
add_action('init', 'sfs_clear_cache');

// reset stats
function sfs_reset_stats() {
	global $wpdb;
	if ((isset($_GET['reset'])) && ($_GET['reset'] === 'true')) {
		if (current_user_can('administrator')) {
			
			$truncate = $wpdb->query("TRUNCATE " . $wpdb->prefix . "simple_feed_stats");
			sfs_delete_transients();
			sfs_cache_data();
		}
	}
}
add_action('init', 'sfs_reset_stats');



// sfs dashboard widget 
function sfs_dashboard_widget() { 
	$sfs_query_current = sfs_query_database('current_stats'); ?>

	<style type="text/css">
		.sfs-table table { border-collapse: collapse; }
		.sfs-table th { font-size: 12px; }
		.sfs-table td { 
			display: table-cell; vertical-align: middle; padding: 10px; color: #555; border: 1px solid #dfdfdf;
			text-align: left; text-shadow: 1px 1px 1px #fff; font: bold 18px/18px Georgia, serif; 
			}
			.sfs-table .rdf      { background-color: #d9e8f9; }
			.sfs-table .rss2     { background-color: #d5f2d5; }
			.sfs-table .atom     { background-color: #fafac0; }
			.sfs-table .comments { background-color: #fee6cc; }
	</style>
	<p><?php _e('Current Subscriber Count', 'sfs'); ?>: <strong><?php sfs_display_subscriber_count(); ?></strong></p>
	<div class="sfs-table">
		<table class="widefat">
			<thead>
				<tr>
					<th><?php _e('RDF', 'sfs'); ?></th>
					<th><?php _e('RSS2', 'sfs'); ?></th>
					<th><?php _e('Atom', 'sfs'); ?></th>
					<th><?php _e('Comments', 'sfs'); ?></th>
				</tr>
			</thead>
			<tbody>
				<tr>
					<td class="rdf"><?php echo $sfs_query_current[0]; ?></td>
					<td class="rss2"><?php echo $sfs_query_current[1]; ?></td>
					<td class="atom"><?php echo $sfs_query_current[2]; ?></td>
					<td class="comments"><?php echo $sfs_query_current[3]; ?></td>
				</tr>
			</tbody>
		</table>
	</div>
	<p><a href="<?php get_admin_url(); ?>options-general.php?page=sfs-options"><?php _e('More stats, tools, and options &raquo;', 'sfs'); ?></a></p>

<?php }
function add_custom_dashboard_widget() {
	wp_add_dashboard_widget('sfs_dashboard_widget', 'Simple Feed Stats', 'sfs_dashboard_widget');
}
add_action('wp_dashboard_setup', 'add_custom_dashboard_widget');

// query database for stats
function sfs_query_database($sfs_query_type) {
	global $wpdb, $sfs_options;

	if ($sfs_options['sfs_strict_stats']) $count = 'COUNT(DISTINCT address)';
	else $count = 'COUNT(*)';

	if ($sfs_query_type == 'current_stats') {
		
		$count_recent_rdf = $wpdb->get_row("SELECT " . $count . " FROM " . $wpdb->prefix . "simple_feed_stats WHERE type='RDF' AND cur_timestamp BETWEEN TIMESTAMP(DATE_SUB(NOW(), INTERVAL 1 DAY)) AND NOW()", ARRAY_A);
		if (is_array($count_recent_rdf)) $count_recent_rdf = $count_recent_rdf[$count];
		else $count_recent_rdf = '0';
		
		$count_recent_rss2 = $wpdb->get_row("SELECT " . $count . " FROM " . $wpdb->prefix . "simple_feed_stats WHERE type='RSS2' AND cur_timestamp BETWEEN TIMESTAMP(DATE_SUB(NOW(), INTERVAL 1 DAY)) AND NOW()", ARRAY_A);
		if (is_array($count_recent_rss2)) $count_recent_rss2 = $count_recent_rss2[$count];
		else $count_recent_rss2 = '0';
		
		$count_recent_atom = $wpdb->get_row("SELECT " . $count . " FROM " . $wpdb->prefix . "simple_feed_stats WHERE type='Atom' AND cur_timestamp BETWEEN TIMESTAMP(DATE_SUB(NOW(), INTERVAL 1 DAY)) AND NOW()", ARRAY_A);
		if (is_array($count_recent_atom)) $count_recent_atom = $count_recent_atom[$count];
		else $count_recent_atom = '0';
		
		$count_recent_comments = $wpdb->get_row("SELECT " . $count . " FROM " . $wpdb->prefix . "simple_feed_stats WHERE type='Comments' AND cur_timestamp BETWEEN TIMESTAMP(DATE_SUB(NOW(), INTERVAL 1 DAY)) AND NOW()", ARRAY_A);
		if (is_array($count_recent_comments)) $count_recent_comments = $count_recent_comments[$count];
		else $count_recent_comments = '0';
		
		$count_recent_open = $wpdb->get_row("SELECT " . $count . " FROM " . $wpdb->prefix . "simple_feed_stats WHERE tracking='open' AND cur_timestamp BETWEEN TIMESTAMP(DATE_SUB(NOW(), INTERVAL 1 DAY)) AND NOW()", ARRAY_A);
		if (is_array($count_recent_open)) $count_recent_open = $count_recent_open[$count];
		else $count_recent_open = '0';
		
		$count_recent_other = $wpdb->get_row("SELECT " . $count . " FROM " . $wpdb->prefix . "simple_feed_stats WHERE type='other' AND cur_timestamp BETWEEN TIMESTAMP(DATE_SUB(NOW(), INTERVAL 1 DAY)) AND NOW()", ARRAY_A);
		if (is_array($count_recent_other)) $count_recent_other = $count_recent_other[$count];
		else $count_recent_other = '0';
		
		$sfs_query_current = array($count_recent_rdf, $count_recent_rss2, $count_recent_atom, $count_recent_comments, $count_recent_open, $count_recent_other);
		return $sfs_query_current;
		
	} elseif ($sfs_query_type == 'alltime_stats') {
		
		$count_rdf = $wpdb->get_row("SELECT " . $count . " FROM " . $wpdb->prefix . "simple_feed_stats WHERE type='RDF'", ARRAY_A);
		if (is_array($count_rdf)) $count_rdf = $count_rdf[$count];
		else $count_rdf = '0';
		
		$count_rss2 = $wpdb->get_row("SELECT " . $count . " FROM " . $wpdb->prefix . "simple_feed_stats WHERE type='RSS2'", ARRAY_A);
		if (is_array($count_rss2)) $count_rss2 = $count_rss2[$count];
		else $count_rss2 = '0';
		
		$count_atom = $wpdb->get_row("SELECT " . $count . " FROM " . $wpdb->prefix . "simple_feed_stats WHERE type='Atom'", ARRAY_A);
		if (is_array($count_atom)) $count_atom = $count_atom[$count];
		else $count_atom = '0';
		
		$count_comments = $wpdb->get_row("SELECT " . $count . " FROM " . $wpdb->prefix . "simple_feed_stats WHERE type='Comments'", ARRAY_A);
		if (is_array($count_comments)) $count_comments = $count_comments[$count];
		else $count_comments = '0';
		
		$count_open = $wpdb->get_row("SELECT " . $count . " FROM " . $wpdb->prefix . "simple_feed_stats WHERE tracking='open'", ARRAY_A);
		if (is_array($count_open)) $count_open = $count_open[$count];
		else $count_open = '0';
		
		$count_other = $wpdb->get_row("SELECT " . $count . " FROM " . $wpdb->prefix . "simple_feed_stats WHERE type='other'", ARRAY_A);
		if (is_array($count_other)) $count_other = $count_other[$count];
		else $count_other = '0';
		
		$sfs_query_alltime = array($count_rdf, $count_rss2, $count_atom, $count_comments, $count_open, $count_other);
		return $sfs_query_alltime;
	}
}

// dismiss plugin notice
function sfs_dismiss_notice() {
	if (isset($_GET['sfs-alert']) && wp_verify_nonce($_GET['sfs-alert'], 'sfs-alert')) {
		if (isset($_GET['sfs_alert']) && $_GET['sfs_alert'] == '1') update_option('sfs_alert', 1);
	}
}
add_action('admin_init', 'sfs_dismiss_notice');

// create the options page
function sfs_render_form() {
	global $wpdb, $sfs_options, $sfs_tracking_method;
	
	if (get_option('sfs_alert')) {
		$display_alert = ' style="display:none;"';
		$checked = true;
	} else {
		$display_alert = ' style="display:block;"';
		$checked = false;
	}
	$sfs_query_current = sfs_query_database('current_stats'); 
	$sfs_query_alltime = sfs_query_database('alltime_stats'); 
	$numresults = $sfs_options['sfs_number_results'];
	
	if (isset($_GET["p"])) $pagevar = (is_numeric($_GET["p"]) ? $_GET["p"] : 1);
	else $pagevar = '1';	

	$offset = ($pagevar-1) * $numresults;
	
	$numrows = $wpdb->get_row("SELECT COUNT(*) FROM " . $wpdb->prefix . "simple_feed_stats", ARRAY_A);
	if (is_array($numrows)) $numrows = $numrows['COUNT(*)'];
	else $numrows = 'undefined';
	$maxpage = ceil($numrows/$numresults);
	
	if ((isset($_GET['filter'])) && (!empty($_GET['filter']))) {
		$sql = '';
		$filter = sfs_clean($_GET['filter']);
		if ($filter === 'logtime' || $filter === 'type' || $filter === 'address' || $filter === 'agent' || $filter === 'tracking' || $filter === 'referer') {    
			$sql = $wpdb->get_results($wpdb->prepare("SELECT * FROM ". $wpdb->prefix ."simple_feed_stats ORDER BY $filter ASC LIMIT %d, %d", $offset, $numresults)); // bug? can't use %s for $filter
		}
	} else {
		$sql = $wpdb->get_results($wpdb->prepare("SELECT * FROM ".$wpdb->prefix."simple_feed_stats ORDER BY id DESC LIMIT %d, %d", $offset, $numresults));
	} ?>

	<style type="text/css">
		.dismiss-alert { margin: 15px 0; }
		.dismiss-alert-wrap { display: inline-block; padding: 7px 0 10px 0; }
		.dismiss-alert .description { display: inline-block; margin: -2px 15px 0 0; }
		
		.sfs-overview {
			padding-left: 130px;
			background-image: url(<?php echo plugins_url('/simple-feed-stats/sfs-logo.jpg'); ?>); 
			background-repeat: no-repeat; background-position: 0 0; background-size: 120px 131px;
			}
			
		.toggle { margin: 0 15px 15px 15px; }
		.sfs-menu-item { float: left; margin: 12px 12px 12px 0; }
		.sfs-sub-item { display: inline-block; }
		.sfs-menu-row { margin: 12px 0 0 0; }
		
		.sfs-admin h1 small { font-size: 60%; color: #777; }
		.js .sfs-admin .postbox h2 { margin: 0; padding: 12px 0 12px 15px; font-size: 16px; cursor: pointer; }
		.sfs-admin h3 { margin: 20px 0; font-size: 14px; }
		.sfs-admin ul { margin: 15px 15px 25px 40px; clear: both; line-height: 16px; }
		.sfs-admin li { margin: 8px 0; list-style-type: disc; }
		.sfs-admin abbr { cursor: help; border-bottom: 1px dotted #dfdfdf; }
		
		.sfs-table table { border-collapse: collapse; }
		.sfs-table th { font-size: 13px; }
		.sfs-table td { padding: 5px 10px; color: #555; border: 1px solid #dfdfdf; font: 12px/18px 'Proxima Nova Regular', 'Helvetica Neue', Helvetica, Arial, sans-serif; }
		.sfs-table .form-table td { padding: 10px; border: none; }
		.sfs-table .form-table th { padding: 10px 10px 10px 0; }
		
		.rdf      { background-color: #d9e8f9; }
		.rss2     { background-color: #d5f2d5; }
		.atom     { background-color: #fafac0; }
		.comments { background-color: #fee6cc; }
		.open     { background-color: #ffe3e3; }
		.other    { background-color: #efefef; }
		
		.sfs-statistics div { margin: 5px; }
		.sfs-statistics .sfs-type { padding: 0 12px; text-align: center; }
		.sfs-table .sfs-type { display: table-cell; vertical-align: middle; padding: 12px; text-align: left; text-shadow: 1px 1px 1px #fff; font: bold 20px/20px Georgia, serif; }
		.sfs-meta, .sfs-details { font-size: 12px; }
		.sfs-meta div { margin: 3px 5px; }
		.sfs-stats-type { font-size: 12px; font-weight: bold; }
		.sfs-stats-type span { color: #777; font-size: 11px; font-weight: normal; }
		
		.sfs-radio { margin: 5px 0; }
		.sfs-table-item { margin: 0 0 10px 0; }
		.sfs-code-input[type="text"], .textarea { width: 90%; padding: 6px; color: #777; font-size: 12px; }
		.sfs-table input[type="text"] { padding: 6px; color: #777; font-size: 12px; }
		.sfs-last-item { margin: 24px 0 0 0; }
		
		.tooltip { 
			cursor: help; display: inline-block; width: 18px; height: 18px; margin: 0 0 0 4px; text-align: center; font: bold 12px/18px Georgia, serif;
			border: 2px solid #fff; color: #fff; background-color: #359fce; -webkit-border-radius: 18px; -moz-border-radius: 18px; border-radius: 18px;
			-webkit-box-shadow: 0 0 1px rgba(0,0,0,0.3); -moz-box-shadow: 0 0 1px rgba(0,0,0,0.3); box-shadow: 0 0 1px rgba(0,0,0,0.3); 
			}
		#easyTooltip { 
			max-width: 310px; padding: 15px; font-size: 13px; line-height: 18px; border: 1px solid #96c2d5; background-color: #fdfdfd; 
			-webkit-box-shadow: 7px 7px 7px -1px rgba(0,0,0,0.3); -moz-box-shadow: 7px 7px 7px -1px rgba(0,0,0,0.3); box-shadow: 7px 7px 7px -1px rgba(0,0,0,0.3);
			}
			#easyTooltip code { padding: 2px 3px; line-height: 0; font-size: 90%; }
		
		.sfs-current { width: 100%; height: 250px; overflow: hidden; }
		.sfs-current iframe { width: 100%; height: 100%; overflow: hidden; margin: 0; padding: 0; }
		.sfs-credits { margin-top: -10px; font-size: 12px; line-height: 18px; color: #777; }
		
		<?php // $sfs_badge_styles = esc_textarea($sfs_options['sfs_custom_styles']); echo $sfs_badge_styles; ?>
		.sfs-subscriber-count { width: 88px; overflow: hidden; height: 26px; color: #424242; font: 9px Verdana, Geneva, sans-serif; letter-spacing: 1px; }
		.sfs-count { width: 86px; height: 17px; line-height: 17px; margin: 0 auto; background: #ccc; border: 1px solid #909090; border-top-color: #fff; border-left-color: #fff; }
		.sfs-count span { display: inline-block; height: 11px; line-height: 12px; margin: 2px 1px 2px 2px; padding: 0 2px 0 3px; background: #e4e4e4; border: 1px solid #a2a2a2; border-bottom-color: #fff; border-right-color: #fff; }
		.sfs-stats { font-size: 6px; line-height: 6px; margin: 1px 0 0 1px; word-spacing: 2px; text-align: center; text-transform: uppercase; }
	</style>

	<div class="wrap sfs-admin">
		<h1><?php _e('Simple Feed Stats', 'sfs'); ?> <small><?php global $sfs_version; echo 'v' . $sfs_version; ?></small></h1>
		
		<?php if (isset($_GET['cache'])) : ?>
		<div class="updated settings-error notice is-dismissible"><p><strong><?php _e('Cache cleared', 'sfs'); ?>.</strong></p></div>
		<?php endif; ?>
		
		<?php if (isset($_GET['reset'])) : ?>
		<div class="updated settings-error notice is-dismissible"><p><strong><?php _e('All feed stats deleted', 'sfs'); ?>.</strong></p></div>
		<?php endif; ?>
		
		<div class="sfs-toggle-panels"><a href="<?php get_admin_url() . 'options-general.php?page=sfs-options'; ?>"><?php _e('Toggle all panels', 'sfs'); ?></a></div>
		<div class="metabox-holder">
			<div class="meta-box-sortables ui-sortable">
				
				<div <?php echo $display_alert; ?> class="postbox">
					<h2><?php _e('Simple Feed Stats needs your support!', 'sfs'); ?></h2>
					<div class="toggle">
						<div class="mm-panel-alert">
							<p>
								<?php _e('Please', 'sfs'); ?> <a target="_blank" href="http://m0n.co/donate" title="<?php _e('Make a donation via PayPal', 'sfs'); ?>"><?php _e('make a donation', 'sfs'); ?></a> <?php _e('and/or', 'sfs'); ?> 
								<a target="_blank" href="http://wordpress.org/support/view/plugin-reviews/<?php echo basename(dirname(__FILE__)); ?>?rate=5#postform" title="<?php _e('Rate and review at the Plugin Directory', 'sfs'); ?>">
									<?php _e('give it a 5-star rating', 'sfs'); ?>&nbsp;&raquo;
								</a>
							</p>
							<p>
								<?php _e('Your generous support enables continued development of this free plugin. Thank you!', 'sfs'); ?>
							</p>
							<div class="dismiss-alert">
								<form action="">
									<div class="dismiss-alert-wrap">
										<input class="input-alert" name="sfs_alert" type="checkbox" value="1" <?php if ($checked) echo 'checked="checked"'; ?> />  
										<label class="description" for="sfs_alert"><?php _e('Check this box if you have shown support', 'sfs') ?></label>
										<?php wp_nonce_field('sfs-alert', 'sfs-alert', false); ?>
										<input type="hidden" name="page" value="sfs-options" />
									</div>
								</form>
							</div>
						</div>
					</div>
				</div>
				
				<div class="postbox">
					<h2><?php _e('Overview', 'sfs'); ?></h2>
					<div class="toggle sfs-overview">
						<p>
							<?php _e('Simple Feed Stats (SFS) makes it easy to track your feeds and display a subscriber count on your website.', 'sfs'); ?> 
							<?php _e('It also enables you to add custom content to the header and footer of each feed item.', 'sfs'); ?> 
							<?php _e('SFS tracks your feeds <em>automatically</em> and displays the statistics on <em>this</em> page.', 'sfs'); ?> 
							<?php _e('Here are some useful shortcuts to get started with Simple Feed Stats:', 'sfs'); ?>
						</p>
						<ul>
							<li><?php _e('To customize and manage SFS, visit', 'sfs'); ?> <a class="sfs-options-link" href="#sfs_custom-options"><?php _e('Tools &amp; Options', 'sfs'); ?></a></li>
							<li><?php _e('To display your subscriber count, visit', 'sfs'); ?> <a class="sfs-shortcodes-link" href="#sfs-shortcodes"><?php _e('Template Tags &amp; Shortcodes', 'sfs'); ?></a></li>
							<li><?php _e('Visit the SFS Widget in the', 'sfs'); ?> <a href="<?php echo get_admin_url(); ?>"><?php _e('Dashboard', 'sfs'); ?></a> <?php _e('any time for a quick overview', 'sfs'); ?></li>
							<li>
								<?php _e('For more info check the', 'sfs'); ?> <a target="_blank" href="<?php echo plugins_url('/simple-feed-stats/readme.txt', dirname(__FILE__)); ?>">readme.txt</a> 
								<?php _e('and', 'sfs'); ?> <a target="_blank" href="https://perishablepress.com/simple-feed-stats/"><?php _e('Simple Feed Stats Homepage', 'sfs'); ?></a>
							</li>
							<li><?php _e('If you like this plugin, please', 'sfs'); ?> 
								<a target="_blank" href="http://wordpress.org/support/view/plugin-reviews/<?php echo basename(dirname(__FILE__)); ?>?rate=5#postform" title="<?php _e('Click here to rate and review this plugin', 'sfs'); ?>">
									<?php _e('give it a 5-star rating at the Plugin Directory', 'sfs'); ?>&nbsp;&raquo;
								</a>
							</li>
						</ul>
					</div>
				</div>

				<?php if ($maxpage != 0) { // begin section ?>

				<div class="postbox">
					<h2><?php _e('Daily Subscriber Count', 'sfs'); ?>: <?php sfs_display_subscriber_count(); ?></h2>
					<div class="toggle default-hidden">
						<p>
							<strong><?php _e('Daily Subscribers by Type', 'sfs'); ?></strong> 
							<span class="tooltip" title="<?php 
								_e('Count totals are cached and updated every 12 hours for better performance. So the count total may not always equal the sum of the individual counts, which are reported in real-time. ', 'sfs');
								_e('Tip: to get the numbers to match up, you can manually clear the cache via the &ldquo;Tools &amp; Options&rdquo; panel. ', 'sfs');
								?>">?</span>
						</p>
						<div class="sfs-table">
							<table class="widefat">
								<thead>
									<tr>
										<th><?php _e('RDF', 'sfs'); ?></th>
										<th><?php _e('RSS2', 'sfs'); ?></th>
										<th><?php _e('Atom', 'sfs'); ?></th>
										<th><?php _e('Comments', 'sfs'); ?></th>
										<th><?php _e('Open', 'sfs'); ?></th>
										<th><?php _e('Other', 'sfs'); ?></th>
									</tr>
								</thead>
								<tbody>
									<tr>
										<td class="sfs-type rdf"><?php echo $sfs_query_current[0]; ?></td>
										<td class="sfs-type rss2"><?php echo $sfs_query_current[1]; ?></td>
										<td class="sfs-type atom"><?php echo $sfs_query_current[2]; ?></td>
										<td class="sfs-type comments"><?php echo $sfs_query_current[3]; ?></td>
										<td class="sfs-type open"><?php echo $sfs_query_current[4]; ?></td>
										<td class="sfs-type other"><?php echo $sfs_query_current[5]; ?></td>
									</tr>
								</tbody>
							</table>
						</div>
					</div>
				</div>
				<div class="postbox">
					<h2><?php _e('Feed Statistics', 'sfs'); ?></h2>
					<div class="toggle<?php if (!isset($_GET['filter']) && !isset($_GET['p'])) echo ' default-hidden'; ?>">
	
						<?php if (isset($_GET['filter'])) : ?>
						<div class="sfs-menu-row">
							<?php _e('Feed stats filtered by', 'sfs'); ?> <strong><?php echo $filter; ?></strong> 
							[ <a href="<?php echo get_admin_url(); ?>options-general.php?page=sfs-options"><?php _e('reset', 'sfs'); ?></a> ]
						</div>
						<?php endif; ?>
						
						<div class="sfs-menu-item">
							<form class="sfs-sub-item" action="">
								<select name="filter">
									<option value="" selected="selected"><?php _e('Filter data by..', 'sfs'); ?></option>
									<option value="logtime"><?php _e('Log Time', 'sfs'); ?></option>
									<option value="type"><?php _e('Feed Type', 'sfs'); ?></option>
									<option value="address"><?php _e('IP Address', 'sfs'); ?></option>
									<option value="agent"><?php _e('User Agent', 'sfs'); ?></option>
									<option value="tracking"><?php _e('Tracking', 'sfs'); ?></option>
									<option value="referer"><?php _e('Referrer', 'sfs'); ?></option>
								</select>
								<input type="hidden" name="page" value="sfs-options" />
								<input class="button-secondary" type="submit" />
							</form>
						</div>
						<div class="sfs-menu-item">
							<form class="sfs-sub-item" action="">
								<select name="sfs-paging-menu" onchange="myF('parent',this,0)">
									<?php $i = 1; while ($i <= $maxpage) {
											$url = get_admin_url() . 'options-general.php' . add_querystring_var('?'. sfs_clean($_SERVER['QUERY_STRING']), 'p', $i);
											if ($pagevar == $i) echo '<option selected class="current" value="selected">'. __('Page ', 'sfs') . $i .'</option>';
											else echo '<option value="'. $url .'">'. __('Page ', 'sfs') . $i .'</option>';
											$i++;
										} ?>
								</select>
							</form>
						</div>
						<div class="sfs-menu-item">
							<?php if($pagevar != 1) {
								$url = get_admin_url() .'options-general.php'. add_querystring_var('?'. sfs_clean($_SERVER['QUERY_STRING']), 'p', $pagevar-1);
								echo '<a class="sfs-sub-item button-secondary" href="'. $url .'">&laquo; '. __('Previous page', 'sfs') .'</a> ';
							}
							if($pagevar != $maxpage) {
								$url = get_admin_url() .'options-general.php'. add_querystring_var('?'. sfs_clean($_SERVER['QUERY_STRING']), 'p', $pagevar+1);
								echo '<a class="sfs-sub-item button-secondary" href="'. $url .'">'. __('Next page', 'sfs') .' &raquo;</a> ';
							} ?>
						</div>
						<div class="sfs-table sfs-statistics">
							<table class="widefat">
								<thead>
									<tr>
										<th><?php _e('ID', 'sfs'); ?></th>
										<th><?php _e('Meta', 'sfs'); ?></th>
										<th><?php _e('Details', 'sfs'); ?></th>
									</tr>
								</thead>
								<tfoot>
									<tr>
										<th><?php _e('ID', 'sfs'); ?></th>
										<th><?php _e('Meta', 'sfs'); ?></th>
										<th><?php _e('Details', 'sfs'); ?></th>
									</tr>
								</tfoot>
								<tbody>
									<?php foreach($sql as $s) { ?>
									<tr>
										<td class="sfs-type <?php echo strtolower($s->type); ?>"><?php echo $s->id; ?></td>
										<td class="sfs-meta">
											<div class="sfs-stats-type"><?php echo $s->type; ?></div>
											<div class="sfs-stats-tracking"><?php echo ucfirst($s->tracking) .'&nbsp;'. __('tracking', 'sfs'); ?></div>
											<div class="sfs-stats-ip"><?php echo $s->address; ?></div>
											<div class="sfs-stats-time"><?php $logtime = preg_replace('/\s+/', '&nbsp;', $s->logtime); echo $logtime; ?></div>
										</td>
										<td class="sfs-details">
											<div class="sfs-stats-referrer"><strong><?php _e('Referrer', 'sfs'); ?>:</strong> <?php echo $s->referer; ?></div>
											<div class="sfs-stats-request"><strong><?php _e('Request', 'sfs'); ?>:</strong> <?php echo $s->request; ?></div>
											<div class="sfs-stats-agent"><strong><?php _e('User Agent', 'sfs'); ?>:</strong> <?php echo $s->agent; ?></div>
										</td>
									</tr>
									<?php } ?>
								</tbody>
							</table>
						</div>
					</div>
				</div>

				<?php } // end section ?>

				<div class="postbox">
					<h2><?php _e('Total Subscriber Count', 'sfs'); ?>: <?php sfs_display_total_count(); ?></h2>
					<div class="toggle default-hidden">
						<p>
							<strong><?php _e('Total Subscribers by Type', 'sfs'); ?></strong> 
							<span class="tooltip" title="<?php 
								_e('Count totals are cached and updated every 12 hours for better performance. So the count total may not always equal the sum of the individual counts, which are reported in real-time. ', 'sfs');
								_e('Tip: to get the numbers to match up, you can manually clear the cache via the &ldquo;Tools &amp; Options&rdquo; panel. ', 'sfs');
								?>">?</span>
						</p>
						<div class="sfs-table">
							<table class="widefat">
								<thead>
									<tr>
										<th><?php _e('RDF', 'sfs'); ?></th>
										<th><?php _e('RSS2', 'sfs'); ?></th>
										<th><?php _e('Atom', 'sfs'); ?></th>
										<th><?php _e('Comments', 'sfs'); ?></th>
										<th><?php _e('Open', 'sfs'); ?></th>
										<th><?php _e('Other', 'sfs'); ?></th>
									</tr>
								</thead>
								<tbody>
									<tr>
										<td class="sfs-type rdf"><?php echo $sfs_query_alltime[0]; ?></td>
										<td class="sfs-type rss2"><?php echo $sfs_query_alltime[1]; ?></td>
										<td class="sfs-type atom"><?php echo $sfs_query_alltime[2]; ?></td>
										<td class="sfs-type comments"><?php echo $sfs_query_alltime[3]; ?></td>
										<td class="sfs-type open"><?php echo $sfs_query_alltime[4]; ?></td>
										<td class="sfs-type other"><?php echo $sfs_query_alltime[5]; ?></td>
									</tr>
								</tbody>
							</table>
						</div>
					</div>
				</div>
				<div id="sfs_custom-options" class="postbox">
					<h2><?php _e('Tools &amp; Options', 'sfs'); ?></h2>
					<div class="toggle<?php if (!isset($_GET['cache']) && !isset($_GET['reset']) && !isset($_GET['settings-updated'])) echo ' default-hidden'; ?>">
						<form method="post" action="options.php">
							<?php settings_fields('sfs_plugin_options'); ?>
							<div class="sfs-table">
								<table class="form-table">
									<tr>
										<th scope="row"><label class="description" for="sfs_options[sfs_tracking_method]"><?php _e('Tracking method', 'sfs'); ?></label></th>
										<td>
											<?php if (!isset($checked)) $checked = '';
												foreach ($sfs_tracking_method as $option) {
													$radio_setting = $sfs_options['sfs_tracking_method'];
													if ('' != $radio_setting) {
														if ($sfs_options['sfs_tracking_method'] == $option['value']) {
															$checked = "checked=\"checked\"";
														} else {
															$checked = '';
														}
													} ?>
													<div class="sfs-radio">
														<input type="radio" name="sfs_options[sfs_tracking_method]" class="sfs-<?php if ($option['value'] == 'sfs_open_tracking') echo 'open-'; ?>tracking" value="<?php esc_attr_e($option['value']); ?>" <?php echo $checked; ?> /> 
														<?php echo $option['label']; ?>
													</div>
											<?php } ?>
										</td>
									</tr>
									<tr class="sfs-open-tracking-url<?php if ($sfs_options['sfs_tracking_method'] !== 'sfs_open_tracking') echo ' default-hidden'; ?>">
										<th scope="row"><label class="description"><?php _e('Open Tracking URL', 'sfs'); ?></label></th>
										<td>
											<div class="sfs-table-item">
												<?php _e('For use with the &ldquo;Open Tracking&rdquo; method. Use this tracking URL as the <code>src</code> for any <code>img</code>:', 'sfs'); ?> 
												<span class="tooltip" title="<?php _e('Tip: SFS Open Tracking is another way to track your FeedBurner feeds. Visit <code>m0n.co/a</code> for details (or google &ldquo;SFS Open Tracking&rdquo;).', 'sfs'); ?>">?</span>
											</div>
											<div class="sfs-table-item"><input class="sfs-code-input" type="text" value="<?php echo plugins_url('/simple-feed-stats/tracker.php?sfs_tracking=true&sfs_type=open'); ?>" /></div>
											<div class="sfs-table-item"><?php _e('Example code:', 'sfs'); ?></div>
											<div class="sfs-table-item"><input class="sfs-code-input" type="text" value='&lt;img src="<?php echo plugins_url('/simple-feed-stats/tracker.php?sfs_tracking=true&sfs_type=open'); ?>" alt="" /&gt;' /></div>
										</td>
									</tr>
									<tr class="sfs-open-tracking-image<?php if ($sfs_options['sfs_tracking_method'] !== 'sfs_open_tracking') echo ' default-hidden'; ?>">
										<th scope="row"><label class="description" for="sfs_options[sfs_open_image_url]"><?php _e('Open Tracking Image', 'sfs'); ?></label></th>
										<td>
											<div class="sfs-table-item">
												<?php _e('For use with the &ldquo;Open Tracking&rdquo; method. Here you may specify the URL for the tracking image:', 'sfs'); ?> 
												<span class="tooltip" title="<?php _e('Tip: this is the URL of the image that will be returned as the <code>src</code> for the open-tracking image. Use text/numbers only, no markup.', 'sfs'); ?>">?</span>
											</div>
											<div class="sfs-table-item"><input class="sfs-code-input" type="text" maxlength="200" name="sfs_options[sfs_open_image_url]" value="<?php echo $sfs_options['sfs_open_image_url']; ?>" /></div>
											<div class="sfs-table-item"><?php _e('Current image being used for Open Tracking:', 'sfs'); ?> <img src="<?php echo $sfs_options['sfs_open_image_url']; ?>" alt="" /></div>
										</td>
									</tr>
									<tr>
										<th scope="row"><label class="description" for="sfs_options[sfs_strict_stats]"><?php _e('Enable strict reporting?', 'sfs'); ?></label></th>
										<td><input name="sfs_options[sfs_strict_stats]" type="checkbox" value="1" <?php if (isset($sfs_options['sfs_strict_stats'])) checked('1', $sfs_options['sfs_strict_stats']); ?> /> 
											<?php _e('Check this box to enable strict reporting of feed statistics.', 'sfs'); ?> 
											<span class="tooltip" title="<?php _e('Note: this will result in a more accurate reporting of feed stats; 
												however, if you have been using SFS for awhile, you may notice that the feed count is lower with this option enabled. 
												Tip: after changing this option, click the &ldquo;Clear the cache&rdquo; link below to reset the cache. Default setting: off (unchecked).', 'sfs'); ?>">?</span>
										</td>
									</tr>
									<tr>
										<th scope="row"><label class="description" for="sfs_options[sfs_ignore_bots]"><?php _e('Ignore bots?', 'sfs'); ?></label></th>
										<td><input name="sfs_options[sfs_ignore_bots]" type="checkbox" value="1" <?php if (isset($sfs_options['sfs_ignore_bots'])) checked('1', $sfs_options['sfs_ignore_bots']); ?> /> 
											<?php _e('Check this box to ignore feed requests from the most common bots/spiders.', 'sfs'); ?> 
											<span class="tooltip" title="<?php _e('Note: this will result in a more accurate reporting of feed stats; 
												however, if you have been using SFS for awhile, you may notice that the feed count is lower with this option enabled. 
												Tip: after changing this option, click the &ldquo;Clear the cache&rdquo; link below to reset the cache. Default setting: off (unchecked). 
												Also note that the bot list for this feature is located in tracker.php and may be filtered via the sfs_filter_bots hook.', 'sfs'); ?>">?</span>
										</td>
									</tr>
								</table>
							</div>
							<div class="sfs-table">
								<table class="form-table">
									<tr>
										<th scope="row"><label class="description" for="sfs_options[sfs_custom]"><?php _e('Custom count', 'sfs'); ?></label></th>
										<td><input type="text" size="20" maxlength="100" name="sfs_options[sfs_custom]" value="<?php echo $sfs_options['sfs_custom']; ?>" /> 
											<em><?php _e('Text/numbers only, no markup.', 'sfs'); ?></em> 
											<span class="tooltip" title="<?php _e('Tip: use the current subscriber count for a day or so after resetting the feed stats (check the next box to enable).', 'sfs'); ?>">?</span>
										</td>
									</tr>
									<tr>
										<th scope="row"><label class="description" for="sfs_options[sfs_custom_enable]"><?php _e('Enable custom count?', 'sfs'); ?></label></th>
										<td><input name="sfs_options[sfs_custom_enable]" type="checkbox" value="1" <?php if (isset($sfs_options['sfs_custom_enable'])) checked('1', $sfs_options['sfs_custom_enable']); ?> /> 
											<em><?php _e('Select to display your custom feed count instead of the recorded value.', 'sfs'); ?></em>
										</td>
									</tr>
								</table>
							</div>
							<div class="sfs-table">
								<table class="form-table">
									<tr>
										<th scope="row"><label class="description" for="sfs_options[sfs_custom_key]"><?php _e('Custom key/value', 'sfs'); ?></label></th>
										<td>
											<div class="sfs-table-item">
												<input type="text" size="20" maxlength="100" name="sfs_options[sfs_custom_key]" value="<?php echo $sfs_options['sfs_custom_key']; ?>" /> 
												<em><label class="description" for="sfs_options[sfs_custom_key]"><?php _e('Custom key', 'sfs'); ?></label></em>
												<br />
												<input type="text" size="20" maxlength="100" name="sfs_options[sfs_custom_value]" value="<?php echo $sfs_options['sfs_custom_value']; ?>" /> 
												<em><label class="description" for="sfs_options[sfs_custom_value]"><?php _e('Custom value', 'sfs'); ?></label></em>
											</div>
											<div class="sfs-table-item">
												<em>
													<?php _e('Add custom key/value parameter for either &ldquo;custom&rdquo; or &ldquo;alt&rdquo; tracking methods. 
													Important: include only alphanumeric characters, underscores, and hyphens. Leave blank to disable.', 'sfs'); ?>
												</em> 
												<span class="tooltip" title="<?php _e('Including a custom key/value in the tracking URL can be used with 3rd-party services such as Google Analytics. 
													This feature will be extended in future versions, send feedback with any requests.', 'sfs'); ?>">?
												</span>
											</div>
										</td>
									</tr>
								</table>
							</div>
							<div class="sfs-table">
								<table class="form-table">
									<tr>
										<th scope="row"><label class="description" for="sfs_options[sfs_enable_shortcodes]"><?php _e('Enable Widget Shortcodes', 'sfs'); ?></label></th>
										<td><input name="sfs_options[sfs_enable_shortcodes]" type="checkbox" value="1" <?php if (isset($sfs_options['sfs_enable_shortcodes'])) checked('1', $sfs_options['sfs_enable_shortcodes']); ?> /> 
											<em><?php _e('Enable shortcodes in widget areas and post content.', 'sfs'); ?></em> 
											<span class="tooltip" title="<?php _e('By default, WordPress does not enable shortcodes in widgets. 
											This setting enables shortcodes to work when they are added to widgets, and also ensures that shortcodes will work when they are added to post/page content. 
											Note: this setting applies to any/all shortcodes, even those of other plugins.', 'sfs'); ?>">?</span>
										</td>
									</tr>
								</table>
							</div>
							<div class="sfs-table">
								<table class="form-table">
									<tr>
										<th scope="row"><label class="description" for="sfs_options[sfs_number_results]"><?php _e('Number of results per page', 'sfs'); ?></label></th>
										<td><input type="number" min="1" max="999" name="sfs_options[sfs_number_results]" value="<?php echo $sfs_options['sfs_number_results']; ?>" />
											<em><?php _e('Applies to the back-end statistics (this page only).', 'sfs'); ?></em>
										</td>
									</tr>
								</table>
							</div>
							<div class="sfs-table">
								<table class="form-table">
									<tr>
										<th scope="row"><label class="description" for="sfs_options[sfs_custom_styles]"><?php _e('Custom CSS for count badge', 'sfs'); ?></label></th>
										<td>
											<textarea class="textarea" cols="50" rows="5" name="sfs_options[sfs_custom_styles]"><?php echo esc_textarea($sfs_options['sfs_custom_styles']); ?></textarea><br />
											<em><?php _e('CSS/text only, no markup.', 'sfs'); ?></em> 
											<span class="tooltip" title="<?php _e('Tip: see the &ldquo;Template Tags &amp; Shortcodes&rdquo; panel for count-badge shortcode and template tag. 
												Default styles replicate the Feedburner chicklet. Leave blank to disable.', 'sfs'); ?>">?</span>
										</td>
									</tr>
								</table>
							</div>
							<div class="sfs-table">
								<table class="form-table">
									<tr>
										<th scope="row"><label class="description" for="sfs_options[sfs_feed_content_before]"><?php _e('Display before each feed item', 'sfs'); ?></label></th>
										<td>
											<textarea class="textarea" cols="50" rows="3" name="sfs_options[sfs_feed_content_before]"><?php echo esc_textarea($sfs_options['sfs_feed_content_before']); ?></textarea><br />
											<em><?php _e('Text and basic markup allowed.', 'sfs'); ?></em> 
											<span class="tooltip" title="<?php _e('Tip: you can has shortcodes. Leave blank to disable.', 'sfs'); ?>">?</span>
										</td>
									</tr>
									<tr>
										<th scope="row"><label class="description" for="sfs_options[sfs_feed_content_after]"><?php _e('Display after each feed item', 'sfs'); ?></label></th>
										<td>
											<textarea class="textarea" cols="50" rows="3" name="sfs_options[sfs_feed_content_after]"><?php echo esc_textarea($sfs_options['sfs_feed_content_after']); ?></textarea><br />
											<em><?php _e('Text and basic markup allowed.', 'sfs'); ?></em> 
											<span class="tooltip" title="<?php _e('Tip: you can has shortcodes. Leave blank to disable.', 'sfs'); ?>">?</span>
										</td>
									</tr>
								</table>
							</div>
							<div class="sfs-table">
								<table class="form-table">
									<tr>
										<th scope="row"><label class="description"><?php _e('Clear the cache', 'sfs'); ?></label></th>
										<td><strong><a href="<?php get_admin_url(); ?>options-general.php?page=sfs-options&amp;cache=clear"><?php _e('Clear cache', 'sfs'); ?></a></strong> 
											&ndash; <em><?php _e('Tip: refresh this page to renew the cache after clearing.', 'sfs'); ?></em> 
											<span class="tooltip" title="<?php _e('Note: it&rsquo;s safe to clear the cache at any time. WordPress automatically will cache fresh data.', 'sfs'); ?>">?</span>
										</td>
									</tr>
									<tr>
										<th scope="row"><label class="description"><?php _e('Reset feed stats', 'sfs'); ?></label></th>
										<td><strong><a class="reset" href="<?php get_admin_url(); ?>options-general.php?page=sfs-options&amp;reset=true"><?php _e('Reset stats', 'sfs'); ?></a></strong> 
											&ndash; <em><?php _e('Warning: this will delete all feed stats!', 'sfs'); ?></em> 
											<span class="tooltip" title="<?php _e('Note: deletes data only. To delete the SFS table, see the &ldquo;Delete Database Table&rdquo; option (below).', 'sfs'); ?>">?</span>
										</td>
									</tr>
									<tr valign="top">
										<th scope="row"><label class="description" for="sfs_options[default_options]"><?php _e('Restore default settings', 'sfs'); ?></label></th>
										<td>
											<input name="sfs_options[default_options]" type="checkbox" value="1" id="sfs_restore_defaults" <?php if (isset($sfs_options['default_options'])) { checked('1', $sfs_options['default_options']); } ?> /> 
											<em><?php _e('Restore default options upon plugin deactivation/reactivation.', 'sfs'); ?></em> 
											<span class="tooltip" title="<?php _e('Tip: leave this option unchecked to remember your settings. ', 'sfs'); ?>
												<?php _e('Note that this setting applies only to plugin settings. Checking this box will not affect any of your statistical data.', 'sfs'); ?>">?</span>
										</td>
									</tr>
									<tr valign="top">
										<th scope="row"><label class="description" for="sfs_options[sfs_delete_table]"><?php _e('Delete database table', 'sfs'); ?></label></th>
										<td>
											<input name="sfs_options[sfs_delete_table]" type="checkbox" value="1" id="sfs_delete_table" <?php if (isset($sfs_options['sfs_delete_table'])) { checked('1', $sfs_options['sfs_delete_table']); } ?> /> 
											<em><?php _e('Delete the stats table the next time plugin is deactivated.', 'sfs'); ?></em> 
											<span class="tooltip" title="<?php _e('Tip: leave this setting unchecked to keep your feed stats if the plugin is deactivated. ', 'sfs'); ?>
												<?php _e('Note that this setting applies only to plugin *deactivation*. If you *uninstall* (i.e., delete) the plugin, all data including feed stats will be removed.', 'sfs'); ?>">?</span>
										</td>
									</tr>
								</table>
							</div>
							<div class="sfs-last-item">
								<input type="submit" class="button-primary" value="<?php _e('Save Settings', 'sfs'); ?>" />
							</div>
						</form>
					</div>
				</div>
				<div class="postbox">
					<h2><?php _e('Your Feed Information', 'sfs'); ?></h2>
					<div class="toggle default-hidden">
						<p>
							<?php _e('Here are some helpful things to know when working with feeds.', 'sfs'); ?> 
							<span class="tooltip" title="<?php _e('Tip: to generate some feed data to look at, try clicking on a few of these links', 'sfs'); ?> :)">?</span>
						</p>
						<?php 
							$feed_rdf       = get_bloginfo('rdf_url');                    // RDF feed
							$feed_rss2      = get_bloginfo('rss2_url');                   // RSS feed
							$feed_atom      = get_bloginfo('atom_url');                   // Atom feed
							$feed_coms      = get_bloginfo('comments_rss2_url');          // RSS2 comments
							$feed_coms_atom = get_bloginfo('comments_atom_url');          // Atom comments
							
							$date_format = get_option('date_format');
							$time_format = get_option('time_format');
							$curtime = date("{$date_format} {$time_format}", current_time('timestamp'));

							$address = 'n/a'; 
							$agent   = 'n/a';
							if (isset($_SERVER['REMOTE_ADDR']))     $address = sfs_clean($_SERVER['REMOTE_ADDR']);
							if (isset($_SERVER['HTTP_USER_AGENT'])) $agent   = sfs_clean($_SERVER['HTTP_USER_AGENT']); 
						?>
	
						<p><strong><?php _e('Your feed URLs', 'sfs'); ?></strong></p>
						<div class="sfs-table">
							<ul>
								<li><?php _e('Content RDF', 'sfs'); ?> &ndash; <a target="_blank" href="<?php echo $feed_rdf; ?>"><code><?php echo $feed_rdf; ?></code></a></li>
								<li><?php _e('Content RSS2', 'sfs'); ?> &ndash; <a target="_blank" href="<?php echo $feed_rss2; ?>"><code><?php echo $feed_rss2; ?></code></a></li>
								<li><?php _e('Content Atom', 'sfs'); ?> &ndash; <a target="_blank" href="<?php echo $feed_atom; ?>"><code><?php echo $feed_atom; ?></code></a></li>
								<li><?php _e('Comments RSS2', 'sfs'); ?> &ndash; <a target="_blank" href="<?php echo $feed_coms; ?>"><code><?php echo $feed_coms; ?></code></a></li>
								<li><?php _e('Comments Atom', 'sfs'); ?> &ndash; <a target="_blank" href="<?php echo $feed_coms_atom; ?>"><code><?php echo $feed_coms_atom; ?></code></a></li>
							</ul>
						</div>
						<p><strong><?php _e('More about WordPress feeds', 'sfs'); ?></strong></p>
						<ul>
							<li><a target="_blank" href="https://perishablepress.com/simple-feed-stats/"><?php _e('Simple Feed Stats Homepage', 'sfs'); ?></a></li>
							<li><a target="_blank" href="http://codex.wordpress.org/WordPress_Feeds"><?php _e('WP Codex: WordPress Feeds', 'sfs'); ?></a></li>
							<li><a target="_blank" href="https://perishablepress.com/what-is-my-wordpress-feed-url/"><?php _e('What is my WordPress Feed URL?', 'sfs'); ?></a></li>
							<li><a target="_blank" href="http://feedburner.google.com/"><?php _e('Google/Feedburner', 'sfs'); ?></a></li>
						</ul>
						<p><strong><?php _e('Your browser/IP info', 'sfs'); ?></strong></p>
						<ul>
							<li><?php _e('IP Address:', 'sfs'); ?> <code><?php echo $address; ?></code></li>
							<li><?php _e('Approx. Time:', 'sfs'); ?> <code><?php echo $curtime; ?></code>
								<span class="tooltip" title="<?php _e('Denotes date/time of most recent page-load (useful when monitoring feed stats).', 'sfs'); ?>">?</span>
							</li>
							<li><?php _e('User Agent:', 'sfs'); ?> <code><?php echo $agent; ?></code></li>
						</ul>
					</div>
				</div>
				<div id="sfs-shortcodes" class="postbox">
					<h2><?php _e('Shortcodes &amp; Template Tags', 'sfs'); ?></h2>
					<div class="toggle default-hidden">
						
						<h3><?php _e('Shortcodes', 'sfs'); ?></h3>
						
						<p><?php _e('Display daily count for all feeds in plain-text:', 'sfs'); ?></p>
						<p><code>[sfs_subscriber_count]</code></p>
						
						<p><?php _e('Display daily count for all feeds with a FeedBurner-style badge:', 'sfs'); ?></p>
						<p><code>[sfs_count_badge]</code></p>

						<p><?php _e('Display daily count for RSS2 feeds in plain-text:', 'sfs'); ?></p>
						<p><code>[sfs_rss2_count]</code></p>
						
						<p><?php _e('Display daily count for comment feeds in plain-text:', 'sfs'); ?></p>
						<p><code>[sfs_comments_count]</code></p>
						
						
						<h3><?php _e('Template Tags', 'sfs'); ?></h3>
						
						<p><?php _e('Display daily count for all feeds in plain-text:', 'sfs'); ?></p>
						<p><code>&lt;?php if (function_exists('sfs_display_subscriber_count')) sfs_display_subscriber_count(); ?&gt;</code></p>
						
						<p><?php _e('Display daily count for all feeds with a FeedBurner-style badge:', 'sfs'); ?></p>
						<p><code>&lt;?php if (function_exists('sfs_display_count_badge')) sfs_display_count_badge(); ?&gt;</code></p>
						
						<p><?php _e('Display total count for all feeds as plain-text:', 'sfs'); ?></p>
						<p><code>&lt;?php if (function_exists('sfs_display_total_count')) sfs_display_total_count(); ?&gt;</code></p>
						
						<p>
							<?php _e('Example of FeedBurner-style badge:', 'sfs'); ?>
							<span class="tooltip" title="<?php _e('Tip: visit the &ldquo;Tools &amp; Options&rdquo; panel to style your badge with some custom CSS.', 'sfs'); ?>">?</span>
						</p>
						<p><?php sfs_display_count_badge(); ?></p>
					</div>
				</div>
				<div class="postbox">
					<h2><?php _e('Updates &amp; Info', 'sfs'); ?></h2>
					<div class="toggle">
						<div class="sfs-current">
							<iframe src="https://perishablepress.com/current/index-sfs.html"></iframe>
						</div>
					</div>
				</div>
			</div>
		</div>
		<div class="sfs-credits">
			<a target="_blank" href="https://perishablepress.com/simple-feed-stats/" title="Simple Feed Stats Homepage">Simple Feed Stats</a> by 
			<a target="_blank" href="https://twitter.com/perishable" title="Jeff Starr on Twitter">Jeff Starr</a> @ 
			<a target="_blank" href="http://monzilla.biz/" title="Obsessive Web Design &amp; Development">Monzilla Media</a>
		</div>
	</div>

	<script type="text/javascript">
		// auto-submit
		function myF(targ, selObj, restore){
			eval(targ + ".location='" + selObj.options[selObj.selectedIndex].value + "'");
			if (restore) selObj.selectedIndex = 0;
		}
		// prevent accidents (delete stats)
		jQuery('.reset').click(function(event){
			event.preventDefault();
			var r = confirm("<?php _e('Are you sure you want to delete all the feed stats? (this action cannot be undone)', 'sfs'); ?>");
			if (r == true){  
				window.location = jQuery(this).attr('href');
			}
		});
		// prevent accidents (restore options)
		if(!jQuery("#sfs_restore_defaults").is(":checked")){
			jQuery('#sfs_restore_defaults').click(function(event){
				var r = confirm("<?php _e('Are you sure you want to restore all default options? (this action cannot be undone)', 'sfs'); ?>");
				if (r == true){  
					jQuery("#sfs_restore_defaults").attr('checked', true);
				} else {
					jQuery("#sfs_restore_defaults").attr('checked', false);
				}
			});
		}
		// prevent accidents (delete table)
		if(!jQuery("#sfs_delete_table").is(":checked")){
			jQuery('#sfs_delete_table').click(function(event){
				var r = confirm("<?php _e('Are you sure you want to delete the stats table and all of its data? (this action cannot be undone)', 'sfs'); ?>");
				if (r == true){  
					jQuery("#sfs_delete_table").attr('checked', true);
				} else {
					jQuery("#sfs_delete_table").attr('checked', false);
				}
			});
		}
		// Easy Tooltip 1.0 - Alen Grakalic @ http://cssglobe.com/post/4380/easy-tooltip--jquery-plugin
		(function($) {
			$.fn.easyTooltip = function(options){
				var defaults = {	
					xOffset: 10,		
					yOffset: 25,
					tooltipId: "easyTooltip",
					clickRemove: false,
					content: "",
					useElement: ""
				}; 
				var options = $.extend(defaults, options);  
				var content;	
				this.each(function() {  				
					var title = $(this).attr("title");				
					$(this).hover(function(e){											 							   
						content = (options.content != "") ? options.content : title;
						content = (options.useElement != "") ? $("#" + options.useElement).html() : content;
						$(this).attr("title","");								  				
						if (content != "" && content != undefined){			
							$("body").append("<div id='"+ options.tooltipId +"'>"+ content +"</div>");		
							$("#" + options.tooltipId).css("position","absolute").css("top",(e.pageY - options.yOffset) + "px")
								.css("left",(e.pageX + options.xOffset) + "px").css("display","none").fadeIn("fast")
						}
					},
					function(){	
						$("#" + options.tooltipId).remove();
						$(this).attr("title",title);
					});	
					$(this).mousemove(function(e){
						$("#" + options.tooltipId)
						.css("top",(e.pageY - options.yOffset) + "px")
						.css("left",(e.pageX + options.xOffset) + "px")					
					});	
					if(options.clickRemove){
						$(this).mousedown(function(e){
							$("#" + options.tooltipId).remove();
							$(this).attr("title",title);
						});				
					}
				});
			};
		})(jQuery);
		jQuery(".tooltip").easyTooltip();
		// toggle stuff
		jQuery(document).ready(function(){
			jQuery('.sfs-toggle-panels a').click(function(){
				jQuery('.toggle').slideToggle(300);
				return false;
			});
			jQuery('.default-hidden').hide();
			jQuery('h2').click(function(){
				jQuery(this).next().slideToggle(300);
			});
			jQuery('.sfs-options-link').click(function(){
				jQuery('.toggle').hide();
				jQuery('#sfs_custom-options .toggle').slideToggle(300);
				return true;
			});
			jQuery('.sfs-shortcodes-link').click(function(){
				jQuery('.toggle').hide();
				jQuery('#sfs-shortcodes .toggle').slideToggle(300);
				return true;
			});
			jQuery('.sfs-open-tracking').click(function(){
				jQuery('.sfs-open-tracking-image, .sfs-open-tracking-url').slideDown('fast');
			});
			jQuery('.sfs-tracking').click(function(){
				jQuery('.sfs-open-tracking-image, .sfs-open-tracking-url').slideUp('fast');
			});
			//dismiss_alert
			if (!jQuery('.dismiss-alert-wrap input').is(':checked')){
				jQuery('.dismiss-alert-wrap input').one('click',function(){
					jQuery('.dismiss-alert-wrap').after('<input type="submit" class="button-secondary" value="<?php _e('Save Preference', 'gap'); ?>" />');
				});
			}
		});
	</script>

<?php }
