<?php

namespace ImpressCMS\Controls\icms\Image;

/**
 * Image control
 *
 * @author mekdrop
 */
class Control 
    extends \icms_controls_Base {
    
    public function __construct($params) {
        
        $this->initVar('src', self::DTYPE_STRING, null, true, self::RENDER_TYPE_ATTRIBUTE);
        $this->initVar('alt', self::DTYPE_STRING, null, true, self::RENDER_TYPE_ATTRIBUTE);
        $this->initVar('height', self::DTYPE_INTEGER, null, false, self::RENDER_TYPE_ATTRIBUTE);
        $this->initVar('width', self::DTYPE_INTEGER, null, false, self::RENDER_TYPE_ATTRIBUTE);
        $this->initVar('ismap', self::DTYPE_BOOLEAN, null, false, self::RENDER_TYPE_STATE);
        $this->initVar('usemap', self::DTYPE_STRING, null, false, self::RENDER_TYPE_ATTRIBUTE);        
        
        parent::__construct($params);
        
        $this->baseTag = 'img';
        
    }
    
}