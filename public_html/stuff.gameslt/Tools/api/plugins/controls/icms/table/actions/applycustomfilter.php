<?php

namespace ImpressCMS\Controls\icms\Table\Actions;

/**
 * Updates table
 *
 * @author mekdrop
 */
class ApplyCustomFilter
    extends \icms_action_base_Control {
    
     private $params = null;
    
     public function __construct($params = array()) {
         $this->params = $params;
         
         parent::__construct($params);
     }
     
     public function updateCriteria(\icms_core_Object &$item) {
         $criteria = new \icms_db_criteria_Compo();
         $sql = array();
         foreach ($this->params as $key => $value) {
             $type = $item->getVarInfo($key, self::VARCFG_TYPE);
             if (!$type)
                 continue;
             $criteria->add(new \icms_db_criteria_Item($key, parent::cleanVar($key, $type, $value)));
         }
         $this->control->criteria = $criteria;
     }
    
     public function exec(icms_action_Response &$response) {
         $handler = $this->control->source;         
         
         if (!($handler instanceof \icms_core_ObjectHandler))
             return $response->error('Problem with handler');                  
         
         $item = $handler->create();
         $this->updateCriteria($item);       
         
         $response->addControlAction($this, 'update');     
     }
    
}