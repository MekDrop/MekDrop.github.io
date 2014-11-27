<?php
/**
 * The check login include file
 *
 * @copyright	http://www.impresscms.org/ The ImpressCMS Project
 * @license		LICENSE.txt
 * @category
 * @package		Members
 * @subpackage	Users
 * @since		XOOPS
 * @version		$Id: checklogin.php 11420 2011-10-25 03:14:27Z skenow $
 */

defined('ICMS_ROOT_PATH') || exit();

icms_loadLanguageFile('core', 'user');
$uname = !isset($_POST['uname']) ? '' : trim($_POST['uname']);
$pass = !isset($_POST['pass']) ? '' : trim($_POST['pass']);
/**
 * Commented out for OpenID , we need to change it to make a better validation if OpenID is used
 */
/*if ($uname == '' || $pass == '') {
 redirect_header(ICMS_URL.'/user.php', 1, _US_INCORRECTLOGIN);
 exit();
 }*/
$member_handler = icms::handler('icms_member');

icms_loadLanguageFile('core', 'auth');
$icmsAuth =& icms_auth_Factory::getAuthConnection(icms_core_DataFilter::addSlashes($uname));

$uname4sql = addslashes(icms_core_DataFilter::stripSlashesGPC($uname));
$pass4sql = icms_core_DataFilter::stripSlashesGPC($pass);

if (empty($user) || !is_object($user)) {
	$user =& $icmsAuth->authenticate($uname4sql, $pass4sql);
}

if (FALSE != $user) {
	if (0 == $user->getVar('level')) {
		redirect_header(ICMS_URL . '/', 5, _US_NOACTTPADM);
		exit();
	}
	if ($icmsConfigPersona['multi_login']) {
		if (is_object($user)) {
			$online_handler = icms::handler('icms_core_Online');
			$online_handler->gc(300);
			$onlines =& $online_handler->getAll();
			foreach ($onlines as $online) {
				if ($online['online_uid'] == $user->getVar('uid')) {
					$user = FALSE;
					redirect_header(ICMS_URL . '/', 3, _US_MULTLOGIN);
				}
			}
			if (is_object($user)) {
				$online_handler->write(
					$user->getVar('uid'),
					$user->getVar('uname'),
					time(),
					0,
					$_SERVER['REMOTE_ADDR']
				);
			}
		}
	}
	if ($icmsConfig['closesite'] == 1) {
		$allowed = FALSE;
		foreach ( $user->getGroups() as $group) {
			if (in_array($group, $icmsConfig['closesite_okgrp']) || ICMS_GROUP_ADMIN == $group) {
				$allowed = TRUE;
				break;
			}
		}
		if (!$allowed) {
			redirect_header(ICMS_URL . '/', 1, _NOPERM);
			exit();
		}
	}
	$user->login();
	if (!empty($_POST['xoops_redirect']) && !strpos($_POST['xoops_redirect'], 'register')) {
		$_POST['xoops_redirect'] = trim($_POST['xoops_redirect']);
		$parsed = parse_url(ICMS_URL);
		$url = isset($parsed['scheme']) ? $parsed['scheme'] . '://' : 'http://';
		if (isset($parsed['host'])) {
			$url .= $parsed['host'];
			if (isset($parsed['port'])) {
				$url .= ':' . $parsed['port'];
			}
		} else {
			$url .= $_SERVER['HTTP_HOST'];
		}
		if (@$parsed['path']) {
			if (strncmp($parsed['path'], $_POST['xoops_redirect'], strlen($parsed['path']))) {
				$url .= $parsed['path'];
			}
		}
		$url .= $_POST['xoops_redirect'];
	} else {
		$url = ICMS_URL . '/';
	}
	if ($pos = strpos($url, '://')) {
		$xoopsLocation = substr(ICMS_URL, strpos(ICMS_URL, '://') + 3);
		if (substr($url, $pos + 3, strlen($xoopsLocation)) != $xoopsLocation) {
			$url = ICMS_URL;
		} elseif (substr($url, $pos + 3, strlen($xoopsLocation)+1) == $xoopsLocation . '.') {
			$url = ICMS_URL;
		}
		if (substr($url, 0, strlen(ICMS_URL)*2) ==  ICMS_URL . ICMS_URL) {
			$url = substr($url, strlen(ICMS_URL));
		}
	}

	// autologin hack V3.1 GIJ (set cookie)
	$secure = substr(ICMS_URL, 0, 5) == 'https' ? 1 : 0; // we need to secure cookie when using SSL
	$icms_cookie_path = defined('ICMS_COOKIE_PATH') ? ICMS_COOKIE_PATH :
	preg_replace( '?http://[^/]+(/.*)$?' , "$1" , ICMS_URL );
	if ($icms_cookie_path == ICMS_URL) $icms_cookie_path = '/';
	if (!empty($_POST['rememberme'])) {
		$expire = time() + (defined('ICMS_AUTOLOGIN_LIFETIME') ? ICMS_AUTOLOGIN_LIFETIME : 604800) ; // 1 week default
		setcookie('autologin_uname', $user->getVar('login_name'), $expire, $icms_cookie_path, '', $secure, 0);
		$Ynj = date('Y-n-j') ;
		setcookie('autologin_pass', $Ynj . ':' . md5($user->getVar('pass') . ICMS_DB_PASS . ICMS_DB_PREFIX . $Ynj),
		$expire, $icms_cookie_path, '', $secure, 0);
	}
	// end of autologin hack V3.1 GIJ

	// Perform some maintenance of notification records
	$notification_handler = icms::handler('icms_data_notification');
	$notification_handler->doLoginMaintenance($user->getVar('uid'));

	redirect_header($url, 1, sprintf(_US_LOGGINGU, $user->getVar('uname')), FALSE);
} elseif (empty($_POST['xoops_redirect'])) {
	redirect_header(ICMS_URL . '/user.php', 5, $icmsAuth->getHtmlErrors());
} else {
	redirect_header(
		ICMS_URL . '/user.php?xoops_redirect='
		. urlencode(trim($_POST['xoops_redirect'])), 5, $icmsAuth->getHtmlErrors(), FALSE
	);
}
exit();
