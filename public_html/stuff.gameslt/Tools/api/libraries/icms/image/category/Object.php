<?php
/**
 * Image categories
 *
 * @copyright	http://www.impresscms.org/ The ImpressCMS Project
 * @license		LICENSE.txt
 * @category	ICMS
 * @package		Image
 * @subpackage	Category
 * @version		SVN: $Id: Object.php 10539 2010-08-25 01:58:41Z skenow $
 */

defined('ICMS_ROOT_PATH') or die("ImpressCMS root path not defined");

/**
 * An image category
 *
 * These categories are managed through a {@link icms_image_category_Handler} object

 * @category	ICMS
 * @package     Image
 * @subpackage	Category
 * @author	    Kazumi Ono	<onokazu@xoops.org>
 */
class icms_image_category_Object extends icms_core_Object {
	private $_imageCount;

	/**
	 * Constructor
	 *
	 */
	public function __construct() {
		parent::__construct();
		$this->initVar('imgcat_id', self::DTYPE_INTEGER, null, false);
		$this->initVar('imgcat_pid', self::DTYPE_INTEGER, null, false);
		$this->initVar('imgcat_name', self::DTYPE_DEP_TXTBOX, null, true, 100);
		$this->initVar('imgcat_foldername', self::DTYPE_DEP_TXTBOX, null, true, 100);
		$this->initVar('imgcat_display', self::DTYPE_INTEGER, 1, false);
		$this->initVar('imgcat_weight', self::DTYPE_INTEGER, 0, false);
		$this->initVar('imgcat_maxsize', self::DTYPE_INTEGER, 0, false);
		$this->initVar('imgcat_maxwidth', self::DTYPE_INTEGER, 0, false);
		$this->initVar('imgcat_maxheight', self::DTYPE_INTEGER, 0, false);
		$this->initVar('imgcat_type', self::DTYPE_DEP_OTHER, null, false);
		$this->initVar('imgcat_storetype', self::DTYPE_DEP_OTHER, null, false);
	}

	/**
	 * Set count of images in a category
	 * @param	int $value Value
	 */
	public function setImageCount($value) {
		$this->_imageCount = (int) $value;
	}

	/**
	 * Gets count of images in a category
	 * @return	int _imageCount number of images
	 */
	public function getImageCount() {
		return $this->_imageCount;
	}
}

