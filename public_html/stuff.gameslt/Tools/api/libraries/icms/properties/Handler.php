<?php
/**
 * Contains methods for dealing with object properties
 *
 * @copyright           The ImpressCMS Project http://www.impresscms.org/
 * @license		http://www.gnu.org/licenses/old-licenses/gpl-2.0.html GNU General Public License (GPL)
 * @category            ICMS
 * @package		Ipf
 * @subpackage          Properties
 * @since		1.0
 * @author		i.know@mekdrop.name
 */

/**
 * icms_properties_Handler base class
 *
 * Base class to dealing with object properties
 *
 * @category            ICMS
 * @package		Ipf
 * @subpackage          Properties
 * @author              i.know@mekdrop.name
 * @todo		Properly identify and declare the visibility of vars and functions
 */
abstract class icms_properties_Handler implements Serializable {

    /**
     * Specifies property that a property stores a string
     */
    const DTYPE_STRING = 2; // XOBJ_DTYPE_TXTBOX
    
    /**
     * Specifies property that a property stores a integer
     */
    const DTYPE_INTEGER = 3; // XOBJ_DTYPE_INT
    
    /**
     * Specifies property that a property stores a float number
     */
    const DTYPE_FLOAT = 201; // XOBJ_DTYPE_FLOAT
    
    /**
     * Specifies property that a property stores a boolean
     */
    const DTYPE_BOOLEAN = 105;
    
    /**
     * Specifies property that a property stores a file
     */
    const DTYPE_FILE = 104; // 
    
    /**
     * Specifies property that a property stores a date or/and time
     */
    const DTYPE_DATETIME = 11; // XOBJ_DTYPE_LTIME
    
    /**
     * Specifies property that a property stores an array
     */
    const DTYPE_ARRAY = 6; // XOBJ_DTYPE_ARRAY
    
    /**
     * Specifies property that a property stores a list
     */
    const DTYPE_LIST = 101; // XOBJ_DTYPE_SIMPLE_ARRAY
    
    /**
     * Specifies property that a property stores a object
     */
    const DTYPE_OBJECT = 12;
    
    /**
     * Specifies property that a property stores a unknown format data
     * 
     * @deprecated since version 2.0
     */
    const DTYPE_DEP_OTHER = 7; // XOBJ_DTYPE_OTHER
    
    /**
     * Specifies property that a property stores a file (old format)
     * 
     * @deprecated since version 2.0
     */
    const DTYPE_DEP_FILE = 204; //XOBJ_DTYPE_FILE
    
    /**
     * Specifies property that a property stores a long string)
     * 
     * @deprecated since version 2.0
     */
    const DTYPE_DEP_TXTBOX = 1; // XOBJ_DTYPE_TXTBOX
    
    /**
     * Specifies property that a property stores a url string
     * 
     * @deprecated since version 2.0
     */
    const DTYPE_DEP_URL = 4; // XOBJ_DTYPE_URL
    
    /**
     * Specifies property that a property stores a email address
     * 
     * @deprecated since version 2.0
     */
    const DTYPE_DEP_EMAIL = 5; // XOBJ_DTYPE_EMAIL
    
    /**
     * Specifies property that a property stores a source code
     * 
     * @deprecated since version 2.0
     */
    const DTYPE_DEP_SOURCE = 8; // XOBJ_DTYPE_SOURCE
    
    /**
     * Specifies property that a property stores a short time
     * 
     * @deprecated since version 2.0
     */
    const DTYPE_DEP_STIME = 9; // XOBJ_DTYPE_STIME
    
    /**
     * Specifies property that a property stores a middle time
     * 
     * @deprecated since version 2.0
     */
    const DTYPE_DEP_MTIME = 10; // XOBJ_DTYPE_MTIME
    
    /**
     * Specifies property that a property stores a currency
     * 
     * @deprecated since version 2.0
     */
    const DTYPE_DEP_CURRENCY = 200; // XOBJ_DTYPE_CURRENCY
    
    /**
     * Specifies property that a property stores a time only data
     * 
     * @deprecated since version 2.0
     */
    const DTYPE_DEP_TIME_ONLY = 202; // XOBJ_DTYPE_TIME_ONLY
    
    /**
     * Specifies property that a property stores a urllink
     * 
     * @deprecated since version 2.0
     */
    const DTYPE_DEP_URLLINK = 203; // XOBJ_DTYPE_URLLINK
    
    /**
     * Specifies property that a property stores a image
     * 
     * @deprecated since version 2.0
     */
    const DTYPE_DEP_IMAGE = 205; // XOBJ_DTYPE_IMAGE
    
    /**
     * Specifies property that a property stores a form section opening
     * 
     * @deprecated since version 2.0
     */
    const DTYPE_DEP_FORM_SECTION = 210; // XOBJ_DTYPE_FORM_SECTION
    
    /**
     * Specifies property that a property stores a form section closing
     * 
     * @deprecated since version 2.0
     */
    const DTYPE_DEP_FORM_SECTION_CLOSE = 211; // XOBJ_DTYPE_FORM_SECTION_CLOSE
        
    /**
     * Specifies allowed mimetypes for the var (only suported for DTYPE_FILE)
     */
    const VARCFG_ALLOWED_MIMETYPES = 'allowedMimeTypes';
    
    /**
     * Specifies max filesize for the var (only suported for DTYPE_FILE)
     */
    const VARCFG_MAX_FILESIZE = 'maxFileSize';
    
    /**
     * Specifies max width of image for the var (only suported for DTYPE_FILE)
     */
    const VARCFG_MAX_WIDTH = 'maxWidth';
    
    /**
     * Specifies max height for the var (only suported for DTYPE_FILE)
     */
    const VARCFG_MAX_HEIGHT = 'maxHeight';
    
    /**
     * Specifies prefix for the var (only suported for DTYPE_FILE, DTYPE_STRING)
     */
    const VARCFG_PREFIX = 'prefix';
    
    /**
     * Specifies saving path for the var (only suported for DTYPE_FILE)
     */
    const VARCFG_PATH = 'path';
    
    /**
     * Specifies filename generator function for the var (only suported for DTYPE_FILE)
     */
    const VARCFG_FILENAME_FUNCTION = 'filenameGenerator';
    
    /**
     * Specifies list with options that can be used for the var
     */
    const VARCFG_POSSIBLE_OPTIONS = 'possibleOptions';
    
    /**
     * Specifies if this var is locked from changing?
     */
    const VARCFG_LOCKED = 'locked';
    
    /**
     * Specifies if this var is hidden from user
     */
    const VARCFG_HIDE = 'hide';
    
    /**
     * Specifies how var should be rendered
     */
    const VARCFG_RENDER_TYPE = 'renderType';
    
    /**
     * Specifies separator for saving list items for the var (only suported for DTYPE_LIST)
     */
    const VARCFG_SEPARATOR = 'separator';
    
    /**
     * Specifies max text length for the var (only suported for DTYPE_STRING)
     */
    const VARCFG_MAX_LENGTH = 'maxLength';
    
    /**
     * Specifies validation rule (REGEXP)
     */
    const VARCFG_VALIDATE_RULE = 'validateRule';
    
    /**
     * Specifies source formating options (only usable for DTYPE_STRING)
     */
    const VARCFG_SOURCE_FORMATING = 'sourceFormating';
    
    /**
     * Specifies outputing formating
     */
    const VARCFG_FORMAT = 'format';
    
    /**
     * Is autoforating for this var disabled?
     */
    const VARCFG_AF_DISABLED = 'autoFormatingDisabled';
    
    /**
     * Not GPC?
     */
    const VARCFG_NOT_GPC = 'not_gpc';
    
    /**
     * Is var changed?
     */
    const VARCFG_CHANGED = 'changed';
    
    /**
     * Value of var
     */
    const VARCFG_VALUE = 'value';
    
    /**
     * Var data type
     */
    const VARCFG_TYPE = 'data_type';
    
    /**
     * Is var required?
     */
    const VARCFG_REQUIRED = 'required';
    
    /**
     * Data handler
     */
    const VARCFG_DATA_HANDLER = 'data_handler';
    
    /**
     * Deprecached data type
     */
    const VARCFG_DEP_DATA_TYPE = 'depDataType';
    
    /**
     * Form caption for this var
     */
    const VARCFG_FORM_CAPTION = 'form_caption';
    
    /**
     * Form description for this var
     */
    const VARCFG_FORM_DESC = 'form_dsc';
    
    /**
     * Default value of this var
     */
    const VARCFG_DEFAULT_VALUE = 'default_value';
    
    /**
     * Is var not loaded?
     */
    const VARCFG_NOTLOADED = 'not_loaded';

    /**
     * Vars configuration
     *
     * @var array 
     */
    protected $_vars = array();
    
    /**
     * Values of all vars
     *
     * @var array 
     */
    protected $_values = array();
    
    /**
     * Changed vars count
     *
     * @var int 
     */
    protected $_changed = 0;

    /**
     * Assigns values from array to vars
     * 
     * @param array $values     Assoc arary with keys and values to assign
     */
    public function assignVars($values) {
        $this->_values = array();
        foreach ($values as $key => $value)
           if (isset($this->_vars[$key][self::VARCFG_TYPE]))
                $this->_values[$key] = $this->cleanVar($key, $this->_vars[$key][self::VARCFG_TYPE], $value);
           else {
               trigger_error('Undefined type in ' . get_class($this) . ' for ' . $key, E_USER_NOTICE);
               $this->_values[$key] = $value;
           }
    }

    /**
     * Inits common var
     *
     * @param	string		$varname            Var name
     * @param	bool            $displayOnForm      Display on form
     * @param	string		$default            Default value
     * 
     * @deprecated since version 2.0
     */
    public function initCommonVar($varname, $displayOnForm = true, $default = 'notdefined') {
        icms_core_Debug::setDeprecated("initCommonVar", sprintf(_CORE_REMOVE_IN_VERSION, '2.1'));
        require_once __DIR__ . '/common/' . $varname . '.php';
        $this->hideFieldFromSingleView($varname);
    }

    /**
     * Magic function to get property value by accessing it by name
     * 
     * @param string $name
     * 
     * @return mixed
     */
    public function __get($name) {
        switch ($name) {
            case 'vars':
                if (isset($this->_vars[$name])) {
                    return $this->_values[$name];
                } else {
                    $callers = debug_backtrace();
                    trigger_error(sprintf('Deprecached "vars" property use in %s (line %d)', $callers[1]['class'], $callers[1]['line']), E_USER_DEPRECATED);
                    $ret = array_merge($this->_vars);
                    foreach ($ret as $key => $value)
                        $ret[$key][self::VARCFG_VALUE] = $this->_values[$key];
                    return $ret;
                }
            case 'cleanVars':
                $callers = debug_backtrace();
                trigger_error(sprintf('Deprecached "cleanVars" property use in %s (line %d)', $callers[1]['class'], $callers[1]['line']), E_USER_DEPRECATED);
                return $this->_values;
            default:
                if (!isset($this->_vars[$name])) {
                    $callers = debug_backtrace();
                    trigger_error(sprintf('%s undefined for %s (in line %d)', $name, $callers[1]['class'], $callers[1]['line']), E_USER_DEPRECATED);
                    return;
                }
                else
                    return $this->_values[$name];
        }
    }

    /**
     * Magic function to work with properties as class variables (set them)
     * 
     * @param string $name      Var name
     * @param mixed $value      New value
     */
    public function __set($name, $value) {
        if (!isset($this->_vars[$name]))
            return trigger_error('Variable ' . get_class($this) . '::$' . $name . ' not found', E_USER_WARNING);
        if ($this->_vars[$name][self::VARCFG_LOCKED])
            return trigger_error('Variable ' . get_class($this) . '::$' . $name . ' locked', E_USER_WARNING);
        if (isset($this->_vars[$name][self::VARCFG_POSSIBLE_OPTIONS]) && !in_array($value, $this->_vars[$name][self::VARCFG_POSSIBLE_OPTIONS]))
            return trigger_error('Option not in array for variable ' . get_class($this) . '::$' . $name . ' not found', E_USER_WARNING);
        $clean = $this->cleanVar($name, $this->_vars[$name][self::VARCFG_TYPE], $value);
                
        if ($clean == $this->_values[$name])                      
            return;
        $this->_values[$name] = $clean;
        $this->setVarInfo($name, self::VARCFG_CHANGED, true);
        if (isset($this->_vars[$name][self::VARCFG_NOTLOADED]) && $this->_vars[$name][self::VARCFG_NOTLOADED])
            $this->_vars[$name][self::VARCFG_NOTLOADED] = false;
    }

    /**
     * Checks if var exists
     * 
     * @param string $name  Var name
     * 
     * @return bool
     */
    public function __isset($name) {
        return isset($this->_vars[$name]);
    }

    /**
     * Returns a specific variable for the object in a proper format
     *
     * @access public
     * @param string $key key of the object's variable to be returned
     * @param string $format format to use for the output
     * @return mixed formatted value of the variable
     */
    public function getVar($name, $format = 's') {
        switch (strtolower($format)) {
            case 's':
            case 'show':
            case 'p':
            case 'preview':
                $ret = $this->getVarForDisplay($name);
                break;
            case 'e':
            case 'edit':
                $ret = $this->getVarForEdit($name);
                break;
            case 'f':
            case 'formpreview':
                $ret = $this->getVarForForm($name);
                break;
            case 'n':
            case 'none':
            default:
                $ret = $this->__get($name);
        }
        return $ret;
    }

    /**
     * Gets var value for displaying
     * 
     * @param string $name
     * 
     * @return mixed
     */
    public function getVarForDisplay($name) {
        switch ($this->_vars[$name][self::VARCFG_TYPE]) {
            case self::DTYPE_STRING:
                if (!isset($this->_vars[$name][self::VARCFG_AF_DISABLED]) || !$this->_vars[$name][self::VARCFG_AF_DISABLED]) {
                    $ts = icms_core_Textsanitizer::getInstance();
                    $html = !empty($this->_vars['dohtml']) ? 1 : 0;
                    $xcode = (!isset($this->_vars['doxcode']) || $this->_values['doxcode'] == 1) ? 1 : 0;
                    $smiley = (!isset($this->_vars['dosmiley']) || $this->_values['dosmiley'] == 1) ? 1 : 0;
                    $image = (!isset($this->_vars['doimage']) || $this->_values['doimage'] == 1) ? 1 : 0;
                    $br = (!isset($this->_vars['dobr']) || $this->_values['dobr'] == 1) ? 1 : 0;
                    if ($html) {
                        return $ts->displayTarea($this->_values[$name], $html, $smiley, $xcode, $image, $br);
                    } else {
                        return $this->_values[$name]; //icms_core_DataFilter::checkVar($this->_values[$name], 'text', 'output');
                    }
                } else {
                    $ret = str_replace(array("&amp;", "&nbsp;"), array('&', '&amp;nbsp;'), @htmlspecialchars($this->_values[$name], ENT_QUOTES, _CHARSET)); //icms_core_DataFilter::htmlSpecialchars($this->_values[$name]);
                    if (method_exists($this, 'formatForML')) {
                        return $this->formatForML($ret);
                    } else {
                        return $ret;
                    }
                    return $ret;
                }
            case self::DTYPE_INTEGER: // self::DTYPE_INTEGER
                return $this->_values[$name];
            case self::DTYPE_FLOAT: // XOBJ_DTYPE_FLOAT
                return sprintf(isset($this->_vars[$name][self::VARCFG_FORMAT]) ? $this->_vars[$name][self::VARCFG_FORMAT] : '%d', $this->_values[$name]);
            case self::DTYPE_BOOLEAN:
                return $this->_values[$name] ? _YES : _NO;
            case self::DTYPE_FILE: // XOBJ_DTYPE_FILE                    
                return str_replace(array("&amp;", "&nbsp;"), array('&', '&amp;nbsp;'), @htmlspecialchars($this->_values[$name], ENT_QUOTES, _CHARSET));
            case self::DTYPE_DATETIME: // XOBJ_DTYPE_LTIME
                return date(isset($this->_vars[$name][self::VARCFG_FORMAT]) ? $this->_vars[$name][self::VARCFG_FORMAT] : 'r', $this->_values[$name]);
            case self::DTYPE_ARRAY: // XOBJ_DTYPE_ARRAY
                return $this->_values[$name];            
            case self::DTYPE_LIST; // XOBJ_DTYPE_SIMPLE_ARRAY
                return nl2br(implode("\n", $this->_values[$name]));
            default:
                return (string)$this->_values[$name];
        }
    }

    /**
      if ($this->vars[$key]['options'] != '' && $ret != '') {
      switch (strtolower($format)) {
      case 's':
      case 'show':
      $selected = explode('|', $ret);
      $options = explode('|', $this->vars[$key]['options']);
      $i = 1;
      $ret = array();
      foreach ($options as $op) {
      if (in_array($i, $selected)) {
      $ret[] = $op;
      }
      $i++;
      }
      return implode(', ', $ret);
      case 'e':
      case 'edit':
      $ret = explode('|', $ret);
      break 1;

      default:
      break 1;
      }

      }
     */
    
    /**
     * Gets var value for editing
     * 
     * @param string $name
     * 
     * @return mixed
     */
    public function getVarForEdit($name) {
        switch ($this->_vars[$name][self::VARCFG_TYPE]) {
            case self::DTYPE_STRING:
            case self::DTYPE_INTEGER: // self::DTYPE_INTEGER
            case self::DTYPE_FLOAT: // XOBJ_DTYPE_FLOAT
            case self::DTYPE_BOOLEAN:
            case self::DTYPE_FILE: // XOBJ_DTYPE_FILE
            case self::DTYPE_DATETIME: // XOBJ_DTYPE_LTIME
            case self::DTYPE_ARRAY: // XOBJ_DTYPE_ARRAY            
                return str_replace(array("&amp;", "&nbsp;"), array('&', '&amp;nbsp;'), @htmlspecialchars($this->_values[$name], ENT_QUOTES, _CHARSET));
            case self::DTYPE_LIST: // XOBJ_DTYPE_SIMPLE_ARRAY
                return $this->getVar($name, 'n');
                break;
            case self::DTYPE_OBJECT:
            default:
                return null;
        }
    }

    /**
     * Gets var value for form
     * 
     * @param string $name
     * 
     * @return mixed
     */
    public function getVarForForm($name) {
        switch ($this->_vars[$name][self::VARCFG_TYPE]) {
            case self::DTYPE_STRING:
            case self::DTYPE_INTEGER: // self::DTYPE_INTEGER
            case self::DTYPE_FLOAT: // XOBJ_DTYPE_FLOAT
            case self::DTYPE_BOOLEAN:
            case self::DTYPE_FILE: // XOBJ_DTYPE_FILE
            case self::DTYPE_DATETIME: // XOBJ_DTYPE_LTIME
            case self::DTYPE_ARRAY: // XOBJ_DTYPE_ARRAY
            case self::DTYPE_LIST: // XOBJ_DTYPE_SIMPLE_ARRAY
                return str_replace(array("&amp;", "&nbsp;"), array('&', '&amp;nbsp;'), @htmlspecialchars($this->_values[$name], ENT_QUOTES, _CHARSET));
            case self::DTYPE_OTHER: // XOBJ_DTYPE_OTHER
            case self::DTYPE_OBJECT:
            default:
                return null;
        }
    }

    /**
     * Sets var value
     * 
     * @param string $name      Var name
     * @param mixed $value      New value
     * @param array $options    Options to apply when settings values
     */
    public function setVar($name, $value, $options = null) {
        if ($options !== null) {
            if (is_bool($options)) {
                $this->setVarInfo($name, self::VARCFG_NOT_GPC, $options);
            } elseif (is_array($options)) {
                foreach ($options as $k2 => $v2)
                    $this->setVarInfo($name, $k2, $v2);
            }
        }
        $this->__set($name, $value);
    }

    /**
     * assign a value to a variable
     *
     * @access public
     * @param string $key name of the variable to assign
     * @param mixed $value value to assign
     */
    public function assignVar($key, &$value) {
        if (isset($value) && isset($this->_vars[$key])) {
            $this->_values[$key] = $value;
        }
    }

    /**
     * Gets changes vars
     * 
     * @return array
     */
    public function getChangedVars() {
        $changed = array();
        foreach ($this->_vars as $key => $format)
            if (isset($format[self::VARCFG_CHANGED]) && $format[self::VARCFG_CHANGED])
                $changed[] = $key;
        return $changed;
    }

    /**
     * If is object variables has been changed?
     * 
     * @return bool
     */
    public function isChanged() {
        return count($this->getChangedVars());
    }

    /**
     * Checks if var is set
     * 
     * @param int $type         
     * @param string $key
     * 
     * @return boolean
     */
    private function isVarSet($type, $key) {
        switch ($type) {
            case self::DTYPE_LIST:
            case self::DTYPE_ARRAY:
            case self::DTYPE_FILE:
                return (isset($this->_values[$key]['filename']) && !empty($this->_values[$key]['filename']));
            case self::DTYPE_BOOLEAN:
            case self::DTYPE_INTEGER:
            case self::DTYPE_FLOAT:
                return true;
            case self::DTYPE_OBJECT:
                return is_object($this->_values[$key]);
            case self::DTYPE_STRING:
                return strlen($this->_values[$key]) > 0;
            case self::DTYPE_DATETIME:
                return is_int($this->_values[$key]) && ($this->_values[$key] > 0);
        }
    }

    /**
     * Gets an array with required but not specified vars
     * 
     * @return array
     */
    public function getProblematicVars() {
        $names = array();
        foreach ($this->_vars as $key => $format)
            if ($format[self::VARCFG_REQUIRED] && !$this->isVarSet($format[self::VARCFG_TYPE], $key))
                $names[] = $key;
        return $names;
    }

    /**
     * Initialize var (property) for the object
     * 
     * @param string $key           Var name
     * @param int $dataType         Var data type (use constants DTYPE_* for specifing it!)
     * @param mixed $defaultValue   Default value
     * @param bool $required        Is Required?
     * @param array/null $otherCfg  If there is, an assoc array with other configuration for var
     */
    protected function initVar($key, $dataType, $defaultValue = null, $required = false, $otherCfg = null) {
        if ($otherCfg !== null) {
            $this->_vars[$key] = $otherCfg;
            if (isset($this->_vars[$key][self::VARCFG_POSSIBLE_OPTIONS]) && is_string($this->_vars[$key][self::VARCFG_POSSIBLE_OPTIONS]))
                $this->_vars[$key][self::VARCFG_POSSIBLE_OPTIONS] = explode('|', $this->_vars[$key][self::VARCFG_POSSIBLE_OPTIONS]);
        } else
            $this->_vars[$key] = array();       
        if (file_exists(__DIR__ . '/deprecached/' . $dataType . '.php'))
            include(__DIR__ . '/deprecached/' . $dataType . '.php');
        switch ($dataType) {
            case self::DTYPE_FILE:
                if (!isset($this->_vars[$key][self::VARCFG_ALLOWED_MIMETYPES]))
                    $this->_vars[$key][self::VARCFG_ALLOWED_MIMETYPES] = 0;
                elseif (is_string($this->_vars[$key][self::VARCFG_ALLOWED_MIMETYPES]))
                    $this->_vars[$key][self::VARCFG_ALLOWED_MIMETYPES] = array($this->_vars[$key][self::VARCFG_ALLOWED_MIMETYPES]);
                if (!isset($this->_vars[$key][self::VARCFG_MAX_FILESIZE]))
                    $this->_vars[$key][self::VARCFG_MAX_FILESIZE] = 1000000;
                elseif (!is_int($this->_vars[$key][self::VARCFG_MAX_FILESIZE]))
                    $this->_vars[$key][self::VARCFG_MAX_FILESIZE] = intval($this->_vars[$key][self::VARCFG_MAX_FILESIZE]);
                if (!isset($this->_vars[$key][self::VARCFG_MAX_WIDTH]))
                    $this->_vars[$key][self::VARCFG_MAX_WIDTH] = 500;
                elseif (!is_int($this->_vars[$key][self::VARCFG_MAX_WIDTH]))
                    $this->_vars[$key][self::VARCFG_MAX_WIDTH] = intval($this->_vars[$key][self::VARCFG_MAX_WIDTH]);
                if (!isset($this->_vars[$key][self::VARCFG_MAX_HEIGHT]))
                    $this->_vars[$key][self::VARCFG_MAX_HEIGHT] = 500;
                elseif (!is_int($this->_vars[$key][self::VARCFG_MAX_HEIGHT]))
                    $this->_vars[$key][self::VARCFG_MAX_HEIGHT] = intval($this->_vars[$key][self::VARCFG_MAX_HEIGHT]);
                if (!isset($this->_vars[$key][self::VARCFG_PATH]) || empty($this->_vars[$key][self::VARCFG_PATH]))
                    $this->_vars[$key][self::VARCFG_PATH] = ICMS_UPLOAD_PATH;
                if (!isset($this->_vars[$key][self::VARCFG_PREFIX]))
                    $this->_vars[$key][self::VARCFG_PREFIX] = str_replace(array('icms_ipf_', 'mod_'), '', get_class($this));
                if (!isset($this->_vars[$key][self::VARCFG_FILENAME_FUNCTION]))
                    $this->_vars[$key][self::VARCFG_FILENAME_FUNCTION] = null;
                break;
            case self::DTYPE_LIST:
                if (!isset($this->_vars[$key][self::VARCFG_SEPARATOR]))
                    $this->_vars[$key][self::VARCFG_SEPARATOR] = ';';
                break;
        }
        if (!isset($this->_vars[$key][self::VARCFG_LOCKED]))
            $this->_vars[$key][self::VARCFG_LOCKED] = false;
        $this->_vars[$key][self::VARCFG_TYPE] = $dataType;
        $this->_vars[$key][self::VARCFG_DEFAULT_VALUE] = $this->_values[$key] = $defaultValue; //$this->cleanVar($key, $dataType, $defaultValue);
        $this->_vars[$key][self::VARCFG_REQUIRED] = $required;
    }

    /**
     * Gets default values for all vars
     * 
     * @return array
     */
    public function getDefaultVars() {
        $ret = array();
        foreach ($this->_vars as $key => $info)
            $ret[$key] = $info[self::VARCFG_DEFAULT_VALUE];
        return $ret;
    }

    /**
     * Gets mymetype from filename
     * 
     * @param string $filename      Filename
     * 
     * @return string
     */
    private function getFileMimeType($filename) {
        if (function_exists('finfo_open')) {
            $info = finfo_open(FILEINFO_MIME_TYPE);
            $rez = finfo_file($info, $filename);
            finfo_close($info);
            return $rez;
        }
        if (function_exists('mime_content_type'))
            return mime_content_type($filename);
        return 'unknown/unknown';
    }

    /**
     * Cleans value for var
     * 
     * @param string $key       Var name
     * @param string $type      Var type
     * @param string $value     new value
     * 
     * @return mixed
     */
    protected function cleanVar($key, $type, $value) {
        switch ($type) {            
            case self::DTYPE_OBJECT:
                if ($value == null || is_object($value))
                    return $value;
                if (is_string($value)) {
                    if (substr($value, 0, 1) == '{')
                        return json_decode($value, false);
                    elseif (substr($value, 0, 2) == 'O:')
                        return unserialize($value);
                    elseif (class_exists($value, true))
                        return new $value();
                }
                trigger_error('Unknown object class specified', E_USER_WARNING);
                return null;
            case self::DTYPE_BOOLEAN:
                if (is_bool($value))
                    return $value;
                if (is_numeric($value))
                    return (bool) intval($value);
                if (!is_string($value))
                    return (bool) $value;
                $value = strtolower($value);
                return ($value == 'yes') || ($value == 'true');
            case self::DTYPE_LIST:
                if (empty($value))
                    return array();
                if ((array) ($value) === $value)
                    return $value;
                if (is_string($value))
                    return explode($this->_vars[$key][self::VARCFG_SEPARATOR], strval($value));
                else
                    return array($value);
            case self::DTYPE_FLOAT:
                if (is_float($value))
                    return $value;
                return floatval($value);
            case self::DTYPE_INTEGER:
                if (is_int($value))
                    return $value;
                return intval($value);
            case self::DTYPE_ARRAY:
                if ((array) $value === $value)
                    return $value;
                elseif (is_string($value) && !empty($value)) {
                    if (in_array(substr($value, 0, 1), array('{', '['))) {
                        $ret = json_decode($value, true);
                        if ($ret !== null)
                            return $ret;
                    } elseif (substr($value, 0, 2) == 'a:') {
                        $ret = unserialize($value);
                        if ($ret !== false)
                            return $ret;
                    } elseif ($value == '')
                        return array();
                    return array($value);
                } elseif (is_null($value) && empty($value))
                    return array();
                elseif (!is_object($value))
                    return array($value);
                elseif ($value instanceOf icms_action_Response) {
                    $data = $value->toArray();
                    if (isset($data['isOK']))
                        unset($data['isOK']);
                    return $data;
                } elseif (($value instanceOf icms_properties_Handler) || (method_exists($value, 'toArray')))
                    return $value->toArray();
                elseif (method_exists($value, 'toResponse'))
                    return $value->toResponse()->toArray();
                else
                    return (array) $value;
            case self::DTYPE_FILE:
                if (isset($_FILES[$key])) {
                    $uploader = new icms_file_MediaUploadHandler($this->_vars[$key]['path'], $this->_vars[$key]['allowedMimeTypes'], $this->_vars[$key]['maxFileSize'], $this->_vars[$key]['maxWidth'], $this->_vars[$key]['maxHeight']);
                    if ($uploader->fetchMedia($key)) {
                        if (!empty($this->_vars[$key][self::VARCFG_FILENAME_FUNCTION])) {
                            $filename = call_user_func($this->_vars[$key][self::VARCFG_FILENAME_FUNCTION], 'post', $uploader->getMediaType(), $uploader->getMediaName());
                            if (!empty($this->_vars[$key]['prefix']))
                                $filename = $this->_vars[$key]['prefix'] . $filename;
                            $uploader->setTargetFileName($filename);
                        } elseif (!empty($this->_vars[$key]['prefix'])) {
                            $uploader->setPrefix($this->_vars[$key]['prefix']);
                        }
                        if ($uploader->upload()) {
                            return array(
                                'filename' => $uploader->getSavedFileName(),
                                'mimetype' => $uploader->getMediaType(),
                            );
                        }
                        return null;
                    }
                } elseif (is_string($value)) {
                    if (file_exists($value)) {
                        return array(
                            'filename' => $value,
                            'mimetype' => $this->getFileMimeType($value),
                        );
                    }
                    $uploader = new icms_file_MediaUploadHandler($this->_vars[$key]['path'], $this->_vars[$key]['allowedMimeTypes'], $this->_vars[$key]['maxFileSize'], $this->_vars[$key]['maxWidth'], $this->_vars[$key]['maxHeight']);
                    if ($uploader->fetchFromURL($value)) {
                        if (!empty($this->_vars[$key][self::VARCFG_FILENAME_FUNCTION])) {
                            $filename = call_user_func($this->_vars[$key][self::VARCFG_FILENAME_FUNCTION], 'post', $uploader->getMediaType(), $uploader->getMediaName());
                            if (!empty($this->_vars[$key]['prefix']))
                                $filename = $this->_vars[$key]['prefix'] . $filename;
                            $uploader->setTargetFileName($filename);
                        } elseif (!empty($this->_vars[$key]['prefix'])) {
                            $uploader->setPrefix($this->_vars[$key]['prefix']);
                        }
                        if ($uploader->upload()) {
                            return array(
                                'filename' => $uploader->getSavedFileName(),
                                'mimetype' => $uploader->getMediaType(),
                            );
                        }
                        trigger_error(strip_tags($uploader->getErrors()), E_USER_NOTICE);
                        return null;
                    }
                    return null;
                } elseif (isset($value['filename']) || isset($value['mimetype'])) {
                    if (!isset($value['filename']) || !isset($value['mimetype']))
                        return null;
                    return $value;
                }
                return null;
            case self::DTYPE_DATETIME:
                if ($value === null)
                    return 0;
                if (is_int($value))
                    return $value;
                if (is_numeric($value))
                    return intval($value);
                if (is_array($value))
                    return 0;
                if (preg_match('/(\d\d\d\d)-(\d\d)-(\d\d) (\d\d):(\d\d):(\d\d)/ui', $value, $ret))
                    $time = gmmktime($ret[4], $ret[5], $ret[6], $ret[2], $ret[3], $ret[1]);
                else
                    $time = (int) strtotime($value);
                return ($time < 0) ? 0 : $time;
            case self::DTYPE_STRING:
            default:
                if (!empty($this->_values[$key]) && isset($this->_vars[$key][self::VARCFG_VALIDATE_RULE]) && !empty($this->_vars[$key][self::VARCFG_VALIDATE_RULE]))
                    if (!preg_match($this->_vars[$key][self::VARCFG_VALIDATE_RULE], $value))
                        trigger_error(sprintf('Bad format for %s var (%s)', $key, $value), E_USER_ERROR);
                    elseif (!isset($this->_vars[$key][self::VARCFG_SOURCE_FORMATING]) || empty($this->_vars[$key][self::VARCFG_SOURCE_FORMATING]))
                        $value = icms_core_DataFilter::censorString($value);
                if (isset($this->_vars[$key][self::VARCFG_NOT_GPC]) && !$this->_vars[$key][self::VARCFG_NOT_GPC] && get_magic_quotes_gpc())
                    $value = stripslashes($value);
                if (!is_string($value))
                    $value = strval($value);
                if (isset($this->_vars[$key][self::VARCFG_MAX_LENGTH]) && ($this->_vars[$key][self::VARCFG_MAX_LENGTH] > 0) && (mb_strlen($value) > $this->_vars[$key][self::VARCFG_MAX_LENGTH])) {
                    trigger_error(sprintf(_XOBJ_ERR_SHORTERTHAN, $key, (int) $this->_vars[$key][self::VARCFG_MAX_LENGTH]), E_USER_WARNING);
                    $value = mb_substr($value, 0, $this->_vars[$key][self::VARCFG_MAX_LENGTH]);
                }
                return $value;
        }
    }

    /**
     * Returns the values of the specified variables
     *
     * @param mixed $keys An array containing the names of the keys to retrieve, or null to get all of them
     * @param string $format Format to use (see getVar)
     * @param int $maxDepth Maximum level of recursion to use if some vars are objects themselves
     * @return array associative array of key->value pairs
     */
    public function getValues($keys = null, $format = 's', $maxDepth = 1) {
        if (!isset($keys)) {
            $keys = array_keys($this->_vars);
        }
        $vars = array();
        foreach ($keys as $key) {
            if (isset($this->_vars[$key])) {
                if (is_object($this->_vars[$key]) && ($this->_vars[$key] instanceof icms_properties_Handler)) {
                    if ($maxDepth) {
                        $vars[$key] = $this->_vars[$key]->getValues(null, $format, $maxDepth - 1);
                    }
                } else {
                    $vars[$key] = $this->getVar($key, $format);
                }
            }
        }
        return $vars;
    }

    /**
     * Returns properties as key-value array
     * 
     * @return array
     */
    public function toArray() {
        $ret = array();
        foreach (array_keys($this->_vars) as $name) {
            if (isset($this->_vars[$name][self::VARCFG_NOTLOADED]) && $this->_vars[$name][self::VARCFG_NOTLOADED])
                continue;
            
            if (is_object($this->_values[$name])) {
                $ret[$name] = serialize($this->_values[$name]);
            } else {
                $ret[$name] = $this->_values[$name];
            }            
        }
        return $ret;
    }

    /**
     * Returns array of vars or only one var (if name specified) with selected info field
     * 
     * @param string $key       Var name
     * @param string $info      Var info to get
     * @param mixed $default    Default response
     * 
     * @return mixed
     */
    public function getVarInfo($key = null, $info = null, $default = null) {
        if (!$key)
            return $this->_vars;
        elseif (!$info)
            if (isset($this->_vars[$key]))
                return $this->_vars[$key];
            else {
                $callers = debug_backtrace();
                trigger_error(sprintf('%s in %s on line %d doesn\'t exist', $key, $callers[1]['class'], $callers[1]['line']), E_USER_DEPRECATED);
                return $default;
            } elseif (isset($this->_vars[$key][$info]))
            return $this->_vars[$key][$info];
        else
            return $default;
    }

    /**
     * returns all variables for the object
     *
     * @access public
     * @return array associative array of key->value pairs
     */
    public function &getVars() {
        foreach (array_keys($this->_vars) as $key) {
            $this->_vars[$key][self::VARCFG_DEFAULT_VALUE] = $this->cleanVar($key, $this->_vars[$key][self::VARCFG_TYPE], isset($this->_vars[$key][self::VARCFG_DEFAULT_VALUE]) ? $this->_vars[$key][self::VARCFG_DEFAULT_VALUE] : null);
        }
        return $this->_vars;
    }

    /**
     * Return array of properties names
     * 
     * @return array
     */
    public function getVarNames() {
        return array_keys($this->_vars);
    }

    /**
     * Assign values to multiple variables in a batch
     *
     * @access public
     * @param array $var_arr associative array of values to assign
     * @param bool $not_gpc
     */
    public function setVars($var_arr, $not_gpc = false) {
        foreach ($var_arr as $key => $value)
            $this->setVar($key, $value, $not_gpc);
    }
    
    /**
     * Changes type for var
     * 
     * @param string $key   Var name
     * @param int $type     Type
     * 
     * @deprecated since version 2.0
     */
    public function setType($key, $type) {
        trigger_error(sprintf('%s is deprecached method for %s', $name, get_class($this)), E_USER_DEPRECATED);
        $this->setVarInfo($key, self::VARCFG_TYPE, $type);
    }
    
    /**
     * Sets field as required
     * 
     * @param string $key   Var name
     * @param bool $is_required     Is required?
     * 
     * @deprecated since version 2.0     
     */
    public function doSetFieldAsRequired($key, $is_required = true) {
         trigger_error(sprintf('%s is deprecached method for %s', $name, get_class($this)), E_USER_DEPRECATED);
         $this->setVarInfo($key, self::VARCFG_REQUIRED, $is_required);
    }
    
    /**
     * Returns cleaned vars array
     * 
     * @return array
     * 
     * @deprecated since version 2.0
     */
    public function cleanVars() {
        trigger_error(sprintf('%s is deprecached method for %s', 'cleanVars', get_class($this)), E_USER_DEPRECATED);
        return $this->toArray();
    }

    /**
     * Sets var info
     * 
     * @param string $key       Var name
     * @param string $info      Var option
     * @param mixed $value      Options value
     */
    public function setVarInfo($key, $info, $value) {        
        if ($key === null)
            $key = array_keys($this->_vars);
        
        if (is_array($key)) {           
            foreach ($key as $k)
                $this->setVarInfo($k, $info, $value);
            return;
        } 
        
        if (!isset($this->_vars[$key]))
            return trigger_error('Variable ' . get_class($this) . '::$' . $key . ' not found', E_USER_WARNING);
        
        $this->_vars[$key][$info] = $value;
        switch ($info) {
            case self::VARCFG_TYPE:
                $this->$key = $this->_values[$key];
                break;
        }
    }

    /**
     * Serialize instance to string
     * 
     * @return string
     */
    public function serialize() {
        $data = array('vars' => $this->getValues(null, 'n'));
        return serialize($data);
    }

    /**
     * Used when using with unserialize function call
     * 
     * @param mixed $serialized
     */
    public function unserialize($serialized) {
        $data = unserialize($serialized);
        if (method_exists($this, '__construct'))
            $this->__construct();
        foreach ($data['vars'] as $key => $value)
            $this->_values[$key] = $value;
    }   

}