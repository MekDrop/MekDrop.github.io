<?php

require_once "../../mainfile.php";
//include_once(dirname( __FILE__ ) . '/include/common.php');

/*if (!isset($_SESSION['gaccess'])) {
	if (!isset($_REQUEST['ldata'])) {
		header("HTTP/1.1 401 Unauthorized");
		exit('Unautorized');
	}
	$ldata = urldecode($_REQUEST['ldata']);
	$ldata = substr(base64_decode($ldata), 0, -1);
	$ldata = unserialize(base64_decode($ldata));
	if (!isset($ldata[':password']) || !isset($ldata[':username'])) {
		header("HTTP/1.1 401 Unauthorized");
		exit('Unautorized');
	}

	$_SESSION['gaccess'] = md5($_REQUEST['ldata']);
	header('Location: ./index.php');
	exit();
}*/

global $xoopsOption;

$op = isset($_REQUEST['op'])?$_REQUEST['op']:'list';

$xoopsOption['template_main'] = 'banner_planner_'.$op.'.html';

require_once(ICMS_ROOT_PATH . '/header.php');

require_once 'pages/' . $op . '.php';

require_once(ICMS_ROOT_PATH . '/footer.php');