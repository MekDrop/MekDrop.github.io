<?php

if (get_magic_quotes_gpc()) {
    $GLOBALS['clean_func'] = function ($value) {
        return is_array($value)?array_map($GLOBALS['clean_func'], $value):stripslashes($value);
    };
    foreach(array('_GET', '_REQUEST', '_POST') as $name)
        $$name = $GLOBALS['clean_func']($$name);
    unset($GLOBALS['clean_func'], $$name);
}

define('ICMS_SKIP_CHECK_SITEOFFLINE', 1);

include "mainfile.php";

$action_handler = icms::handler('icms_action');

if (isset($_SERVER['HTTP_ICMS_ENCODING'])) {
    $_SERVER['HTTP_ICMS_REQUEST'] = base64_decode($_SERVER['HTTP_ICMS_REQUEST']);
    switch ($_SERVER['HTTP_ICMS_ENCODING']) {
        case 'zlib':
        case 'zlib/inflate':
            $_SERVER['HTTP_ICMS_REQUEST'] = gzinflate($_SERVER['HTTP_ICMS_REQUEST']);
        break;
        case 'zlib/uncompress':
            $_SERVER['HTTP_ICMS_REQUEST'] = gzuncompress($_SERVER['HTTP_ICMS_REQUEST']);
        break;
        case 'bzip2':
        case 'bzip2/decompress':
            $_SERVER['HTTP_ICMS_REQUEST'] = bzdecompress($_SERVER['HTTP_ICMS_REQUEST']);
        break;
        case 'lzf':
        case 'lzf/decompress':
            $_SERVER['HTTP_ICMS_REQUEST'] = lzf_decompress($_SERVER['HTTP_ICMS_REQUEST']);
        break;
    }
} else {
    $_SERVER['HTTP_ICMS_REQUEST'] = json_encode($_REQUEST);
}

$data = json_decode($_SERVER['HTTP_ICMS_REQUEST'], true);

if (isset($data['show_headers'])) {
    $show_headers = (bool)intval($data['show_headers']);
    unset($data['show_headers']);
} else {
    $show_headers = false;
}

if (isset($data['logging_enabled'])) {
    $logging_enabled = (bool)intval($data['logging_enabled']);
    unset($data['logging_enabled']);
} else {
    $logging_enabled = false;
}

if (isset($data['base_controls'])) {
    $base_controls = (bool)intval($data['base_controls']);
    unset($data['base_controls']);
} else {
    $base_controls = false;
}

if (isset($data['format'])) {
    $action_handler->output_format = $data['format'];
    unset($data['format']);
} else {
    $action_handler->output_format = 'json';
}

if (isset($data['actions'])) {
    $actions = $data['actions'];
    unset($data['actions']);
} 

if (isset($data['lang'])) {
	unset($data['lang']);
}

$action_handler->render_options = $data;
if ($show_headers)
    $action_handler->includeHeadersInResponse();

$member_handler = icms::handler('icms_member');
$group = $member_handler->getUserBestGroup((icms::$user instanceof icms_member_user_Object) ? icms::$user->getVar('uid') : 0);

if (isset($actions))
    $action_handler->execActionFromArray($actions);

if (!empty($base_controls)) {
    $controls_handler = icms::handler('icms_controls');
    $required = array();
    $diff = array_diff($controls_handler::$renderedControlTypes, $base_controls);

    if (is_array($diff) && !empty($diff)) {
        foreach ($diff as $m_type) {
            $ctl = $controls_handler->make($m_type);
            foreach ($ctl->getRequiredURLs() as $type => $urls)
                if (isset($required[$type]))
                    $required[$type] = array_merge($required[$type], $urls);
                else
                    $required[$type] = $urls;
        }
        unset($m_type, $urls);
    }

    if (!empty($required))
        $action_handler->response->add('load_files', $required);
    unset($diff, $required);
}

if ($logging_enabled)
    $action_handler->includeLoggingInfoInResponse();

$action_handler->render();