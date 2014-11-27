<?php

/**
 * Session Management
 * 
 * @copyright	http://www.impresscms.org/ The ImpressCMS Project
 * @license	LICENSE.txt
 * @category	ICMS
 * @package	Core
 * @subpackage	Session
 * @version	SVN: $Id: Session.php 12112 2012-11-09 02:15:50Z skenow $
 */

/**
 * Handler for a session
 * 
 * Based on SecureSession class 
 * Written by Vagharshak Tozalakyan <vagh@armdex.com>
 * Released under GNU Public License
 * 
 * @category	ICMS
 * @package	Session
 * @copyright	copyright (c) 2000-2003 XOOPS.org
 * @author	    Kazumi Ono	<onokazu@xoops.org>
 */
class icms_session_Handler 
    extends icms_core_ObjectHandler {
    /**
     * Security checking level - no check        
     */

    const SLEVEL_NO_CHECK = 0;

    /**
     * Security checking level - check browser characteristics 
     * (HTTP_USER_AGENT)
     */
    const SLEVEL_BROWSER = 1;

    /**
     * Security checking level - check browser and IP A.B;
     */
    const SLEVEL_BROWSER_AND_IP_WEAK = 2;

    /**
     * Security checking level - check browser and IP A.B.C, recommended
     */
    const SLEVEL_BROWSER_AND_IP_MIDDLE = 3;

    /**
     * Security checking level - no check browser and IP A.B.C.D
     */
    const SLEVEL_BROWSER_AND_IP_HARD = 4;

    /**
     * Security checking level (use constants to set it)
     * 
     * @var	int
     * 
     * @access	public
     */
    public $securityLevel = self::SLEVEL_BROWSER_AND_IP_MIDDLE;

    /**
     * Gets provider for handling sessions
     *
     * @var icms_session_provider_abstract
     */
    public $provider = null;

    /**
     * Initialize the session service
     * @return icms_core_Session
     */
    static public function service() {
        global $icmsConfig;
        $instance = icms::handler('icms_session');
        session_set_save_handler($instance->provider, true);
        $cfgSSLName = $icmsConfig['sslpost_name'];
        $sslpost_name = isset($_POST[$cfgSSLName]) ? $_POST[$cfgSSLName] : '';
        $current = $instance->getCurrent($sslpost_name);
        icms::$user = $current->getUser();
        return $instance;
    }

    /**
     * Enable regenerate_id
     * @var	bool
     * @access	public
     */
    public $enableRegenerateId = false;

    /**
     * Security checking level for IPv6 Address types
     * Possible value:
     * 	0 - no check;
     * 	1 - check browser characteristics (HTTP_USER_AGENT);
     * 	2 - check browser and IPv6 aaaa:bbbb;
     * 	3 - check browser and IPv6 aaaa:bbbb:cccc;
     * 	4 - check browser and IPv6 aaaa:bbbb:cccc:dddd;
     *  5 - check browser and IPv6 aaaa:bbbb:cccc:dddd:eeee;
     *  6 - check browser and IPv6 aaaa:bbbb:cccc:dddd:eeee:ffff;
     *  7 - check browser and IPv6 aaaa:bbbb:cccc:dddd:eeee:ffff:gggg; (recommended)
     *  8 - check browser and IPv6 aaaa:bbbb:cccc:dddd:eeee:ffff:gggg:hhhh;
     *
     * @var	int
     * @access	public
     */
    public $ipv6securityLevel = 7;
    
    /**
     * Constructor
     * 
     * @global array $icmsConfig
     * @param object $db
     */
    public function __construct(&$db) {
        global $icmsConfig;
        
        $providerName = isset($icmsConfig['session_provider'])?$icmsConfig['session_provider']:'db';
        $class = 'icms_session_provider_' . $providerName;
        
        $this->provider = new $class($this);        
        @ini_set('session.serialize_handler', 'php_serialize');
        
        parent::__construct($db);
    }

    /**
     * Gets configured session name
     * 
     * @global array $icmsConfig
     * 
     * @return string
     */
    public function getNameFromConfig() {
        global $icmsConfig;
        if ($this->useCustom())
            return $icmsConfig['session_name'];
        else
            return session_name();
    }

    /**
     * Do we use custom sessions
     * 
     * @global array $icmsConfig
     * 
     * @return bool
     */
    public function useCustom() {
        global $icmsConfig;
        return ($icmsConfig['use_mysession'] && $icmsConfig['session_name'] != '');
    }

    /**
     * Get lifetime of session from cookie
     * 
     * @global array $icmsConfig
     * @return int
     */
    public function getLifeTimeFromConfig() {
        global $icmsConfig;
        if ($this->useCustom())
            $lifeTime = $icmsConfig['session_expire'] * 60;
        else
            $lifeTime = ini_get('session.cookie_lifetime');
        if ($lifeTime == 0) {
            $lifeTime = 3600;
        }
        return $lifeTime;
    }

    /**
     * Creates new session
     * 
     * @return icms_session_Object
     */
    public function &create() {
        session_regenerate_id(false);
        $this->start();
        
        $_SESSION = new icms_session_Object($this, [
            'name' => $this->getNameFromConfig(),
            'lifetime' => $this->getLifeTimeFromConfig(),
            'id' => session_id()
        ]);       

        return $_SESSION;
    }
    
    /**
     * Restarts session
     * 
     * @param array $data
     * 
     * @return \icms_session_Object
     */
    public function restart(array $data = []) {
        session_regenerate_id(true);
        $this->start();
        
        $data['name'] = $this->getNameFromConfig();
        $data['lifetime'] = $this->getLifeTimeFromConfig();
        $data['id'] = session_id();
        
        $_SESSION = new icms_session_Object($this, $data); 

        return $_SESSION;
    }

    /**
     * Gets session by id
     * 
     * @param string $session_id
     */
    public function &get($session_id) {
        session_id($session_id);
        $this->start();

        return $_SESSION;
    }

    /**
     * Saves session
     * 
     * @param icms_session_Object $object
     * @return bool
     */
    public function insert(&$object) {
        return $this->provider->write($object->id, $object);
    }

    /**
     * Deletes session
     * 
     * @param icms_session_Object $object
     */
    public function delete(&$object) {
        session_regenerate_id(true);
        if ($this->useCustom()) {
            $_SESSION->lifetime = -3600;
            $_SESSION->updateCookie();
            $_SESSION = null;
        }
        // clear entry from online users table
        if ($object->user_data['uid'] > 0) {
            $online_handler = icms::handler('icms_core_Online');
            $online_handler->destroy($object->user_data['uid']);
        }
        icms_Event::trigger('icms_core_Session', 'sessionClose', $this);
    }

    /**
     * Starts session
     */
    protected function start() {
        session_name($this->getNameFromConfig());
        
        if (!$this->isStarted()) {
            session_start();
        }
        icms_Event::trigger('icms_core_Session', 'sessionStart', $this);
    }
    
    /**
     * Is session started?
     * 
     * @return boolean
     */
    public function isStarted() {
        if ( version_compare(phpversion(), '5.4.0', '>=') ) {
            return session_status() === PHP_SESSION_ACTIVE;
        } else {
            return session_id() !== '';
        }
    }

    /**
     * Gets current session (if can't find - creates one)
     * 
     * @global array $icmsConfig
     * @param string $sslpost_name
     * @return icms_session_Object
     */
    public function getCurrent($sslpost_name = null) {
        global $icmsConfig;
        if ($icmsConfig['use_ssl'] && !empty($sslpost_name)) {
            $sessionId = $sslpost_name;
        } elseif ($this->useCustom() && $icmsConfig['session_expire'] > 0) {
            if (isset($_COOKIE[$icmsConfig['session_name']])) {
                $sessionId = $_COOKIE[$icmsConfig['session_name']];
            }
            if (function_exists('session_cache_expire')) {
                session_cache_expire($icmsConfig['session_expire']);
            }
            @ini_set('session.gc_maxlifetime', $icmsConfig['session_expire'] * 60);
        } else {
            $name = session_name();
            if (isset($_COOKIE[$name])) {
                $sessionId = $_COOKIE[$name];
            }
            unset($name);
        }
        if (isset($sessionId)) {
            $session = $this->get($sessionId);
        }
        if (!isset($session) || empty($session)) {
            $session = $this->create();
        }
        return $session;
    }

}