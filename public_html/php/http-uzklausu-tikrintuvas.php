<?php
ini_set('memory_limit', '100M');
set_time_limit(0);

if (isset($_POST['server_url'])) {
    $ch = curl_init ();
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
    curl_setopt($ch, CURLOPT_VERBOSE, true);
    curl_setopt($ch, CURLOPT_HEADER, true);
    
   function mek_merge_arrays(&$array1, &$array2) {
        foreach ($array2 as $k => $v) {
            if (isset($array1[$k])) {
                if (is_array($v)) {
                    mek_merge_arrays($array1[$k], $v);
                } else {
                    $array1[$k] = $v;
                }                
            } else {
                $array1[$k] = $v;
            }
        }
    };
    
    $txtUser = json_encode(array(
        $_SERVER['HTTP_USER_AGENT'],
        $_SERVER['REMOTE_ADDR'],
        isset($_SERVER['REMOTE_HOST'])?$_SERVER['REMOTE_HOST']:'',
        isset($_SERVER['HTTP_X_FORWARDED_FOR'])?$_SERVER['HTTP_X_FORWARDED_FOR']:'',
        isset($_SERVER['HTTP_CLIENT_IP'])?$_SERVER['HTTP_CLIENT_IP']:'',
        /*isset($_SERVER['X_SERVER_ADDR'])?$_SERVER['X_SERVER_ADDR']:''*/
         ));
    $uhash = sha1($txtUser);
    $ckfile = sys_get_temp_dir() . '/' . $uhash . '-' . strlen($txtUser) . '.cookie';
    if ($_POST['save_cookies'] == 'yes') {        
        curl_setopt($ch, CURLOPT_COOKIEJAR, $ckfile);
        curl_setopt($ch, CURLOPT_COOKIEFILE, $ckfile);
    } elseif (file_exists($ckfile)) {
        unlink($ckfile);
    }
    
    $fields = array();
    foreach ($_POST['param_name'] as $i => $name) {
        if (strstr($name, '[')) {
            parse_str($name . '=' . rawurlencode($_POST['param_value'][$i]), $data);
            mek_merge_arrays($fields, $data);
        } else {
            $fields[$name] = $_POST['param_value'][$i];
        }        
    }

	switch ($_POST['server_request_http_version']) {
		case '1.0':
			curl_setopt($ch, CURLOPT_HTTP_VERSION, CURL_HTTP_VERSION_1_0);
		break;
		case '1.1':
			curl_setopt($ch, CURLOPT_HTTP_VERSION, CURL_HTTP_VERSION_1_1);
		break;
		default:
			curl_setopt($ch, CURLOPT_HTTP_VERSION, CURL_HTTP_VERSION_NONE);
		break;
	}
    
    switch ($_POST['server_request_type']) {
        case 'get':
            $url_parts = parse_url($_POST['server_url']);
            $url = $url_parts['scheme'] . '://';
            if (isset($url_parts['user']) || isset($url_parts['pass']) || !empty($url_parts['user']) || empty($url_parts['pass']))
                $url .= rawurlencode(@$url_parts['user']) . ':' . rawurlencode(@$url_parts['pass']) . '@';
            if (!isset($url_parts['port']))
                $url_parts['port'] = 80;
            if (!isset($url_parts['path']))
                $url_parts['path'] = '/';
            $url .= $url_parts['host'] . ':' . $url_parts['port'] . $url_parts['path'];
            if (isset($url_parts['query'])) {
                $vars = array();
                parse_str($url_parts['query'], $vars);
                mek_merge_arrays($fields, $vars);
            } else {
                $vars = $fields;
            }
            $url .= '?' . http_build_query($vars);
            curl_setopt($ch, CURLOPT_URL, $url);
        break;
        case 'post':
            curl_setopt($ch, CURLOPT_URL, $_POST['server_url']);
            curl_setopt($ch, CURLOPT_POSTFIELDS, $fields);
        break;
        case 'put':
            curl_setopt($ch, CURLOPT_URL, $_POST['server_url']);
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, strtoupper($_POST['server_request_type']));
            curl_setopt($ch, CURLOPT_POSTFIELDS, $fields);
        break;
        case 'delete':
        case 'trace':
        case 'options':        
		case 'patch':
        case 'connect':
		case 'head':
            curl_setopt($ch, CURLOPT_URL, $_POST['server_url']);
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, strtoupper($_POST['server_request_type']));
        break;      
    }

	switch ($_POST['server_request_format']) {
		case 'special_header':
            curl_setopt($ch, CURLOPT_URL, $_POST['server_url']);
            curl_setopt($ch, CURLOPT_HTTPHEADER, array(
                rawurlencode($_POST['server_request_ext']) . ':' . json_encode($fields)
            ));
        break; 
	}

    
    $response = curl_exec ($ch);
    
    $header_size = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $header = substr($response, 0, $header_size);
    $output = substr($response, $header_size);        
    
    curl_close($ch);
    
    switch ($_POST['server_result_type']) {
		case 'html':
			switch ($_POST['server_request_type']) {
				case 'trace':
					header('Content-Type: application/header');
				break;
				default:
					header('Content-Type: text/html');
					$output = htmlentities($output);
				break;
			}			
			echo $output;
		break;
        case 'json':
            $json = json_decode(trim($output), true);
            if ($json === null) {
                if ($output == 'null') {
					header('Content-Type: application/json');
					$ret = $output;
                } else {
                    if (strstr($output, '<html') && strstr($output, '</html>')) {
						header('Content-Type: text/html');
                        $ret = '<span class="noselect result-content-some-html"><span><</span>html<span>></span><span class="result-content-multidot">...</span><span><</span>/html<span>></span></span>';
                    } else {
						header('Content-Type: text/plain');
                        $ret = strip_tags($output);
                    }                    
                }
            } else {
				header('Content-Type: application/json');
				$ret = json_encode($json, JSON_PRETTY_PRINT);
            }
            echo $ret;
        break;
        case 'header':
			header('Content-Type: application/header');
            echo $header;
           
        break;
    }    
}