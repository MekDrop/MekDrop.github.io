<?php
/**
 * All functions for lost password generator are going through here.
 *
 * Form and process for sending a new password to a user
 *
 * @copyright	http://www.impresscms.org/ The ImpressCMS Project
 * @license		http://www.gnu.org/licenses/old-licenses/gpl-2.0.html GNU General Public License (GPL)
 * @package		Member
 * @subpackage	Users
 * @version		SVN: $Id$
 */

$xoopsOption['pagetype'] = 'user';
/** Include mainfile.php - required */
include 'mainfile.php';
/* $_POST parameters
 *	email
 *
 *	$_GET parameters
 *	code
 */
/* set default value for $code */
$code = '';

$filter_get = $filter_post = array('email' => array('email', 'options' => array(0, 0)));

/* set default value for parameters */
$code = '';

if (!empty($_GET)) {
    $clean_GET = icms_core_DataFilter::checkVarArray($_GET, $filter_get, FALSE);
    extract($clean_GET);
}
if (!empty($_POST)) {
    $clean_POST = icms_core_DataFilter::checkVarArray($_POST, $filter_post, FALSE);
    extract($clean_POST);
}
if ($email == '') {
	redirect_header('user.php', 2, _US_SORRYNOTFOUND);
}

$member_handler = icms::handler('icms_member');
$criteria = new icms_db_criteria_Compo();
$criteria->add(new icms_db_criteria_Item('email',$email));
$criteria->add(new icms_db_criteria_Item('level', '-1', '!='));
$getuser =& $member_handler->getUsers($criteria);

if (empty($getuser)) {
	$msg = _US_SORRYNOTFOUND;
	redirect_header('user.php', 2, $msg);
} else {
	$icmspass = new icms_core_Password();

	$areyou = substr($getuser[0]->getVar('pass'), 0, 5);
	if ($code != '' && $areyou == $code) {
		$newpass = $icmspass->createSalt(8);
		$pass = $icmspass->encryptPass($newpass);
		$xoopsMailer = new icms_messaging_Handler();
		$xoopsMailer->useMail();
		$xoopsMailer->setTemplate('lostpass2.tpl');
		$xoopsMailer->assign('SITENAME', $icmsConfig['sitename']);
		$xoopsMailer->assign('ADMINMAIL', $icmsConfig['adminmail']);
		$xoopsMailer->assign('SITEURL', ICMS_URL . '/');
		$xoopsMailer->assign('IP', $_SERVER['REMOTE_ADDR']);
		$xoopsMailer->assign('NEWPWD', $newpass);
		$xoopsMailer->setToUsers($getuser[0]);
		$xoopsMailer->setFromEmail($icmsConfig['adminmail']);
		$xoopsMailer->setFromName($icmsConfig['sitename']);
		$xoopsMailer->setSubject(sprintf(_US_NEWPWDREQ, ICMS_URL));
		if (!$xoopsMailer->send()) {
			echo $xoopsMailer->getErrors();
		}

		// Next step: add the new password to the database
		$sql = sprintf("UPDATE %s SET pass = '%s', pass_expired = '%u' WHERE uid = '%u'",
						icms::$xoopsDB->prefix('users'), $pass, 1, (int) $getuser[0]->getVar('uid'));
		if (!icms::$xoopsDB->queryF($sql)) {
			/** Include header.php to start page rendering */
			include 'header.php';
			echo _US_MAILPWDNG;
			/** Include footer.php to complete page rendering */
			include 'footer.php';
			exit();
		}
		redirect_header('user.php', 3, sprintf(_US_PWDMAILED, $getuser[0]->getVar('uname')), FALSE);
		// If no Code, send it
	} else {
		$xoopsMailer = new icms_messaging_Handler();
		$xoopsMailer->useMail();
		$xoopsMailer->setTemplate('lostpass1.tpl');
		$xoopsMailer->assign('SITENAME', $icmsConfig['sitename']);
		$xoopsMailer->assign('ADMINMAIL', $icmsConfig['adminmail']);
		$xoopsMailer->assign('SITEURL', ICMS_URL . '/');
		$xoopsMailer->assign('IP', $_SERVER['REMOTE_ADDR']);
		$xoopsMailer->assign('NEWPWD_LINK', ICMS_URL . '/lostpass.php?email=' . $email . '&code=' . $areyou);
		$xoopsMailer->setToUsers($getuser[0]);
		$xoopsMailer->setFromEmail($icmsConfig['adminmail']);
		$xoopsMailer->setFromName($icmsConfig['sitename']);
		$xoopsMailer->setSubject(sprintf(_US_NEWPWDREQ, $icmsConfig['sitename']));
		/** Include header.php to start page rendering */
		include 'header.php';
		if (!$xoopsMailer->send()) {
			echo $xoopsMailer->getErrors();
		}
		echo '<h4>';
		printf(_US_CONFMAIL, $getuser[0]->getVar('uname'));
		echo '</h4>';
		/** Include footer.php to complete page rendering */
		include 'footer.php';
	}
}
