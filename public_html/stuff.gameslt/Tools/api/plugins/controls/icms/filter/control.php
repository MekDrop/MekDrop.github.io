<?php

namespace ImpressCMS\Controls\icms\Filter;

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
        
        $this->initVar('linked_control', self::DTYPE_STRING, '', true, self::RENDER_TYPE_DATA);
        $this->initVar('filter', self::DTYPE_ARRAY, array(), false, self::RENDER_TYPE_DATA);
        $this->initVar('hidden_filter', self::DTYPE_ARRAY, array(), false, self::RENDER_TYPE_DATA);                
        
        parent::__construct($params);       
        
        $this->baseTag = 'div';
        
    }
    
}