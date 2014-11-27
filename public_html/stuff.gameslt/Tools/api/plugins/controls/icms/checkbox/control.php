<?php

namespace ImpressCMS\Controls\icms\Checkbox;

class Control
    extends \icms_controls_Base {
    
    public function __construct($params) {       
        
        $this->initVar('confirm_msg', self::DTYPE_STRING, '', false, self::RENDER_TYPE_DATA);
        $this->initVar('autofocus', self::DTYPE_BOOLEAN, false, false, self::RENDER_TYPE_STATE);
        $this->initVar('disabled', self::DTYPE_BOOLEAN, false, false, self::RENDER_TYPE_STATE);
        $this->initVar('form', self::DTYPE_STRING, '', false, self::RENDER_TYPE_ATTRIBUTE);
        $this->initVar('formaction', self::DTYPE_STRING, '', false, self::RENDER_TYPE_ATTRIBUTE);
        $this->initVar('formenctype', self::DTYPE_STRING, 'application/x-www-form-urlencoded', false, self::RENDER_TYPE_ATTRIBUTE, array(self::VARCFG_POSSIBLE_OPTIONS => array('application/x-www-form-urlencoded', 'multipart/form-data', 'text/plain')));
        $this->initVar('formmethod', self::DTYPE_STRING, 'post', false, self::RENDER_TYPE_ATTRIBUTE, array(self::VARCFG_POSSIBLE_OPTIONS => array('post', 'get')));
        $this->initVar('formnovalidate', self::DTYPE_BOOLEAN, false, false, self::RENDER_TYPE_STATE);
        $this->initVar('formtarget', self::DTYPE_STRING, '_self', false, self::RENDER_TYPE_ATTRIBUTE);
        $this->initVar('name', self::DTYPE_STRING, '', false, self::RENDER_TYPE_ATTRIBUTE);
        $this->initVar('value', self::DTYPE_BOOLEAN, '', false, self::RENDER_TYPE_ATTRIBUTE);
        $this->initVar('change_action', self::DTYPE_STRING, '', false, self::RENDER_TYPE_DATA);
        
        parent::__construct($params);       
        
        $this->baseTag = 'input';
        
    }
    
    public function getAttributes() {
        $ret = parent::getAttributes();
        $ret['type'] = 'checkbox';
        $ret['value'] = 1;
        if ($this->value)
            $ret['checked'] = 'checked';            
        return $ret;
    }   
    
}