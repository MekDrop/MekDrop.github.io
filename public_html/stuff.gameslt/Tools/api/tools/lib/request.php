<?php

class XRequest {
    
    public static $USER_AGENT = 'Mozilla/5.0 (Windows; U; Windows NT 5.1; en-US) AppleWebKit/525.13 (KHTML, like Gecko) Chrome/0.2.149.29 Safari/525.13';
    
    public static function doRequest($module, $action, $otherParams = array()) {        
        $logging_enabled = ST_LOGGING;
        $params = array_merge(compact('module', 'action', 'logging_enabled'), $otherParams);        
        $url = ST_HOST . '/index.php?' . http_build_query($params);        
        XLogger::log('Fetching %s...', $url, json_encode($params));
        $ms = microtime(true);
        $ch = curl_init($url);
        curl_setopt_array($ch, array(
            CURLOPT_USERAGENT => self::$USER_AGENT,
            CURLOPT_COOKIEFILE => dirname(__DIR__) . '/cache/tools-cookies.dat',
           // CURLOPT_POSTFIELDS => $params,
            CURLOPT_RETURNTRANSFER => 1,
            CURLOPT_FAILONERROR => 1,
        ));
        $data = curl_exec($ch);
        curl_close($ch);        
        if (!$data)
            return trigger_error('request', E_USER_ERROR);
        $rez = json_decode($data, true);
	if (ST_SHOW_RESULTS)
	    XLogger::log('Got results: %s', (!$rez)?$data:$rez);
        $time = abs(microtime(true) - $ms);
        XLogger::log('Action took: %s', $time);
        XTest::getInstance()->writeAction($action, $time);
        
        if ($rez === null)
            return trigger_error('request', E_USER_ERROR);
        elseif (isset($rez['error']))
            return trigger_error($rez['error']);
        else
            return $rez;
    }
    
    public static function doRandomSleep() {
        if (ST_SLEEPTIME < 1)
            return;
        $time = mt_rand(1, ST_SLEEPTIME) * 100;
        XLogger::log('Sleeping for %d ms', $time);
        usleep($time);        
    }
    
    public static function fetchURL($url) {
        XLogger::log('Fetching %s...', $url);
        $ch = curl_init($url);
        curl_setopt_array($ch, array(
            CURLOPT_USERAGENT => self::$USER_AGENT,
            CURLOPT_COOKIEFILE => dirname(__DIR__) . '/cache/tools-cookies.dat',
            CURLOPT_POSTFIELDS => $params,
            CURLOPT_RETURNTRANSFER => 1,
            CURLOPT_FAILONERROR => 1,
        ));
        $data = curl_exec($ch);
        XLogger::log('Got results with length %s', strlen($data));
        return $data;
    }
    
    private function __construct() {}
    
    
}