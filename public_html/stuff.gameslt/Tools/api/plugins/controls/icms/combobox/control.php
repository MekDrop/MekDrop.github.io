<?php

namespace ImpressCMS\Controls\icms\ComboBox;

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
    extends \icms_controls_Base 
    implements \icms_controls_iHasContent {
    
    public function __construct($params) {       
        
        $this->initVar('autofocus', self::DTYPE_BOOLEAN, false, false, self::RENDER_TYPE_STATE);
        $this->initVar('disabled', self::DTYPE_BOOLEAN, false, false, self::RENDER_TYPE_STATE);
        $this->initVar('form', self::DTYPE_STRING, '', false, self::RENDER_TYPE_ATTRIBUTE);        
        $this->initVar('name', self::DTYPE_STRING, '', false, self::RENDER_TYPE_ATTRIBUTE);
        $this->initVar('multiple', self::DTYPE_BOOLEAN, false, false, self::RENDER_TYPE_STATE);
        
        $this->initVar('items', self::DTYPE_ARRAY, array(), false, self::RENDER_TYPE_DATA);
        $this->initVar('value', self::DTYPE_LIST, array(), false, self::RENDER_TYPE_DATA);
        
        $this->initVar('source', self::DTYPE_DATA_SOURCE, '', false, self::RENDER_TYPE_DATA);
        $this->initVar('srules', self::DTYPE_CRITERIA, '', false, self::RENDER_TYPE_DATA);                
        
        parent::__construct($params);
        
        $this->baseTag = 'select';
        
    }
    
    public function getContent() {        
        
        if ($this->source) {
            $criteria = $this->srules?(new \icms_db_criteria_SQLItem($this->srules)):null;
            $this->items = $this->source->getList($criteria);
        }
        
        $content = '';
        foreach ($this->items as $key => $value)
            $content .= '<option value="' . $key . '"'.(in_array($key, $this->value)?' selected="selected"':'').'>' . $value . '</option>';
        return $content;
    }
    
    public function getAttributes() {
        $ret = parent::getAttributes();
        $ret['size'] = 1;
        return $ret;
    } 
    
}