<?php

namespace ImpressCMS\Controls\icms\Table\Actions;

/**
 * Delete row from table
 *
 * @author mekdrop
 */
class Delete
    extends \icms_action_base_Control {
    
     public function __construct($params = array()) {
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
         $item->delete();
         
         $response->addControlAction($this, 'update');
     }
    
}