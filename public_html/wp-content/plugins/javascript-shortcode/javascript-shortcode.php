<?php
/*
Plugin Name: JavaScript Shortcode
Plugin URI: http://www.komprihensiv.com/creating-a-wordpress-plugin-to-load-javascript-with-a-shortcode/
Description: Creates a shortcode to add JavaScript on any page
Version: 1.0
Author: Kyle Gentile
Author URI: http://www.komprihensiv.com/
*/

class Javascript_shortcode {
    
    private $handles = array();
    
    function __construct() {
        add_shortcode( 'javascript', array(&$this, 'js_shortcode') );
    }
    
    function js_shortcode( $atts = array() ){
        extract(shortcode_atts(array(
                'handle'      => '',
                'src'         => '',
                'deps'        => array(),
                'ver'         => ''
        ), $atts));

        global $wp_scripts;

        if( key_exists($handle, $wp_scripts->registered) ){
            $this->handles[] = $handle;
        }else{
            if( is_string($deps) ){
                $deps = explode( ",", $deps );
                //remove any whitespace if there is any, you never know 
                foreach($deps as $key => $dep){
                    $deps[$key] = trim( $dep );
                }
            }

            //register the script 
            wp_register_script( $handle, $src, $deps, $ver, TRUE );
            //add the script to the array of handles 
            $this->handles[] = $handle;
        }

        add_action( 'wp_print_footer_scripts', array($this, 'call_js') );
    }
        
    function call_js(){
        wp_print_scripts( $this->handles );
    }
}

$Javascript_shortcode = new Javascript_shortcode;