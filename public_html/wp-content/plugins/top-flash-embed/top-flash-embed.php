<?php
/*
Plugin Name: Top Flash Embed
Version: 0.3.4
Description: This a simple plugin for embedding flash into pages/posts through the editor. Upload SWF as attachments with <strong>Media Manager</strong> and the plugin will embed them in posts/pages. | <a href="http://profiles.wordpress.org/foo123" target="_blank"> Other plugins </a> | <a href="https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=DP8WED9XW9TAE" target="_blank"> Donate if you like it </a>
Author: Nikos M.
Author URI: http://nikos-web-development.netai.net
Plugin URI: http://nikos-web-development.netai.net
License: GPL
*/

define('TOPFLASH_PLUGIN_VERSION', '0.3.4');
define('TOPFLASH_PLUGIN_PATH', dirname(__FILE__));
define('TOPFLASH_PLUGIN_FOLDER', basename(TOPFLASH_PLUGIN_PATH));
define('TOPFLASH_PLUGIN_URL',plugins_url().'/'.TOPFLASH_PLUGIN_FOLDER);
define('TOPFLASH_PLUGIN', plugin_basename(__FILE__));

/*function __log($what)
{
    file_put_contents(dirname(__FILE__).'/debug.log', print_r($what, true), FILE_APPEND);
}*/

require_once(TOPFLASH_PLUGIN_PATH.'/classes/TopFlashEmbed.php');
TopFlashEmbed::init();
