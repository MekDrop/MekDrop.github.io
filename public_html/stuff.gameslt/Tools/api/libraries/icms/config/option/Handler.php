<?php
/**
 * Manage configuration options
 *
 * @copyright	http://www.impresscms.org/ The ImpressCMS Project
 * @license		LICENSE.txt
 * @category	ICMS
 * @package		Config
 * @subpackage	Option
 * @author		Kazumi Ono (aka onokazo)
 * @version		SVN: $Id:Handler.php 19775 2010-07-11 18:54:25Z malanciault $
 */

defined('ICMS_ROOT_PATH') or die("ImpressCMS root path not defined");

/**
 * Configuration option handler class.
 * This class is responsible for providing data access mechanisms to the data source
 * of configuration option class objects.
 *
 * @author  Kazumi Ono <onokazu@xoops.org>
 *
 * @category	ICMS
 * @package     Config
 * @subpackage  Option
 */
class icms_config_option_Handler extends icms_ipf_Handler {
    
        public function __construct(&$db) {
            parent::__construct($db, 'config_option', 'confop_id', 'confop_name', 'confop_value', 'icms', 'configoption', 'confop_id');
        }

}

