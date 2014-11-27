<?php

namespace ImpressCMS\Controls\icms\Slider;

/**
 * This control handles table
 *
 * @author mekdrop
 * 
 * @property int $recordsCount
 * @property int $perPage
 * @property int $page
 */
class Control
    extends \icms_controls_Base {    
    
    public function __construct($params) {                
        
        $this->initVar('min', self::DTYPE_INTEGER, 0, false, self::RENDER_TYPE_ATTRIBUTE);
        $this->initVar('max', self::DTYPE_INTEGER, 50, false, self::RENDER_TYPE_ATTRIBUTE);        
        $this->initVar('value', self::DTYPE_INTEGER, 0, false, self::RENDER_TYPE_ATTRIBUTE);
        $this->initVar('step', self::DTYPE_INTEGER, 1, false, self::RENDER_TYPE_ATTRIBUTE);
        $this->initVar('auto_title', self::DTYPE_BOOLEAN, true, false, self::RENDER_TYPE_DATA);  
        
        parent::__construct($params); 
        
        $this->baseTag = 'input';
    }
    
    public function getAttributes($skipFalse = true) {
        $ret = parent::getAttributes($skipFalse);
        $ret['type'] = 'range';
        return $ret;
    }   
    
}