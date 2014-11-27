<?php
/**
 * Manage memberships
 *
 * @copyright	http://www.impresscms.org/ The ImpressCMS Project
 * @license		LICENSE.txt
 * @category	ICMS
 * @package		Member
 * @subpackage	GroupMembership
 * @author		Kazumi Ono (aka onokazo)
 * @version		SVN: $Id:Handler.php 19775 2010-07-11 18:54:25Z malanciault $
 */

defined('ICMS_ROOT_PATH') or die("ImpressCMS root path not defined");

/**
 * Group membership handler class. (Singleton)
 *
 * This class is responsible for providing data access mechanisms to the data source
 * of group membership class objects.
 *
 * @author Kazumi Ono <onokazu@xoops.org>
 * @category	ICMS
 * @package		Member
 * @subpackage	GroupMembership
 */
class icms_member_group_membership_Handler extends icms_ipf_Handler {
    
        public function __construct(&$db) {
            parent::__construct($db, 'member_group_membership', 'linkid', 'groupid', 'uid', 'icms', 'groups_users_link', 'linkid');
        }	    

	/**
	 * retrieve groups for a user
	 *
	 * @param int $uid ID of the user
	 * @param bool $asobject should the groups be returned as {@link icms_member_group_Object}
	 * objects? FALSE returns associative array.
	 * @return array array of groups the user belongs to
	 */
	public function getGroupsByUser($uid) {
		$ret = array();
		$sql = "SELECT groupid FROM " . icms::$xoopsDB->prefix('groups_users_link')
			. " WHERE uid='" . (int) $uid . "'";
		$result = icms::$xoopsDB->query($sql);
		if (!$result) {
			return $ret;
		}
		while ($myrow = icms::$xoopsDB->fetchArray($result)) {
			$ret[] = $myrow['groupid'];
		}
		return $ret;
	}

	/**
	 * retrieve users belonging to a group
	 *
	 * @param int $groupid ID of the group
	 * @param bool $asobject return users as {@link icms_user_Object} objects?
	 * FALSE will return arrays
	 * @param int $limit number of entries to return
	 * @param int $start offset of first entry to return
	 * @return array array of users belonging to the group
	 */
	public function getUsersByGroup($groupid, $limit=0, $start=0) {
		$ret = array();
		$sql = "SELECT uid FROM " . icms::$xoopsDB->prefix('groups_users_link')
			. " WHERE groupid='" . (int) $groupid . "'";
		$result = icms::$xoopsDB->query($sql, $limit, $start);
		if (!$result) {
			return $ret;
		}
		while ($myrow = icms::$xoopsDB->fetchArray($result)) {
			$ret[] = $myrow['uid'];
		}
		return $ret;
	}
}

