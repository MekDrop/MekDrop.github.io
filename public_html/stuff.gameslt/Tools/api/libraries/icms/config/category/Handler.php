<?php
/**
 * Manage configuration categories
 *
 * @copyright	http://www.impresscms.org/ The ImpressCMS Project
 * @license		LICENSE.txt
 * @category	ICMS
 * @package		Config
 * @subpackage	Category
 * @author		Kazumi Ono (aka onokazo)
 * @version		SVN: $Id:Handler.php 19775 2010-07-11 18:54:25Z malanciault $
 */

defined('ICMS_ROOT_PATH') or die("ImpressCMS root path not defined");

/**
 * Configuration category handler class.
 *
 * This class is responsible for providing data access mechanisms to the data source
 * of configuration category class objects.
 *
 * @author  	Kazumi Ono <onokazu@xoops.org>
 * @category	ICMS
 * @package     Config
 * @subpackage  Category
 */
class icms_config_category_Handler extends icms_ipf_Handler {
    
        public function __construct(&$db) {
            parent::__construct($db, 'config_category', 'confcat_id', 'confcat_name', 'confcat_order', 'icms', 'configcategory', 'confcat_id');
        }
}

