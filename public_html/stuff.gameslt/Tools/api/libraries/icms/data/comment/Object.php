<?php
/**
 * Core class for managing comments
 *
 * @category	ICMS
 * @package		Data
 * @subpackage	Comment
 * @author	    Kazumi Ono	<onokazu@xoops.org>
 * @copyright 	http://www.impresscms.org/ The ImpressCMS Project
 * @license		LICENSE.txt
 * @version		SVN: $Id:Object.php 19775 2010-07-11 18:54:25Z malanciault $
 */

defined('ICMS_ROOT_PATH') or die("ImpressCMS root path not defined");

/**
 * A Comment
 *
 * @category	ICMS
 * @package		Data
 * @subpackage	Comment
 *
 */
class icms_data_comment_Object extends icms_ipf_Object {

	/**
	 * Constructor
	 **/
	public function __construct(&$handler, $data = array()) {
		parent::__construct($handler, $data);
		$this->initVar('com_id', self::DTYPE_INTEGER, null, false);
		$this->initVar('com_pid', self::DTYPE_INTEGER, 0, false);
		$this->initVar('com_modid', self::DTYPE_INTEGER, null, false);
		$this->initVar('com_icon', self::DTYPE_DEP_OTHER, null, false);
		$this->initVar('com_title', self::DTYPE_DEP_TXTBOX, null, true, 255, true);
		$this->initVar('com_text', self::DTYPE_STRING, null, true, null, true);
		$this->initVar('com_created', self::DTYPE_INTEGER, 0, false);
		$this->initVar('com_modified', self::DTYPE_INTEGER, 0, false);
		$this->initVar('com_uid', self::DTYPE_INTEGER, 0, true);
		$this->initVar('com_ip', self::DTYPE_DEP_OTHER, null, false);
		$this->initVar('com_sig', self::DTYPE_INTEGER, 0, false);
		$this->initVar('com_itemid', self::DTYPE_INTEGER, 0, false);
		$this->initVar('com_rootid', self::DTYPE_INTEGER, 0, false);
		$this->initVar('com_status', self::DTYPE_INTEGER, 0, false);
		$this->initVar('com_exparams', self::DTYPE_DEP_OTHER, null, false, 255);
		$this->initVar('dohtml', self::DTYPE_INTEGER, 0, false);
		$this->initVar('dosmiley', self::DTYPE_INTEGER, 0, false);
		$this->initVar('doxcode', self::DTYPE_INTEGER, 0, false);
		$this->initVar('doimage', self::DTYPE_INTEGER, 0, false);
		$this->initVar('dobr', self::DTYPE_INTEGER, 0, false);
	}

	/**
	 * Is this comment on the root level?
	 *
	 * @return  bool
	 **/
	public function isRoot() {
		return ($this->getVar('com_id') == $this->getVar('com_rootid'));
	}
}
