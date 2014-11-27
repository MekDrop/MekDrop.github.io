<?php
/**
 * ImpressCMS Mimetypes
 *
 * @copyright	The ImpressCMS Project http://www.impresscms.org/
 * @license		http://www.gnu.org/licenses/old-licenses/gpl-2.0.html GNU General Public License (GPL)
 * @package		System
 * @subpackage	Mimetypes
 * @since		1.2
 * @author		Sina Asghari (aka stranger) <pesian_stranger@users.sourceforge.net>
 * @version		SVN: $Id: Mimetype.php 11584 2012-02-19 05:17:15Z skenow $
 */

defined("ICMS_ROOT_PATH") or die("ImpressCMS root path not defined");

/* This may be loaded by other modules - and not just through the cpanel */ 
icms_loadLanguageFile('system', 'mimetype', TRUE);

/**
 * Mimetype management for file handling
 * 
 * @package		System
 * @subpackage	Mimetypes
 */
class mod_system_Mimetype extends icms_ipf_Object {
	public $content = FALSE;

	/**
	 * Constructor
	 * 
	 * @param object $handler
	 */
	function __construct(&$handler) {
		parent::__construct($handler);

		$this->quickInitVar('mimetypeid', self::DTYPE_INTEGER, TRUE);
		$this->quickInitVar('extension', self::DTYPE_DEP_TXTBOX, TRUE, _CO_ICMS_MIMETYPE_EXTENSION, _CO_ICMS_MIMETYPE_EXTENSION_DSC);
		$this->quickInitVar('types', self::DTYPE_STRING, TRUE, _CO_ICMS_MIMETYPE_TYPES, _CO_ICMS_MIMETYPE_TYPES_DSC);
		$this->quickInitVar('name', self::DTYPE_DEP_TXTBOX, TRUE, _CO_ICMS_MIMETYPE_NAME, _CO_ICMS_MIMETYPE_NAME_DSC);
		$this->quickInitVar('dirname', self::DTYPE_LIST, TRUE, _CO_ICMS_MIMETYPE_DIRNAME);

		$this->setControl('dirname', array(
			'name' => 'selectmulti',
			'itemHandler' => 'icms_module',
			'method' => 'getActive'));
	}

	/**
	 * (non-PHPdoc)
	 * @see icms_ipf_Object::getVar()
	 * @return	mixed	Value of the selected property
	 */
	public function getVar($key, $format = 's') {
		if ($format == 's' && in_array($key, array())) {
			return call_user_func(array($this, $key));
		}
		return parent::getVar($key, $format);
	}

	/**
	 * Determines if a variable is a zero length string
	 * @param string $var
	 * @return	boolean
	 */
	public function emptyString($var) {
		return strlen($var) > 0;
	}

	/**
	 * Get the name property of the selected mimetype
	 * @return	string
	 */
	public function getMimetypeName() {
		$ret = $this->getVar('name');
		return $ret;
	}

	/**
	 * Get the type of the selected mimetype
	 * @return	string
	 */
	public function getMimetypeType() {
		$ret = $this->getVar('types');
		return $ret;
	}

	/**
	 * Get the ID of the selected mimetype
	 * @return	int
	 */
	public function getMimetypeId() {
		$ret = (int) $this->getVar('mimetypeid');
		return $ret;
	}
}
