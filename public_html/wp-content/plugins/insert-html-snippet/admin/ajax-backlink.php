<?php
add_action('wp_ajax_ajax_backlink', 'xyz_ihs_ajax_backlink');
function xyz_ihs_ajax_backlink() {

	global $wpdb;
	
	if($_POST){
		update_option('xyz_credit_link','ihs');
		
	}
}


?>