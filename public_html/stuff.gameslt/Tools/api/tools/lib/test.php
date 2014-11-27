<?php


class XTest {

    private static $instance = null;
    private $link = null;
    private static $no = null;
    
    /**
     *
     * @return XTest 
     */
    public static function getInstance() {
      if (!self::$instance) 
          self::$instance = new self();
      if (!self::$no)
          self::$no = strval(microtime(true))  . '.' . strval(mt_rand(0, getrandmax()));
      return self::$instance;      
    }
    
    public function writeAction($action, $time) {
         mysql_query('INSERT INTO list (action, exectime, instance) VALUES(\''.mysql_real_escape_string($action).'\',\''.$time.'\', \''.self::$no.'\');');
    }

    private function __construct() {
        XLogger::log('Connecting to test database...');
        $this->link = mysql_connect('dev.fa.on-5.com', 'root', '20111018');
        XLogger::log('Selecting test database...');
        mysql_select_db('test', $this->link);
        XLogger::log('Increasing counter...');
        mysql_query("UPDATE stress SET counter = counter + 1 WHERE cid = 1", $this->link);
    }
    
    public function __destruct() {
        XLogger::log('Decreasing counter...');
        mysql_query("UPDATE stress SET counter = counter - 1 WHERE cid = 1", $this->link);
        XLogger::log('Closing connection...');
        mysql_close($this->link);
    }   
    
    //put your code here
}