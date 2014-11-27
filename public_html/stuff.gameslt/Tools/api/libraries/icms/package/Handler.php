<?php

/**
 * Handler for packages
 */
class icms_package_Handler extends icms_ipf_Handler {

    const UPDATE_LOCAL = 1;
    const UPDATE_GLOBAL = 2;

    public function __construct(&$db) {
        parent::__construct($db, 'package', 'pkg_id', 'name', 'description', 'icms');
    }

    /**
     * Updates packages info in database
     * 
     * @staticvar array $paths  Predefined local paths for differnt type data
     * 
     * @param int $type             What types update
     * @param int $source           Do we need update only local or we need to update global data?
     * 
     * @throws Exception
     */
    public function update($type = 0, $source = self::UPDATE_LOCAL) {
        static $paths = array(
            icms_package_Object::PKG_TYPE_MODULE => array(ICMS_MODULE_PATH, false),
            icms_package_Object::PKG_TYPE_CONTROL => array(ICMS_CONTROLS_PATH, true),
            icms_package_Object::PKG_TYPE_LIBRARY => array(ICMS_LIBRARIES_PATH, false),
            icms_package_Object::PKG_TYPE_THEME => array(ICMS_THEME_PATH, false)
        );

        // gets types to update
        $item = $this->create();
        $types = array();
        foreach (array_keys($item->getSupportedTypes()) as $t)
            if (($type & $t) == $t)
                $types[] = $t;
        unset($item, $t);

        // does local updates
        if (($whatUpdate & self::UPDATE_LOCAL) == self::UPDATE_LOCAL) {            
            foreach ($types as $t) {
                $rez = array();
                foreach (new DirectoryIterator($paths[$t][0]) as $file) {
                    if ($file->isDot() || !$file->isDir())
                        continue;
                    if ($paths[$t][1]) {
                        foreach (new DirectoryIterator($file->getPathname()) as $file2) {
                            if ($file->isDot() || !$file->isDir())
                                continue;
                            list($filename, $func, $compat) = $this->detectInfoFileAndType($file2->getPathname());
                            if ($filename === null)
                                continue;
                            $info = call_user_func($func, $filename);
                            $info['alt_type'] = $file2->getBasename();
                            $info['name'] = $file->getBasename() . '/' . $file2->getBasename();                            
                        }
                    } else {
                        list($filename, $func, $compat) = $this->detectInfoFileAndType($file->getPathname());
                        if ($filename === null)
                            continue;
                        $info = call_user_func($func, $filename);
                    }
                    $info['compat'] = $compat;
                    $info['current_version'] = $info['version'];
                    $rez[$info['name']] = $info;
                }
                $criteria = new icms_db_criteria_SQLItem('%s IN (%a) AND type = %d', array_keys($names), $t);
                $items = $this->getObjects($criteria);
                $time = time();
                foreach ($items as $item) {
                    $name = $item->getVar('name', 'n');
                    $item->setVars($rez[$name]);
                    $item->setVar('last_update', $time);
                    $item->store();
                    unset($rez[$name]);
                }
                foreach ($rez as $name => $info) {
                    $item = $this->create();
                    $item->setVars($info);
                    $item->setVar('last_update', $time);
                    $item->setVar('type', $t);
                    $item->store();
                }
                unset($rez, $item, $info, $name);
                $this->query('UPDATE ' . $this->table . ' SET is_local = 0 AND last_update = '.$time.' WHERE last_update < ' .  $time . ' AND type = ' . $t);
            }
        }

        // does globals updates
        if (($whatUpdate & self::UPDATE_GLOBAL) == self::UPDATE_GLOBAL) {
            // TODO: Implement this part;
            Throw new Exception('Not yet implemented!');
        }
    }

    /**
     * Reads JSON file with settings
     * 
     * @param string $file
     * 
     * @return array
     */
    protected function readInfoFromJSON($file) {
        if (!file_exists($file))
            return array();
        $ret = array();
        foreach (json_decode(file_get_contents($file)) as $key => $value) {
            if (isset($value['@file'])) {
                $contents = file_get_contents($value['@file']);
                if (isset($value['@regexp'])) {
                    preg_match_all($value['@regexp'], $contents, $rt, PREG_PATTERN_ORDER);
                    $contents = isset($rt[0][0]) ? $rt[0][0] : '????';
                }
                $value = $contents;
            }
            $ret[$key] = $value;
        }
        return $ret;
    }

    /**
     * Reads ICMS file with settings
     * 
     * @param string $file
     * 
     * @return array
     */
    protected function readInfoFromICMSVersion($file) {
        if (!file_exists($file))
            return array();
        include $file;
        return $modversion;
    }

     /**
     * Reads Xoops file with settings
     * 
     * @param string $file
     * 
     * @return array
     */
    protected function readInfoFromXoopsVersion($file) {
        if (!file_exists($file))
            return array();
        include $file;
        return $modversion;
    }

    /**
     * Detects item type
     * 
     * @param string $path
     * 
     * @return array
     */
    protected function detectInfoFileAndType($path) {
        if (file_exists($path . '/control.json'))
            return array($path . '/control.json', array($this, 'readInfoFromJSON'), null);
        if (file_exists($path . '/module.json'))
            return array($path . '/module.json', array($this, 'readInfoFromJSON'), null);
        if (file_exists($path . '/icms_version.php'))
            return array($path . '/icms_version.json', array($this, 'readInfoFromICMSVersion'), null);
        if (file_exists($path . '/xoops_version.php'))
            return array($path . '/xoops_version.json', array($this, 'readInfoFromXoopsVersion'), 'xoops');
        return array(null, null, null);
    }

}