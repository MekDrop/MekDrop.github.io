<?php

/**
 * Description of actiosnhandler
 *
 * @author mekdrop
 */
class gcActionsHandler {
    
    public function exists($action) {
        return class_exists('action' . ucfirst(strtolower($action)), true);
    }
    
    public function exec($action) {
        $class = 'action' . ucfirst(strtolower($action));
        //var_dump($action);
        $instance = new $class();
        $data = array();
        foreach ($instance->getVars() as $var => $type) {
            $value = isset($_REQUEST[$var])?$_REQUEST[$var]:null;
            switch ($type) {
                case 'int':
                    $data[$var] = (int)$value;
                break;
                case 'bool':
                    $data[$var] = in_array($value, array('1', 1, 'true', 'yes'));                    
                break;
                case 'float':
                    $data[$var] = (float)$value;
                break;
                default:
                    $data[$var] = (string)$value;
            }
        }
        return $instance->exec($data);
    }
    
}