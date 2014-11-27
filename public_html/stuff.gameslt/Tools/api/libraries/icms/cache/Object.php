<?php

class icms_cache_Object
    extends icms_core_Object {
    
    /**
     * Handler binded for this object
     *
     * @var icms_cache_Handler 
     */
    public $handler;
    
    /**
     * How long cache data
     *
     * @var int 
     */
    public $cacheTime;
    
    public function __construct(&$handler, $data) {
         $this->initVar('cid', self::DTYPE_INTEGER, 0, true);
         $this->initVar('path', self::DTYPE_STRING, '', true);
         $this->initVar('name', self::DTYPE_STRING, '', true);
       
         $this->_values = $data;
         $this->handler = $handler;         
         
         $this->cacheTime = SDATA_CACHE_TIME;
    }
    
    public function store($objectName, $key, $value) {
        Throw new Exception('Not implemented');
    }
    
    public function delete($objectName, $key) {
        Throw new Exception('Not implemented');
    }
    
    public function get($objectName, $key, $defaultValue = null) {
        Throw new Exception('Not implemented');
    }    
    
    public function connect($host = null, $port = null, $login = null, $pass = null) {
        Throw new Exception('Not implemented');
    }
    
    public function disconnect() {
        Throw new Exception('Not implemented');
    }
    
}