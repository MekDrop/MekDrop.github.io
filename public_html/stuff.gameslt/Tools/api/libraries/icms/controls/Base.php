<?php

/**
 * Base class for controls
 *
 * @author mekdrop
 * 
 * @abstract
 * 
 * @property string $baseTag        Tag name for this control (by default is div)
 * @property-read string $style     Reserved keyword
 * @property string $id             ID for control (by default it will be auto generated)
 * @property array  $class          CSS classes list
 * @property string $accesskey      Access key for this control
 * @property bool $contenteditable  Is content for this control editable?
 * @property string $contextmenu    Context menu ID
 * @property string $dir            Content direction
 * @property string $dragzone       Action that will be processed on dropping this control
 * @property string $lang           Language for content
 * @property bool $spellcheck       Do we need to spellcheck for this control?
 * @property int $tabindex          Tab index
 * @property string $title          Title for this control
 * @property bool  $hidden          Is thsi control hidden?
 */
abstract class icms_controls_Base extends icms_properties_Handler {

    /**
     * Static var with list all HTML short tags
     *
     * @var array 
     */
    protected static $ShortHTMLTags = array(
        'base', 'br', 'hr', 'img', 'input', 'keygen', 'link', 'meta', 'param', 'source', 'track'
    );

    const URL_TYPE_UNKNOWN = 0;
    const URL_TYPE_CSS = 1;
    const URL_TYPE_JS = 2;
    const URL_TYPE_JS_INLINE = 3;

    /**
     * Property must be rendered as data for tag
     */
    const RENDER_TYPE_DATA = 0;

    /**
     * Property must be rendered as tag attribute
     */
    const RENDER_TYPE_ATTRIBUTE = 1;

    /**
     * Property must be rendered as CSS style
     */
    const RENDER_TYPE_STYLE = 2;

    /**
     * Property must be rendered as attribute with same value as attribute
     */
    const RENDER_TYPE_STATE = 3;

    /**
     * Property must be rendered as tag name
     */
    const RENDER_TYPE_TAG = 4;

    /**
     * Last number with control id
     *
     * @var int 
     */
    private static $ctl = 0;

    /**
     * Generates new control name
     *
     * @return string 
     */
    protected function generateID() {
        return 'ctrl_' . str_replace('/', '_', $this->getType()) . '_' . (++self::$ctl);
    }

    /**
     * Constructor
     *
     * @param array $params Array with params for this control (key => value...)
     */
    public function __construct($params = array()) {
        $this->initVar('baseTag', self::DTYPE_STRING, 'div', false, self::RENDER_TYPE_TAG);
        $this->initVar('style', self::DTYPE_STRING, '', false, self::RENDER_TYPE_ATTRIBUTE);
        parent::setVarInfo('style', self::VARCFG_LOCKED, true);

        $this->initVar('id', self::DTYPE_STRING, '', false, self::RENDER_TYPE_ATTRIBUTE);
        $this->initVar('class', self::DTYPE_LIST, array(), false, self::RENDER_TYPE_ATTRIBUTE);
        parent::setVarInfo('class', self::VARCFG_SEPARATOR, ' ');

        $this->initVar('accesskey', self::DTYPE_STRING, '', false, self::RENDER_TYPE_ATTRIBUTE);
        $this->initVar('contenteditable', self::DTYPE_BOOLEAN, false, false, self::RENDER_TYPE_ATTRIBUTE);
        $this->initVar('contextmenu', self::DTYPE_STRING, '', false, self::RENDER_TYPE_ATTRIBUTE);
        $this->initVar('dir', self::DTYPE_STRING, '', false, self::RENDER_TYPE_ATTRIBUTE, array('ltr', 'rtl', 'auto', ''));
        $this->initVar('dropzone', self::DTYPE_STRING, '', false, self::RENDER_TYPE_ATTRIBUTE, array('copy', 'move', 'link', ''));
        $this->initVar('draggable', self::DTYPE_BOOLEAN, false, false, self::RENDER_TYPE_ATTRIBUTE);
        $this->initVar('lang', self::DTYPE_STRING, '', false, self::RENDER_TYPE_ATTRIBUTE);
        $this->initVar('spellcheck', self::DTYPE_BOOLEAN, false, false, self::RENDER_TYPE_ATTRIBUTE);
        $this->initVar('tabindex', self::DTYPE_INTEGER, 0, false, self::RENDER_TYPE_ATTRIBUTE);
        $this->initVar('title', self::DTYPE_STRING, '', false, self::RENDER_TYPE_ATTRIBUTE);
        $this->initVar('hidden', self::DTYPE_BOOLEAN, false, false, self::RENDER_TYPE_STATE);

        if (!isset($params['id']) || empty($params['id']))
            $params['id'] = $this->generateID();

        if (isset($params['html']) && isset($this->html)) {
            $this->html = $params['html'];
            unset($params['html']);
        }

        if (isset($params['text']) && isset($this->text)) {
            $this->text = $params['text'];
            unset($params['text']);
        }

        $handler = icms::handler('icms_controls');
        $type = $this->getType();
        if (isset($handler::$state[$type][$params['id']])) {
            $params = array_merge($params, $handler::$state[$type][$params['id']]);
        }

        parent::setVars($params);
        //parent::load($params);
    }

    /**
     * Changes var info
     *
     * @param string $key       Var name
     * @param string $info      Var option
     * @param string $value     Option value
     * 
     * @return bool
     */
    //private function setVarInfo($key, $info, $value) {
    //  return parent::setVarInfo($key, $info, $value);
    //}

    /**
     * Does this control has container?
     *
     * @return bool 
     */
    public function hasContainer() {
        return isset($this->controls) && is_array($this->controls) && !$this->isShortTag();
    }

    /**
     * Does this control has changeble text?
     *
     * @return bool 
     */
    public function hasChangeableText() {
        return isset($this->text) && !$this->isShortTag();
    }

    /**
     * Does this control has changeble HTML text?
     *
     * @return bool
     */
    public function hasChangeableHTML() {
        return isset($this->html) && !$this->isShortTag();
    }

    /**
     * Is this control rendered as short HTML tag?
     *
     * @return bool 
     */
    public function isShortTag() {
        return in_array($this->baseTag, self::$ShortHTMLTags);
    }

    /**
     * Adds new property with filters to this control
     *
     * @param string $key               Property name
     * @param int $dataType             Property type
     * @param mixed $defaultValue       Default value
     * @param bool $required            Is this property required?
     * @param int $renderType           Specifies render type
     * @param array $possibleOptions    Possible values for this property
     * 
     * @return bool 
     */
    public function initVar($key, $dataType, $defaultValue = null, $required = false, $renderType = self::RENDER_TYPE_DATA, $possibleOptions = null) {
        if (strstr(strtolower($key), '-') || in_array($key, array('html', 'text', 'controls')))
            Throw new Exception($key . ' attribute is reserved!');

        if ($renderType == self::RENDER_TYPE_TAG && $key != 'baseTag')
            Throw new Exception('Use baseTag to set Tag for this object');

        $otherCfg = array(self::VARCFG_RENDER_TYPE => $renderType);
        if ($possibleOptions != null)
            $otherCfg[self::VARCFG_POSSIBLE_OPTIONS] = $possibleOptions;

        return parent::initVar($key, $dataType, $defaultValue, $required, $otherCfg);
    }

    /**
     * Converts classname to classtype
     * 
     * @param string $class
     * 
     * @return string
     */
    protected function classToType($class) {
        if (!strrpos($class, '\\'))
            return null;
        $class = substr($class, 20, -8);
        $class = str_replace('\\', '/', $class);
        return strtolower($class);
    }

    /**
     * Gets classtype of control
     * 
     * @return string
     */
    public function getType() {
        return $this->classToType(get_class($this));
    }

    /**
     * Converts object 
     * 
     * @param object $obj
     * 
     * @return string
     */
    protected function objToJSON(&$obj) {
        $data = serialize($obj);
        preg_match_all('/C\:([0-9]+)\:"([^"]+)":([0-9]+)\:\{/ui', $data, $matches, PREG_SET_ORDER);
        foreach ($matches as $m) {
            $data = str_replace($m[0], 'a:1:{s:' . strlen($m[2]) . ':"' . $m[2] . '";', $data);
        }
        return json_encode(unserialize($data));
    }

    /**
     * Makes JS for control call
     * 
     * @param string $id        ID Of name
     * @param string $action    Action to call
     * @param array $params     Actions params
     * 
     * @return string
     */
    protected function makeJSCodeForControl($id, $action = null, $params = array()) {
        $code = 'window.ImpressCMS.controls[\'' . addslashes($id) . '\']';
        if (is_string($action))
            $code .= '.' . $action . '(' . implode(',', array_map('json_encode', $params)) . ')';
        return $code;
    }

    /**
     * Converts JSON to object
     * 
     * @param string $json
     * 
     * @return array
     */
    protected function JSONToObj($json) {
        $data = json_decode($json, true);
        $classes = $data->extractClassNamesFromArray($data);
        $ret = serialize($data);
        foreach ($classes as $class) {
            $sl = strlen($class);
            $ret = str_replace('a:1:{s:' . $sl . ':"' . $class . '";', 'C:' . $sl . ':"' . $class . '":1:{', $ret);
        }
        return unserialize($ret);
    }

    /**
     * Extracts class names from array
     * 
     * @param array $array
     * 
     * @return array
     */
    protected function extractClassNamesFromArray(&$array) {
        $keys = array_keys($array);
        if ((bool) count(array_filter($keys, 'is_string'))) {
            $ret = array();
            foreach ($keys as $key) {
                if (class_exists(stripcslashes($key), true) && is_array($array[$key])) {
                    $ret[] = $key;
                    $ret = array_merge($ret, $this->extractClassNamesFromArray($array[$key]));
                }
            }
            return $ret;
        } else
            return array();
    }

    /**
     * Returns attributes array for control
     * 
     * @param bool $skipFalse
     * 
     * @return string
     */
    public function getAttributes($skipFalse = true) {
        $style = array();

        $format = $this->getVarInfo();
        $default = $this->getDefaultVars();
        $data = parent::toArray();
        
        $main_class = array(
            'icms_control', 
            str_replace('/', '_', $this->getType())
        );
        
        if (file_exists(ICMS_CONTROLS_PATH . '/' . $this->getType() . '/js/control.js'))
            $attr[] = 'icms_controls_hasJS';
        
        $attr = array(
            'class' => implode(' ', array_merge($main_class, $this->class)),
            'data-icms-control' => $this->getType()
        );

        unset($format['class']);
        foreach ($format as $var => $info) {
            if ($skipFalse && ($default[$var] == $data[$var]) && !is_numeric($data[$var]))
                continue;
            $name = $var;
            switch ($info[self::VARCFG_RENDER_TYPE]) {
                case self::RENDER_TYPE_DATA:
                    $name = 'data-' . $name;
                case self::RENDER_TYPE_ATTRIBUTE:
                    switch ($info[self::VARCFG_TYPE]) {
                        case self::DTYPE_BOOLEAN:
                            $attr[$name] = $data[$var] ? 'true' : 'false';
                            break;
                        case self::DTYPE_ARRAY:
                        case self::DTYPE_DATA_SOURCE:
                            $attr[$name] = json_encode($data[$var]);
                            break;
                        default:
                            $attr[$name] = $data[$var];
                    }
                    break;
                case self::RENDER_TYPE_STYLE:
                    $style[$var] = $data[$var];
                    break;
                case self::RENDER_TYPE_STATE:
                    if ($data[$var])
                        $attr[$var] = $var;
                    break;
                case self::RENDER_TYPE_TAG:
                    continue;
            }
        }

        if (!empty($style)) {
            $attr['style'] = '';
            foreach ($style as $key => $value)
                $attr['style'] .= $key . ':' . $value . ';';
        }

        return $attr;
    }

    /**
     * Renders HTML tag
     *
     * @return string 
     */
    final public function render($mode = null) {

        $type = $this->getType();
        $log_msg = 'Render control ' . $type . '#' . $this->id;
        icms::$logger->startTime($log_msg);

        if (!in_array($type, icms_controls_Handler::$renderedControlTypes))
            icms_controls_Handler::$renderedControlTypes[] = $type;

        $pvars = $this->getProblematicVars();
        if (!empty($pvars))
            trigger_error(sprintf('%s required but are not set for %s', implode(', ', $pvars), get_class($this)));
        unset($pvars);

        $short_tag = in_array($this->baseTag, self::$ShortHTMLTags);

        $ret = '';

        if ($mode === true || $mode === null) {
            $ret .= '<' . $this->baseTag;
            foreach ($this->getAttributes() as $key => $value)
                $ret .= ' ' . $key . '="' . htmlentities($value) . '"';

            if ($short_tag)
                return $ret . ' />';
            $ret .= '>';
            if ($this instanceof icms_controls_iHasContent) {
                $data = $this->getContent();
                if (isset($this->controls) && is_array($this->controls)) {
                    $ret .= $this->replaceMagicTags($data);
                } else {
                    $ret .= $data;
                }
            } elseif (isset($this->controls) && is_array($this->controls)) {
                foreach ($this->controls as $control)
                    if ($control instanceof icms_controls_Base)
                        $ret .= $control->render() . ' ';
            }
            if (isset($this->html))
                $ret .= $this->html;
            if (isset($this->text))
                $ret .= htmlentities($this->text);
        }

        if (!$mode && !$short_tag)
            $ret .= '</' . $this->baseTag . '>';

        icms::$logger->stopTime('Render control "' . $type . '#' . $this->id);

        return $ret;
    }

    public function replaceMagicTags($content) {
        $all_ctl = array();
        if (preg_match_all('/<{control:([^}]+)}>/ui', $content, $all_ctl, PREG_SET_ORDER))
            foreach ($all_ctl as $rct) {
                if (isset($this->controls[$rct[1]]) && ($this->controls[$rct[1]] instanceof icms_controls_Base)) {
                    $content = str_replace($rct[0], $this->controls[$rct[1]]->render(), $content);
                    $type = $this->controls[$rct[1]]->getType();
                    if (!in_array($type, icms_controls_Handler::$renderedControlTypes))
                        icms_controls_Handler::$renderedControlTypes[] = $type;
                }
            }
        return $content;
    }

    /**
     * Same as render function
     *
     * @return string 
     */
    final public function __toString() {
        try {
            return $this->render();
        } catch (Exception $e) {
            return $e->getMessage();
        }
    }

    /**
     * Detects predefined events for control
     *
     * @return array 
     */
    public function detectServerEvents() {
        $rez = array();
        if ($dh = opendir(ICMS_LIBRARIES_PATH . '/icms/controls/actions')) {
            $cpath = ICMS_CONTROLS_PATH . '/' . $this->getType() . '/actions/';
            while (($file = readdir($dh)) !== false) {
                $ext = substr($file, -4);
                if ($ext != '.php')
                    continue;
                if (file_exists($cpath . $file))
                    $rez[] = substr($file, 0, -4);
            }
            closedir($dh);
        }

        return $rez;
    }

    protected function needJSCacheUpdate() {
        $type = $this->getType();
        $cache_file = ICMS_CACHE_PATH . '/controls/' . str_replace(array('_', '-', '/'), array('__', '_', '-'), $type) . '.js';
        if (!file_exists($cache_file))
            return true;
        return filemtime($cache_file) < filemtime($script_file);
    }

    /**
     * Makes control instance (link to handler same method)
     * 
     * @param string    $name       Control name
     * @param array     $options    Options
     * 
     * @return object
     */
    protected function makeControl($name, $options = array()) {
        $handler = new icms_controls_Handler();
        return $handler->make($name, $options);
    }

    /**
     * Can this control have content?
     * 
     * @return bool
     */
    public function canHaveContent() {
        return isset($this->html) || isset($this->text);
    }

    /**
     * Updates config for control
     *
     * @return type 
     */
    protected function updateJSConfig($type, $parentType = null) {
        if ($this->needJSCacheUpdate()) {
            $location = ICMS_CACHE_PATH . '/controls/';
            if (!is_dir($location)) {
                mkdir($location, 0777, true);
                file_put_contents($location . 'index.html', '<meta http-equiv="Refresh" content="0;url=javascript:history.go(-1)" />');
            }
            $file = $location . '/' . str_replace(array('_', '-', '/'), array('__', '_', '-'), $type) . '.js';
            $data = array(
                'events' => $this->detectServerEvents(),
                'fields' => $this->getVarInfo(),
                'parentType' => $parentType,
                'baseValues' => $this->getDefaultVars()
            );
            file_put_contents($file, 'define([], ' . json_encode($data) . ');');
        }
    }

    /**
     * Returns array with inherinted control types
     * 
     * @return array
     */
    protected function getInherintedTypes() {
        $class = new ReflectionClass(get_class($this));

        $parents = array();
        while (true) {
            $parent = $class->getParentClass();
            $name = $parent->getName();
            if ($name == __CLASS__ || !$parent)
                break;
            $class2 = new ReflectionClass($name);
            if ($class2->isInstantiable() && $class2->isSubclassOf('icms_controls_Base')) {
                $pName = $class2->getParentClass()->getName();
                $parents[] = array($this->classToType($name), $this->classToType($pName));
            }
            $class = $class2;
        }

        return array_reverse($parents);
    }

    /**
     * Returns full url for file
     * 
     * @param string $file
     * 
     * @return string
     */
    public function getFileURL($file) {
        return ICMS_CACHE_URL . '/controls/' . $this->getType() . '/' . $file;
    }

    /**
     * Returns full file location
     * 
     * @param string $file
     * 
     * @return string
     */
    public function getFilePath($file) {
        return ICMS_CACHE_PATH . '/controls/' . $this->getType() . '/' . $file;
    }

    /**
     * Gets array with required urls
     *
     * @return array 
     */
    public function getRequiredURLs() {
        $ret = array(
            self::URL_TYPE_JS => array(),
            self::URL_TYPE_JS_INLINE => array(),
            self::URL_TYPE_CSS => array()
        );
        foreach ($this->getInherintedTypes() as $type) {
            $ret[self::URL_TYPE_JS][] = $this->getJSURL($type[0], $type[1]);
            $file = '/' . $type . '/style.css';
            if (file_exists(ICMS_CONTROLS_PATH . $file))
                $ret[self::URL_TYPE_CSS][] = ICMS_CONTROLS_URL . $file;
        }
        $type = $this->getType();
        $this->updateJSConfig($type, $this->classToType(get_parent_class($this)));
        $file = '/' . $type . '/style.css';
        if (file_exists(ICMS_CONTROLS_PATH . $file))
            $ret[self::URL_TYPE_CSS][] = ICMS_CONTROLS_URL . $file;
        if (empty($ret[self::URL_TYPE_CSS]))
            unset($ret[self::URL_TYPE_CSS]);
        if (empty($ret[self::URL_TYPE_JS]) || !empty($ret[self::URL_TYPE_JS_INLINE]))
            unset($ret[self::URL_TYPE_JS]);
        if (empty($ret[self::URL_TYPE_JS_INLINE]))
            unset($ret[self::URL_TYPE_JS_INLINE]);
        if (isset($this->controls) && is_array($this->controls))
            foreach ($this->controls as $control)
                if ($control instanceof icms_controls_Base)
                    foreach ($control->getRequiredURLs() as $type => $urls)
                        $ret[$type] = array_merge($ret[$type], $urls);
        return $ret;
    }

}