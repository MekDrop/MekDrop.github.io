<?php

/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */

/**
 * Description of device
 *
 * @author mekdrop
 */
class XDevice {

    public static $devices = array(
        'iOS' => array(
            'iPhone' => array(
                '320x480',
                '640x960',
                '640x1136'
            ),
            'iPad' => array(
                '2048x1536',
                '1024x768',
            ),
        ),
        'Android' => array(
            'Acer' => array(
                '240x320',
                '480x800',
                '1280x800',
                '1024x600',
            ),
            'Ainol' => array(
                '1024x600',
                '800x480'
            ),
            'Advent' => array(
                '1024x600'
            ),
            'AOC' => array(
                '800x600'
            ),
            'Archos' => array(
                '800x480',
                '320x240',
                '400x240',
                '480x854',
                '1024x600',
                '800x600',
                '1024x768',
                '1024x600',
                '1280x800',
            ),
            'PAC' => array(
                '1024x720',
            ),
            'Asus' => array(
                '540x960',
                '720x1280',
                '1280x800',
                '1920x1200',
            ),
            'AUGEN_Electronics' => array(
                '800x480',
            ),
            'Barnes&Noble' => array(
                '1024x600'
            ),
            'HTC' => array(
                '320x480',
                '480x800',
                '540x960',
                '720x1280',
                '1024x600',
            ),
            'LG' => array(
                '320x480',
                '480x800',
                '1024x768',
                '1280x720',
                '1280x768'
            ),
            'Motorola' => array(
                '540x960',
                '720x1280',
                '240x320',
                '480x854',
                '540x960',
                '320x240',
                '320x480',
                '1280x720',
                '1280x800'
            ),
            'Notion_Ink' => array(
                '1024x600',
            ),
            'Pandigital' => array(
                '800x600'
            ),
            'Quanta_Computer' => array(
                '1024x600',
            ),
            'Panasonic' => array(
                '540x960',
                '720x1280'
            ),
            'Samsung' => array(
                '480x800',
                '240x320',
                '320x480',
                '240x400',
                '480x800',
                '720x1280',
                '1280x720',
                '1280x800',
                '1024x600',
            ),
            'Síragon' => array(
                '1280x800'
            ),
            'Sony' => array(
                '480x320',
                '854x480',
                '960x540',
                '1280x720',
                '1280×800',
            ),
            'Toshiba' => array(
                '1024x600',
                '1280x800'
            ),
            'ViewSonic' => array(
                '1024x600',
                '800x480'
            ),
            'Vizio' => array(
                '1024x768'
            ),
            'Sony_Ericsson' => array(
                '480x854',
                '240x320',
                '320x480'
            ),
            'Alcatel' => array(
                '240x320'
            ),
            'Bluelans_Communication' => array(
                '240x320',
                '240x400',
            ),
            'CD-R_King' => array(
                '480x800',
            ),
            'Cherry_Mobile' => array(
                '480x800',
                '320x480',
                '800x480',
            ),
            'Coby' => array(
                '800x480'
            ),
            'Creative' => array(
                '480x800',
                '1024x600'
            ),
            'CSL' => array(
                '240x640'
            ),
            'Dell' => array(
                '360x640',
                '480x800',
                '800x480',
            ),
            'Entourage' => array(
                '1024x600',
                '800x480'
            ),
            'Garmin' => array(
                '320x480'
            ),
            'GeeksPhone' => array(
                '320x240'
            ),
            'Huawei' => array(
                '320x480',
                '240x320',
                '480x854',
            ),
            'INQ' => array(
                '320x480'
            ),
            'i-Mobile' => array(
                '320x480',
                '480x800',
            ),
            'Kyocera-Sanyo' => array(
                '480x800'
            ),
            'Lenovo' => array(
                '800x480'
            ),
            'Meizu' => array(
                '640x960',
            ),
            'NEC' => array(
                '480x854',
                '480x800',
            ),
            'Nexian' => array(
                '320x480',
            ),
            'Ouku' => array(
                '480x320'
            ),
            'Pantech' => array(
                '480x800',
            ),
            'Vibo' => array(
                '320x480',
            ),
            'Videocon' => array(
                '480x320',
            ),
            'ZTE' => array(
                '480x800',
                '240x320',
                '800x400'
            ),
        )
    );
    
    public static function getRandomOS() {
        return self::randInArray(self::$devices);
    }
    
    public static function getRandomDevice($os) {
        return self::randInArray(self::$devices[$os]);
    }
    
    public static function getRandomResolution($os, $device) {
        $i = self::randInArray(self::$devices[$os][$device]);
        return self::$devices[$os][$device][$i];
    }
    
    public static function generateRandomAgent() {
        $os = self::getRandomOS();
        $device = self::getRandomDevice($os);
        $resolution = self::getRandomResolution($os, $device);
        $language = 'en';
        return sprintf('%s/%s %s/%s %s/%s %s', 
                       'FreeApp', '1.0',
                       $os, '1.0',
                       $device, $resolution,
                       $language);
    }
    
    private static function randInArray(&$array) {
        $count = count($array);
        if ($count == 1)
            return key($array);
        $keys = array_keys($array);
        $i = mt_rand(0, $count - 1);
        return $keys[$i];
    }
    
    private function __construct() {}

}