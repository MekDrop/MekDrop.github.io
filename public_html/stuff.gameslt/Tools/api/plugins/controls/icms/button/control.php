<?php

namespace ImpressCMS\Controls\icms\Button;

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
    
    public $html = '';
    
    public function __construct($params) {       
        
        $this->initVar('autofocus', self::DTYPE_BOOLEAN, false, false, self::RENDER_TYPE_STATE);
        $this->initVar('disabled', self::DTYPE_BOOLEAN, false, false, self::RENDER_TYPE_STATE);
        $this->initVar('form', self::DTYPE_STRING, '', false, self::RENDER_TYPE_ATTRIBUTE);
        $this->initVar('formaction', self::DTYPE_STRING, '', false, self::RENDER_TYPE_ATTRIBUTE);
        $this->initVar('formenctype', self::DTYPE_STRING, '', false, self::RENDER_TYPE_ATTRIBUTE, array(self::VARCFG_POSSIBLE_OPTIONS => array('application/x-www-form-urlencoded', 'multipart/form-data', 'text/plain', '')));
        $this->initVar('formmethod', self::DTYPE_STRING, '', false, self::RENDER_TYPE_ATTRIBUTE, array(self::VARCFG_POSSIBLE_OPTIONS => array('post', 'get', '')));
        $this->initVar('formnovalidate', self::DTYPE_BOOLEAN, false, false, self::RENDER_TYPE_STATE);
        $this->initVar('formtarget', self::DTYPE_STRING, '', false, self::RENDER_TYPE_ATTRIBUTE);
        $this->initVar('name', self::DTYPE_STRING, '', false, self::RENDER_TYPE_ATTRIBUTE);
        $this->initVar('type', self::DTYPE_STRING, 'button', false, self::RENDER_TYPE_ATTRIBUTE, array(self::VARCFG_POSSIBLE_OPTIONS => array('button', 'reset', 'submit')));
        $this->initVar('value', self::DTYPE_STRING, '', false, self::RENDER_TYPE_ATTRIBUTE);
        
        parent::__construct($params);       
        
        $this->baseTag = 'button';
        
    }
    
}