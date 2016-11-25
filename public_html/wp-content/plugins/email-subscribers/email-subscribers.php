<?php
/**
 * Plugin Name: Email Subscribers
 * Plugin URI: http://www.storeapps.org/
 * Description: Email subscribers plugin has options to send newsletters to subscribers. It has a separate page with HTML editor to create a HTML newsletter. Also have options to send notification email to subscribers when new posts are published to your blog. Separate page available to include and exclude categories to send notifications.
 * Version: 3.1.3
 * Author: Store Apps
 * Author URI: http://www.storeapps.org/
 * Donate link: http://www.storeapps.org/
 * Requires at least: 3.4
 * Tested up to: 4.5.1
 * Text Domain: email-subscribers
 * Domain Path: /languages/
 * License: GPLv3
 * Copyright (c) 2015, 2016 Store Apps
 */

if(preg_match('#' . basename(__FILE__) . '#', $_SERVER['PHP_SELF'])) { die('You are not allowed to call this page directly.'); }

require_once(dirname(__FILE__).DIRECTORY_SEPARATOR.'base'.DIRECTORY_SEPARATOR.'es-defined.php');
require_once(dirname(__FILE__).DIRECTORY_SEPARATOR.'classes'.DIRECTORY_SEPARATOR.'es-stater.php');

add_action( 'admin_menu', array( 'es_cls_registerhook', 'es_adminmenu' ) );
add_action( 'admin_init', array( 'es_cls_registerhook', 'es_welcome' ) );
add_action( 'admin_enqueue_scripts', array( 'es_cls_registerhook', 'es_load_scripts' ) );
add_action( 'wp_enqueue_scripts', array( 'es_cls_registerhook', 'es_load_widget_scripts_styles' ) );
register_activation_hook( ES_FILE, array( 'es_cls_registerhook', 'es_activation' ) );
register_deactivation_hook( ES_FILE, array( 'es_cls_registerhook', 'es_deactivation' ) );
add_action( 'widgets_init', array( 'es_cls_registerhook', 'es_widget_loading' ));
add_shortcode( 'email-subscribers', 'es_shortcode' );

add_action( 'wp_ajax_es_klawoo_subscribe', array( 'es_cls_registerhook', 'klawoo_subscribe' ) );

require_once(dirname(__FILE__).DIRECTORY_SEPARATOR.'classes'.DIRECTORY_SEPARATOR.'es-directly.php');

function es_textdomain() {
	load_plugin_textdomain( 'email-subscribers' , false, dirname( plugin_basename( __FILE__ ) ) . '/languages/' );
}

add_action( 'plugins_loaded', 'es_textdomain' );
add_action( 'transition_post_status', array( 'es_cls_sendmail', 'es_prepare_notification' ), 10, 3 );

add_action( 'user_register', 'es_sync_registereduser');
?>