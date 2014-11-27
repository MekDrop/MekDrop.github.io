<?php

namespace ImpressCMS\Controls\icms\Form;

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
        
        $this->initVar('autofocus', self::DTYPE_BOOLEAN, false, false, self::RENDER_TYPE_STATE);
        $this->initVar('name', self::DTYPE_STRING, '', false, self::RENDER_TYPE_ATTRIBUTE);
        $this->initVar('action', self::DTYPE_STRING, '', false, self::RENDER_TYPE_ATTRIBUTE);
        $this->initVar('enctype', self::DTYPE_STRING, 'application/x-www-form-urlencoded', false, self::RENDER_TYPE_ATTRIBUTE, array(self::VARCFG_POSSIBLE_OPTIONS => array('application/x-www-form-urlencoded', 'multipart/form-data', 'text/plain')));
        $this->initVar('method', self::DTYPE_STRING, 'post', false, self::RENDER_TYPE_ATTRIBUTE, array(self::VARCFG_POSSIBLE_OPTIONS => array('post', 'get')));
        //$this->initVar('accept-charset', self::DTYPE_STRING, false, false, self::RENDER_TYPE_ATTRIBUTE);
        $this->initVar('target', self::DTYPE_STRING, '_self', false, self::RENDER_TYPE_ATTRIBUTE);
        $this->initVar('novalidate', self::DTYPE_BOOLEAN, false, false, self::RENDER_TYPE_STATE);
        $this->initVar('autocomplete', self::DTYPE_BOOLEAN, false, false, self::RENDER_TYPE_STATE);        
        
        parent::__construct($params);
        
        $this->baseTag = 'form';
        
    }
    
    
}