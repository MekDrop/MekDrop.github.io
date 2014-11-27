<?php

function xyz_ihs_network_install($networkwide) {
	global $wpdb;

	if (function_exists('is_multisite') && is_multisite()) {
		// check if it is a network activation - if so, run the activation function for each blog id
		if ($networkwide) {
			$old_blog = $wpdb->blogid;
			// Get all blog ids
			$blogids = $wpdb->get_col("SELECT blog_id FROM $wpdb->blogs");
			foreach ($blogids as $blog_id) {
				switch_to_blog($blog_id);
				xyz_ihs_install();
			}
			switch_to_blog($old_blog);
			return;
		}
	}
	xyz_ihs_install();
}


function xyz_ihs_install(){
	
	global $wpdb;
	//global $current_user; get_currentuserinfo();
	
	
	if(get_option('xyz_credit_link') == "")
	{
			add_option("xyz_credit_link",0);
	}

	add_option('xyz_ihs_limit',20);
	$queryInsertHtml = "CREATE TABLE IF NOT EXISTS  ".$wpdb->prefix."xyz_ihs_short_code (
	  `id` int NOT NULL AUTO_INCREMENT,
		  `title` varchar(1000) COLLATE utf8_unicode_ci NOT NULL,
		  `content` longtext COLLATE utf8_unicode_ci NOT NULL,
		  `short_code` varchar(2000) COLLATE utf8_unicode_ci NOT NULL,
		  `status` int NOT NULL,
		  PRIMARY KEY (`id`)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci AUTO_INCREMENT=1";
	$wpdb->query($queryInsertHtml);
}

register_activation_hook( XYZ_INSERT_HTML_PLUGIN_FILE ,'xyz_ihs_network_install');





