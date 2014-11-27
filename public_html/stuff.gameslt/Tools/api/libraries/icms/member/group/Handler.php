<?php
/**
 * Manage groups
 *
 * @copyright	http://www.impresscms.org/ The ImpressCMS Project
 * @license		LICENSE.txt
 * @category	ICMS
 * @package		Member
 * @subpackage	Group
 * @author		Kazumi Ono (aka onokazo)
 * @version		SVN: $Id:Handler.php 19775 2010-07-11 18:54:25Z malanciault $
 */

if (!defined('ICMS_ROOT_PATH')) die("ImpressCMS root path not defined");

/**
 * Group handler class.
 * This class is responsible for providing data access mechanisms to the data source
 * of group class objects.
 *
 * @author Kazumi Ono <onokazu@xoops.org>
 * @category	ICMS
 * @package		Member
 * @subpackage	Group
 */
class icms_member_group_Handler extends icms_ipf_Handler {
    
        public function __construct(&$db) {
            parent::__construct($db, 'member_group', 'groupid', 'name', 'description', 'icms', 'groups', 'groupid');
        }
}
