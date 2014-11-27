<?php

$sth = $DB->prepare("SELECT * FROM games_templates");
$sth->execute();

$ret = $DB->fetchAll();
echo INI::fromArray($ret);