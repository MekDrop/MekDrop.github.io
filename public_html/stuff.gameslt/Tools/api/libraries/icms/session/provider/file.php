<?php

/**
 * Based on SessionHandlerInterface example from PHP.net
 */
class icms_session_provider_file
    extends icms_session_provider_abstract {
    
    /**
     * Where to save our sessions?
     *
     * @var string 
     */
    private $savePath;
    
    /**
     * This we do when we open session
     * 
     * @param string $savePath
     * @param string $sessionName
     * @return boolean
     */
    public function open($savePath, $sessionName) {
        $this->savePath = $savePath;
        if (!is_dir($this->savePath)) {
            mkdir($this->savePath, 0777);
        }

        return true;
    }

    /**
     * This is when we are clsoing session
     * 
     * @return boolean
     */
    public function close() {
        return true;
    }

    /**
     * Read a session from the database
     * @param	string  &sess_id    ID of the session
     * @return	array   Session data
     */
    public function read($sess_id) {
       return (string)@file_get_contents("$this->savePath/sess_$sess_id");
    }

    /**
     * Inserts a session into the database
     * @param   string  $sess_id
     * @param   string  $sess_data
     * @return  bool
     * */
    public function write($sess_id, $sess_data) {
        return file_put_contents("$this->savePath/$sess_id", $sess_data) === false ? false : true;
    }

    /**
     * Destroy a session stored in DB
     * @param   string  $sess_id
     * @return  bool
     **/
    public function destroy($sess_id) {
        $file = "$this->savePath/sess_$sess_id";
        if (file_exists($file)) {
            unlink($file);
        }

        return true;
    }

    /**
     * Garbage Collector
     * @param   int $expire Time in seconds until a session expires
     * @return  bool
     **/
    public function gc($expire) {
          foreach (glob("$this->savePath/sess_*") as $file) {
            if (filemtime($file) + $expire < time() && file_exists($file)) {
                unlink($file);
            }
        }

        return true;
    }

}