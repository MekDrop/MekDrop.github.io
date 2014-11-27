<?php
/**
 * Template file object
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
 * Base class for all templates
 *
 * @author Kazumi Ono (AKA onokazu)
 * @category	ICMS
 * @package		View
 * @subpackage	Template
 **/
class icms_view_template_file_Object extends icms_ipf_Object {

	/**
	 * constructor
	 */
	public function __construct($handler, $data = array()) {		
		$this->initVar('tpl_id', self::DTYPE_INTEGER, null, false);
		$this->initVar('tpl_refid', self::DTYPE_INTEGER, 0, false);
		$this->initVar('tpl_tplset', self::DTYPE_DEP_OTHER, null, false);
		$this->initVar('tpl_file', self::DTYPE_DEP_TXTBOX, null, true, 100);
		$this->initVar('tpl_desc', self::DTYPE_DEP_TXTBOX, null, false, 100);
		$this->initVar('tpl_lastmodified', self::DTYPE_INTEGER, 0, false);
		$this->initVar('tpl_lastimported', self::DTYPE_INTEGER, 0, false);
		$this->initVar('tpl_module', self::DTYPE_DEP_OTHER, null, false);
		$this->initVar('tpl_type', self::DTYPE_DEP_OTHER, null, false);
		$this->initVar('tpl_source', self::DTYPE_DEP_SOURCE, null, false);
                
                parent::__construct($handler, $data);
	}

	/**
	 * Gets Template Source
	 */
	public function getSource()	{
		return $this->getVar('tpl_source');
	}

	/**
	 * Gets Last Modified timestamp
	 */
	public function getLastModified()	{
		return $this->getVar('tpl_lastmodified');
	}
}

