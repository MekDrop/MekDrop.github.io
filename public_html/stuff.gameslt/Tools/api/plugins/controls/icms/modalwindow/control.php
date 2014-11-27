<?php

namespace ImpressCMS\Controls\icms\ModalWindow;

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
        
        $this->initVar('top', self::DTYPE_INTEGER, '100', false, self::RENDER_TYPE_ATTRIBUTE);
        $this->initVar('overlay', self::DTYPE_FLOAT, 0.5, false, self::RENDER_TYPE_ATTRIBUTE);
        $this->initVar('close-button', self::DTYPE_STRING, null, false, self::RENDER_TYPE_ATTRIBUTE);
        
        parent::__construct($params);
        
        $this->baseTag = 'div';
    }
   
}