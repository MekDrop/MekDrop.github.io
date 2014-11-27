<?php
/**
 * Site index aka home page.
 * redirects to installation, if ImpressCMS is not installed yet
 *
 * @copyright	http://www.impresscms.org/ The ImpressCMS Project
 * @license		http://www.gnu.org/licenses/old-licenses/gpl-2.0.html GNU General Public License(GPL)
 * @package		core
 * @author	    Sina Asghari(aka stranger) <pesian_stranger@users.sourceforge.net>
 * @version		SVN: $Id: index.php 11733 2012-06-21 23:11:44Z skenow $
 **/


if (!file_exists("mainfile.php")) {
	header("Location: install/index.php");
}
/** mainfile is required, if it doesn't exist - installation is needed */
require "mainfile.php";

$member_handler = icms::handler('icms_member');
$group = $member_handler->getUserBestGroup((@is_object(icms::$user) ? icms::$user->getVar('uid') : 0));
$icmsConfig['startpage'] = $icmsConfig['startpage'][$group];

if (isset($icmsConfig['startpage']) && $icmsConfig['startpage'] != "" && $icmsConfig['startpage'] != "--") {
	$arr = explode('-', $icmsConfig['startpage']);
	if (count($arr) > 1) {
		$page_handler = icms::handler('icms_data_page');
		$page = $page_handler->get($arr[1]);
		if (is_object($page)) {
			$url =(substr($page->getVar('page_url'), 0, 7) == 'http://')
				? $page->getVar('page_url') : ICMS_URL . '/' . $page->getVar('page_url');
			header('Location: ' . $url);
		} else {
			$icmsConfig['startpage'] = '--';
			$xoopsOption['show_cblock'] = 1;
			/** Included to start page rendering */
			include "header.php";
			/** Included to complete page rendering */
			include "footer.php";
		}
	} else {
		header('Location: ' . ICMS_MODULES_URL . '/' . $icmsConfig['startpage'] . '/');
	}
	exit();
} else {
	$xoopsOption['show_cblock'] = 1;
	/** Included to start page rendering */
	include "header.php";
	/** Included to complete page rendering */
	include "footer.php";
}
