<?php
/**
 * Manage images
 *
 * @copyright	http://www.impresscms.org/ The ImpressCMS Project
 * @license		LICENSE.txt
 * @category	ICMS
 * @package		Image
 * @version		SVN: $Id: Object.php 10326 2010-07-11 18:54:25Z malanciault $
 */

defined('ICMS_ROOT_PATH') or die('ImpressCMS root path not defined');

/**
 * An Image Object
 *
 * @category	ICMS
 * @package		Image
 * @author		Kazumi Ono 	<onokazu@xoops.org>
 */
class icms_image_Object extends icms_core_Object {
	/**
	 * Info of Image file (width, height, bits, mimetype)
	 *
	 * @var array
	 */
	public $image_info = array();

	/**
	 * Constructor
	 **/
	public function __construct() {
		parent::__construct();
		$this->initVar('image_id', self::DTYPE_INTEGER, null, false);
		$this->initVar('image_name', self::DTYPE_DEP_OTHER, null, false, 30);
		$this->initVar('image_nicename', self::DTYPE_DEP_TXTBOX, null, true, 100);
		$this->initVar('image_mimetype', self::DTYPE_DEP_OTHER, null, false);
		$this->initVar('image_created', self::DTYPE_INTEGER, null, false);
		$this->initVar('image_display', self::DTYPE_INTEGER, 1, false);
		$this->initVar('image_weight', self::DTYPE_INTEGER, 0, false);
		$this->initVar('image_body', self::DTYPE_DEP_SOURCE, null, true);
		$this->initVar('imgcat_id', self::DTYPE_INTEGER, 0, false);
	}

	/**
	 * Returns information
	 *
	 * @param string  $path  the path to search through
	 * @param string  $type  the path type, url or other
	 * @param bool  $ret  return the information or keep it stored
	 *
	 * @return array  the array of image information
	 */
	public function getInfo($path, $type = 'url', $ret = false) {
		$path = (substr($path,-1) != '/') ? $path . '/' : $path;
		if ($type == 'url') {
			$img = $path . $this->getVar('image_name');
		} else {
			$img = $path;
		}
		$get_size = getimagesize($img);
		$this->image_info = array(
			'width' => $get_size[0],
			'height' => $get_size[1],
			'bits' => $get_size['bits'],
			'mime' => $get_size['mime']
		);
		if ($ret) {
			return $this->image_info;
		}
	}
}
