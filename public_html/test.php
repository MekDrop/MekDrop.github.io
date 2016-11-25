<?php 

if (empty($_REQUEST['url'])) { 
    $_REQUEST['url'] = 'http://impresscms.org';
} 

header('Content-Type: text/plain;'); 
header('Cache-Control: no-cache, no-store, must-revalidate');
header('Pragma: no-cache');
header('Expires: 0');

echo ' URL: ' . $_REQUEST['url'] . PHP_EOL . PHP_EOL; 
echo shell_exec('lynx --dump --head ' . $_REQUEST['url']); 
echo PHP_EOL . PHP_EOL; 
echo shell_exec('lynx --dump ' . $_REQUEST['url']);