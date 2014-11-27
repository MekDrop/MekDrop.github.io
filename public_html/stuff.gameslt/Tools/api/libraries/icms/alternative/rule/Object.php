<?php

/**
 * Rule for handling object alternativelly
 */
class icms_alternative_rule_Object 
    extends icms_ipf_Object {

    /**
     * constructor
     *
     * normally, this is called from child classes only
     * @access public
     */
    public function __construct(&$handler) {
        $this->quickInitVar('altrule_id', self::DTYPE_INTEGER, false, _CO_ICMS_ALTERNATIVE_RULE_ALTRULE_ID, _CO_ICMS_ALTERNATIVE_RULE_ALTERNATIVE_ID_DSC);
        $this->initVar('alternative_id', self::DTYPE_INTEGER, true, _CO_ICMS_ALTERNATIVE_RULE_ALTERNATIVE_ID, _CO_ICMS_ALTERNATIVE_RULE_ALTERNATIVE_ID_DSC);
        $this->initVar('when_group', self::DTYPE_INTEGER, false, _CO_ICMS_ALTERNATIVE_RULE_WHEN_GROUP, _CO_ICMS_ALTERNATIVE_RULE_WHEN_GROUP_DSC);
        $this->initVar('when_module', self::DTYPE_STRING, false, _CO_ICMS_ALTERNATIVE_RULE_WHEN_MODULE, _CO_ICMS_ALTERNATIVE_RULE_WHEN_MODULE_DSC);
        $this->initVar('when_page', self::DTYPE_STRING, false, _CO_ICMS_ALTERNATIVE_RULE_WHEN_PAGE, _CO_ICMS_ALTERNATIVE_RULE_WHEN_PAGE_DSC);
        $this->initVar('then', self::DTYPE_STRING, true, _CO_ICMS_ALTERNATIVE_RULE_THEN, _CO_ICMS_ALTERNATIVE_RULE_THEN_DSC);
        $this->initVar('enabled', self::DTYPE_BOOLEAN, false, _CO_ICMS_ALTERNATIVE_RULE_ENABLED, _CO_ICMS_ALTERNATIVE_RULE_ENABLED_DSC);
        
        $this->setControl('then', array('name' => false,
                                           'object' => $this,
                                           'method' => 'getSupportedAlternatives'));
        $this->setControl('alternative_id', array('name' => false,
                                           'object' => $this,
                                           'method' => 'getPossibleAlternatives'));
        $this->setControl('when_group', array('name' => 'group'));
        $this->setControl('when_module', array('object' => $this,
                                               'method' => 'getPossibleModules'));
        
        $this->doMakeFieldreadOnly('alternative_id');

        parent::__construct($handler);
    }
    
    public function getPossibleModules() {
        $modules_handler = icms::handler('icms_module');
        $list = array('' => '');
        foreach ($modules_handler::getActive() as $module) {
            $name = $module->getVar('name');
            $list[$name] = $name;
        }
        return $list;
    }
    
    public function getPossibleAlternatives() {
        $handler = icms::handler('icms_alternative');
        $ret = array();
        foreach ($handler->getObjects() as $item) {
            $ret[(int)$item->getVar('alt_id')] = $item->getVar('name');
        }
        return $ret;
    }
    
    public function getLinkedAlternative() {
        $handler = icms::handler('icms_alternative');
        return $handler->get($this->getVar('alternative_id', 'n'));
    }
    
    public function getSupportedAlternatives() {
        $alt = $this->getLinkedAlternative();
        $handler = icms::handler('icms_package');
        $criteria = new icms_db_criteria_SQLItem('is_local = 1 AND alt_type = %s AND type = %d AND NOT name = %s', $alt->getVar('name'), $alt->getVar('type'), $alt->getVar('default'));
        $ret = array();
        foreach($handler->getObjects($criteria) as $item)
            $ret[$item->getVar('name')] = $item->getVar('name');
        return $ret;
    }    

}