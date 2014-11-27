<?php

global $icmsTpl;

$btypes = array(
       'm' => 'Maži (Verta aplankyti)',
       'd' => 'Dideli'
    );

if (!isset($_REQUEST['type'])) {
    $icmsTpl->assign('types',$btypes);
} else {
    $ch = curl_init(); 
    curl_setopt_array($ch, array(
        CURLOPT_URL => 'http://games.lt/team-link/?token=YxXpMUdBDUUq8qk1mGWKfETPPHsXsVlcQ2vedV9HyisNeo9Mk6&cmd=get&action=last_banners',
        CURLOPT_RETURNTRANSFER => 1
    ));

    $lbanners = curl_exec($ch); 
    curl_close($ch);   

    $lbanners = unserialize(base64_decode($lbanners));
    $lbanners = $lbanners[$_REQUEST['type']];
    foreach ($lbanners as $i => &$lbanner) {
        $lbanner['src'] = 'http://www.games.lt/w/hotdemo/' . 
                substr($lbanner['filename_local'], 0, strpos($lbanner['filename_local'], '_')) .
                substr($lbanner['filename_local'], strrpos($lbanner['filename_local'], '.'));
        $lbanner['time_left'] = ($lbanner['created'] + 7 * 86400) - time();
        if ($lbanner['time_left'] < 0)
            $lbanner['time_left'] = 0;
        $lbanner['time_left_parts'] = array(            
            'days' => (int)floor($lbanner['time_left'] / 86400),
            'hours' => (int)floor($lbanner['time_left'] / 3600) % 24,
            'minutes' => (int)floor($lbanner['time_left'] / 60) % 60,
            'seconds' => $lbanner['time_left'] % 60,
        );
        $lbanner['expired'] = $lbanner['time_left'] == 0;
    }
    $icmsTpl->assign('current_banners', $lbanners);
    
    $banners_handler = icms_getmodulehandler('banner', 'bannersplanner');
    $ktypes = array_keys($btypes);
    $criteria = new icms_db_criteria_Item('size', array_search($ktypes, $_REQUEST['type']) + 2);
    $criteria->sort = 'banner_id';
    $criteria->order = 'ASC';
    $planned_banners = $banners_handler->getObjects($criteria, false, false);
    $icmsTpl->assign('planned_banners', $planned_banners);
    
}