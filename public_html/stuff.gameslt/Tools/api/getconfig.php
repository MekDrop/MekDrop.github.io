<?php

// cache time for this data
$age = 60 * 60 * 24;

header('Cache-Control: max-age=' . $age . ', must-revalidate');
header('Expires: ' . gmdate("D, d M Y H:i:s", time() + $age) . ' GMT');

include "mainfile.php";

icms::$logger->disableRendering();

$filename = ICMS_CACHE_PATH . '/impresscms.config.js';

if (file_exists($filename)) {
    
    $rez = file_get_contents($filename);
    
} else {
    $config = array(
                'url' => array(
                    'root' => ICMS_URL,
                    'control' => ICMS_CONTROLS_URL,
                    'libraries' => ICMS_LIBRARIES_URL,
                    'module' => ICMS_MODULES_URL,
                    'plugins' => ICMS_PLUGINS_URL,
                    'theme' => ICMS_THEME_URL,
                    'upload' => ICMS_UPLOAD_URL,
                ),
                'global' => array(
                    'left' => _GLOBAL_LEFT,
                    'right' => _GLOBAL_RIGHT,
                ),
                'controls' => array(
                    'class' => 'icms_control'
                )                
            );

    foreach(array(
       'icms_action_Handler' => 
            array(
                 'special_param' => 'PARAM_'
            ),
        'icms_properties_Handler' => 
            array(
                  'var_type' => 'DTYPE_',
                  'var_param' => 'VARCFG_'
            ),
        'icms_action_base_Control' =>
            array(
                  'response_special_key' => 'RESPONSE_KEY_'
            ),
        'icms_controls_Base' => 
            array(
                'url_type' => 'URL_TYPE_'
            )
     ) as $class => $fields) {
        $refl = new ReflectionClass($class);
        $var_types = array(); 
        $constants = $refl->getConstants();
        foreach ($fields as $area => $prefix) {
            $config[$area] = array();
            $pcount = strlen($prefix);
            foreach ($constants as $constant => $value) {
                if (substr($constant, 0, $pcount) == $prefix)
                    $config[$area][strtolower(substr($constant, $pcount))] = $value;
            }
        }
        unset($constants, $var_types, $refl, $fields, $area, $class, $pcount, $constant, $value);
    };
    
    $rez = 'if (!window.ImpressCMS) window.ImpressCMS = {}; window.ImpressCMS.config = ' . json_encode($config) . ';';
    
    file_put_contents($filename, $rez);
}

echo $rez;