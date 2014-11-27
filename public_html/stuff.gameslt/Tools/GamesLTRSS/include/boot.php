<?php

require_once dirname(__FILE__) . '/constants.php';
require_once ROOT_PATH . '/class/autoloader.php';

set_time_limit(-1);

spl_autoload_register(array(new gcAutoloader(), 'autoload'));

date_default_timezone_set(TIMEZONE);