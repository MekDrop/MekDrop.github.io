<?php

/**
 * Cache manifest support for HTML 5
 *
 * @author mekdrop
 */
class icms_cache_Manifest {
    
    /**
     * These files must exist allways in server
     */
    const TYPE_NETWORK = 'NETWORK';
    
    /**
     * These files must be used if other files fails
     */
    const TYPE_FALLBACK = 'FALLBACK';
    
    /**
     * These files must be cached on client
     */
    const TYPE_CACHE = 'CACHE';
    
    /**
     * List of cache entry
     *
     * @var array 
     */
    protected $data = array();
    
    /**
     * Gets class instance
     * 
     * @return icms_cache_Manifest 
     */
    public static function getInstance() {
        static $instance = null;
        if (!$instance)
            $instance = new self();
        return $instance;
    }
    
    /**
     * Constructur (must be private!)
     */
    private function __construct() {}
    
    /**
     * Add item to cached file
     *
     * @param string $url       URL to include in manifest
     * @param string $type      Type of cache entry (use class constants)
     */
    public function add($url, $type = self::TYPE_CACHE) {
        if ($this->isCached())
            return;
        if (!isset($this->data[$type]))
            $this->data[$type] = array();        
        if (in_array($url, $this->data[$type]))
            return;
        $this->data[$type][] = $url;
    }
    
    /**
     * Return if object is cached
     *
     * @return bool 
     */
    public function isCached() {
        static $cached = null;
        if ($cached === null) {
            $cached = file_exists(ICMS_CACHE_PATH . '/cache-manifest/' . $this->getFilename());
        }            
        return $cached;
    }
    
    /**
     * Gets filename for request
     *
     * @return string 
     */
    protected function getFilename() {
        return sha1(icms::$urls['full_phpself']) . '[' . strlen(icms::$urls['full_phpself']) . '].cache';
    }
    
    /**
     * Get cache URL
     *
     * @return string 
     */
    public function getURL() {
        return ICMS_CACHE_URL . '/cache-manifest/' . $this->getFilename();
    }
    
    /**
     * Destructor. Writes cache file if is needed 
     */
    public function __destruct() {
        if (empty($this->data)) 
           return;
        $path = ICMS_CACHE_PATH . '/cache-manifest';
        if (!is_dir($path))
            mkdir($path, 0777, true);
        $ret = 'CACHE MANIFEST';
        foreach ($this->data as $area => $urls)
            $ret .= "\r\n" . $area . "\r\n" . implode("\r\n", $urls);
        file_put_contents($path . '/' . $this->getFilename(), $ret);
    }
    
}