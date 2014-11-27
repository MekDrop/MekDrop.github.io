<?php

require_once dirname(__FILE__) . '/include/boot.php';

$action = (!isset($_GET['action']))?'rss':$_GET['action'];
$actions = new gcActionsHandler();
if (!$actions->exists($action))
    die($action . ' action doesn\'t exists');

echo $actions->exec($action);