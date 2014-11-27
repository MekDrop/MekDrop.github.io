<?php
/**
 * Manage template sets
 *
 * @copyright	http://www.impresscms.org/ The ImpressCMS Project
 * @license		LICENSE.txt
 * @category	ICMS
 * @package		View
 * @subpackage	Template
 * @version		SVN: $Id$
 */

defined('ICMS_ROOT_PATH') or die("ImpressCMS root path not defined");

/**
 * Base class for all template sets
 *
 * @author		Kazumi Ono (AKA onokazu)
 * @category	ICMS
 * @package		View
 * @subpackage	Template
 **/
class icms_view_template_set_Object extends icms_ipf_Object {

	/**
	 * constructor
	 */
	public function __construct(&$handler, $data = array()) {
		$this->initVar('tplset_id', self::DTYPE_INTEGER, null, false);
		$this->initVar('tplset_name', self::DTYPE_DEP_OTHER, null, false);
		$this->initVar('tplset_desc', self::DTYPE_DEP_TXTBOX, null, false, 255);
		$this->initVar('tplset_credits', self::DTYPE_STRING, null, false);
		$this->initVar('tplset_created', self::DTYPE_INTEGER, 0, false);
                
                parent::__construct($handler, $data);
	}
}

