<?php
/**
 * Description of actionFetch
 *
 * @author mekdrop
 */
class actionUnTop implements iAction {    
    
    public function getVars() {
        return array();
    }
    
    public function exec(array $params) {
        $db = gcDB::getInstance();
        $db->query('UPDATE top SET score = score - 7000');
        $db->query('DELETE FROM top WHERE score < -10000');
    }   
    
}