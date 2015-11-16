<?php
defined('ABSPATH') or die('No direct access permitted');

// run the activation function upon acitvation of the plugin
register_activation_hook( __FILE__,'ssba_activate');

// register deactivation hook
register_uninstall_hook(__FILE__,'ssba_uninstall');

// activate ssba function
function ssba_activate() {

	// insert default options for ssba
	add_option('ssba_version', 				SSBA_VERSION);
	add_option('ssba_image_set', 			'somacro');
	add_option('ssba_size', 				'35');
	add_option('ssba_pages',				'');
	add_option('ssba_posts',				'');
	add_option('ssba_cats_archs',			'');
	add_option('ssba_homepage',				'');
	add_option('ssba_excerpts',				'');
	add_option('ssba_align', 				'left');
	add_option('ssba_padding', 				'6');
	add_option('ssba_before_or_after', 		'after');
	add_option('ssba_additional_css', 		'');
	add_option('ssba_custom_styles', 		'');
	add_option('ssba_custom_styles_enabled','');
	add_option('ssba_email_message', 		'');
	add_option('ssba_twitter_text', 		'');
	add_option('ssba_buffer_text', 			'');
	add_option('ssba_flattr_user_id', 		'');
	add_option('ssba_flattr_url', 			'');
	add_option('ssba_share_new_window', 	'Y');
	add_option('ssba_link_to_ssb', 			'N');
	add_option('ssba_show_share_count',		'');
	add_option('ssba_share_count_style',	'default');
	add_option('ssba_share_count_css',		'');
	add_option('ssba_share_count_once',		'Y');
	add_option('ssba_widget_text',			'');
	add_option('ssba_rel_nofollow',			'');
	add_option('ssba_default_pinterest',	'');
	add_option('ssba_pinterest_featured',	'');
	add_option('ssba_content_priority',	    '10');

	// share container
	add_option('ssba_div_padding', 			'');
	add_option('ssba_div_rounded_corners', 	'');
	add_option('ssba_border_width', 		'');
	add_option('ssba_div_border', 			'');
	add_option('ssba_div_background', 		'');

	// share text
	add_option('ssba_share_text', 			"It's only fair to share...");
	add_option('ssba_text_placement', 		'left');
	add_option('ssba_font_family', 			'Indie Flower');
	add_option('ssba_font_color',			'');
	add_option('ssba_font_size',			'20');
	add_option('ssba_font_weight',			'');

	// include
	add_option('ssba_selected_buttons', 	'facebook,google,twitter,linkedin');

	// custom images
	add_option('ssba_custom_email', 		'');
	add_option('ssba_custom_google', 		'');
	add_option('ssba_custom_facebook', 		'');
	add_option('ssba_custom_twitter', 		'');
	add_option('ssba_custom_diggit', 		'');
	add_option('ssba_custom_linkedin', 	  	'');
	add_option('ssba_custom_reddit', 	  	'');
	add_option('ssba_custom_stumbleupon', 	'');
	add_option('ssba_custom_pinterest', 	'');
	add_option('ssba_custom_buffer', 		'');
	add_option('ssba_custom_flattr', 		'');
	add_option('ssba_custom_tumblr', 		'');
	add_option('ssba_custom_print', 		'');
	add_option('ssba_custom_vk', 			'');
	add_option('ssba_custom_yummly', 		'');

	// button helper array
	ssba_button_helper_array();
}

// uninstall ssba
function ssba_uninstall() {

	//if uninstall not called from WordPress exit
	if (defined('WP_UNINSTALL_PLUGIN')) {
		exit();
	}

	// delete all options
	delete_option('ssba_version');
	delete_option('ssba_image_set');
	delete_option('ssba_size');
	delete_option('ssba_pages');
	delete_option('ssba_posts');
	delete_option('ssba_cats_archs');
	delete_option('ssba_homepage');
	delete_option('ssba_excerpts');
	delete_option('ssba_align');
	delete_option('ssba_padding');
	delete_option('ssba_before_or_after');
	delete_option('ssba_additional_css');
	delete_option('ssba_custom_styles');
	delete_option('ssba_custom_styles_enabled');
	delete_option('ssba_email_message');
	delete_option('ssba_buffer_text');
	delete_option('ssba_twitter_text');
	delete_option('ssba_flattr_user_id');
	delete_option('ssba_flattr_url');
	delete_option('ssba_share_new_window');
	delete_option('ssba_link_to_ssb');
	delete_option('ssba_show_share_count');
	delete_option('ssba_share_count_style');
	delete_option('ssba_share_count_css');
	delete_option('ssba_share_count_once');
	delete_option('ssba_widget_text');
	delete_option('ssba_rel_nofollow');
	delete_option('ssba_default_pinterest');
	delete_option('ssba_pinterest_featured');
	delete_option('ssba_content_priority');

	// share container
	delete_option('ssba_div_padding');
	delete_option('ssba_div_rounded_corners');
	delete_option('ssba_border_width');
	delete_option('ssba_div_border');
	delete_option('ssba_div_background');

	// share text
	delete_option('ssba_share_text');
	delete_option('ssba_text_placement');
	delete_option('ssba_font_family');
	delete_option('ssba_font_color');
	delete_option('ssba_font_size');
	delete_option('ssba_font_weight');

	// include
	delete_option('ssba_selected_buttons');

	// custom images
	delete_option('ssba_custom_email');
	delete_option('ssba_custom_google');
	delete_option('ssba_custom_facebook');
	delete_option('ssba_custom_twitter');
	delete_option('ssba_custom_diggit');
	delete_option('ssba_custom_linkedin');
	delete_option('ssba_custom_reddit');
	delete_option('ssba_custom_stumbleupon');
	delete_option('ssba_custom_pinterest');
	delete_option('ssba_custom_buffer');
	delete_option('ssba_custom_flattr');
	delete_option('ssba_custom_tumblr');
	delete_option('ssba_custom_print');
	delete_option('ssba_custom_vk');
	delete_option('ssba_custom_yummly');
}

// the upgrade function
function upgrade_ssba($arrSettings) {

	// ensure excerpts are set
	add_option('ssba_excerpts',		'');

	// add print button
	add_option('ssba_custom_print', '');

	// new for 3.8
	add_option('ssba_widget_text',	'');
	add_option('ssba_rel_nofollow',	'');

	// added pre 4.5, added in 4.6 to fix notice
	add_option('ssba_rel_nofollow',	'');

	// added in 5.0
	add_option('ssba_custom_vk', 	 '');
	add_option('ssba_custom_yummly', '');

	// added in 5.2
	add_option('ssba_default_pinterest', '');

	// added in 5.5
	add_option('ssba_pinterest_featured', '');

	// added in 5.7
	// additional CSS field
	add_option('ssba_additional_css', '');

	// empty custom CSS var and option
	$customCSS = '';
	add_option('ssba_custom_styles_enabled', '');

	// if some custom styles are in place
	if ($arrSettings['ssba_custom_styles'] != '') {
		$customCSS.= $arrSettings['ssba_custom_styles'];
		update_option('ssba_custom_styles_enabled', 'Y');
	}

	// if some custom share count styles are in place
	if ($arrSettings['ssba_share_count_css'] != '') {
		$customCSS.= $arrSettings['ssba_share_count_css'];
		update_option('ssba_custom_styles_enabled', 'Y');
	}

	// update custom CSS option
	update_option('ssba_custom_styles', $customCSS);

	add_option('ssba_content_priority', '10');

	// button helper array
	ssba_button_helper_array();

	// update version number
	update_option('ssba_version', SSBA_VERSION);
}

// button helper option
function ssba_button_helper_array()
{
	// helper array for ssbp
	update_option('ssba_buttons', json_encode(array(
		'buffer' => array(
			'full_name' 	=> 'Buffer'
		),
		'diggit' => array(
			'full_name' 	=> 'Diggit'
		),
		'email' => array(
			'full_name' 	=> 'Email'
		),
		'facebook' => array(
			'full_name' 	=> 'Facebook'
		),
		'flattr' => array(
			'full_name' 	=> 'Flattr'
		),
		'google' => array(
			'full_name' 	=> 'Google+'
		),
		'linkedin' => array(
			'full_name' 	=> 'LinkedIn'
		),
		'pinterest' => array(
			'full_name' 	=> 'Pinterest'
		),
		'print' => array(
			'full_name' 	=> 'Print'
		),
		'reddit' => array(
			'full_name' 	=> 'Reddit'
		),
		'stumbleupon' => array(
			'full_name' 	=> 'StumbleUpon'
		),
		'tumblr' => array(
			'full_name' 	=> 'Tumblr'
		),
		'twitter' => array(
			'full_name' 	=> 'Twitter'
		),
		'vk' => array(
			'full_name' 	=> 'VK'
		),
		'yummly' => array(
			'full_name' 	=> 'Yummly'
		)
	)));
}
