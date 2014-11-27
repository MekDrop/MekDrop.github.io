<?php
/**
 * Common file of the module included on all pages of the module
 *
 * @copyright	The ImpressCMS Project
 * @license		http://www.gnu.org/licenses/old-licenses/gpl-2.0.html GNU General Public License (GPL)
 * @since		1.0
 * @author		Rodrigo P Lima aka TheRplima <therplima@impresscms.org>
 * @package		content
 * @version		$Id: common.php 20053 2010-08-28 16:30:42Z phoenyx $
 */

include_once "../../../include/cp_header.php";

define("GIVEAWAYS_DIRNAME", $modversion["dirname"] = basename(dirname(__DIR__)));
define("GIVEAWAYS_URL", ICMS_MODULES_URL . '/'. GIVEAWAYS_DIRNAME . '/');
define("GIVEAWAYS_ROOT_PATH", ICMS_MODULES_PATH . '/' . GIVEAWAYS_DIRNAME . '/');
define("GIVEAWAYS_IMAGES_URL", GIVEAWAYS_URL . 'images/');
define("GIVEAWAYS_ADMIN_URL", GIVEAWAYS_URL . 'admin/');
define('GIVEAWAYS_CORE_PATH', GIVEAWAYS_ROOT_PATH . 'class/core');

// Include the common language file of the module
icms_loadLanguageFile("giveaways", "common");
icms_loadLanguageFile("giveaways", "modinfo");

// Find if the user is admin of the module and make this info available throughout the module
define('GIVEAWAYS_ISADMIN', icms_userIsAdmin(GIVEAWAYS_DIRNAME));

// creating the icmsPersistableRegistry to make it available throughout the module
$icmsPersistableRegistry = icms_ipf_registry_Handler::getInstance();