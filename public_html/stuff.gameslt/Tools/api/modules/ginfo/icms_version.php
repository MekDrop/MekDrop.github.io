<?php
/**
* contact version infomation
*
* This file holds the configuration information of this module
*
* @copyright	
* @license		http://www.gnu.org/licenses/old-licenses/gpl-2.0.html GNU General Public License (GPL)
* @since		1.0
* @author		 <>
* @package		contact
* @version		$Id$
*/

if (!defined("ICMS_ROOT_PATH")) die("ICMS root path not defined");

/**  General Information  */
$modversion = array(
  'name'=> _MI_GINFO_MD_NAME,
  'version'=> 0.1,
  'description'=> _MI_GINFO_MD_NAME_DESC,
  'author'=> "",
  'credits'=> "",
  'help'=> "",
  'license'=> "GNU General Public License (GPL)",
  'official'=> 0,
  'dirname'=> basename( dirname( __FILE__ ) ),

/**  Images information  */
  'iconsmall'=> "images/icon_small.png",
  'iconbig'=> "images/icon_big.png",
  'image'=> "images/icon_big.png", /* for backward compatibility */

/**  Development information */
  'status_version'=> "1.0",
  'status'=> "Beta",
  'date'=> "Unreleased",
  'author_word'=> "",

/** Contributors */
  'developer_website_url' => "",
  'developer_website_name' => "",
  'developer_email' => "");

$modversion['warning'] = _CO_ICMS_WARNING_BETA;

/** Administrative information */
$modversion['hasAdmin'] = 0;

/** Menu information */
$modversion['hasMain'] = 1;

/** Templates information */

$modversion['templates'][]= array(
  'file' => 'ginfo_waiting_upcomming_games.html',
  'description' => 'waiting upcomming games template');