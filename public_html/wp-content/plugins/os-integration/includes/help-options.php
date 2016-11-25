<?php

	if( !is_admin() )
		wp_die(__('Access denied!'));
	
	$help_screen = WP_Screen::get();

	$help_screen->add_help_tab(
		array(
			'title'    => 	__('General'),
			'id'       => 	'general_tab',
			'content'  => 	'<p>' . __('<b>Square Image</b>: This is a square image file to use to generate the various display items.  This image MUST be GREATER than 450x450 px, if it is not then some items will not display correctly or at all.') . '</p>' .
							'<p>' . __('<b>Wide Image</b>: This is a wide image file to use to generate display items in a wide screen format.  If this is left blank the square image above will be used.  This image MUST be GREATER than 450x218 px, if it is not then some items will not display correctly or at all.') . '</p>' .
							'<p>' . __('<b>Background Color</b>: This is the background color to use in icons and live tiles.') . '</p>' .
							'<p>' . __('<b>SIte Title</b>: This will be the text displayed on your Live Title or iOS app icon, by default this will be your blog title.') . '</p>'
			,
			'callback' => 	false
		)
	);
	
	$help_screen->add_help_tab(
		array(
			'title'    => 	__('Fav Icon'),
			'id'       => 	'fav_icon_tab',
			'content'  => 	'<p>' . __('<b>Enable Fav Icon</b>: Enable the generate and usage of the Fav Icon.  This will both generate an .ico file as well as png files with appropriate <link> references in the html header.') . '</p>' .
							'<p>' . __('<b>Fav Icon Path</b>: This is the location to store the .ico file, you must have write access to this location.') . '</p>' .
							'<p>' . __('<b>Include 64px Image</b>: When generating the .ico file, this will include a 64x64px image as well.') . '</p>' .
							'<p>' . __('<b>Include 96px Image</b>: When generating the .ico file, this will include a 96x96px image as well.') . '</p>'
			,
			'callback' => 	false
		)
	);

	$help_screen->add_help_tab(
		array(
			'title'    => 	__('Windows'),
			'id'       => 	'windows_tab',
			'content'  => 	'<p>' . __('<b>Enable Live Tile</b>: This will enable Windows Live Tile support.  Multiple sizes and Live Tile updates are available via <a href="http://buildmypinnedsite.com" target=_blank>buildmypinnedsite.com</a>.') . '</p>' .
							'<p>' . __('<b>RSS Feed URL</b>: The RSS feed URL to pass to buildmypinnedsite.com.') . '</p>' .
							'<p>' . __('<b>Update Interval</b>: This is how often the Windows Live Tile will update it\'s data.  If you update your site often, set this lower.  If you update your site less often, set it higher.') . '</p>' .
							'<p>' . __('<b>Local XML File</b>: By default, buildmypinnedsite.com is used to proxy your XML updates for Live Tiles.  If you wish to use your own site to host the updates you can do so.') . '</p>' .
							'<p>' . __('<b>Enabled Local XML</b>: Enable the local XML feed support.') . '</p>' .
							'<p>' . __('<b>Include featured image</b>: Include the featured image from the posts in the XML feed.') . '</p>' .
							'<p>' . __('<b>Search body for featured image</b>: If your theme doesn\'t support a featured image or you don\'t use them, OS Integration can search the body of your post for the first image and use it instead.') . '</p>' .
							'<p>' . __('<b>Use square image if no image found</b>: If no image is found, this option will instead use your square image for the post.  Note if this is not enabled and featured images are enabled, a default WordPress logo will appear.') . '</p>'
			,
			'callback' => 	false
		)
	);

	$help_screen->add_help_tab(
		array(
			'title'    => 	__('iOS'),
			'id'       => 	'ios_tab',
			'content'  => 	'<p>' . __('<b>Enable iOS</b>: This will enable iOS Icon support.  Both standard and HD icons are supported.') . '</p>' .
							'<p>' . __('<b>Enable Web App Support</b>: This will enable Web App suppport on iOS for your site including load screens.  Note that Web App support is limited to the first page you load, when a user selects a link that takes them to another page it will open in Safari and leave the Web App.') . '</p>' .
							'<p>' . __('<b>Enable Link Override</b>: This will enable a JavaScript function that will keep the user in the Web App when they click on a link to another page on your site.  If the user clicks on a link to an external site it will take them to Safari.  NOTE:  This code can have a performance impact on your site responding to clicks and some advanced controls may not work with it.  You should test this option before deploying it to a production site.') . '</p>' .
							'<p>' . __('<b>Use wide image for web app loading screen</b>: By default the square image is used on the loading screen for the Web App, this option will instead use the wide image.') . '</p>' .
							'<p>' . __('<b>Web App Logo Location</b>: The location to place the image on the loading screen.') . '</p>' .
							'<p>' . __('<b>Web App Status Bar Style</b>: the iOS status bar can be set to be the default, black or transparent.') . '</p>'
			,
			'callback' => 	false
		)
	);

		$help_screen->add_help_tab(
		array(
			'title'    => 	__('Advanced'),
			'id'       => 	'advanced_tab',
			'content'  => 	'<p>' . __('<b>Allow WordPress Site Icon</b>: OS Integration will override WordPress\'s Site Icon settings and strip the meta information from the page headers. If you wish to use WordPress\'s Site Icons, you can override this behaviour by checking this option.  Note this option will only appear if you have WordPress 4.3 or later installed.') . '</p>' .
							'<p>' . __('<b>Force rebuild</b>: By default, images and other icons are only regenerated when new images are selected, if you have changed the background color or other options and want to regenerate the images, select this option and save the settings.') . '</p>' .
							'<p>' . __('<b>Override individual image files to be used</b>: All images are auto generated by default, but if you want to select your own custom images to use instead you can enter a URL under each one here.') . '</p>'
			,
			'callback' => 	false
		)
	);

?>