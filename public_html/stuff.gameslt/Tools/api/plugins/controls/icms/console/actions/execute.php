<?php

namespace ImpressCMS\Controls\icms\Console\Actions;

/**
 * Delete row from table
 *
 * @author mekdrop
 */
class Execute
    extends \icms_action_base_Control {
    
     public function __construct($params = array()) {
         $this->initVar('cmd', self::DTYPE_STRING);
         
         parent::__construct($params);
     }
    
     public function exec(\icms_action_Response &$response) {
         
     }
    
}