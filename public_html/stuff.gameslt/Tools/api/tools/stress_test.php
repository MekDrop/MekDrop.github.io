<?php

ob_implicit_flush(true);
set_time_limit(0);
date_default_timezone_set('UTC');

if (isset($_GET['host']))
    define('ST_HOST', $_GET['host']);
else 
    die('Testing server not found!');

define('ST_SLEEPTIME', isset($_GET['maxtime'])?(int)$_GET['maxtime']:0);
define('ST_SHOW_RESULTS', isset($_GET['results'])?(bool)$_GET['results']:false);
define('ST_LOGGING', isset($_GET['logging'])?$_GET['logging']:'no');
define('SYS_TEST_MODE', isset($_REQUEST['test']) && $_REQUEST['test']);

require 'lib/request.php';
require 'lib/device.php';
require 'lib/logger.php';
require 'lib/test.php';

$test = XTest::getInstance();

$email = str_repeat(base_convert(mt_rand(0, 65550), 10, 22), 10) . '@testing.on-5.com';
$pass = str_repeat(base_convert(mt_rand(0, 65550), 10, 22), 10);

XRequest::$USER_AGENT = XDevice::generateRandomAgent();
XLogger::log('Selected user agent: %s', XRequest::$USER_AGENT);
XLogger::log('Email: %s', $email);
XLogger::log('Pass: %s', $pass);

XRequest::doRandomSleep();

// Registering new user
try {
    $ret = XRequest::doRequest('freeapp', SYS_TEST_MODE?'Test':'Register', array(
        'pass1' => $pass,
        'pass2' => $pass,
        'email' => $email
    ));
} catch (Exception $e) {
    die('Existing due error #1');
}

if (SYS_TEST_MODE)
    die();
//exit();

XRequest::doRandomSleep();

// Trying to loging in 
try {
    $ret = XRequest::doRequest('freeapp', 'Login', array(
        'pass' => $pass,
        'uname' => $email
    ));
} catch (Exception $e) {
    die('Existing due error #2');
}


$page = 0;
$n = 0;
while($n++ < 21) {
    // Trying to get apps list
    try {
        $ret = XRequest::doRequest('freeapp', 'GetList', array(
                    'page' => $page,
                    'type' => 'free'
                ));
    } catch (Exception $e) {
        die('Existing due error #3');
    }
    
    if (empty($ret['apps']))
        $page -= 2;
        if ($page < 0)
            break 2;
    else {
        foreach ($ret['apps'] as $app)
            foreach (array('high_banner', 'wide_banner', 'small_banner', 'icon') as $image)
                if (isset($app[$image]['url']) && !empty($app[$image]['url'])) {
                    //XRequest::fetchURL($app[$image]['url']);
                    break;
                }
        XRequest::doRandomSleep();
        if ($page > 0) {
            $rand = mt_rand(0, 10);
            switch($rand) {
                case 0:
                    XLogger::log('Page++...');
                    $page++;
                break;
                case 1:
                    XLogger::log('Page--...');
                    $page--;
                break;
                case (( $rand > 1) && ($rand < 10)):
                    $applistid = mt_rand(0, count($ret['apps']) - 1);
                    $applistid = $ret['apps'][$applistid]['appslistitem_id'];
                    $ret = XRequest::doRequest('freeapp', 'GetApp', array(
                        'appslistitem_id' => $applistid,
                    ));
                    XRequest::doRandomSleep();
                break;
                case 10:
                    XLogger::log('Exiting...');
                    break 2;
            }
        } else {
            $page++;
        }
    }
}

