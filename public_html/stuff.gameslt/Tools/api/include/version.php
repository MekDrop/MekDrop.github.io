<?php
/**
 * Version information about ImpressCMS
 *
 * @copyright	The ImpressCMS Project http://www.impresscms.org/
 * @license		http://www.gnu.org/licenses/old-licenses/gpl-2.0.html GNU General Public License (GPL)
 * @package		core
 * @since		1.0
 * @author		marcan <marcan@impresscms.org>
 * @version		$Id: version.php 11745 2012-06-26 03:55:32Z skenow $
 */

define('ICMS_VERSION_NAME', 'ImpressCMS 2.0 Alpha 2');

// For backward compatibility with XOOPS
define('XOOPS_VERSION', ICMS_VERSION_NAME);

/**
 * Version Status
 * 1  = Alpha
 * 2  = Beta
 * 3  = RC
 * 10 = Final
 */

define('ICMS_VERSION_STATUS', 1);

/**
 * Build number
 *
 * Every release has its own build number, incrementable by 1 everytime we make a release
 */
// 2.0 alpha 2 = 62
define('ICMS_VERSION_BUILD', 62);

/**
 * Latest dbversion of the System Module
 *
 * When installing ImpressCMS, the System Module's dbversion needs to be the latest dbversion found
 * in system/include/update.php
 *
 * So, developers, everytime you add an upgrade block in system/include/update.php to upgrade something in the DB,
 * please also change this constant
 */
define('ICMS_SYSTEM_DBVERSION', 44);
