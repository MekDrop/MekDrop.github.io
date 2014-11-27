<?php
function xyz_ihs_plugin_query_vars($vars) {
	$vars[] = 'wp_ihs';
	return $vars;
}
add_filter('query_vars', 'xyz_ihs_plugin_query_vars');


function xyz_ihs_plugin_parse_request($wp) {
	/*confirmation*/
	if (array_key_exists('wp_ihs', $wp->query_vars) && $wp->query_vars['wp_ihs'] == 'editor_plugin_js') {
		require( dirname( __FILE__ ) . '/editor_plugin.js.php' );
		die;
	}
	
}
add_action('parse_request', 'xyz_ihs_plugin_parse_request');
