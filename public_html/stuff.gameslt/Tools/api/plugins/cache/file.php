<?php
namespace ImpressCMS\Cache\System;

/**
 * Cache some data in files
 *
 * @author mekdrop
 */
class File
  extends \icms_cache_Object {
   
  public function connect($host = null, $port = null, $login = null, $pass = null) {
      return true;
  }
  
  public function disconnect() {
      return true;
  }
  
  protected function getFilename($objectName, $key) {
      $filename = ICMS_CACHE_PATH . '/objects/' . $objectName . '/';
      if (!is_dir($filename))
          @mkdir($filename, 0777, true);
      $filename .= sha1($key) . '-' . strlen($key) . '.dat';
      return $filename;
  }
  
  public function get($objectName, $key, $defaultValue = null) {
      $filename = $this->getFilename($objectName, $key);
      if (!file_exists($filename) || (filemtime($filename) - time()) > $this->cacheTime)
          return $defaultValue;
      \icms::$logger->addExtra('cache', 'Reading ' . $objectName . '::' . $key);
      return unserialize(file_get_contents($filename));
  }
  
  public function store($objectName, $key, $value) {
      $filename = $this->getFilename($objectName, $key);
      if (file_put_contents($filename, serialize($value))) {
          \icms::$logger->addExtra('cache', 'Saved ' . $objectName . '::' . $key);
      } else {
          \icms::$logger->addExtra('cache', 'Not saved ' . $objectName . '::' . $key);
      }
  }
  
  public function delete($objectName, $key) {
      $filename = $this->getFilename($objectName, $key);      
      if (unlink($filename)) {
          \icms::$logger->addExtra('cache', 'Deleted ' . $objectName . '::' . $key);
      } else {
          \icms::$logger->addExtra('cache', 'Not deleted ' . $objectName . '::' . $key);
      }
  }
    
}