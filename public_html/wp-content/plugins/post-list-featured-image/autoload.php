<?php
if ( !defined( 'ABSPATH' ) || preg_match(
		'#' . basename( __FILE__ ) . '#',
		$_SERVER['PHP_SELF']
	)
) {
	die( "You are not allowed to call this page directly." );
}

class Post_List_Featured_Image_Loader {

	public static function init() {
		spl_autoload_register( array( 'Post_List_Featured_Image_Loader', 'autoload' ) );

		/*register_activation_hook( __FILE__, array( Admin::instance(), 'activation_actions' ) );
		register_deactivation_hook( __FILE__, array( Admin::instance(), 'deactivation_actions' ) );*/

		add_action( 'plugins_loaded', array( \PostListFeaturedImage\Controller\Admin::instance(), 'init' ) );
		add_action( 'plugins_loaded', array( \PostListFeaturedImage\Controller\Front::instance(), 'init' ) );
	}

	public static function autoload( $class ) {
		if ( 'PostListFeaturedImage' !== mb_substr( $class, 0, 21 ) ) {
			return;
		}

		$file = PLFI_PLUGIN_DIR_PATH . str_replace( '\\', '/', $class ) . '.php';
		if ( file_exists( $file ) ) {
			require_once( $file );
		} else {
			$error = new WP_Error( 'class_not_found', 'Class ' . $class . ' not found!<br>' . $file );
			echo $error->get_error_message( 'class_not_found' );
		}
	}
}

Post_List_Featured_Image_Loader::init();
