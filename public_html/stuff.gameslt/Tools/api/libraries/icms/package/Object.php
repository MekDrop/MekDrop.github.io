<?php

/**
 * Handles packages system
 */
class icms_package_Object 
    extends icms_ipf_Object {

    // @note starting numbers should be same as alternatives
    const PKG_TYPE_MODULE = 1;
    const PKG_TYPE_CONTROL = 2;
    const PKG_TYPE_LIBRARY = 4;
    const PKG_TYPE_THEME = 8;

    /**
     * constructor
     *
     * normally, this is called from child classes only
     * @access public
     */
    public function __construct(&$handler) {
        $this->initVar('pkg_id', self::DTYPE_STRING);        
        $this->initVar('type', self::DTYPE_INTEGER);
        
        $this->initVar('name', self::DTYPE_STRING);
        $this->initVar('current_version', self::DTYPE_STRING);
        $this->initVar('latest_version', self::DTYPE_STRING);
        $this->initVar('license', self::DTYPE_STRING);
        $this->initVar('title', self::DTYPE_STRING);
        $this->initVar('description', self::DTYPE_STRING);
        $this->initVar('author', self::DTYPE_STRING);
        
        $this->initVar('is_local', self::DTYPE_BOOLEAN);
        $this->initVar('compat', self::DTYPE_STRING);
        $this->initVar('last_update', self::DTYPE_INTEGER);
        $this->initVar('alt_type', self::DTYPE_STRING);
        
        $this->setControl('type', array('name' => false,
                                        'object' => $this,
                                        'method' => 'getSupportedTypes'));
        $this->setControl('name', 'text');        

        parent::__construct($handler);
    }

    
    public function getSupportedTypes() {
        return array(
            self::PKG_TYPE_MODULE => 'Module',
            self::PKG_TYPE_CONTROL => 'Control',
            self::PKG_TYPE_LIBRARY => 'Library',
            self::PKG_TYPE_THEME => 'Theme'
        );
    }           

}