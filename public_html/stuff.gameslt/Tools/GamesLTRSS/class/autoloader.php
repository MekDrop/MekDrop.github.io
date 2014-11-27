<?php

class gcAutoloader {

    protected static $paths = null;

    public function __construct() {
        if (self::$paths === null) {
            self::$paths = array(              
                'gc' => function ($class) {
                    return ROOT_PATH . DIRECTORY_SEPARATOR . 'class' . DIRECTORY_SEPARATOR . strtolower(substr($class, 2)) . '.php';
                },
                'action' => function ($class) {
                    return ROOT_PATH . DIRECTORY_SEPARATOR . 'action' . DIRECTORY_SEPARATOR . strtolower(substr($class, 6)) . '.php';
                },
                'fetch' => function ($class) {
                    return ROOT_PATH . DIRECTORY_SEPARATOR . 'fetchers' . DIRECTORY_SEPARATOR . strtolower(substr($class, 5)) . '.php';
                },
                'simple_html_dom_node' => ROOT_PATH . DIRECTORY_SEPARATOR . 'libraries' . DIRECTORY_SEPARATOR . 'simplehtmldom' . DIRECTORY_SEPARATOR . 'simple_html_dom.php',
                'SimplePie' => function ($class) {
                    return ROOT_PATH .  DIRECTORY_SEPARATOR . 'libraries' . DIRECTORY_SEPARATOR . 'simplepie' . DIRECTORY_SEPARATOR .  'library' . DIRECTORY_SEPARATOR . str_replace('_', DIRECTORY_SEPARATOR, $class) . '.php';
                },
                'idna_convert' => ROOT_PATH .  DIRECTORY_SEPARATOR . 'libraries' . DIRECTORY_SEPARATOR . 'simplepie' . DIRECTORY_SEPARATOR . 'idn' . DIRECTORY_SEPARATOR . 'idna_convert.class.php',
                'i' => function ($class) {
                    return ROOT_PATH . DIRECTORY_SEPARATOR . 'interfaces' . DIRECTORY_SEPARATOR . strtolower(substr($class, 1)) . '.php';
                },
            );
        }
    }

    public function autoload($class) {
        foreach (self::$paths as $class_start => $path) {
            /*var_dump(array(
                $class, 0, strlen($class_start),
                $class_start
            )
                    );*/
            if (substr($class, 0, strlen($class_start)) != $class_start)
                continue;
            $filename = is_callable($path)?$path($class):$path;
            if (substr($filename, -strlen(DIRECTORY_SEPARATOR . '.php')) == DIRECTORY_SEPARATOR . '.php')
                    return false;
                
           // echo $filename . "<br />";  
            require $filename;
            return true;
        }
        return false;
    }

}