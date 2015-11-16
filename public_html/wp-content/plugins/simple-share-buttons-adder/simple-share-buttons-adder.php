<?php
/*
Plugin Name: Simple Share Buttons Adder
Plugin URI: https://simplesharebuttons.com
Description: A simple plugin that enables you to add share buttons to all of your posts and/or pages.
Version: 6.0.1
Author: Simple Share Buttons
Author URI: https://simplesharebuttons.com
License: GPLv2

Copyright 2015 Simple Share Buttons admin@simplesharebuttons.com

This program is free software; you can redistribute it and/or modify
it under the terms of the GNU General Public License, version 2, as
published by the Free Software Foundation.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

      _                    _           _   _
  ___| |__   __ _ _ __ ___| |__  _   _| |_| |_ ___  _ __  ___
 / __| '_ \ / _` | '__/ _ \ '_ \| | | | __| __/ _ \| '_ \/ __|
 \__ \ | | | (_| | | |  __/ |_) | |_| | |_| || (_) | | | \__ \
 |___/_| |_|\__,_|_|  \___|_.__/ \__,_|\__|\__\___/|_| |_|___/

 */

//======================================================================
// 		CONSTANTS
//======================================================================

	define('SSBA_FILE', __FILE__);
    define('SSBA_ROOT', dirname(__FILE__));
	define('SSBA_VERSION', '6.0.1');

//======================================================================
// 		 SSBA SETTINGS
//======================================================================

	// make sure we have settings ready
	// this has been introduced to exclude from excerpts
	$arrSettings = get_ssba_settings();

//======================================================================
// 		INCLUDES
//======================================================================

    include_once plugin_dir_path(__FILE__).'/inc/ssba_admin_bits.php';
    include_once plugin_dir_path(__FILE__).'/inc/ssba_buttons.php';
    include_once plugin_dir_path(__FILE__).'/inc/ssba_styles.php';
    include_once plugin_dir_path(__FILE__).'/inc/ssba_widget.php';
    include_once plugin_dir_path(__FILE__).'/inc/ssba_database.php';

//======================================================================
// 		GET SSBA SETTINGS
//======================================================================

	// return ssba settings
	function get_ssba_settings() {

		// globals
		global $wpdb;

		// query the db for current ssba settings
		$arrSettings = $wpdb->get_results("SELECT option_name, option_value
											 FROM $wpdb->options
											WHERE option_name LIKE 'ssba_%'");

		// loop through each setting in the array
		foreach ($arrSettings as $setting) {

			// add each setting to the array by name
			$arrSettings[$setting->option_name] =  $setting->option_value;
		}

		// return
		return $arrSettings;
	}
