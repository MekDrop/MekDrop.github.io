<?php

require_once 'config.php';
require_once 'ini.inc.php';

$DB = new PDO('msql:dbname=' . DB_NAME . ';host=' . DB_HOST, DB_USER, DB_PASS);

require 'actions/' . $_GET['action'] . '.php';