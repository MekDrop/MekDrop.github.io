<?php

class icms_session_provider_db
    extends icms_session_provider_abstract {   
    
    /**
     * This we do when we open session
     * 
     * @param string $savePath
     * @param string $sessionName
     * @return boolean
     */
    public function open($savePath, $sessionName) {
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
        $sql = sprintf('SELECT sess_data, sess_ip FROM %s WHERE sess_id = %s', $this->handler->db->prefix('session'), $this->handler->db->quoteString($sess_id));
        if (false != $result = $this->handler->db->query($sql)) {
            list($sess_data, $sess_ip) = $this->handler->db->fetchRow($result);                        
            if ($sess_data === null) {
                return null;
            }
            $data = json_decode($sess_data, true);           
            $_SESSION = new icms_session_Object($this->handler, $data);
            return null;
           /* if ($sess_data && $sess_ip) {
                if ($this->handler->ipv6securityLevel > 1 && icms_core_DataFilter::checkVar($sess_ip, 'ip', 'ipv6')) {
                    /**
                     * also cover IPv6 localhost string
                     */
               /*     if ($_SERVER['REMOTE_ADDR'] == "::1") {
                        $pos = 3;
                    } else {
                        $pos = strpos($sess_ip, ":", $this->handler->ipv6securityLevel - 1);
                    }

                    if (strncmp($sess_ip, $_SERVER['REMOTE_ADDR'], $pos)) {
                        $sess_data = '';
                    }
                } elseif ($this->handler->securityLevel > 1 && icms_core_DataFilter::checkVar($sess_ip, 'ip', 'ipv4')) {
                    $pos = strpos($sess_ip, ".", $this->handler->securityLevel - 1);

                    if (strncmp($sess_ip, $_SERVER['REMOTE_ADDR'], $pos)) {
                        $sess_data = '';
                    }
                }
                return $sess_data;
            }*/
        }
        return '';
    }

    /**
     * Inserts a session into the database
     * @param   string  $sess_id
     * @param   mixed  $sess_data
     * @return  bool
     * */
    public function write($sess_id, $sess_data) {
        $sess_id = $this->handler->db->quoteString($sess_id);
        $sess_data = $this->handler->db->quoteString(json_encode($sess_data->toArray()));

        $sql = sprintf(
                "UPDATE %s SET sess_updated = '%u', sess_data = %s WHERE sess_id = %s", $this->handler->db->prefix('session'), time(), $sess_data, $sess_id
        );
        $this->handler->db->queryF($sql);
        if (!$this->handler->db->getAffectedRows()) {
            $sql = sprintf(
                    "INSERT INTO %s (sess_id, sess_updated, sess_ip, sess_data)"
                    . " VALUES (%s, '%u', %s, %s)", $this->handler->db->prefix('session'), $sess_id, time(), $this->handler->db->quoteString($_SERVER['REMOTE_ADDR']), $sess_data
            );
            return $this->handler->db->queryF($sql);
        }
        return true;
    }

    /**
     * Destroy a session stored in DB
     * @param   string  $sess_id
     * @return  bool
     **/
    public function destroy($sess_id) {
        $sql = sprintf(
                'DELETE FROM %s WHERE sess_id = %s', $this->handler->db->prefix('session'), $this->handler->db->quoteString($sess_id)
        );
        if (!$result = $this->handler->db->queryF($sql)) {
            return false;
        }
        return true;
    }

    /**
     * Garbage Collector
     * @param   int $expire Time in seconds until a session expires
     * @return  bool
     **/
    public function gc($expire) {
        if (empty($expire)) {
            return true;
        }
        $mintime = time() - (int) $expire;
        $sql = sprintf("DELETE FROM %s WHERE sess_updated < '%u'", $this->handler->db->prefix('session'), $mintime);
        return $this->handler->db->queryF($sql);
    }

}