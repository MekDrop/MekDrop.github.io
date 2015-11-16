<?php
/*
Plugin Name: OS Integration
Description: Integrate your site in to your users OS, Windows Live Tiles, icons for Apple and Android, iOS Web App!
Version: 1.7
Plugin URI: http://toolstack.com/os-integration
Author: Greg Ross
Author URI: http://toolstack.com
Tags: Windows 8, Internet Explorer, IE10, IE11, live tile, RSS, App, tiles, start screen, pinned site, branding, favicon, apple, icons, Android, Windows Phone 8.1, WebApp, web app
License: GPL

Compatible with WordPress 3.5+.

Read the accompanying readme.txt file for instructions and documentation.

Copyright (c) 2014 by Greg Ross

This software is released under the GPL v2.0, see license.txt for details
*/

/* 
****************************************
Plugin Variables and Defines Starts Here
****************************************
*/

// Define the plugin version.
DEFINE( 'OSINTVER', '1.7' );

// Define the name of the WordPress option to use.
DEFINE( 'ISINTOPTIONNAME', 'osintegration_options' );

include_once dirname( __FILE__ ) . '/widget.php';

/* 
****************************
Plugin Functions Starts Here
****************************
*/

// Delete options table entries ONLY when plugin deactivated AND deleted.
function osintegration_delete_plugin_options() 
	{
	delete_option( ISINTOPTIONNAME );
	}
	
// Display a Settings link on the main plugins page.
function osintegration_plugin_action_links( $links, $file ) 
	{
	if ( $file == plugin_basename( __FILE__ ) ) 
		{
		$osintegration_links = '<a href="' . get_admin_url() . 'options-general.php?page=os-integration%2Fos-integration.php">' . __( 'Settings' ) . '</a>';

		// Add our settings to the top of the list.
		array_unshift( $links, $osintegration_links );
		}
		
	return $links;
	}

// Define default option settings, called when the plugin is activated.
function osintegration_add_defaults() 
	{
	// Check to see if we already have options set.
	$tmp = get_option( ISINTOPTIONNAME );
	
    if( !is_array( $tmp ) ) 
		{
		delete_option( ISINTOPTIONNAME );
		
		$arr = array(
					'plugin_version' 			=> OSINTVER,
					'notification_frequency' 	=> 360,
					'background-color' 			=> '#111111',
					'title' 					=> get_bloginfo( 'name' ),
					'enablefavicon'				=> 'on',
					'enablelivetile'			=> 'on',
					'enableios'					=> 'on',
					'rssurl'					=> get_bloginfo( 'rss2_url' )
		);
		
		update_option( ISINTOPTIONNAME, $arr );
		
		add_feed( 'msxmllivetile', 'osintegration_outputxmlfeed' );
		
		//Ensure the $wp_rewrite global is loaded
		global $wp_rewrite;
		//Call flush_rules() as a method of the $wp_rewrite object
		$wp_rewrite->flush_rules( false );
		}
	}

// Init plugin options to white list our options.
function osintegration_init()
	{
	register_setting( 'osintegration_plugin_options', ISINTOPTIONNAME, 'osintegration_validate_options' );
	}

// Add us to the settings menu.
function osintegration_add_options_page()
	{
	$page = add_options_page( 'OS Integration Settings', 'OS Integration', 'manage_options', __FILE__, 'osintegration_options_page' );
	add_action( 'load-' . $page, 'osintegration_create_help_screen' );
	}

function osintegration_create_help_screen()
	{
	include_once( 'includes/help-options.php' );
	}
	
// Prepare the media uploader and our admin scripts.
function osintegration_admin_scripts()
	{
	// Must be running 3.5+ to use color pickers and image upload.
	wp_enqueue_media();
	wp_enqueue_style( 'wp-color-picker' );
	wp_enqueue_script( 'osintegration-admin', plugins_url( "/js/os-integration.js", __FILE__ ), array( 'wp-color-picker', 'jquery' ) );
	
	wp_enqueue_script('jquery');
	wp_enqueue_script('jquery-ui-core');
	wp_enqueue_script('jquery-ui-tabs');
	
	global $wp_scripts; 
	wp_register_style("jquery-ui-css", plugin_dir_url(__FILE__) . "css/jquery-ui-1.10.4.custom.css");
	wp_enqueue_style("jquery-ui-css");
	wp_register_style("jquery-ui-tabs-css", plugin_dir_url(__FILE__) . "css/jquery-ui-tabs.css");
	wp_enqueue_style("jquery-ui-tabs-css");
	}
	
// Display the options page.
function osintegration_options_page()
	{
	include_once( 'includes/page-options.php' );
	}

// Sanitize and validate input. Accepts an array, return a sanitized array.
function osintegration_validate_options( $input ) 
	{
	// Get the old options for reference.
	$options = get_option( ISINTOPTIONNAME );

	// Sanitize inputs.
	$input['title'] = sanitize_text_field( $input['title'] );
	$input['notification_frequency'] = absint( $input['notification_frequency'] );
	
	// don't let users shoot themselves in the foot by trying to set a value other than those MS accepts.
	if( !in_array( $input['notification_frequency'], array( 30, 60, 360, 720, 1440 ) ) )
		{
		$input['notification_frequency'] = 360;
		}

	// Create the various image sizes if the image has been changed.
	if( $options['squareimgurl'] != $input['squareimgurl'] || $options['wideimgurl'] != $input['wideimgurl'] || $input['forcerebuild'] ) 
		{
		// If the user forced a rebuild of the images, unset it now so we don't save it later.
		unset( $input['forcerebuild'] );
		
		// We need a few variables to use later on, set them up now.
		$upload_dir = wp_upload_dir();
		$upload_base_dir = $upload_dir['basedir'];
		
		$path = trailingslashit( $upload_base_dir ) . 'os-integration/';

		// Flush out any old files before we create the new images.
		$files_to_delete = scandir( $path );
		foreach( $files_to_delete as $file ) 
			{
			if( !is_dir( $file ) ) 
				{
				@unlink( $path . $file );
				}
			}
		
		// By default the media selector returns a url, some hosting providers disable remote file wrappers for security,
		// so let's convert the "local" url to a local path.
		$square_image_path = str_replace( $upload_dir['baseurl'], $upload_dir['basedir'], $input['squareimgurl'] );
		$wide_image_path = str_replace( $upload_dir['baseurl'], $upload_dir['basedir'], $input['wideimgurl'] );

		// Load the square image in to the WordPress image editor and make the required sizes.
		$squareimg = wp_get_image_editor( $square_image_path );

		// Make sure the image exists.
		if( !is_wp_error( $squareimg ) ) 
			{
			$imgsize = $squareimg->get_size();

			if( $imgsize['width'] != $imgsize['height'] || $imgsize['width'] < 451 ) 
				{
				$input['error_message'] .= "<p><b>Error - Square image has incorrect dimensions ({$imgsize['width']}x {$imgsize['height']})!</b></p>";
				}
			else
				{
				// Save the image as a png in the dedicated os-integration folder before generating variants.
				$info = pathinfo( $input['squareimgurl'] );
				$path = trailingslashit( $upload_base_dir ) . 'os-integration/';
				$filename = $info['filename'];
				$out = $squareimg->save( $path . $filename . '.png', 'image/png' );
				
				if( !is_wp_error( $out ) ) 
					{
					// Create the image sizes we needed.
					$sizes_array = array(
										array( 'width' => 16, 'height' => 16, 'crop' => true ),
										array( 'width' => 32, 'height' => 32, 'crop' => true ),
										array( 'width' => 57, 'height' => 57, 'crop' => true ),
										array( 'width' => 64, 'height' => 64, 'crop' => true ),
										array( 'width' => 70, 'height' => 70, 'crop' => true ),
										array( 'width' => 72, 'height' => 72, 'crop' => true ),
										array( 'width' => 96, 'height' => 96, 'crop' => true ),
										array( 'width' => 114, 'height' => 114, 'crop' => true ),
										array( 'width' => 144, 'height' => 144, 'crop' => true ),
										array( 'width' => 150, 'height' => 150, 'crop' => true ),
										array( 'width' => 160, 'height' => 160, 'crop' => true ),
										array( 'width' => 196, 'height' => 196, 'crop' => true ),
										array( 'width' => 230, 'height' => 230, 'crop' => true ),
										array( 'width' => 310, 'height' => 310, 'crop' => true ),
										array( 'width' => 450, 'height' => 450, 'crop' => true )
									);
					
					$resize = $squareimg->multi_resize( $sizes_array );
					
					// Save the new image URLs in the plugin options for use when we generate the HTML.
					if ( !is_wp_error( $resize ) ) 
						{
						$base = trailingslashit($upload_dir['baseurl']) . 'os-integration/';
						$input['img_square_16'] = $base . $resize[0]['file'];
						$input['img_square_32'] = $base . $resize[1]['file'];
						$input['img_square_57'] = $base . $resize[2]['file'];
						$input['img_square_64'] = $base . $resize[3]['file'];
						$input['img_square_70'] = $base . $resize[4]['file'];
						$input['img_square_72'] = $base . $resize[5]['file'];
						$input['img_square_96'] = $base . $resize[6]['file'];
						$input['img_square_114'] = $base . $resize[7]['file'];
						$input['img_square_144'] = $base . $resize[8]['file'];
						$input['img_square_150'] = $base . $resize[9]['file'];
						$input['img_square_160'] = $base . $resize[10]['file'];
						$input['img_square_196'] = $base . $resize[11]['file'];
						$input['img_square_230'] = $base . $resize[12]['file'];
						$input['img_square_310'] = $base . $resize[13]['file'];
						$input['img_square_450'] = $base . $resize[14]['file'];
						}
					else
						{
						$input['error_message'] = '<b>Error Generating Square Images</b>: ' . $resize->get_error_message();
						}
					}
				else
					{
					$input['error_message'] = '<b>Error Converting Square Image</b>: ' . $out->get_error_message();
					}
				}
			}
		else
			{
			$input['error_message'] = "<b>Error - Could not edit square image file</b>: " . $squareimg->get_error_message() . '<br><br>';
			$input['error_message'] .= "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;URL: " . $input['imgurl'] . '<br>';
			$input['error_message'] .= "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Path: " . $image_path . '<br>';
			}

		// If a wide image doesn't exist, create one from the square image (assuming of course it exists :)
		if( !file_exists( $wide_image_path ) && file_exists( $square_image_path ) ) 
			{
			// Get the file path information for the square image.
			$img_path_info = pathinfo($square_image_path);
			
			$wide_image_path = trailingslashit( $upload_base_dir ) . 'os-integration/' . $img_path_info['filename'] . '-wide.' . $img_path_info['extension'];
			
			// Get the image size so we can calculate the wide image size.
			$imgsize = $squareimg->get_size();
			
			$wide_imgsize = $imgsize;
			$wide_imgsize['width'] = $imgsize['height'] * (451 / 219);
			
			// Create the blank background image.
			osintegration_new_png( $wide_image_path, $wide_imgsize['width'], $wide_imgsize['height'], $input['background-color'] );
			// Determine the location of the logo on the background.
			$x = (int)( ( $wide_imgsize['width'] - $imgsize['width'] ) / 2 );
			$y = 0;
			
			// Add the logo to the background image.
			osintegration_composite_images( $wide_image_path, $square_image_path, $x, $y );
			
			// Store the url
			$wide_image_url = str_replace( $upload_dir['basedir'], $upload_dir['baseurl'], $wide_image_path );
			$input['wideimgurl'] = $wide_image_url;
			}
			
		// Load the wide image in to the WordPress image editor and make the required sizes.
		$wideimg = wp_get_image_editor( $wide_image_path );
		
		// Make sure the image exists.
		if( !is_wp_error( $wideimg ) ) 
			{
			$imgsize = $wideimg->get_size();
			
			if( $imgsize['height'] < 219 || $imgsize['width'] < 451 ) 
				{
				$input['error_message'] .= "<p><b>Error - Wide image has incorrect dimensions ({$imgsize['width']}x {$imgsize['height']})!</b></p>";
				}
			else
				{
				// Save the image as a png in the dedicated os-integration folder before generating variants.
				if( $square_image_path != $wide_image_path ) 
					{
					$info = pathinfo( $input['wideimgurl'] );
					$path = trailingslashit( $upload_base_dir ) . 'os-integration/' . $info['filename'];
					$out = $wideimg->save( $path . '.png', 'image/png' );
					}
				
				if( !is_wp_error( $out ) ) 
					{
					// Create the image sizes we needed.
					$sizes_array = array(
										array ( 'width' => 96, 'height' => 46, 'crop' => true ),
										array ( 'width' => 155, 'height' => 75, 'crop' => true ),
										array ( 'width' => 196, 'height' => 95, 'crop' => true ),
										array ( 'width' => 230, 'height' => 112, 'crop' => true ),
										array ( 'width' => 256, 'height' => 160, 'crop' => true ),
										array ( 'width' => 310, 'height' => 150, 'crop' => true ),
										array ( 'width' => 450, 'height' => 218, 'crop' => true )
									);
					
					$resize = $wideimg->multi_resize( $sizes_array );
					
					// Save the new image URLs in the plugin options for use when we generate the HTML.
					if ( !is_wp_error( $resize ) ) 
						{
						$base = trailingslashit($upload_dir['baseurl']) . 'os-integration/';
						$input['img_wide_96']  = $base . $resize[0]['file'];
						$input['img_wide_155'] = $base . $resize[1]['file'];
						$input['img_wide_196'] = $base . $resize[2]['file'];
						$input['img_wide_230'] = $base . $resize[3]['file'];
						$input['img_wide_256'] = $base . $resize[4]['file'];
						$input['img_wide_310'] = $base . $resize[5]['file'];
						$input['img_wide_450'] = $base . $resize[6]['file'];
						}
					else
						{
						$input['error_message'] = '<b>Error Generating Wide Images</b>: ' . $resize->get_error_message();
						}
					}
				else
					{
					$input['error_message'] = '<b>Error Converting Wide Image</b>: ' . $out->get_error_message();
					}
				}
			}
		else
			{
			$input['error_message'] = "<b>Error - Could not edit wide image file</b>: " . $wideimg->get_error_message() . '<br><br>';
			$input['error_message'] .= "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;URL: " . $input['imgurl'] . '<br>';
			$input['error_message'] .= "&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Path: " . $image_path . '<br>';
			}

		// Create the iOS icon and web app backgrounds.
		$path = trailingslashit( $upload_base_dir ) . 'os-integration/';
		$base = trailingslashit($upload_dir['baseurl']) . 'os-integration/';
		
		if( $input['widewebapp'] ) 
			{
			$iOSfilenames = array(  
									array( 'tag' => 'ios_icon_', 'name' => $path . 'iOS-Icon-57x57.png', 'x' => 57, 'y' => 57, 'logo' => $path . basename( $input['img_square_57'] ), 'logo-position' => 1, 'logo-x' => 57, 'logo-y' => 57 ),
									array( 'tag' => 'ios_icon_', 'name' => $path . 'iOS-Icon-72x72.png', 'x' => 72, 'y' => 72, 'logo' => $path . basename( $input['img_square_72'] ), 'logo-position' => 1, 'logo-x' => 72, 'logo-y' => 72 ),
									array( 'tag' => 'ios_icon_', 'name' => $path . 'iOS-Icon-114x114.png', 'x' => 114, 'y' => 114, 'logo' => $path . basename( $input['img_square_114'] ), 'logo-position' => 1, 'logo-x' => 114, 'logo-y' => 114 ),
									array( 'tag' => 'ios_icon_', 'name' => $path . 'iOS-Icon-144x144.png', 'x' => 144, 'y' => 144, 'logo' => $path . basename( $input['img_square_144'] ), 'logo-position' => 1, 'logo-x' => 144, 'logo-y' => 144 ),
									array( 'tag' => 'ios_web_app_', 'name' => $path . 'iOS-Web-App-320x460.png', 'x' => 320, 'y' => 460, 'logo' => $path . basename( $input['img_wide_96'] ), 'logo-position' => $input['logo-position'], 'logo-x' => 96, 'logo-y' => 46 ),
									array( 'tag' => 'ios_web_app_', 'name' => $path . 'iOS-Web-App-640x920.png', 'x' => 640, 'y' => 920, 'logo' => $path . basename( $input['img_wide_196'] ), 'logo-position' => $input['logo-position'], 'logo-x' => 196, 'logo-y' => 95 ),
									array( 'tag' => 'ios_web_app_', 'name' => $path . 'iOS-Web-App-640x1096.png', 'x' => 640, 'y' => 1096, 'logo' => $path . basename( $input['img_wide_196'] ), 'logo-position' => $input['logo-position'], 'logo-x' => 196, 'logo-y' => 95 ),
									array( 'tag' => 'ios_web_app_', 'name' => $path . 'iOS-Web-App-768x1004.png', 'x' => 768, 'y' => 1004, 'logo' => $path . basename( $input['img_wide_230'] ), 'logo-position' => $input['logo-position'], 'logo-x' => 230, 'logo-y' => 112 ),
									array( 'tag' => 'ios_web_app_', 'name' => $path . 'iOS-Web-App-748x1024.png', 'x' => 748, 'y' => 1024, 'logo' => $path . basename( $input['img_wide_230'] ), 'logo-position' => $input['logo-position'], 'logo-x' => 230, 'logo-y' => 112 ),
									array( 'tag' => 'ios_web_app_', 'name' => $path . 'iOS-Web-App-1536x2008.png', 'x' => 1536, 'y' => 2008, 'logo' => $path . basename( $input['img_wide_450'] ), 'logo-position' => $input['logo-position'], 'logo-x' => 450, 'logo-y' => 218 ),
									array( 'tag' => 'ios_web_app_', 'name' => $path . 'iOS-Web-App-1496x2048.png', 'x' => 1496, 'y' => 2048, 'logo' => $path . basename( $input['img_wide_450'] ), 'logo-position' => $input['logo-position'], 'logo-x' => 450, 'logo-y' => 218 )
								);
			}
		else
			{
			$iOSfilenames = array(  
									array( 'tag' => 'ios_icon_', 'name' => $path . 'iOS-Icon-57x57.png', 'x' => 57, 'y' => 57, 'logo' => $path . basename( $input['img_square_57'] ), 'logo-position' => 1, 'logo-x' => 57, 'logo-y' => 57 ),
									array( 'tag' => 'ios_icon_', 'name' => $path . 'iOS-Icon-72x72.png', 'x' => 72, 'y' => 72, 'logo' => $path . basename( $input['img_square_72'] ), 'logo-position' => 1, 'logo-x' => 72, 'logo-y' => 72 ),
									array( 'tag' => 'ios_icon_', 'name' => $path . 'iOS-Icon-114x114.png', 'x' => 114, 'y' => 114, 'logo' => $path . basename( $input['img_square_114'] ), 'logo-position' => 1, 'logo-x' => 114, 'logo-y' => 114 ),
									array( 'tag' => 'ios_icon_', 'name' => $path . 'iOS-Icon-144x144.png', 'x' => 144, 'y' => 144, 'logo' => $path . basename( $input['img_square_144'] ), 'logo-position' => 1, 'logo-x' => 144, 'logo-y' => 144 ),
									array( 'tag' => 'ios_web_app_', 'name' => $path . 'iOS-Web-App-320x460.png', 'x' => 320, 'y' => 460, 'logo' => $path . basename( $input['img_square_96'] ), 'logo-position' => $input['logo-position'], 'logo-x' => 96, 'logo-y' => 96 ),
									array( 'tag' => 'ios_web_app_', 'name' => $path . 'iOS-Web-App-640x920.png', 'x' => 640, 'y' => 920, 'logo' => $path . basename( $input['img_square_196'] ), 'logo-position' => $input['logo-position'], 'logo-x' => 196, 'logo-y' => 196 ),
									array( 'tag' => 'ios_web_app_', 'name' => $path . 'iOS-Web-App-640x1096.png', 'x' => 640, 'y' => 1096, 'logo' => $path . basename( $input['img_square_196'] ), 'logo-position' => $input['logo-position'], 'logo-x' => 196, 'logo-y' => 196 ),
									array( 'tag' => 'ios_web_app_', 'name' => $path . 'iOS-Web-App-768x1004.png', 'x' => 768, 'y' => 1004, 'logo' => $path . basename( $input['img_square_230'] ), 'logo-position' => $input['logo-position'], 'logo-x' => 230, 'logo-y' => 230 ),
									array( 'tag' => 'ios_web_app_', 'name' => $path . 'iOS-Web-App-748x1024.png', 'x' => 748, 'y' => 1024, 'logo' => $path . basename( $input['img_square_230'] ), 'logo-position' => $input['logo-position'], 'logo-x' => 230, 'logo-y' => 230 ),
									array( 'tag' => 'ios_web_app_', 'name' => $path . 'iOS-Web-App-1536x2008.png', 'x' => 1536, 'y' => 2008, 'logo' => $path . basename( $input['img_square_450'] ), 'logo-position' => $input['logo-position'], 'logo-x' => 450, 'logo-y' => 450 ),
									array( 'tag' => 'ios_web_app_', 'name' => $path . 'iOS-Web-App-1496x2048.png', 'x' => 1496, 'y' => 2048, 'logo' => $path . basename( $input['img_square_450'] ), 'logo-position' => $input['logo-position'], 'logo-x' => 450, 'logo-y' => 450 )
								);
			}

		foreach( $iOSfilenames as $item ) 
			{
			// Create the blank background image.
			osintegration_new_png( $item['name'], $item['x'], $item['y'], $input['background-color'] );
			
			// Determine the location of the logo on the background.
			list( $x, $y ) = osintegration_get_logo_position( $item['x'], $item['y'], $item['logo-position'], $item['logo-x'], $item['logo-y'] );
			
			// Add the logo to the background image.
			osintegration_composite_images( $item['name'], $item['logo'], $x, $y );
			
			// Store the url
			$desc = $item['tag'] . $item['y'];
			$input[$desc] = $base . basename( $item['name'] );
			}
			
		// Generate the ICO file
		require_once( dirname( __FILE__ ) . '/includes/php-ico/class-php-ico.php' );

		$destination = dirname( __FILE__ ) . '/example.ico';
		
		$ico_lib = new PHP_ICO();
		
		if( $input['favicon96'] ) { $ico_lib->add_image( $path . basename( $input['img_square_96'] ), array( 96, 96 ) ); }
		if( $input['favicon64'] ) { $ico_lib->add_image( $path . basename( $input['img_square_64'] ), array( 64, 64 ) ); }
		$ico_lib->add_image( $path . basename( $input['img_square_32'] ), array( 32, 32 ) );
		$ico_lib->add_image( $path . basename( $input['img_square_16'] ), array( 16, 16 ) );
		
		$ico_lib->save_ico( trailingslashit( $input['faviconpath'] ) . 'favicon.ico' );

		// Deal with a user override of individual items
		foreach( $input as $key => $value )
			{
			if( substr( $key, 0, 7 ) == 'adv_'  )
				{
				$basekey = substr( $key, 4 );
				
				if( $value != '' )
					{
					$input[$basekey] = $value;
					}
				}
			}
		
		}
	else
		{
		// If we're not generating new images, copy the old image settings over from the previous options array.
		foreach( $options as $tag => $item )
			{
			if( !isset( $input[$tag] ) ) 
				{
				$chop = substr( $tag, 0, 4 );
				
				if( $chop == 'img_' || $chop == 'ios_' )
					{
					$input[$tag] = $options[$tag];
					}
				}
			}
		}
		
	return $input;
	}
	
// Get a option value.
function osintegration_getOption( $option, $options = null ) 
	{
	if( $options == null ) { $options = get_option( ISINTOPTIONNAME ); }
		
	if( array_key_exists( $option, $options ) )
		{
		return $options[$option];
		}
	else
		{
		return false;
		}
	}

// Output the HTML for the os integration options.
function osintegration_output() 
	{
	$options = get_option( ISINTOPTIONNAME );

	// Get our RSS2 feed url.
	if( !isset( $options['rssurl'] ) )
		{
		$options['rssurl'] = get_bloginfo( 'rss2_url' );
		}
		
	$feed_url = $options['rssurl'];
	
	if( $options['localxml'] ) 
		{
		// If we're using our own feed, use the feed url for rss2 but replace it with 'mslivetile'.
		$feed_url = str_ireplace( 'rss2', 'mslivetile', $feed_url );
		
		// Setup the pooling uri for our own feed.
		$polling_uri  = $feed_url . '&amp;id=1;' .
						$feed_url . '&amp;id=2;' .
						$feed_url . '&amp;id=3;' .
						$feed_url . '&amp;id=4;' .
						$feed_url . '&amp;id=5;';
		}
	else
		{
		// Setup the pooling uri for Microsoft.
		$polling_uri  = 'http://notifications.buildmypinnedsite.com/?feed=' . $feed_url . '&amp;id=1;' .
						'polling-uri2=http://notifications.buildmypinnedsite.com/?feed=' . $feed_url . '&amp;id=2;' .
						'polling-uri3=http://notifications.buildmypinnedsite.com/?feed=' . $feed_url . '&amp;id=3;' .
						'polling-uri4=http://notifications.buildmypinnedsite.com/?feed=' . $feed_url . '&amp;id=4;' .
						'polling-uri5=http://notifications.buildmypinnedsite.com/?feed=' . $feed_url . '&amp;id=5;';
		}
	
	// Get the polling interval, if not set, default to 6 hours.
	if( osintegration_getOption( 'notification_frequency', $options ) )
		{
		$polling_frequency = osintegration_getOption( 'notification_frequency', $options );
		}
	else
		{
		$polling_frequency = 720;
		}

	// If we're supporting Fav Icons, output the required code now.
	if( $options['enablefavicon'] && osintegration_getOption( 'img_square_16', $options ) ) 
		{
?>

<!-- For PNG Fav Icons -->	
<link rel="icon" type="image/png" href="<?php echo osintegration_getOption( 'img_square_196', $options ); ?>" sizes="196x196">
<link rel="icon" type="image/png" href="<?php echo osintegration_getOption( 'img_square_160', $options ); ?>" sizes="160x160">
<link rel="icon" type="image/png" href="<?php echo osintegration_getOption( 'img_square_96', $options ); ?>" sizes="96x96">
<link rel="icon" type="image/png" href="<?php echo osintegration_getOption( 'img_square_32', $options ); ?>" sizes="32x32">
<link rel="icon" type="image/png" href="<?php echo osintegration_getOption( 'img_square_16', $options ); ?>" sizes="16x16">

<?php
		}
		// End Fav Icon
		
	// If we're supporting Windows 8 live tiles, output the required code now.
	if( $options['enablelivetile'] && osintegration_getOption( 'img_square_310', $options ) ) 
		{
?>
<!-- For pinned live tiles in Windows 8.1 start screens -->	
<meta name="application-name" content="<?php echo osintegration_getOption( 'title', $options ); ?>" />
<meta name="msapplication-TileColor" content="<?php echo osintegration_getOption( 'background-color', $options ); ?>" />
<meta name="msapplication-notification" content="frequency=<?php echo $polling_frequency; ?>;polling-uri=<?php echo $polling_uri; ?>; cycle=1" />
<meta name="msapplication-square310x310logo" content="<?php echo osintegration_getOption( 'img_square_310', $options ); ?>" />
<meta name="msapplication-wide310x150logo" content="<?php echo osintegration_getOption( 'img_wide_310', $options ); ?>" />
<meta name="msapplication-square150x150logo" content="<?php echo osintegration_getOption( 'img_square_150', $options ); ?>" />
<meta name="msapplication-square70x70logo" content="<?php echo osintegration_getOption( 'img_square_70', $options ); ?>" />
<meta name="msapplication-TileImage" content="<?php echo osintegration_getOption( 'img_square_144', $options ); ?>" />

<?php 
		}	
	// End Windows 8.

	$user_agent = $_SERVER['HTTP_USER_AGENT'];
	
	// If we're supporting iOS, output the required code now.
	if( $options['enableios'] && osintegration_getOption( 'ios_icon_144', $options ) && ( stristr( $user_agent, 'iphone' ) !== FALSE || stristr( $user_agent, 'ipad' ) !== FALSE ) ) 
		{
		$statusbarstyle = 'black-translucent';
		if( $options['statusbarstyle'] == 1 ) { $statusbarstyle = 'black'; }
		if( $options['statusbarstyle'] == 2 ) { $statusbarstyle = 'default'; }
		
?>
<!-- For iOS home screen icons -->
<link href="<?php echo osintegration_getOption( 'ios_icon_57', $options ); ?>" rel="apple-touch-icon" sizes="57x57" />
<link href="<?php echo osintegration_getOption( 'ios_icon_114', $options ); ?>" rel="apple-touch-icon" sizes="114x114" />
<link href="<?php echo osintegration_getOption( 'ios_icon_72', $options ); ?>" rel="apple-touch-icon" sizes="72x72" />
<link href="<?php echo osintegration_getOption( 'ios_icon_144', $options ); ?>" rel="apple-touch-icon" sizes="144x144" />

<!-- Override the default page name for iOS -->
<meta name="apple-mobile-web-app-title" content="<?php echo osintegration_getOption( 'title', $options );?>">

<?php 

		// If we're supporting iOS web app, output the required code now.
		if( $options['enablewebapp'] ) 
			{
?>
<!-- For iOS Web App -->
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="<?php echo $statusbarstyle; ?>" />

<script type="text/javascript">
<?php 	
if( $options['enablelinkoverride'] ) 
	{?>
	// If we're in a webapp window, avoid leaving it every time a user clicks on a link.
	if (window.navigator.standalone == true) 
		{
		// Capture all clicks on the page.
		jQuery( document ).on("click",
			function( event )
				{
				// Find the root page location.
				var root = (location.protocol + '//' + location.host + location.pathname);
				
				// If whatever we clicked on has is a link to something on our own site, prevent the webapp window for switching to Safari.
				// Otherwise let it switch to the external site.
			    if( event.srcElement.href.indexOf( root ) == 0 )
					{
					// Stop the default behavior of the browser, which
					// is to change the URL of the page.
					event.preventDefault();

					// Manually change the location of the page to stay in
					// "Standalone" mode and change the URL at the same time.
					location.href = jQuery( event.target ).attr( "href" );
					}
				}
			);
		}

<?php
	} ?>
	(function(){
		var image 				= false;
		var land_image			= false;
		var ipad				= false;
		var userAgent 			= navigator.userAgent;
		var devicePixelRatio 	= window.devicePixelRatio ? window.devicePixelRatio : 0;

		if( userAgent.indexOf( "iPhone" ) > -1)
			{
			if( devicePixelRatio > 1 )
				{	
				image = "<?php echo osintegration_getOption( 'ios_web_app_920', $options ); ?>";
				
				if( window.screen.height == 568 )
					{
					image = "<?php echo osintegration_getOption( 'ios_web_app_1096', $options ); ?>";
					}
				}
			else
				{
				image = "<?php echo osintegration_getOption( 'ios_web_app_460', $options ); ?>";
				}
			}
		else if( userAgent.indexOf( "iPad" ) > -1 )
			{
			ipad = true;
			
			if( devicePixelRatio > 1 )
				{	
				image 		= "<?php echo osintegration_getOption( 'ios_web_app_2008', $options ); ?>";
				land_image 	= "<?php echo osintegration_getOption( 'ios_web_app_2048', $options ); ?>";
				}
			else
				{
				image 		= "<?php echo osintegration_getOption( 'ios_web_app_1004', $options ); ?>";
				land_image 	= "<?php echo osintegration_getOption( 'ios_web_app_1024', $options ); ?>";
				}
			}
			
		if( image )
			{
			var link 	= document.createElement( "link" );
			link.rel	= "apple-touch-startup-image";
			link.href	= image;

			if( ipad )
				{
				link.media	= "(orientation: portrait)";
				}

			document.getElementsByTagName( "head" )[0].appendChild( link );
			}
			
		if( land_image )
			{
			var link 	= document.createElement( "link" );
			link.rel	= "apple-touch-startup-image";
			link.href	= image;
			link.media	= "(orientation: landscape)";

			document.getElementsByTagName( "head" )[0].appendChild( link );
			}
	})();
</script>
	
<?php 
			}
			// End web apps.
		
		} 	
		// End iOS.
	
	}

// This function will take two images ($first and $second) and overlay $second on to $first at $x/$y co-ordinates.
// Needs GD or ImageMagic to function, will return FALSE if they don't exist.
function osintegration_composite_images( $first, $second, $x, $y )
	{
	if( !is_readable( $first ) || !is_readable( $second ) ) { return FALSE; }
	
	// First try using the GD library, then Image Magic, otherwise just fail.
	if( function_exists( 'imagecopy' ) )
		{
		// Load the two PNG's were going to composite together.
		$dest = imagecreatefrompng( $first );
		$src = imagecreatefrompng( $second );

		// Use imagecopy NOT imagecopymerge, otherwise the transparency won't work.
		imagecopy( $dest, $src, $x, $y, 0, 0, imagesx($src), imagesy($src) );
		
		// Save the merged image to a file.
		imagepng( $dest, $first );
		
		// Get rid of the working copies.
		imagedestroy( $dest );
		imagedestroy( $src );
		
		return $first;
		}
	else if( class_exists( 'Imagick' ) )
		{
		$dest = new Imagick();
		$src = new Imagick();
		
		$dest->readImage( $first );
		$src->readImage( $second );
		
		$dest->compositeImage( $src, Imagick::COMPOSITE_DEFAULT, $x, $y );
		
		$dest->flattenImages();
		
		$dest->writeImage();
		
		$dest->destroy();
		$src->destroy();
		
		return FALSE;
		}
	else
		{
		return FALSE;
		}
	}
	
// This function creates a new PNG file ($filename) of a given size ($x/$y) and fills it with a solid color ($fill = array('R'=>int, 'G'=>int, 'B'=>int)) if $fill is an array.  
// Needs GD or ImageMagic to function, will return FALSE if they don't exist.
function osintegration_new_png( $filename, $x, $y, $fill )
	{
	// First try using the GD library, then Image Magic, otherwise just fail.
	if( function_exists( 'imagecreatetruecolor' ) )
		{
		$color = osintegration_html2rgb( $fill );
			
		// We need to first create a new true color image, not just a standard pallet image, otherwise it won't work later when we try and overlay the logo on to the background.
		$img = imagecreatetruecolor( $x, $y );
		
		// Check to make sure we were passed an array, if not, don't bother filling in the background.
		if( is_array( $color ) ) 
			{
			// Get the selected background color to use.
			$newcolor = imagecolorallocate( $img, $color['R'], $color['G'], $color['B'] );

			// Fill the entire new image.
			imagefill( $img, 0, 0, $newcolor );
			}
		
		// Write the PNG out to a file.
		imagepng( $img, $filename );

		// Free up the color and the temporary image.
		imagecolordeallocate( $img, $newcolor );
		imagedestroy( $img );
		
		return $filename;
		}
	else if( class_exists( 'Imagick' ) )
		{
		$img = new Imagick();
		
		$img->newImage( $x, $y, $fill, 'PNG32' );
		$img->setFilename( $filename );
		$img->writeImage();
		
		$img->destory();
		
		return FALSE;
		}
	else
		{
		return FALSE;
		}
	}
	
// This function converts an HTML style color (#ffffff) to an array ('R'=>int, 'G'=>int, 'B'=>int).
function osintegration_html2rgb( $color )
	{
	// First, check to see if the value starts with a #, if so, get rid of it.
    if( $color[0] == '#' ) { $color = substr($color, 1); }

	// Two formats are supported ffffff and a short form fff.  Fail if the string is in neither format.
    if( strlen( $color ) == 6 )
		{
        list($r, $g, $b) = array($color[0].$color[1], $color[2].$color[3], $color[4].$color[5]);
		}
    elseif (strlen($color) == 3)
		{
        list($r, $g, $b) = array($color[0].$color[0], $color[1].$color[1], $color[2].$color[2]);
		}
    else
        return false;

	// Convert the hex values to decimal and return the result array.
    return array( 'R'=>hexdec($r), 'G'=>hexdec($g), 'B'=>hexdec($b) );
	}

// This function determines the local to place the logo on the iOS web app load screens.
// 		$x/$y is the size of the load screen.
// 		$logopostion is the location of the logo (see below).
//		$logox/$logoy is the size of the logo.
//
// Positions:
//		1 = top left
//		2 = top center
//		3 = top right
//		4 = middle left
//		5 = middle center
//		6 = middle right
//		7 = bottom left
//		8 = bottom center
//		9 = bottom right
//
function osintegration_get_logo_position( $x, $y, $logoposition, $logox, $logoy )
	{
	// Initalize our position.
	$posx = $posy = 0;
	
	switch( $logoposition )
		{
		case 1:		// top left
			$posx = 0;
			$posy = 0;
			
			break;
		case 2:		// top center
			$posx = ( $x - $logox ) / 2;
			$posy = 0;
			
			break;
		case 3:		// top right
			$posx = ( $x - $logox );
			$posy = 0;
			
			break;
		case 4:		// middle left
			$posx = 0;
			$posy = ( $y - $logoy ) / 2;
			
			break;
		case 5:		// middle center
			$posx = ( $x - $logox ) / 2;
			$posy = ( $y - $logoy ) / 2;
			
			break;
		case 6:		// middle right
			$posx = ( $x - $logox );
			$posy = ( $y - $logoy ) / 2;
			
			break;
		case 7:		// bottom left
			$posx = 0;
			$posy = ( $y - $logoy );
			
			break;
		case 8:		// bottom center
			$posx = ( $x - $logox ) / 2;
			$posy = ( $y - $logoy );
			
			break;
		case 9:		// bottom right
			$posx = ( $x - $logox );
			$posy = ( $y - $logoy );
			
			break;
		}
		
	return array( $posx, $posy );
	}
	
function osintegration_addxmlfeed()
	{
	add_feed( 'mslivetile', 'osintegration_outputxmlfeed' );
	}

function osintegration_outputxmlfeed()
	{
	$args = array(
					'numberposts' => 3,
					'offset' => 0,
					'category' => 0,
					'orderby' => 'post_date',
					'order' => 'DESC',
					'include' => null,
					'exclude' => null,
					'meta_key' => null,
					'meta_value' => null,
					'post_type' => 'post',
					'post_status' => 'publish',
					'suppress_filters' => true 
				);

    $recent_posts = wp_get_recent_posts( $args, ARRAY_A );
	
	echo '<tile>' . "\n";
	echo '	<visual lang="en-US" version="2">' . "\n";
	echo '		<binding template="TileSquare150x150Text04" branding="logo" fallback="TileSquareImage">' . "\n";
	echo '			<text id="1">' . $recent_posts[0]["post_title"] . '</text>' . "\n";
	echo '		</binding>' . "\n";
	echo '		<binding template="TileWide310x150Text05" branding="logo" fallback="TileWideText05">' . "\n";
	echo '			<text id="1">' . $recent_posts[0]["post_title"] . '</text>' . "\n";
	echo '			<text id="2">' . $recent_posts[1]["post_title"] . '</text>' . "\n";
	echo '			<text id="3">' . $recent_posts[2]["post_title"] . '</text>' . "\n";
	echo '		</binding>' . "\n";
	echo '		<binding template="TileSquare310x310TextList02" branding="logo">' . "\n";
	echo '			<text id="1">' . $recent_posts[0]["post_title"] . '</text>' . "\n";
	echo '			<text id="2">' . $recent_posts[1]["post_title"] . '</text>' . "\n";
	echo '			<text id="3">' . $recent_posts[2]["post_title"] . '</text>' . "\n";
	echo '		</binding>' . "\n";
	echo '	</visual>' . "\n";
	echo '</tile>' . "\n";

	exit();
	}
	
/* 
***********************
Plugin Code Starts Here
***********************
*/

// Set-up Action and Filter Hooks
if ( is_admin() )
	{
	// Runs osintegartion_add_defaults() each time the plugin is activated.
	register_activation_hook( __FILE__, 'osintegration_add_defaults' );
	// Runs osintegartion_delete_plugin_options() when the plugin uninstalled.
	register_uninstall_hook( __FILE__, 'osintegration_delete_plugin_options' );
	
	// Registers the settings with WordPress.
	add_action( 'admin_init', 'osintegration_init' );
	// Adds the options page to the settings menu.
	add_action( 'admin_menu', 'osintegration_add_options_page' );
	// Adds a link to our settings in the plugin list.
	add_filter( 'plugin_action_links', 'osintegration_plugin_action_links', 10, 2 );
	}

if( isset( $_GET['page']) && $_GET['page'] == 'os-integration/os-integration.php' ) 
	{
	// Load the JavaScript for the options page.
	add_action( 'admin_enqueue_scripts', 'osintegration_admin_scripts' );
	}

// Add the HTML to the header.
add_action( 'wp_head', 'osintegration_output' );
add_action( 'init', 'osintegration_addxmlfeed' );