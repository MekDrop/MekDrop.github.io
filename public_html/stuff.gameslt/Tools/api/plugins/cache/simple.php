<?php

namespace ImpressCMS\Cache\System;

/**
 * Cache some data in files
 *
 * @author mekdrop
 */
class Simple
  extends \icms_cache_Object {
    
  protected $cached_items = array();

  public function connect($host = null, $port = null, $login = null, $pass = null) {
      return true;
  }
  
  public function disconnect() {
      return true;
  }  
  
  public function get($objectName, $key, $defaultValue = null) {
      if (isset($this->cached_items[$objectName][$key])) {
          if (time() - $this->cached_items[$objectName][$key][0] > $this->cacheTime) {
              unset($this->cached_items[$objectName][$key]);
              return $defaultValue;
          } else {
              return $this->cached_items[$objectName][$key][1];
          }
      } else {
          return $defaultValue;
      }      
  }
  
  public function store($objectName, $key, $value) {
      $this->cached_items[$objectName][$key] = array(
          time(),
          $value
      );
  }
  
  public function delete($objectName, $key) {
      unset($this->cached_items[$objectName][$key]);
  }  
    
}