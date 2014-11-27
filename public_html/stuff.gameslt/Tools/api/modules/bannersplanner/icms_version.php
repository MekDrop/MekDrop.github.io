<?php
/**
* Content version infomation
*
* This file holds the configuration information of this module
*
* @copyright	The ImpressCMS Project
* @license		http://www.gnu.org/licenses/old-licenses/gpl-2.0.html GNU General Public License (GPL)
* @since		1.0
* @author		Rodrigo P Lima aka TheRplima <therplima@impresscms.org>
* @package		content
* @version		$Id$
*/

if (!defined("ICMS_ROOT_PATH")) die("ICMS root path not defined");

/**  General Information  */
$modversion = array(
  'name'=> _MI_BANNER_PLANNER_MD_NAME,
  'version'=> 0.1,
  'description'=> _MI_BANNER_PLANNER_MD_DESC,
  'author'=> "Raimondas Rimkevičius aka Mek",
  'credits'=> "",
  'help'=> "",
  'license'=> "GNU General Public License (GPL)",
  'official'=> 0,
  'dirname'=> basename( dirname( __FILE__ ) ),

/**  Images information  */
  'iconsmall'=> "images/icon_small.apng",
  'iconbig'=> "images/icon_big.apng",
  'image'=> "images/icon_big.apng", /* for backward compatibility */

/**  Development information */
  'status_version'=> "Final",
  'status'=> "Final",
  'date'=> "",
  'author_word'=> "",

/** Contributors */
  'developer_website_url' => "http://mekdrop.name",
  'developer_website_name' => "",
  'developer_email' => "impresscms@mekdrop.name");

//$modversion['people']['testers'][] = "";
//$modversion['people']['translators'][] = "";
//$modversion['people']['documenters'][] = "";
//$modversion['people']['other'][] = "";

/** Manual */

$modversion['warning'] = _CO_ICMS_WARNING_BETA;

/** Administrative information */
$modversion['hasAdmin'] = 0;
//$modversion['adminindex'] = "admin/index.php";
//$modversion['adminmenu'] = "admin/menu.php";

/** Database information */
$modversion['object_items'][1] = 'banner';

$modversion["tables"] = icms_getTablesArray($modversion['dirname'], $modversion['object_items']);

/** Install and update informations */
//$modversion['onInstall'] = "include/onupdate.inc.php";
//$modversion['onUpdate'] = "include/onupdate.inc.php";

/** Search information */
/*$modversion['hasSearch'] = 1;
$modversion['search'] = array (
  'file' => "include/search.inc.php",
  'func' => "content_search");*/

/** Menu information */
$modversion['hasMain'] = 1;

/** Templates information */
$modversion['templates'][1] = array(
  'file' => 'banner_planner_list.html',
  'description' => 'List planed banners');

$modversion['templates'][] = array( 
  'file' => 'banner_planner_add.html',
  'description' => 'Add banner planer');

$modversion['autotasks'][] = array(
	'enabled' => true,
	'name' => _MI_BANNER_PLANNER_UPLOAD_BANNER,
	'code' => 'atasks/upload-banner.php',
	'interval' => 84000
);