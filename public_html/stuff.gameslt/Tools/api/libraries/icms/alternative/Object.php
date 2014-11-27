<?php

/**
 * Handles alternative object
 * 
 * @property string $name         Alternative name
 * @property int $type            Type of alternative list
 * @property array $selected      Selections list
 * @property string $default      Default alternative
 * @property array  $available    Available alternatives
 */
class icms_alternative_Object 
    extends icms_ipf_Object {

    const ALT_TYPE_MODULE = 1;
    const ALT_TYPE_CONTROL = 2;

    /**
     * constructor
     *
     * normally, this is called from child classes only
     * @access public
     */
    public function __construct(&$handler) {
        $this->quickInitVar('alt_id', self::DTYPE_STRING, false, _CO_ICMS_ALTERNATIVE_ALT_ID, _CO_ICMS_ALTERNATIVE_ALT_ID_DSC);
        $this->quickInitVar('name', self::DTYPE_STRING, true, _CO_ICMS_ALTERNATIVE_NAME, _CO_ICMS_ALTERNATIVE_NAME_DSC);
        $this->quickInitVar('type', self::DTYPE_INTEGER, true, _CO_ICMS_ALTERNATIVE_TYPE, _CO_ICMS_ALTERNATIVE_TYPE_DSC);
        $this->quickInitVar('default', self::DTYPE_STRING, true, _CO_ICMS_ALTERNATIVE_DEFAULT, _CO_ICMS_ALTERNATIVE_DEFAULT_DSC);
        
        $this->setControl('type', array('name' => false,
                                        'object' => $this,
                                        'method' => 'getSupportedTypes'));
        
        $this->setControl('default', array('name' => false,
                                           'object' => $this,
                                           'method' => 'getSupportedAlternatives'));
        
        if (!$this->isNew())
            $this->makeFieldReadOnly('type');
        
        $this->setControl('name', 'text');        

        parent::__construct($handler);
    }
    
    public function getSupportedAlternatives() {
        $handler = icms::handler('icms_package');
        $criteria = new icms_db_criteria_SQLItem(
                'is_local = 1 AND alt_type = %s AND type = %d', 
                $this->getVar('name'), 
                $this->getVar('type')
        );
        $ret = array();
        foreach($handler->getObjects($criteria) as $item)
            $ret[$item->getVar('name')] = $item->getVar('name');
        return $ret;
    }

    public function getRules($asArray = false) {
        $handler = icms::handler('icms_alternative_rule');
        $criteria = new icms_db_criteria_SQLItem('alternative_id = %d', $this->getVar('alt_id', 'n'));
        return $handler->getObjects($criteria, false, $asArray);
    }
    
    public function updateCache() {
        $this->handler->updateCache($this->getVar('type'), $this->getVar('name'));
    }
    
}