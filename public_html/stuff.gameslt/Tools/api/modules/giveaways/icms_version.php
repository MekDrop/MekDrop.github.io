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
 * @version		$Id: icms_version.php 22687 2011-09-18 10:01:52Z phoenyx $
 */
defined("ICMS_ROOT_PATH") or die("ICMS root path not defined");
$modversion = array(
    /**  General Information  */
    'name' => _MI_GIVEAWAYS_MD_NAME,
    'version' => 0.1,
    'description' => _MI_GIVEAWAYS_MD_DESC,
    'author' => "Raimondas",
    'credits' => "MekDrop",
    'help' => "",
    'license' => "GNU General Public License v3 (GPLv3)",
    'official' => 0,
    'dirname' => basename(dirname(__FILE__)),
    'modname' => 'giveaways',
    /**  Images information  */
    'iconsmall' => "images/icon_small.png",
    'iconbig' => "images/icon_big.png",
    'image' => "images/icon_big.png", /* for backward compatibility */

    /**  Development information */
    'status_version' => "Beta",
    'status' => "Beta",
    'date' => "18 Sep 2013",
    'author_word' => "",
    'warning' => _CO_ICMS_WARNING_FINAL,
    /** Contributors */
    'developer_website_url' => "http://www.impresscms.org",
    'developer_website_name' => "The ImpressCMS Project",
    'developer_email' => "contact@impresscms.org",
    /** Administrative information */
    'hasAdmin' => 1,
    'adminindex' => "admin/index.php",
    'adminmenu' => "include/admin_menu.php",
    /** Search information */
    'hasSearch' => 0,
    /** Comments information */
    'hasComments' => 0,
    /** Menu information */
    'hasMain' => 0,    
    /** Database information */
    'object_items' => array(
        'type',
        'code',
    ),
    'templates' => array(
        array('file' => 'giveaways_admin_code.html', 'description' => 'Giveaways codes admin'),
        array('file' => 'giveaways_admin_type.html', 'description' => 'Giveaways types admin'),
    )
);

$modversion["tables"] = icms_getTablesArray($modversion['dirname'], $modversion['object_items']);