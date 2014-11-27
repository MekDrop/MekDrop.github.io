<?php
/**
 * Wrapper for administering groups
 *
 * @category	ICMS
 * @package		Administration
 * @subpackage	Groups
 * @copyright 	The ImpressCMS Project <http://www.impresscms.org>
 * @license		GNU General Public License (GPL) <http://www.gnu.org/licenses/old-licenses/gpl-2.0.html>
 * @version		$Id: GroupsHandler.php 11719 2012-05-22 00:40:10Z skenow $
 */

/**
 * Handles group administration
 *
 * @category	ICMS
 * @package		Administration
 * @subpackage	Groups
 */
class mod_system_GroupsHandler extends icms_member_group_Handler {

	/**
	 * Constructs the handler class for groups
	 *
	 * @param  obj $db	database instance (@see icms_db_Factory::instance)
	 */
	public function __construct(&$db) {
		parent::__construct($db);
		/* overriding the default table name
		 * @todo	complete refactoring and use standard table name
		 */
		$this->table = $this->db->prefix('groups');
	}
}