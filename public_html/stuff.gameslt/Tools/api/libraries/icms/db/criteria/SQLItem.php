<?php
/**
 * A single criteria
 *
 * @category	ICMS
 * @package     Database
 * @subpackage  Criteria
 *
 * @author	    Kazumi Ono	<onokazu@xoops.org>
 */
class icms_db_criteria_SQLItem extends icms_db_criteria_Element {
    
        protected $sql, $params, $pcount, $n;

	/**
	 * Constructor
	 *
	 * @param   string  $sql
	 * @param   string  $value
	 * @param   string  $operator
	 **/
	public function __construct($sql) {
            $this->sql = $sql;
            $this->pcount = func_num_args() - 1;
	    if ($this->pcount == 1)
		$this->params = array(func_get_arg(1));
            elseif ($this->pcount > 1)
                $this->params = array_slice(func_get_args(), 1);
	}	
	
	public function doReplace($m) {
	    if ($this->n >= $this->pcount)
		return icms::$xoopsDB->quote('');
	    switch ($m[1]) {
		case 'd':
		    return (int)$this->params[$this->n++];
		case 'a':
		    if (!is_array($this->params[$this->n]))
			$this->params[$this->n] = array($this->params[$this->n]);
		    return implode(',', array_map(array(icms::$xoopsDB, 'quote'), $this->params[$this->n++]));
		case 't':
		    return  '`' . $this->params[$this->n++] . '`';
		case 's':
		    return icms::$xoopsDB->quote($this->params[$this->n++]);
		case 'F':
		    return (float)$this->params[$this->n++];
		case 'x':
		    return icms::$xoopsDB->quote(dechex($this->params[$this->n++]));
		case 'X':
		    return icms::$xoopsDB->quote(strtoupper(dechex($this->params[$this->n++])));
		case 'o':
		    return decoct($this->params[$this->n++]);
		default:
		    return sprintf($m[0], $this->params[$this->n++]);
	    }
	}

	/**
	 * Make a sql condition string
	 *
	 * @return  string
	 **/
	public function render() {
            $sql = $this->sql;
            if ($this->pcount == 0)
                return $sql;
	    $this->n = 0;
            
            $sql = preg_replace_callback('/%([bcdeufFosxXat])/', array($this, 'doReplace'), $sql);	    
	    
	    return $sql;
	}

	/**
	 * Make a SQL "WHERE" clause
	 *
	 * @return	string
	 */
	public function renderWhere() {
		$cond = $this->render();
		return empty($cond) ? '' : "WHERE $cond";
	}
}

