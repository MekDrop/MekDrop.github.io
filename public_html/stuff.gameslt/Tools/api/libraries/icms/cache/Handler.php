<?php
/**
 * Cached persistable Object Handlder
 * @category	ICMS
 * @package		Ipf
 * @since		1.1
 * @author              Raimondas Rimkevicius <i.know@mekdrop.name>
 * @todo		Properly name the vars using the naming conventions
 */
class icms_cache_Handler
    extends icms_core_ObjectHandler {   
    
        public static $config = null;
    
        public static function getDefault() {
            static $instance = -1;
            if ($instance === -1) {
                if (defined('SDATA_CACHE_SYSTEM') && SDATA_CACHE_SYSTEM) {
                    $path = ICMS_PLUGINS_PATH . '/cache/' . SDATA_CACHE_SYSTEM . '.php';    
                    if (!file_exists($path))
                        $instance = null;
                    else {
                        include_once $path;
                        $class = '\\ImpressCMS\\Cache\\System\\' . SDATA_CACHE_SYSTEM;
                        $cid = strlen($path) * (ord(substr($path, 0, 1)) - ord(substr($path, -1)));
                        $instance = new $class(new self(icms::$xoopsDB), compact('cid', 'path', 'name'));
                        $instance->connect(SDATA_CACHE_HOST, SDATA_CACHE_PORT, SDATA_CACHE_USER, SDATA_CACHE_PASS);
                    }
                } else {
                    $instance = null;
                }                
            }            
            return $instance;
        }       
    
        //
	/**
	* called from child classes only
	*
	* @param object $db reference to the {@link icms_db_legacy_Database} object
	* @access protected
	*/
	public function __construct(&$db) {
		parent::__construct($db);
	}
    
        public function &create() {
            throw new Exception('Not supported');
        }

	public function &get($int_id) {
            throw new Exception('Not supported');
        }

	public function insert(&$object) {
            throw new Exception('Not supported');
        }
        
        public function delete(&$object) {
            throw new Exception('Not supported');
        }

	/**
	 * retrieve objects from the database
	 *
	 * @param object $criteria {@link icms_db_criteria_Element} conditions to be met
	 * @param bool $id_as_key use the ID as key for the array?
	 * @param bool $as_object return an array of objects?
	 *
	 * @return array
	 */
	public function getObjects($criteria = null, $id_as_key = false, $as_object = false, $sql = false, $debug = false) {            
                if ($criteria || $sql)
                    Throw new Exception('criteria, as_object, sql are not supported for getObjects');
            
                $dir = opendir(ICMS_PLUGINS_PATH . '/cache');
                if (!$dir)
                    return array();
                
                $ret = array();
                $i = 0;
                while (($file = readdir($dir)) !== false) {
                    $path = $dir . '/' . $file;
                    $cid = strlen($path) * (ord(substr($file, 0, 1)) - ord(substr($file, -1)));
                    $name = strstr($file, '.', true);                                        
                    if ($as_object) {
                        try {
                            $class = '\\ImpressCMS\\Cache\\System\\' . $name;
                            include_once $path;
                            if (!class_exists($class))
                                continue;
                            $obj = new $class($this, compact('cid', 'path', 'name'));
                        } catch (Exception $e) {
                            continue;
                        }                        
                        if ($id_as_key)
                            $ret[$cid] = $obj;
                        else
                            $ret[] = $obj;
                    } else {
                        if ($id_as_key)
                            $ret[$cid] = compact('cid', 'path', 'name');
                        else
                            $ret[] = compact('cid', 'path', 'name');
                    }
                }
                
		return $ret;
	}
	
	/**
	 * Retrieve a list of objects as arrays - DON'T USE WITH JOINT KEYS
	 *
	 * @param object $criteria {@link icms_db_criteria_Element} conditions to be met
	 * @param int   $limit      Max number of objects to fetch
	 * @param int   $start      Which record to start at
	 *
	 * @return array
	 */
	public function getList($criteria = null, $limit = 0, $start = 0, $debug = false) {            
		$items = $this->getObjects($criteria, false, false, false, $debug);
		$rez = array();
                foreach ($items as $item)
                    $rez[$item['cid']] = $item['name'];
                
		return $rez;
	}

	/**
	 * count objects matching a condition
	 *
	 * @param object $criteria {@link icms_db_criteria_Element} to match
	 * @return int count of objects
	 */
	public function getCount($criteria = null) {
                $items = $this->getObjects($criteria, false, false, false, $debug);
		
                return count($items);
	}

}

