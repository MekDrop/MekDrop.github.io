<?php
/**
 * Description of actionFetch
 *
 * @author mekdrop
 */
class actionFetch implements iAction {
    
    public function getVars() {
        return array(
            'type' => 'string'
        );
    }
    
    public function exec(array $params) {
        if (!empty($params['type'])) {
            $types = array($params['type']);
        } else {
            $types = $this->getFetchers();
        }
        $db = gcDB::getInstance();
        $i = 0;
        $data = array();
        $table = null;
        $mode = null;
        foreach ($types as $type) {                    
            $this->useFetcher($type, $data, $table, $mode);
            $ids = array();
            foreach ($data as $k => $rec) {
                $data[$k]['type'] = $type;                
                $link = isset($rec['title'])?$rec['title']:$rec['link'];
                $data[$k]['hash'] = str_pad(sha1($link) . ';' . substr($link, 0, 1) . ';' . substr($link, -1) . ';' . strlen($link), 50, '_', STR_PAD_LEFT);
                $ids[] = $data[$k]['hash'];
                if (isset($data[$k]['date']))
                    $data[$k]['date'] = strtotime($data[$k]['date']);
            }
            $exists_ids = $db->recordExists($ids, $table, 'hash');
            if (!is_array($exists_ids))
                $exists_ids = array();
            foreach ($data as $rec) {            
                if (in_array($rec['hash'], $exists_ids)) {
                    $update = array();
                    foreach ($mode as $field => $what) 
                        switch ($what) {
                            case 'increase':
                                $update[] = sprintf('`%s` = `%s` + %d', $field, $field, $rec[$field]);
                            break;
                            case 'update':
                                $update[] = sprintf('`%s` = \'%s\'', $field, str_replace('\'', '\'\'', $rec[$field]));
                            break;
                        }
                    if (!empty($update))  {
                        $sql = sprintf('UPDATE `%s` SET %s WHERE hash = \'%s\'', $table, implode(', ', $update), $rec['hash']);
                        $db->query($sql);
                    }                        
                     
                } elseif ($db->quickInsert($rec, $table))
                   $i++;
            }
        }
        return "Fetched. $i new items.";
    }
    
    public function useFetcher($type, &$data, &$table, &$mode) {
        $class = 'fetch' . ucfirst($type);
        if (!class_exists($class, true))
            return '';

        $instance = new $class();
        $data = $instance->fetch();
        $table = $instance->getTable();
        $mode = $instance->getMode();
    }
    
    public function getFetchers() {
        $path = ROOT_PATH . DIRECTORY_SEPARATOR . 'fetchers';
        $dir = opendir($path);
        $ret = array();
        while (false !== ($entry = readdir($dir))) {
            if (strlen($entry) < 5 || !is_file($path . DIRECTORY_SEPARATOR . $entry) || (substr($entry, -4) != '.php'))
                continue;
            $ret[] = substr($entry, 0, -4);
        }
        closedir($dir);
        return $ret;
    }
    
}
