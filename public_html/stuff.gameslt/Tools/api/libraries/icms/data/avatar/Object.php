<?php
/**
 * Manage avatars for users
 *
 * @copyright	http://www.impresscms.org/ The ImpressCMS Project
 * @license		LICENSE.txt
 * @category	ICMS
 * @package		Data
 * @subpackage	Avatar
 * @author		Kazumi Ono (aka onokazo)
 * @version		SVN: $Id:Object.php 19775 2010-07-11 18:54:25Z malanciault $
 */

defined('ICMS_ROOT_PATH') or die("ImpressCMS root path not defined");

/**
 * Avatar class
 * @category	ICMS
 * @package		Data
 * @subpackage	Avatar
 *
 */
class icms_data_avatar_Object extends icms_ipf_Object {
	/** @var integer */
	private $_userCount;

	/**
	 * Constructor for avatar class, initializing all the properties of the class object
	 *
	 */
	public function __construct(&$handler, $data = array()) {		
		$this->initVar('avatar_id', self::DTYPE_INTEGER, null, false);
		$this->initVar('avatar_file', self::DTYPE_DEP_OTHER, null, false, 30);
		$this->initVar('avatar_name', self::DTYPE_DEP_TXTBOX, null, true, 100);
		$this->initVar('avatar_mimetype', self::DTYPE_DEP_OTHER, null, false);
		$this->initVar('avatar_created', self::DTYPE_INTEGER, null, false);
		$this->initVar('avatar_display', self::DTYPE_INTEGER, 1, false);
		$this->initVar('avatar_weight', self::DTYPE_INTEGER, 0, false);
		$this->initVar('avatar_type', self::DTYPE_DEP_OTHER, 0, false);
                
                parent::__construct($handler, $data);
	}

	/**
	 * Sets the value for the number of users
	 * @param integer $value
	 *
	 */
	public function setUserCount($value) {
		$this->_userCount = (int) $value;
	}

	/**
	 * Gets the value for the number of users
	 * @return integer
	 */
	public function getUserCount() {
		return $this->_userCount;
	}
}

