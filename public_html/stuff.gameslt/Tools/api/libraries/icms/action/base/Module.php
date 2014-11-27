<?php
/**
 * Special action executed when doing request. Returns data for application but not for user
 *
 * @author mekdrop
 */
abstract class icms_action_base_Module
    extends icms_properties_Handler {
    
    const SR_NOTHING = 0;
    const SR_LOGIN = 1;
    const SR_NOLOGIN = 2;
    
    protected $special_requirements = self::SR_NOTHING;
    
    /**
     * Constructor
     *
     * @param array $params Array with keys used to set current action properties
     */
    public function __construct($params = array()) {
        foreach ($params as $key => $value)
            if (isset($this->_vars[$key])) {
                $this->_values[$key] = $this->cleanVar($key, $this->_vars[$key][parent::VARCFG_TYPE], $value);
                $this->_vars[$key][parent::VARCFG_CHANGED] = true;
            }
    }
    
    /**
     * This is called when action is executed
     */
    abstract function exec(icms_action_Response &$response);
    
    /**
     * Check if this action has any special requirement
     * 
     * @param mixed $requirement
     * 
     * @return bool
     */
    public function checkSR($requirement) {
        if (!is_int($requirement)) 
            $requirement = constant('icms_action_base_Module::SR_' . strtoupper($requirement));
        return ($this->special_requirements & $requirement) == $requirement;
    }
    
    /**
     * Checks if rights for executing this action are ok
     * 
     * @param icms_action_Response $response
     * @return bool
     */
    public function checkIfRightsAreOK(icms_action_Response &$response) {
        if ($this->checkSR(icms_action_base_Module::SR_LOGIN) && !icms::$user) {
            $ainfo = $this->getActionInfo();
            $response->error(sprintf('%s::%s action requires to login', $ainfo['module'], $ainfo['action']));
            return false;
        } elseif ($this->checkSR(icms_action_base_Module::SR_NOLOGIN) && icms::$user) {
            $ainfo = $this->getActionInfo();
            $response->error(sprintf('%s::%s action is usable for only not logged in users', $ainfo['module'], $ainfo['action']));
            return false;
        }
        return true;
    }
    
    /**
     * Return action info
     * 
     * @return array
     */
    public function getActionInfo() {
        $class = get_class($this);
        $parts = explode('_', $class);
        return array(
            'module' => $parts[1],
            'action' => $parts[2]
        );
    }
    
}