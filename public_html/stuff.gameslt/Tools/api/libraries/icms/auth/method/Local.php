<?php
/**
 * Local authentication class
 * Authentication classes, local authentication class file
 * @copyright	http://www.xoops.org/ The XOOPS Project
 * @copyright	XOOPS_copyrights.txt
 * @copyright	http://www.impresscms.org/ The ImpressCMS Project
 * @license		LICENSE.txt
 * @category	ICMS
 * @package		Authentication
 * @subpackage	Local
 * @since		XOOPS
 * @author		http://www.xoops.org The XOOPS Project
 * @author		modified by UnderDog <underdog@impresscms.org>
 * @version		SVN: $Id: Local.php 11730 2012-06-17 01:00:09Z skenow $
 */
/**
 * Authentication class for local database
 * @category	ICMS
 * @package		Authentication
 * @subpackage	Local
 * @author		Pierre-Eric MENUET <pemphp@free.fr>
 * @copyright	copyright (c) 2000-2003 XOOPS.org
 */
class icms_auth_method_Local extends icms_auth_Object {
    
        /**
         * Defines custom handler for returned data type
         *
         * @var icms_member_user_Handler
         */
        static public $customMemberHandler = null;
    
	/**
	 * Authentication Service constructor
	 * constructor
	 * @param object $dao reference to dao object
	 */
	public function __construct() {
		$this->_dao = icms::$xoopsDB;
		$this->auth_method = 'local';
	}

	/**
	 * Authenticate user
	 * @param string $uname
	 * @param string $pwd
     * @param object $customUserHandler If specified will be used for getting results
	 * @return object {@link icms_member_user_Object} icms_member_user_Object object
	 */
	public function authenticate($uname, $pwd = NULL, $customUserHandler = null) {
        $member_handler = icms::handler('icms_member');
		$user = $member_handler->loginUser($uname, $pwd, $customUserHandler);
		icms::$session->enableRegenerateId = TRUE;
		icms::$session->getCurrent();
		if ($user == FALSE) {
			icms::$session->destroy(session_id());
			$this->setErrors(1, _US_INCORRECTLOGIN);
		}
		return ($user);
	}
}
