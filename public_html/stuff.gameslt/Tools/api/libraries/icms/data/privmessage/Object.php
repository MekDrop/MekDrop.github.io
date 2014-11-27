<?php
/**
 * Private messages
 *
 * @copyright	http://www.impresscms.org/ The ImpressCMS Project
 * @license		LICENSE.txt
 * @category	ICMS
 * @package		Privmessage
 * @version		SVN: $Id:Object.php 19775 2010-07-11 18:54:25Z malanciault $
 */

defined('ICMS_ROOT_PATH') or die("ImpressCMS root path not defined");

/**
 * A handler for Private Messages
 *
 * @category	ICMS
 * @package		Privmessage
 * @author		Kazumi Ono	<onokazu@xoops.org>
 */
class icms_data_privmessage_Object extends icms_ipf_Object {

	/**
	 * constructor
	 **/
	public function __construct(&$handler, $data = array()) {		
		$this->initVar('msg_id', self::DTYPE_INTEGER, null, false);
		$this->initVar('msg_image', self::DTYPE_DEP_OTHER, 'icon1.gif', false, 100);
		$this->initVar('subject', self::DTYPE_DEP_TXTBOX, null, true, 255);
		$this->initVar('from_userid', self::DTYPE_INTEGER, null, true);
		$this->initVar('to_userid', self::DTYPE_INTEGER, null, true);
		$this->initVar('msg_time', self::DTYPE_DEP_OTHER, null, false);
		$this->initVar('msg_text', self::DTYPE_STRING, null, true);
		$this->initVar('read_msg', self::DTYPE_INTEGER, 0, false);
                
                parent::__construct($handler, $data);
	}
}

