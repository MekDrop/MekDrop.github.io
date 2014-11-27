<?php

namespace ImpressCMS\Controls\icms\Label;

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
    
    protected $text = '';

    public function __construct($params) {       
        
        $this->initVar('title', self::DTYPE_STRING, '', false, self::RENDER_TYPE_ATTRIBUTE);
        $this->initVar('for', self::DTYPE_STRING, '', false, self::RENDER_TYPE_ATTRIBUTE);
        
        parent::__construct($params);
        
        $this->baseTag = 'label';
    }        
    
}