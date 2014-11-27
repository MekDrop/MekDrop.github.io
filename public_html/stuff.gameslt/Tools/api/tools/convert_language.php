#!/usr/bin/php -f 
<?php

switch($argv[1]) {
    case 'getconstants':       
        define('ICMS_ROOT_PATH', '??');
        date_default_timezone_set('UTC');
        $old_constants = get_defined_constants();
        require $argv[2]; 
        $new_constants = get_defined_constants();
        $changed_constants = array_diff($new_constants, $old_constants);
        echo json_encode($changed_constants);
        die();
    case 'getallfiles':
        $results = array();
        foreach (glob($argv[2] . '/*.php') as $file) {
            exec('php -f ' . __FILE__ . ' getconstants \'' . addslashes($file) . '\'', $ret);
            $ret = trim(implode('',$ret));
            $ret = ($ret == '[]')?array():json_decode($ret, true);
            if (!$ret)
                continue;     
            $results[substr($file, strlen($argv[2]))] = $ret;
        }
        echo json_encode($results);
        die();
    break;
    case 'convert':
        $xoopsOption['nocommon'] = true;

        global $xoopsOption;
        include '../mainfile.php';       
        if ($argv[2] == 'core') {
            $source_path = ICMS_ROOT_PATH . '/language/';
        } else {
            $source_path = ICMS_ROOT_PATH . '/modules/' . $argv[2] . '/language/';
        }
        
        function getData($path) {
            $cmd = __FILE__ . ' getallfiles \'' . addslashes($path) . '\'';
            echo $cmd . "\n";
            exec('php -f ' . $cmd, $ret);
            $ret = trim(implode('',$ret));            
            $ret = ($ret == '[]')?array():json_decode($ret, true);
            return $ret;
       }
        
        echo 'Reading english file...' . "\n";
        $ret = getData($source_path . 'english/');
        $constants = array();
        foreach ($ret as $file => $content) {
            foreach ($content as $constant => $value) {
                $ret[$file][$constant] = array('english' => $value);
                $constants[$constant] = $value;
            }
        }
        
        echo 'Reading other languages...' . "\n";
        $languages = array('english');
        foreach (glob($source_path . '*', GLOB_ONLYDIR) as $path) {
            $language = substr($path, strlen($source_path));
            if ($language == 'english')
                continue;
            $languages[] = $language;
            $rez = getData($source_path . '/' . $language);
            foreach ($rez as $file => $content)
                foreach ($content as $constant => $value)
                    $ret[$file][$constant][$language] = $value;
        }                           
        
        function processFolder($place, $path, &$constants) {
            foreach (glob($path . '/*') as $file) {
                $xname = substr(str_replace(ICMS_ROOT_PATH, '', $file), 1);
                $tname = $place . '/' . $xname;
                if ($xname == '.')
                    continue;
                if ($xname == 'cache')
                    continue;
                if ($xname == '..')
                    continue;                
                if (is_dir($file)) {
                    echo "Creating folder $tname...\n";
                    @mkdir($tname, fileperms($file), true);
                    processFolder($place, $file, $constants);
                } elseif (is_file($file)) {
                    echo "Creating file $tname...\n";
                    if (pathinfo($file, PATHINFO_EXTENSION) != 'php')
                        copy($file, $tname);
                    else {
                        $content = file_get_contents($file);
                        foreach ($constants as $constant => $value)
                            $content = preg_replace("/\b$constant\b/", '_(\'' . str_replace('\'', '\\\'', addslashes($value)) . '\')', $content);
                        file_put_contents($tname, $content);
                    }                        
                }
            }
        }
        
        processFolder(ICMS_ROOT_PATH . '/cache/language', ICMS_ROOT_PATH, $constants);        
        
        $xname = substr(str_replace(ICMS_ROOT_PATH, '', $source_path), 1);
        $tname = ICMS_ROOT_PATH . '/cache/language/' . $xname;
        
        foreach ($languages as $language) {
            $filename = $tname . '/' . $language . '.po';
            echo "Writing $filename...\n";
            $fp = fopen($filename, 'w');
            foreach ($ret as $file => $content) {
                fwrite($fp, '# file: ' . $file . "\n");
                foreach ($content as $constant => $value) {
                    fwrite($fp, "\n" . '# const: ' . $constant . "\n");
                    fwrite($fp, "msgid \"".$value['english']."\"\n");
                    fwrite($fp, "msgstr \"".$value[$language]."\"\n");
                }                    
                fwrite($fp, "\n");
            }
            fclose($fp);
        }
        
        die();
    /*    
        //var_dump($source_path . '*.php');
       
        
            
            foreach () {
                
            }
            var_dump($ret);
            /*$fp = fopen($filename, 'w');
            foreach (glob($path . '/*.php') as $file) {
                echo __FILE__ . ' getconstants \'' . addslashes($file) . '\'' . "\n";
                fwrite($fp, '#' . $file);
                fwrite($fp, "\n");
                exec('php -f ' . __FILE__ . ' getconstants \'' . addslashes($file) . '\'', $ret);
                $ret = trim(implode('',$ret));
                if ($ret2 == '[]')
                    $ret2 = array();
                else
                    $ret2 = json_decode($ret, true);
                if (!$ret2)
                    continue;     
                foreach ($ret2 as $key => $value) {
                    fwrite($fp, "\n");
                    $key = addslashes($key);
                    $value = addslashes($value);
                    fwrite($fp, "msgid \"$value\"\n");
                    fwrite($fp, "msgstr \"$value\"\n");
                }
                fwrite($fp, "\n");    
            }           
            fclose($fp);*/
      //  }
    //break;
}

if (!file_exists($source_path)) {
    var_dump($argv);
    //die('Error not found source!');
}