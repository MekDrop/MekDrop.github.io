<?php // Simple Feed Stats > Tracking

define('WP_USE_THEMES', false);
require('../../../wp-load.php');
if (!defined('ABSPATH')) exit;

$options = get_option('sfs_options');

global $wpdb, $wp_query;

// $wpdb->show_errors();
$wpdb->hide_errors();
error_reporting(0);

function sfs_cleaner($string) {
	$string = trim($string); 
	$string = strip_tags($string);
	$string = urldecode($string);
	$string = str_replace("\n", "", $string);
	$string = trim($string); 
	return $string;
}

function sfs_ignore_bots() {
	$bots = array('googlebot', 'googleproducer', 'google-site-verification', 'google-test', 'baidu', 'bingbot', 'bingpreview', 'msnbot', 'yandex', 'sosospider', 'sosoimagespider', 'exabot', 'sogou', 'facebookexternalhit', 'feedfetcher-google');
	return apply_filters('sfs_filter_bots', $bots);
}

if (isset($_SERVER['QUERY_STRING']) && !empty($_SERVER['QUERY_STRING'])) {
	$string = array();
	$params = array();
	$args = explode('&', htmlspecialchars_decode($_SERVER['QUERY_STRING'], ENT_QUOTES));
	foreach($args as $key => $value) {
		$string = explode('=', $value);
		$params[sfs_cleaner($string[0])] = sfs_cleaner($string[1]);
	}
}

if (isset($params['sfs_tracking']) && !empty($params['sfs_tracking'])) {
	
	$date_format = get_option('date_format');
	$time_format = get_option('time_format');
	$logtime = date("{$date_format} {$time_format}", current_time('timestamp'));
	
	$protocol = 'http://';
	if (is_ssl()) $protocol = 'https://';
	
	$type = 'undefined'; $feed_type = 'undefined';
	
	$host = 'n/a'; $request = 'n/a'; $referer = 'n/a'; $qstring = 'n/a'; $address = 'n/a'; $agent = 'n/a';

	if (isset($_SERVER['HTTP_HOST']))       $host    = sfs_cleaner($_SERVER['HTTP_HOST']);
	if (isset($_SERVER['REQUEST_URI']))     $request = sfs_cleaner($protocol.$host.$_SERVER['REQUEST_URI']);
	if (isset($_SERVER['HTTP_REFERER']))    $referer = sfs_cleaner($_SERVER['HTTP_REFERER']);
	if (isset($_SERVER['QUERY_STRING']))    $qstring = sfs_cleaner($_SERVER['QUERY_STRING']);
	if (isset($_SERVER['REMOTE_ADDR']))     $address = sfs_cleaner($_SERVER['REMOTE_ADDR']);
	if (isset($_SERVER['HTTP_USER_AGENT'])) $agent   = sfs_cleaner($_SERVER['HTTP_USER_AGENT']);
	
	if (isset($params['feed_type']) && !empty($params['feed_type'])) $feed_type = sfs_cleaner($params['feed_type']);
	if (isset($params['sfs_type']) && $params['sfs_type'] == 'open') $feed_type = 'open';
	
	if     ($feed_type == 'rdf')      $type = 'RDF';
	elseif ($feed_type == 'rss2')     $type = 'RSS2';
	elseif ($feed_type == 'atom')     $type = 'Atom';
	elseif ($feed_type == 'comments') $type = 'Comments';
	elseif ($feed_type == 'open')     $type = 'Open';
	else                              $type = 'Other';
	
	$tracking = 'default';
	
	if ($options['sfs_tracking_method'] == 'sfs_custom_tracking') $tracking = 'custom';
	if ($options['sfs_tracking_method'] == 'sfs_alt_tracking')    $tracking = 'alt';
	if ($options['sfs_tracking_method'] == 'sfs_open_tracking')   $tracking = 'open';
	
	if ($options['sfs_ignore_bots'] && preg_match('/'. implode('|', sfs_ignore_bots()) .'/i', $agent)) exit;
	
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
	
	if (($options['sfs_tracking_method'] == 'sfs_open_tracking')) {
		$custom_image = $options['sfs_open_image_url'];
		wp_redirect($custom_image);
		exit;
	} else {
		$tracker_image = plugins_url() . '/simple-feed-stats/tracker.gif';
		wp_redirect($tracker_image);
		exit;
	}
}

exit;