<?php
/**
 * Manage configuration items
 *
 * @copyright    http://www.xoops.org/ The XOOPS Project
 * @copyright    XOOPS_copyrights.txt
 * @copyright    http://www.impresscms.org/ The ImpressCMS Project
 * @license      LICENSE.txt
 * @package      core
 * @subpackage   config
 * @since        XOOPS
 * @author       Kazumi Ono (aka onokazo)
 * @author       http://www.xoops.org The XOOPS Project
 * @version      $Id:Handler.php 19775 2010-07-11 18:54:25Z malanciault $
 */

if (!defined('ICMS_ROOT_PATH')) die("ImpressCMS root path not defined");

/**#@+
 * Config type
 */
define('ICMS_CONF', 1);
define('ICMS_CONF_USER', 2);
define('ICMS_CONF_METAFOOTER', 3);
define('ICMS_CONF_CENSOR', 4);
define('ICMS_CONF_SEARCH', 5);
define('ICMS_CONF_MAILER', 6);
define('ICMS_CONF_AUTH', 7);
define('ICMS_CONF_MULILANGUAGE', 8);
define('ICMS_CONF_CONTENT', 9);
define('ICMS_CONF_PERSONA', 10);
define('ICMS_CONF_CAPTCHA', 11);
define('ICMS_CONF_PLUGINS', 12);
define('ICMS_CONF_AUTOTASKS', 13);
define('ICMS_CONF_PURIFIER', 14);
/**#@-*/

/**
 * Configuration handler class.
 *
 * This class is responsible for providing data access mechanisms to the data source
 * of configuration class objects.
 *
 * @author       Kazumi Ono <onokazu@xoops.org>
 * @category	ICMS
 * @package     Config
 * @subpackage  Item
 */
class icms_config_Item_Handler extends icms_ipf_Handler {

	public function __construct(&$db) {
            parent::__construct($db, 'config_item', 'conf_id', 'conf_name', 'conf_value', 'icms', 'config', 'conf_id');
        }
}

