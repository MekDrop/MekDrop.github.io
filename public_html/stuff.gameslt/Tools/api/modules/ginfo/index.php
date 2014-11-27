<?php

require_once "../../mainfile.php";
//include_once(dirname( __FILE__ ) . '/include/common.php');

global $xoopsOption;
$xoopsOption['template_main'] = 'ginfo_waiting_upcomming_games.html';

require_once(ICMS_ROOT_PATH . '/header.php');

$ch = curl_init(); 
curl_setopt_array($ch, array(
    CURLOPT_URL => 'http://games.lt/team-link/?token=YxXpMUdBDUUq8qk1mGWKfETPPHsXsVlcQ2vedV9HyisNeo9Mk6&cmd=get&action=soon_waiting_list',
    CURLOPT_RETURNTRANSFER => 1
));

$ret = curl_exec($ch); 
curl_close($ch);   

$ret = unserialize(base64_decode($ret));

$icmsTpl->assign('games', $ret);

require_once(ICMS_ROOT_PATH . '/footer.php');