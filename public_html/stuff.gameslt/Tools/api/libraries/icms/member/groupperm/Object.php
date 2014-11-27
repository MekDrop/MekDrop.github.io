<?php
/**
 * Manage groups and memberships
 *
 * @copyright	The ImpressCMS Project <http://www.impresscms.org/>
 * @license		LICENSE.txt
 *
 * @author		Kazumi Ono (aka onokazo)
 * @author		Gustavo Alejandro Pilla (aka nekro) <nekro@impresscms.org> <gpilla@nube.com.ar>
 * @category	ICMS
 * @package		Member
 * @subpackage	Groupperm
 * @version		SVN: $Id$
 */

defined('ICMS_ROOT_PATH') or die("ImpressCMS root path not defined");

/**
 * A group permission
 *
 * These permissions are managed through a {@link icms_member_groupperm_Handler} object
 * @category	ICMS
 * @package     Member
 * @subpackage	GroupPermission
 * @author	    Kazumi Ono	<onokazu@xoops.org>
 */
class icms_member_groupperm_Object extends icms_ipf_Object {
	/**
	 * Constructor
	 *
	 */
	function __construct(&$handler, $data = array()) {
		
		$this->initVar('gperm_id', self::DTYPE_INTEGER, null, false);
		$this->initVar('gperm_groupid', self::DTYPE_INTEGER, null, false);
		$this->initVar('gperm_itemid', self::DTYPE_INTEGER, null, false);
		$this->initVar('gperm_modid', self::DTYPE_INTEGER, 0, false);
		$this->initVar('gperm_name', self::DTYPE_DEP_OTHER, null, false);
                
                parent::__construct($handler, $data);
	}
}

