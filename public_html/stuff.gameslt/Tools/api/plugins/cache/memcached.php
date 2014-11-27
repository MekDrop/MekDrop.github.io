<?php

namespace ImpressCMS\Cache\System;

/**
 * Cache some data in files
 *
 * @author mekdrop
 */
class Memcached
  extends \icms_cache_Object {
  
  /**
   * Memcached connection
   *
   * @var Memcached
   */
  protected $connection;
    
  public function __construct(&$handler, $data) {
    parent::__construct($handler, $data);
    $this->connection = new \Memcached();
  }      
   
  public function connect($host = null, $port = null, $login = null, $pass = null) {
      $this->connection->resetServerList();
      if ($login != null)
          $this->connection->setSaslAuthData($login, $pass);      
      $this->connection->addServer($host, $port);
  }
  
  public function disconnect() {
      return $this->connection->quit();
  }
  
  protected function getPath($objectName, $key) {
      return 'objects/' . $objectName . '/' . sha1($key) . '-' . strlen($key);
  }
  
  public function get($objectName, $key, $defaultValue = null) {
      $path = $this->getPath($objectName, $key);
      $data = $this->connection->get($path);
      if ($data == false && $this->connection->getResultCode() == Memcached::RES_NOTFOUND)
            return $defaultValue;
      return $data;
  }
  
  public function store($objectName, $key, $value) {
      $path = $this->getPath($objectName, $key);
      $this->connection->set($path, $value, time() + $this->cacheTime);
  }
    
}