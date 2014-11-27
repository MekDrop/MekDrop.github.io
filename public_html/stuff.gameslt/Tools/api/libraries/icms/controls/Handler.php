<?php

class icms_controls_Handler {

	public static $state = null;
    
    public static $renderedControlTypes = array();

	public function __construct() {
		if (!is_array(self::$state))
			$this->loadState();
	}

    /**
     * Create instance of control
     *
     * @param string $name      Control name
     * @param string $author    Author of control
     * @param string $options   Options to create instance
     *
     * @return object
     */
    public function make($name, $options = array()) {
        $i = strpos($name, '/');
        if (!$i) {
            $alternative_handler = icms::handler('icms_alternative');
            $author = $alternative_handler->find(icms_alternative_Object::ALT_TYPE_CONTROL, $name);
            if ($author === null)
                $author = 'icms';
            $control = $name;
        } else {
            $author = substr($name, 0, $i);
            $control = substr($name, $i+1);
        }
        $class = $this->getClassName($control, $author);
        if (!$this->loadClass($class)) {
            $class = $this->getClassName('Missing');
            if (!$this->loadClass($class)) {
                Throw new Exception("$name control ($class) from $author missing");
            }
            $options = compact('control', 'author', 'options');
        }
        $obj = new $class($options);
        return $obj;
    }     

    /**
     * @todo move this function to global loader
     */
    protected function loadClass($class) {
        if (class_exists($class, false))
           return true;
        $file = str_replace(array('\impresscms\\controls', '\\'), array(ICMS_CONTROLS_PATH, '/'), strtolower($class)) . '.php';
        if (file_exists($file)) {
            include $file;
            return class_exists($class, false);
        }
        return false;
    }

    /**
     * Gets class name for object
     *
     * @param string $name      Control name
     * @param string $author    Author of control
     *
     * @return string
     */
    public function getClassName($name, $author = 'icms') {
        return sprintf('\ImpressCMS\Controls\%s\%s\Control', $author, ucfirst($name));
    }
    
    

    /**
     * Get list with urls for controls
     *
     * @return array
     */
    public function getRequiredURLs($controls) {
        $controls_js = ICMS_LIBRARIES_URL.'/icms/controls/js/';
        $ret = array(
            icms_controls_Base::URL_TYPE_JS_INLINE => array(
                '
                    require([\'app/controls/main\']);
                 '
            )
        );
        $ctypes = array();
        foreach ($controls as $control) {
            if (!($control instanceof icms_controls_Base))
                continue;
            $type = get_class($control);
            if (isset($ctypes[$type]))
                continue;
            $ctypes[$type] = true;
            foreach ($control->getRequiredURLs() as $type => $urls)
                if (isset($ret[$type]))
                    $ret[$type] = array_merge($ret[$type], $urls);
                else
                    $ret[$type] = $urls;
        }
        // $ret[icms_controls_Base::URL_TYPE_JS] = array_unique($ret[icms_controls_Base::URL_TYPE_JS]);
        // $ret[icms_controls_Base::URL_TYPE_JS][] = $controls_js . 'Init.js';
        return $ret;
    }    

    /**
     * Sets controls state from request
     */
    protected function loadState() {
        self::$state = array();
        if (!isset($_REQUEST['icms_page_state']))
            return;
        
        $code = $_REQUEST['icms_page_state'];
        $code = rawurldecode($code);
        $code = base64_decode($code);
        $code = gzinflate($code);
        $code = rawurldecode($code);

        self::$state = json_decode($code, true);
        
    }

}