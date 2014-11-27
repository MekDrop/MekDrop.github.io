<?php

/**
 * User can use controls on the selected theme
 */
function smarty_compiler_control( $tag_arg, &$smarty ) {    
	$tag_arg = trim($tag_arg);
	$closed_tag = substr($tag_arg, strlen($tag_arg) - 1, 1) == '/';
	if ($closed_tag) {
		$tag_arg = trim(substr($tag_arg, 0, strlen($tag_arg) - 1));
	}
	$params = $smarty->_parse_attrs($tag_arg);
	if (!isset($params['control'])) {
		$smarty->trigger_error("Control name not set", E_USER_ERROR, __FILE__, __LINE__);
	}
           
    $code = '';
    
    
    $code .= '$this->_controls[++$this->_controlsNum] = $this->_controlHandler->make('.$params['control'] . ', array(';
    
    $first = true;
    foreach ($params as $key => $param) {
        if ($key == 'control')
            continue;
        if ($first) {
            $first = false;
        } else {
            $code .= ',';
        }
        $code .= "'$key' => $param";
    }
    $code .= '));'. "\r\n";
    if ($closed_tag) {
        $code .= 'echo $this->_controls[$this->_controlsNum]->render();';
    } else {
        $code .= 'array_push($this->_controlsIndexes, $this->_controlsNum); 
                  echo $this->_controls[$this->_controlsNum]->render(true);';
    }    
  
	return $code;
}

function smarty_compiler_endcontrol( $tag_arg, &$smarty ) {
    return 'echo $this->_controls[array_pop($this->_controlsIndexes)]->render(false);';	
}