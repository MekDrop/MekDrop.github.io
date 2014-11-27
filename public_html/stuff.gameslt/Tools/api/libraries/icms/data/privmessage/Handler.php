<?php
/**
 * Manage private messages
 *
 * @copyright	http://www.impresscms.org/ The ImpressCMS Project
 * @license		LICENSE.txt
 * @category	ICMS
 * @package		Privmessage
 * @version		SVN: $Id:Handler.php 19775 2010-07-11 18:54:25Z malanciault $
 */

defined('ICMS_ROOT_PATH') or die("ImpressCMS root path not defined");

/**
 */

/**
 * Private message handler class.
 *
 * This class is responsible for providing data access mechanisms to the data source
 * of private message class objects.
 *
 * @category	ICMS
 * @package     Privmessage
 * @author	    Kazumi Ono	<onokazu@xoops.org>
 */
class icms_data_privmessage_Handler extends icms_ipf_Handler {
    
        public function __construct(&$db) {
            parent::__construct($db, 'data_privmessage', 'msg_id', 'subject', 'msg_text', 'icms', 'priv_msgs', 'msg_id');
        }

	/**
	 * Mark a message as read
	 * @param 	object 	$pm 	{@link icms_data_privmessage_Object} object
	 * @return 	bool
	 **/
	public function setRead(&$pm) {
		if (!is_a($pm, 'icms_data_privmessage_Object')) {
			return false;
		}

		$sql = sprintf("UPDATE %s SET read_msg = '1' WHERE msg_id = '%u'", $this->table, (int) $pm->getVar('msg_id'));
		if (!$this->db->queryF($sql)) {
			return false;
		}
		return true;
	}
}

