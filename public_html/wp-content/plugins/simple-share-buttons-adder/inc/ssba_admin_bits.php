<?php
defined('ABSPATH') or die('No direct access permitted');

// add settings link on plugin page
function ssba_settings_link($links) {

	// add to plugins links
	array_unshift($links, '<a href="options-general.php?page=simple-share-buttons-adder">Settings</a>');

	// return all links
	return $links;
}

// include js files and upload script
function ssba_admin_scripts() {

	// all extra scripts needed
	wp_enqueue_media();
	wp_enqueue_script('media-upload');
	wp_register_script('ssba-bootstrap-js', plugins_url('/js/ssba_bootstrap.js', SSBA_FILE ));
	wp_enqueue_script('ssba-bootstrap-js');
	wp_register_script('ssba-colorpicker-js', plugins_url('/js/ssba_colorpicker.js', SSBA_FILE ));
	wp_enqueue_script('ssba-colorpicker-js');
	wp_register_script('ssba-switch-js', plugins_url('/js/ssba_switch.js', SSBA_FILE ));
	wp_enqueue_script('ssba-switch-js');
	wp_register_script('ssba-admin-js', plugins_url('/js/ssba_admin.js', SSBA_FILE ));
	wp_enqueue_script('ssba-admin-js');
	wp_enqueue_script('jquery-ui-sortable');
	wp_enqueue_script('jquery-ui');
}

// include styles for the ssba admin panel
function ssba_admin_styles() {

	// admin styles
	wp_register_style('ssba-readable', plugins_url('/css/readable.css', SSBA_FILE ));
	wp_enqueue_style('ssba-readable');
	wp_register_style('ssba-colorpicker', plugins_url('/css/colorpicker.css', SSBA_FILE ));
	wp_enqueue_style('ssba-colorpicker');
	wp_register_style('ssba-switch', plugins_url('/css/ssbp_switch.css', SSBA_FILE ));
	wp_enqueue_style('ssba-switch');
	wp_register_style('ssba-admin-theme', plugins_url('/css/ssbp-admin-theme.css', SSBA_FILE ));
	wp_enqueue_style('ssba-admin-theme');
	wp_register_style('ssbp-font-awesome', '//maxcdn.bootstrapcdn.com/font-awesome/4.3.0/css/font-awesome.min.css');
	wp_enqueue_style('ssbp-font-awesome');
	wp_register_style('ssba-styles', plugins_url('/css/style.css', SSBA_FILE ));
	wp_enqueue_style('ssba-styles');
}

// add filter hook for plugin action links
add_filter('plugin_action_links_' . plugin_basename(SSBA_FILE), 'ssba_settings_link' );

// add menu to dashboard
add_action( 'admin_menu', 'ssba_menu' );

// check if viewing the admin page
if (isset($_GET['page']) && $_GET['page'] == 'simple-share-buttons-adder') {

	// add the registered scripts
	add_action('admin_print_styles', 'ssba_admin_styles');
	add_action('admin_print_scripts', 'ssba_admin_scripts');
}

// menu settings
function ssba_menu() {

	// add menu page
	add_options_page( 'Simple Share Buttons Adder', 'Share Buttons', 'manage_options', 'simple-share-buttons-adder', 'ssba_settings');

	// query the db for current ssba settings
	$arrSettings = get_ssba_settings();

	// check if not updated to current version
	if ($arrSettings['ssba_version'] != SSBA_VERSION) {

		// run the upgrade function
		upgrade_ssba($arrSettings);
	}
}

// answer form
function ssba_settings() {

	// check if user has the rights to manage options
	if (! current_user_can('manage_options')) {

		// permissions message
		wp_die( __('You do not have sufficient permissions to access this page.'));
	}

	// if a post has been made
	if(isset($_POST['ssbaData']))
	{
		// get posted data
		$ssbaPost = $_POST['ssbaData'];
		parse_str($ssbaPost, $ssbaPost);

		// if the nonce doesn't check out...
		if ( ! isset($ssbaPost['ssba_save_nonce']) || ! wp_verify_nonce($ssbaPost['ssba_save_nonce'], 'ssba_save_settings'))
		{
			die('There was no nonce provided, or the one provided did not verify.');
		}

		// update existing ssba settings
		update_option('ssba_image_set', 			$ssbaPost['ssba_image_set']);
		update_option('ssba_size', 					$ssbaPost['ssba_size']);
		update_option('ssba_pages', 				(isset($ssbaPost['ssba_pages']) ? $ssbaPost['ssba_pages'] : NULL));
		update_option('ssba_posts', 				(isset($ssbaPost['ssba_posts']) ? $ssbaPost['ssba_posts'] : NULL));
		update_option('ssba_cats_archs', 			(isset($ssbaPost['ssba_cats_archs']) ? $ssbaPost['ssba_cats_archs'] : NULL));
		update_option('ssba_homepage', 				(isset($ssbaPost['ssba_homepage']) ? $ssbaPost['ssba_homepage'] : NULL));
		update_option('ssba_excerpts', 				(isset($ssbaPost['ssba_excerpts']) ? $ssbaPost['ssba_excerpts'] : NULL));
		update_option('ssba_align', 				(isset($ssbaPost['ssba_align']) ? $ssbaPost['ssba_align'] : NULL));
		update_option('ssba_padding', 				$ssbaPost['ssba_padding']);
		update_option('ssba_before_or_after', 		$ssbaPost['ssba_before_or_after']);
		update_option('ssba_additional_css', 		$ssbaPost['ssba_additional_css']);
		update_option('ssba_custom_styles', 		$ssbaPost['ssba_custom_styles']);
		update_option('ssba_custom_styles_enabled', $ssbaPost['ssba_custom_styles_enabled']);
		update_option('ssba_email_message', 		stripslashes_deep($ssbaPost['ssba_email_message']));
		update_option('ssba_twitter_text', 			stripslashes_deep($ssbaPost['ssba_twitter_text']));
		update_option('ssba_buffer_text', 			stripslashes_deep($ssbaPost['ssba_buffer_text']));
		update_option('ssba_flattr_user_id', 		stripslashes_deep($ssbaPost['ssba_flattr_user_id']));
		update_option('ssba_flattr_url', 			stripslashes_deep($ssbaPost['ssba_flattr_url']));
		update_option('ssba_share_new_window', 		(isset($ssbaPost['ssba_share_new_window']) ? $ssbaPost['ssba_share_new_window'] : NULL));
		update_option('ssba_link_to_ssb', 			(isset($ssbaPost['ssba_link_to_ssb']) ? $ssbaPost['ssba_link_to_ssb'] : NULL));
		update_option('ssba_show_share_count', 		(isset($ssbaPost['ssba_show_share_count']) ? $ssbaPost['ssba_show_share_count'] : NULL));
		update_option('ssba_share_count_style',		$ssbaPost['ssba_share_count_style']);
		update_option('ssba_share_count_css',		$ssbaPost['ssba_share_count_css']);
		update_option('ssba_share_count_once',		(isset($ssbaPost['ssba_share_count_once']) ? $ssbaPost['ssba_share_count_once'] : NULL));
		update_option('ssba_widget_text',			$ssbaPost['ssba_widget_text']);
		update_option('ssba_rel_nofollow',			(isset($ssbaPost['ssba_rel_nofollow']) ? $ssbaPost['ssba_rel_nofollow'] : NULL));
		update_option('ssba_default_pinterest',		(isset($ssbaPost['ssba_default_pinterest']) ? $ssbaPost['ssba_default_pinterest'] : NULL));
		update_option('ssba_pinterest_featured',	(isset($ssbaPost['ssba_pinterest_featured']) ? $ssbaPost['ssba_pinterest_featured'] : NULL));
		update_option('ssba_content_priority',	    (isset($ssbaPost['ssba_content_priority']) ? $ssbaPost['ssba_content_priority'] : NULL));

		// share container
		update_option('ssba_div_padding', 			$ssbaPost['ssba_div_padding']);
		update_option('ssba_div_rounded_corners', 	(isset($ssbaPost['ssba_div_rounded_corners']) ? $ssbaPost['ssba_div_rounded_corners'] : NULL));
		update_option('ssba_border_width', 			$ssbaPost['ssba_border_width']);
		update_option('ssba_div_border', 			$ssbaPost['ssba_div_border']);
		update_option('ssba_div_background', 		$ssbaPost['ssba_div_background']);

		// text
		update_option('ssba_share_text', 			stripslashes_deep($ssbaPost['ssba_share_text']));
		update_option('ssba_text_placement', 		$ssbaPost['ssba_text_placement']);
		update_option('ssba_font_family', 			$ssbaPost['ssba_font_family']);
		update_option('ssba_font_color', 			$ssbaPost['ssba_font_color']);
		update_option('ssba_font_size', 			$ssbaPost['ssba_font_size']);
		update_option('ssba_font_weight', 			$ssbaPost['ssba_font_weight']);

		// include
		update_option('ssba_selected_buttons', 		$ssbaPost['ssba_selected_buttons']);

		// prepare array of buttons
        $arrButtons = json_decode(get_option('ssba_buttons'), true);

        // loop through each button
        foreach ($arrButtons as $button => $arrButton) {
            // update the option for the button
            update_option('ssba_custom_'.$button, $ssbaPost['ssba_custom_'.$button]);
        }

        // return success
		return true;
	}

	// include then run the upgrade script
	include_once (plugin_dir_path(SSBA_FILE) . '/inc/ssba_admin_panel.php');

	// query the db for current ssba settings
	$arrSettings = get_ssba_settings();

	// --------- ADMIN PANEL ------------ //
	ssba_admin_panel($arrSettings);
}
