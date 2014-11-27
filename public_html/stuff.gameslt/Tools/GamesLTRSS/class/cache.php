<?php
/**
 * Description of cache
 *
 * @author Raimondas
 */
class gcCache {
    
    public static function get($key, $defaultValue = null) {
        $db = gcDB::getInstance();
        $data = $db->quickFetch('key = \''.str_pad(sha1($key) . ';' . substr($key, 0, 1) . ';' . substr($key, -1) . ';' . strlen($key), 50, '_', STR_PAD_LEFT).'\' AND liveuntil > '.time().' LIMIT 1', 'cache', array('value'), true);
        if (empty($data))
            return $defaultValue;
        return json_decode($data[0]);
    }
    
    public static function set($key, $value, $alive = 1000) {        
        $db = gcDB::getInstance();
        $data = array('hash' => str_pad(sha1($key) . ';' . substr($key, 0, 1) . ';' . substr($key, -1) . ';' . strlen($key), 50, '_', STR_PAD_LEFT) , 'value' => json_encode($value, true), 'lifeuntil' => time() + $alive);
        $db->query('DELETE FROM cache WHERE hash = \'' . $data['hash'] . '\'');
        return $db->quickInsert($data, 'cache');
    }
    
    private function __construct() {
    }
    
}