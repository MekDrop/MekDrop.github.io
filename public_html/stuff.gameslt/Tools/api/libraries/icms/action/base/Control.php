<?php

/**
 * Action class to use for control
 *
 * @author admin
 */
abstract class icms_action_base_Control
    extends icms_action_base_Module {
    
    const RESPONSE_KEY_INNER_HTML = 'icms_inner_html';
    const RESPONSE_KEY_SELECTOR = 'icms_content_selector';
    const RESPONSE_KEY_CHANGED_PROPERTIES = 'icms_changed_properties';
    
    protected $control = null;
    
    public function __get($name) {
        switch ($name) {
            case 'control':
                return $this->control;
            default:
                return parent::__get($name);
        }
    }
    
    public function __set($name, $value) {
        switch ($name) {
            case 'control':
                if ($this->control == null)
                    $this->control = $value;
            break;
            default:
                parent::__set($name, $value);
        }
    }
    
}
