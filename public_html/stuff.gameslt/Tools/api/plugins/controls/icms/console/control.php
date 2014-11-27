<?php

namespace ImpressCMS\Controls\icms\Console;

/**
 * This control handles console
 *
 * @author mekdrop
 * 
 * @property bool $interactive Can user add some messages?
 */
class Control
    extends \icms_controls_Base
    implements \icms_controls_iHasContent {
    
    public function __construct($params = array()) {
        
        $this->initVar('interactive', self::DTYPE_BOOLEAN, array(), true, self::RENDER_TYPE_DATA);
        $this->initVar('prompt', self::DTYPE_STRING, '$P$G', false, self::RENDER_TYPE_DATA);
        
        parent::__construct($params);
        
        $this->baseTag = 'ul';
    }        
    
    public function getContent() {                
        if ($this->interactive)
            return '<li id="' . $this->id . '_cmd"><span id="' . $this->id . '_cmd_prompt"></span><input type="text" id="' . $this->id . '_cmd_input" /></li>';
        else
            return '';
    }
    
}