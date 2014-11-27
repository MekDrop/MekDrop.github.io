<?php

/**
 * Handler for alternatives
 */
class icms_alternative_rule_Handler extends icms_ipf_Handler {

    public function __construct(&$db) {
        parent::__construct($db, 'alternative_rule', 'altrule_id', 'when_area', 'then', 'icms');
    }
    
    /**
     * Updates cache after saving object
     * 
     * @param icms_alternative_rule_Object $obj
     */
    protected function afterSave(icms_alternative_rule_Object &$obj) {        
        $linked_alternative = $obj->getLinkedAlternative();
        $linked_alternative->updateCache();
    }

}