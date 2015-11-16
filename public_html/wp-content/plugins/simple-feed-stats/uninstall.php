<?php // uninstall remove options

if (!defined('ABSPATH') && !defined('WP_UNINSTALL_PLUGIN')) exit();

// delete options
delete_option('sfs_options');
delete_option('sfs_alert');

// delete transients
delete_transient('all_count');
delete_transient('feed_count');
delete_transient('rss2_count');
delete_transient('comment_count');

delete_transient('_transient_timeout_all_count');
delete_transient('_transient_timeout_feed_count');
delete_transient('_transient_timeout_rss2_count');
delete_transient('_transient_timeout_comment_count');

// delete transients (WP MS)
delete_site_transient('feed_count');
delete_site_transient('all_count');
delete_site_transient('rss2_count');
delete_site_transient('comments_count');

delete_site_transient('_transient_timeout_all_count');
delete_site_transient('_transient_timeout_feed_count');
delete_site_transient('_transient_timeout_rss2_count');
delete_site_transient('_transient_timeout_comment_count');

// delete custom tables
global $wpdb;
$table_name = $wpdb->prefix .'simple_feed_stats';
$wpdb->query("DROP TABLE IF EXISTS {$table_name}");

// delete cron event
$timestamp = wp_next_scheduled('sfs_cron_cache');
wp_unschedule_event($timestamp,'sfs_cron_cache');
