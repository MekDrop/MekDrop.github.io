<?php
/*
Plugin Name: Manage Upload Types
Plugin URI: http://www.madea.net/projects/wordpress-plugins/manage-upload-types/
Description: Enables changing the types of files allowed to be uploaded to the media library.
Version: 1.3
Author: Jeremy Madea
Author URI: http://madea.net/
License: GPL2
*/

/*  Copyright 2012 Jeremy Madea

    This program is free software; you can redistribute it and/or modify
    it under the terms of the GNU General Public License, version 2, as
    published by the Free Software Foundation.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program; if not, write to the Free Software
    Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
*/



register_activation_hook( __FILE__, 'jm_mut_install' ); 



/**
 * Callback for activation hook.
 * 
 * Adds the jm_mut_mime_types option and initializes it to 
 * contain the currently allowed mime_types.
 * 
*/
function jm_mut_install() { 
    $mime_types = get_allowed_mime_types(); 
    add_option('jm_mut_mime_types', $mime_types); 
} // jm_mut_install()



/**
 * Load mime types array from database.
 * 
 * Gets this plugin's mime_types array if it exists and 
 * adds it otherwise. 
*/
function jm_mut_load_mime_types($mime_types=array()) { 
    $jm_mut_mime_types = get_option( 'jm_mut_mime_types' ); 
    if ($jm_mut_mime_types === false) { 
        add_option( 'jm_mut_mime_types', $mime_types ); 
    } 
    return $jm_mut_mime_types;
} // jm_mut_load_mime_types($mime_types=array())

add_filter( 'upload_mimes', 'jm_mut_load_mime_types');



/**
 * Callback for admin_init
 *
 * Creates the admin section for this plugin.
 *
*/
function jm_mut_settings_api_init() {
	add_settings_section('jm_mut_setting_section',
		'Manage Upload Settings',
		'jm_mut_setting_section_callback',
		'media');
 	
} // jm_mut_settings_api_init()
 
add_action('admin_init', 'jm_mut_settings_api_init');
 
  
 
/**
 * Callback for settings section.
 *
 * Creates the content for this plugin's admin section.
 *
*/
function jm_mut_setting_section_callback() {
	echo '<p>The extensions below are those permitted for uploaded files.</p>' . "\n";
	$jm_mut_mime_types = get_option('jm_mut_mime_types'); 
	echo '<table id="jm_mut_mimetypes_table">' . "\n";
	echo '  <tr class="jm_mut_mimetype_thtr">'
	.    '<th>Extension</th>'
	.    '<th>Mime Type</th>'
	.    "</tr>\n";
	foreach ($jm_mut_mime_types as $extension => $mimetype) { 
		echo '  <tr class="jm_mut_mimetype_tr">'
		.    '<td class="jm_mut_extension_td">' . $extension . '</td>'
		.    '<td class="jm_mut_mimetype_td">' . $mimetype . '</td>'
		.    '<td class="jm_mut_delete_td">'
		.    '<a href="javascript:void(0);">delete</a></td>'
		.    "</tr>\n";
	}
        echo '<tr>'; 
        echo '<td><input id="jm_mut_add_extension" type="text" /></td>';
        echo '<td><input id="jm_mut_add_mimetype" type="text" /></td>';
        echo '<td id="jm_mut_add_button_td">';
          // The following button's onclick handler is added via javascript. See jm_mut.js. 
        echo '<input id="jm_mut_add_button" type="button" value="add" /></td>';
        echo '</tr>' . "\n";
	echo "</table>\n";
        
} // jm_mut_setting_section_callback()



/**
 * Callback for admin_enqueue_scripts
 *
 * Load our javascript and style sheet on the proper admin page. 
 *
*/
function jm_mut_enqueue_scripts_and_styles($hook) {
        // Only load our scripts and styles on the Settings -> Media admin page.
	if ($hook != 'options-media.php') 
		return;  

	// Javascript is kept in js/jm_mut.js. JQuery is a dependency. 
	wp_enqueue_script( 'jm-mut-js', plugin_dir_url( __FILE__ ) . 'js/jm_mut.js', array( 'jquery' ) );
        $js_data = array( 
		addNonce => wp_create_nonce('jm_mut_add_nonce'), 
		delNonce => wp_create_nonce('jm_mut_del_nonce')
	);
	wp_localize_script( 'jm-mut-js', 'JmMut', $js_data);

        // Respects SSL, Style.css is relative to the current file
	wp_register_style( 'jm-mut-style', plugin_dir_url( __FILE__ ) . 'css/jm_mut.css' );
        wp_enqueue_style( 'jm-mut-style' );
} // jm_mut_enqueue_scripts_and_styles($hook)

add_action( 'admin_enqueue_scripts', 'jm_mut_enqueue_scripts_and_styles' );



/**
 * Callback for AJAX when a mime type is deleted.
 *
 * Check that this is a valid request and, if so, perform the deletion.
*/
function jm_mut_delete_type_callback() {
	// Check that this is a good request. 
	// Note: This is silent on failure. 
	check_ajax_referer( 'jm_mut_del_nonce', 'nonce');
	$extension = $_POST['extension_to_delete'];
        
	// FIXME - We aren't checking that the option exists. 
	$jm_mut_mime_types = get_option( 'jm_mut_mime_types' ); 

	// FIXME - We need to validate $extension
	unset($jm_mut_mime_types[$extension]);

	update_option('jm_mut_mime_types', $jm_mut_mime_types); 

        echo "REMOVED $extension";
	die(); // this is required to return a proper result
} // jm_mut_delete_type_callback()

add_action('wp_ajax_jm_mut_delete_type', 'jm_mut_delete_type_callback');



/**
 * Callback for AJAX when a mime type is added.
 *
 * Check that this is a valid request and, if so, perform the addition.
*/
function jm_mut_add_type_callback() {
	// Check that this is a good request. 
	// Note: This is silent on failure. 
	check_ajax_referer( 'jm_mut_add_nonce', 'nonce');

	$extension = $_POST['extension_to_add'];
	$mimetype  = $_POST['mimetype_to_add'];

	// FIXME - We aren't checking that the option exists. 
	$jm_mut_mime_types = get_option( 'jm_mut_mime_types' ); 

	// FIXME - We need to check to see if the extension already exists.
	// FIXME - We need to validate both pieces of data here. 
	$jm_mut_mime_types[$extension] = $mimetype;

	update_option('jm_mut_mime_types', $jm_mut_mime_types); 

        echo "ADDED $extension => $mimetype";
	die(); // this is required to return a proper result
} // jm_mut_add_type_callback()

add_action('wp_ajax_jm_mut_add_type', 'jm_mut_add_type_callback');

?>
