<?php
/**
 * Authentication classes, Active Directory class file
 *
 * @copyright	http://www.impresscms.org/ The ImpressCMS Project
 * @license		LICENSE.txt
 * @category	ICMS
 * @package		Authentication
 * @subpackage	ActiveDirectory
 * @version		SVN: $Id: Ads.php 11730 2012-06-17 01:00:09Z skenow $
 */

/**
 * Authentication class for Active Directory
 *
 * @category	ICMS
 * @package     Authentication
 * @subpackage	ActiveDirectory
 * @author	    Pierre-Eric MENUET	<pemphp@free.fr>
 */
class icms_auth_method_Ads extends icms_auth_method_Ldap {

	/**
	 * Authentication Service constructor
	 */
	public function __construct() {
		parent::__construct();
	}

	/**
	 *  Authenticate  user again LDAP directory (Bind)
	 *  2 options :
	 * 		Authenticate directly with uname in the DN
	 * 		Authenticate with manager, search the dn
	 *
	 * @param string $uname Username
	 * @param string $pwd Password
	 *
	 * @return bool
	 */
	public function authenticate($uname, $pwd = NULL) {
		global $icmsConfigAuth;
		$authenticated = FALSE;
		if (in_array($uname, $icmsConfigAuth['ldap_users_bypass'])) {
			/* use core authentication if user is bypassed for LDAP */
			$auth = new icms_auth_method_Local(icms::$xoopsDB);
			return $auth->authenticate($uname, $pwd);
		}
		if (!extension_loaded('ldap')) {
			$this->setErrors(0, _AUTH_LDAP_EXTENSION_NOT_LOAD);
			return $authenticated;
		}
		$this->_ds = ldap_connect($this->ldap_server, $this->ldap_port);
		if ($this->_ds) {
			ldap_set_option($this->_ds, LDAP_OPT_PROTOCOL_VERSION, $this->ldap_version);
			ldap_set_option($this->_ds, LDAP_OPT_REFERRALS, 0);
			if ($this->ldap_use_TLS) {
				// We use TLS secure connection
				if (!ldap_start_tls($this->_ds)) $this->setErrors(0, _AUTH_LDAP_START_TLS_FAILED);
			}
			// If the uid is not in the DN we proceed to a search
			// The uid is not always in the dn
			$userUPN = $this->getUPN($uname);
			if (!$userUPN) return FALSE;
			// We bind as user to test the credentials
			$authenticated = ldap_bind($this->_ds, $userUPN, $this->cp1252_to_utf8(stripslashes($pwd)));
			if ($authenticated) {
				// We load the User database
				$dn = $this->getUserDN($uname);
				if ($dn) {
					return $this->getMember($dn, $uname, $pwd);
				} else {
					return FALSE;
				}
			} else {
				$this->setErrors(ldap_errno($this->_ds), ldap_err2str(ldap_errno($this->_ds)) . '(' . $userUPN . ')');
			}
		} else {
			$this->setErrors(0, _AUTH_LDAP_SERVER_NOT_FOUND);
		}
		@ldap_close($this->_ds);
		return $authenticated;
	}

	/**
	 *  Return the UPN = userPrincipalName (Active Directory)
	 *  userPrincipalName = guyt@CP.com    Often abbreviated to UPN, and
	 *  looks like an email address.  Very useful for logging on especially in
	 *  a large Forest.   Note UPN must be unique in the forest.
	 *
	 * @param string $uname Username
	 * @return userDN or false
	 */
	public function getUPN($uname) {
		$userDN = FALSE;
		$userDN = $uname . "@" . $this->ldap_domain_name;
		return $userDN;
	}
}
