<?php

global $icmsTpl;

if (isset($_REQUEST['op_from_form']) && ($_REQUEST['op_from_form'] == 1)) {
    $banners_handler = icms_getmodulehandler('banner', 'bannersplanner');
    $banner = $banners_handler->create();
    foreach ($_REQUEST as $key => $value) {
        $banner->setVar($key, $value);
    }
    
    if ($banner->store()) {
        $sizes = array(1 => 'm', 2=>'d');
        redirect_header('index.php?op=list&type=' . $sizes[$_REQUEST['size']], 2, 'Baneris pridėtas į laukiančiųjų sąrašą');
        die();
    } else {
        redirect_header('index.php?op=list', 2, 'Deja, kažkodėl nepavyko pridėti šio banerio');
        die();
    }
} else {
    $ch = curl_init(); 
    curl_setopt_array($ch, array(
        CURLOPT_URL => 'http://games.lt/team-link/?token=YxXpMUdBDUUq8qk1mGWKfETPPHsXsVlcQ2vedV9HyisNeo9Mk6&cmd=get&action=platforms',
        CURLOPT_RETURNTRANSFER => 1
    ));

    $platforms = curl_exec($ch); 
    curl_close($ch);

    $icmsTpl->assign('platforms', array_map('strtoupper', unserialize(base64_decode($platforms))));
    $icmsTpl->assign('size', 2);
    $icmsTpl->assign('types', array(
        array(
            'name' => 'Žaidimo apžvalga',
            'firstgame' => true,
            'showgameselector' => true,
            'sizes' => array(
                'm' => true,
                'd' => true
            )
        ),    
        array(
            'name' => 'Geležies apžvalga',
            'firstgame' => false,
            'showgameselector' => false,
            'sizes' => array(
                'm' => true,
                'd' => false
            )
        ),
        array(
            'name' => 'Telefono apžvalga',
            'firstgame' => false,
            'showgameselector' => false,
            'sizes' => array(
                'm' => true,
                'd' => false
            )
        ),
        array(
            'name' => 'Games.lt TV pristatymas',
            'firstgame' => false,
            'showgameselector' => true,
            'sizes' => array(
                'm' => true,
                'd' => false
            )
        ),
        array(
            'name' => 'Games.lt TV epizodas',
            'firstgame' => false,
            'showgameselector' => false,
            'sizes' => array(
                'm' => true,
                'd' => false
            )
        ),
        array(
            'name' => 'Games.lt TV reportažas',
            'firstgame' => false,
            'showgameselector' => false,
            'sizes' => array(
                'm' => true,
                'd' => false
            )
        ),
        array(
            'name' => 'Games.lt TV TOP\'as',
            'firstgame' => false,
            'showgameselector' => false,
            'sizes' => array(
                'm' => true,
                'd' => false
            )
        ),
        array(
            'name' => 'Sąrašas',
            'firstgame' => false,
            'showgameselector' => false,
            'sizes' => array(
                'm' => true,
                'd' => false
            )
        ),
        array(
            'name' => 'Blog\'o įrašas',
            'firstgame' => false,
            'showgameselector' => false,
            'sizes' => array(
                'm' => true,
                'd' => false
            )
        ),
        array(
            'name' => 'Sąrašas',
            'firstgame' => false,
            'showgameselector' => false,
            'sizes' => array(
                'm' => true,
                'd' => false
            )
        ),
        array(
            'name' => 'Renginys',
            'firstgame' => false,
            'showgameselector' => false,
            'sizes' => array(
                'm' => true,
                'd' => false
            )
        ),
        array(
            'name' => 'Konkursas',
            'firstgame' => false,
            'showgameselector' => false,
            'sizes' => array(
                'm' => true,
                'd' => false
            )
        ),
        array(
            'name' => 'Pamoka',
            'firstgame' => false,
            'showgameselector' => false,
            'sizes' => array(
                'm' => true,
                'd' => false
            )
        ),
    ));
}