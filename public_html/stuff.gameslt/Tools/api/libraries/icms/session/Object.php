<?php

/**
 * @property string $id             Session id
 * @property string $name           Session name
 * @property int    $lifetime       Lifetime of session
 * @property string $fingerprint    Fingerprint string
 * @property array  $user_data      Stored user data
 * @property array  $user_paths     Classes used for user
 * @property string $user_handler   User handler class name
 * @property string $language       User's language
 * @property array  $data           Some data
 */
final class icms_session_Object
    extends icms_core_Object 
    implements ArrayAccess {
    
    protected $handler = null;
    
    /**
     * Constructor
     * 
     * @param icms_session_Handler $handler
     * @param array $data
     */
    public function __construct(icms_session_Handler &$handler, array $data = []) {
        $this->handler = $handler;
                
        // main configuration
        $this->initVar('id', self::DTYPE_STRING, $data['id'], true);
        $this->initVar('name', self::DTYPE_STRING, $data['name'], true);
        $this->initVar('lifetime', self::DTYPE_INTEGER, $data['lifetime'], true);
        
        // custom configuration for session        
        foreach ([
                  'user' => self::DTYPE_ARRAY,
                  'user_paths' => self::DTYPE_LIST,
                  'user_handler' => self::DTYPE_STRING,
                  'language' => self::DTYPE_STRING,
                  'theme' => self::DTYPE_STRING,
                  'data' => self::DTYPE_ARRAY,
                  'last_login' => self::DTYPE_DATETIME,
                  'fingerprint' => self::DTYPE_STRING
                  ] as $name => $type) {
            $value = isset($data[$name])?$data[$name]:null;
            $value = $this->getRealValue($name, $value);
            $this->initVar($name, $type, $value, false);
        }
    }
    
    /**
     * Loads all required classes
     */
    protected function loadRequiredClasses() {
        foreach ($this->user_paths as $spath) {
            include_once $spath . '.php';
        }
    }
    
    /**
     * Sets cookie for session
     */
    public function updateCookie() {
        setcookie(
                $this->name, 
                $this->id,
                $this->lifetime ? time() + $this->lifetime : 0,
                '/',
                '',
                substr(ICMS_URL, 0, 5) == 'https' ? 1 : 0, // we need to secure cookie when using SSL
                0
        );
    }
    
    /**
     * Gets user from session
     * 
     * @return icms_ipf_Object
     */
    public function getUser() {
        if (!isset($this->user['uid'])) {
            return null;
        }
        $this->loadRequiredClasses();
        $handler = new $this->user_handler(icms::$xoopsDB);
        return new $handler->className($handler, $this->user);
    }

    /**
     * Compares the Fingerprint stored in $_SESSION['icms_fprint'] by creating a new Fingerprint.
     * If they match, the Session is valid.
     * To be refactored
     * 
     * @return  bool
     **/
    public function checkFingerprint() {
        return $this->createFingerprint() == $this->fingerprint;        
    }
    
    /**
     * Creates a Fingerprint of the current User Session
     * Fingerprint stored in current $_SESSION['fingerprint']
     * @return  string
     **/
    protected function createFingerprint() {
        $userAgent = $_SERVER['HTTP_USER_AGENT'];
        $userIP = $_SERVER['REMOTE_ADDR'];
        return $this->makeFingerprint($userIP, $userAgent);
    }

    /**
     * Makes sha256 fingerprint string
     * 
     * @param string $ip            IP
     * @param string $userAgent     User agent
     * 
     * @return string
     */
    private function makeFingerprint($ip, $userAgent) {
        $securityLevel = $this->handler->securityLevel;
        $ipv6securityLevel = $this->handler->ipv6securityLevel;

        $fingerprint = SDATA_DB_SALT;

        if (icms_core_DataFilter::checkVar($ip, 'ip', 'ipv4')) {
            if ($securityLevel >= 1) {
                $fingerprint .= $userAgent;
            }
            if ($securityLevel >= 2) {
                $num_blocks = abs($securityLevel);
                if ($num_blocks > 4) {
                    $num_blocks = 4;
                }
                $blocks = explode('.', $ip);
                for ($i = 0; $i < $num_blocks; $i++) {
                    $fingerprint .= $blocks[$i] . '.';
                }
            }
        } elseif (icms_core_DataFilter::checkVar($ip, 'ip', 'ipv6')) {
            if ($ipv6securityLevel >= 1) {
                $fingerprint .= $userAgent;
            }
            if ($ipv6securityLevel >= 2) {
                $num_blocks = abs($ipv6securityLevel);
                if ($num_blocks > 4) {
                    $num_blocks = 4;
                }
                $blocks = explode(':', $ip);
                for ($i = 0; $i < $num_blocks; $i++) {
                    $fingerprint .= $blocks[$i] . ':';
                }
            }
        } else {
            icms_core_Debug::message('ERROR (Session Fingerprint): Invalid IP format,
				IP must be a valid IPv4 or IPv6 format', false);
            return '';
        }
        return hash('sha256', $fingerprint);
    }
    
    /**
     * Check if data element exists
     * 
     * @param mixed $offset
     * 
     * @return mixed
     */
    public function offsetExists($offset) {
        return isset($this->data[$offset]);
    }
    
    /**
     * Get data element
     * 
     * @param mixed $offset
     * 
     * @return mixed
     */
    public function offsetGet($offset) {
        return $this->data[$offset];
    }
    
    /**
     * Sets data item
     * 
     * @param mixed $offset
     * @param mixed $value
     */
    public function offsetSet($offset, $value) {
        $data = $this->data;
        $data[$offset] = $value;
        $this->data = $data;
    }
    
    /**
     * Unset data item
     * 
     * @param mixed $offset
     */
    public function offsetUnset($offset) {
        $data = $this->data;
        unset($data[$offset]);
        $this->data = $data;        
    }
    
    /**
     * Checks if value is correct and if not returns the correct one
     * 
     * @global array $icmsConfig
     * @param string $name
     * @param mixed $value
     * 
     * @return mixed
     */
    protected function getRealValue($name, $value) {
        global $icmsConfig;
        switch ($name) {
            case 'theme':
                if (in_array($value, $icmsConfig['theme_set_allowed'])) {
                    return $value;
                } else {
                    return null;
                }
            break;
            case 'fingerprint':
                return !$value?self::createFingerprint():$value;
            case 'last_login':
                return !$value?time():$value;
            case 'theme':
                return $value?$value:$icmsConfig['theme_set'];
            case 'user_handler':
                return $value?$value:'';
            default:
                return $value;
        }        
    }
    
    /**
     * Setting some properties
     * 
     * @param string $name
     * @param mixed $value
     */
    public function __set($name, $value) {
        parent::__set($name, $this->getRealValue($name, $value));
    }
    
    /**
     * Destrcutor. Saves session
     */
    public function __destruct() {
        $this->handler->insert($this);
    }
    
    /**
     * Used when using with unserialize function call
     * 
     * @param mixed $serialized
     */
    public function unserialize($serialized) {
        $data = unserialize($serialized);        
        if (!$this->handler) {
            $this->handler = icms::handler('icms_session');
        }
        $this->__construct($this->handler, $data['vars']);
    }   

}