<?php

/**
 * If you define this class for control it will be called automatically when params changes on client
 *
 * @author mekdrop
 */
abstract class icms_controls_actions_PropertyChanged 
    extends icms_action_base_Control {
    
    public function __construct($params = array()) {
        $this->initVar('name', self::DTYPE_STRING, '', true);
        $this->initVar('value', self::DTYPE_STRING, '', true);
        
        parent::__construct($params);
    }
    
}