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
 * @version		SVN: $Id$
 */

defined('ICMS_ROOT_PATH') or die("ImpressCMS root path not defined");

/**
 * a group of users
 *
 * @author		Kazumi Ono <onokazu@xoops.org>
 * @category	ICMS
 * @package		Member
 * @subpackage	Group
 */
class icms_member_group_Object extends icms_ipf_Object {
	/**
	 * constructor
	 */
	public function __construct(&$handler, $data = array()) {		
		$this->initVar('groupid', self::DTYPE_INTEGER, null, false);
		$this->initVar('name', self::DTYPE_DEP_TXTBOX, null, true, 100);
		$this->initVar('description', self::DTYPE_STRING, null, false);
		$this->initVar('group_type', self::DTYPE_DEP_OTHER, null, false);
                
                parent::__construct($handler, $data);
	}
}
