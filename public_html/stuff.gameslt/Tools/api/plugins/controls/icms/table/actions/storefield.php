<?php

namespace ImpressCMS\Controls\icms\Table\Actions;

/**
 * Updates table
 *
 * @author mekdrop
 */
class StoreField
    extends \icms_action_base_Control {
    
     public function __construct($params = array()) {
         $this->initVar('field', self::DTYPE_STRING);
         $this->initVar('value', self::DTYPE_OTHER);
         $this->initVar('item_id', self::DTYPE_INTEGER);
         
         parent::__construct($params);
     }
    
     public function exec(icms_action_Response &$response) {
         $handler = $this->control->source;
         if (!($handler instanceof \icms_core_ObjectHandler))
             return $response->error('Problem with handler');
         $item = $handler->get($this->item_id);
         if (!$item || $item->isNew())
             return $response->error('Object doesn\'t exists');
         $item->setVar($this->field, $this->value);
         $item->store(true);         
     }
    
}