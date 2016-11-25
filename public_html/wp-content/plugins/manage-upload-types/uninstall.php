<?php
// Be sure this is a valid uninstall call. 
if ( !defined( 'WP_UNINSTALL_PLUGIN' ) ) exit(); 

$jm_mut_options = array( 'jm_mut_mime_types' ); 

foreach ($jm_mut_options as $option) { 
	delete_option( $option ); 
}

?>
