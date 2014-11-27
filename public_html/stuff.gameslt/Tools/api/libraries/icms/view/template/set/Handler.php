<?php
/**
 * Manage template sets
 *
 * @copyright	http://www.impresscms.org/ The ImpressCMS Project
 * @license		LICENSE.txt
 * @category	ICMS
 * @package		View
 * @subpackage	Template
 * @version		SVN: $Id:Handler.php 19775 2010-07-11 18:54:25Z malanciault $
 */

defined('ICMS_ROOT_PATH') or die("ImpressCMS root path not defined");

/**
 * Template set handler class.
 * This class is responsible for providing data access mechanisms to the data source
 * of template set class objects.
 *
 *
 * @author		Kazumi Ono <onokazu@xoops.org>
 * @category	ICMS
 * @package		View
 * @subpackage	Template
 */
class icms_view_template_set_Handler extends icms_ipf_Handler {

        public function __construct(&$db) {
            parent::__construct($db, 'view_template_set', 'tplset_id', 'tplset_name', 'tplset_name', 'icms', 'tplset', 'tplset_id');
        }

	/**
	 * Gets templateset from database by Name
	 *
	 * @see icms_view_template_set_Object
	 * @param string $tplset_name of the tempateset to get
	 * @return object icms_view_template_set_Object {@link icms_view_template_set_Object} reference to the new template
	 **/
	public function &getByName($tplset_name) {
                $criteria = new icms_db_criteria_Item('tplset_name', trim($tplset_name));
                $criteria->setLimit(1);
                $objs = $this->getObjects($criteria);
                return isset($objs[0])?$objs[0]:null;		
	}

	/**
	 * Deletes templateset from the database
	 *
	 * @see icms_view_template_set_Object
	 * @param object $tplset {@link icms_view_template_set_Object} reference to the object of the tempateset to delete
	 * @return object icms_view_template_set_Object {@link icms_view_template_set_Object} reference to the new template
	 **/
	public function delete(&$tplset) {
		if (!parent::delete($tplset))
			return false;
		$sql = sprintf(
			"DELETE FROM %s WHERE tplset_name = %s",
			$this->db->prefix('imgset_tplset_link'),
			$this->db->quoteString($tplset->getVar('tplset_name'))
		);
		$this->db->query($sql);
		return true;
	}
}