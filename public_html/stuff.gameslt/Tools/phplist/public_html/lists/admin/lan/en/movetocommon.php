<?php

### move common translations in all files to the common.php file
## usage "php movetocommon.php" from the "lan/en/" directory.
## this will compare strings in all files and move them to "common.php" if mentioned in more than one file

if (php_sapi_name() != "cli") exit;

$dir = dirname(__FILE__);

$all_texts = array();
$exclude = array('pagetitles.php','common.php','movetocommon.php','removedups.php','..','.');

include 'common.php';
$common_texts = $lan;

if ($dh = opendir($dir)) {
  while (($file = readdir($dh)) !== false) { 
    if(!is_dir($dir.'/'.$file) && !in_array($file,$exclude)) {
      include $file;
      $all_texts[$file] = $lan;
    }
  } 
  closedir($dh); 
} 

$count = array();
$textfiles = array();
foreach ($all_texts as $file => $texts) {
  foreach ($texts as $tag => $text) {
    if (!isset($textfiles[$tag.'!'.$text])) $textfiles[$tag.'!'.$text] = '';
    if (!empty($count[$tag.'!'.$text])) {
      $count[$tag.'!'.$text]++;
    } else {
      $count[$tag.'!'.$text] = 1;
    }
    $textfiles[$tag.'!'.$text] .= $file.' ';

    ## remove from this file, if found in common already
    if (isset($common_texts[$tag])) {
      print "Remove $tag from $file, already in common\n";
      removeTag($file,$tag);
    }
  }
}

#var_dump($all_texts);
foreach ($count as $text => $count) {
  if ($count > 1) {
    printf('%03d: %s'."\n",$count, $text);
    list($tag,$translation) = explode('!',$text);
    appendToCommon('common.php',"'".str_replace("'","\'",$tag)."' => '".str_replace("'","\'",$translation)."',");
    print $textfiles[$text]."\n";
    $oldfiles = explode(' ',$textfiles[$text]);
    foreach ($oldfiles as $file) {
      removeTag($file,$tag);
    }
  }
}

function removeTag($file,$tag) {
  print "Removing $tag from $file\n";
  if (is_file($file)) {
    include $file;
    unset($lan[$tag]);
    $filecontents = '<?php

$lan = array(
';
    foreach ($lan as $key => $val) {
      $filecontents .= "\n"."'".str_replace("'","\'",$key)."' => '".str_replace("'","\'",$val)."',";
    }
    $filecontents .= '
);
?>';
    $dir = dirname($file);
    if (!is_writable($dir) || (is_file($file) && !is_writable($file))) {
      $newfile = basename($file);
      $file = '/tmp/'.$newfile;
    }
    print "Writing $file\n";
    file_put_contents($file,$filecontents);
  }
}

function appendToCommon($file,$text) {
  $filecontents = '';
  if (is_file($file)) {
    $filecontents = file_get_contents($file);
  } else {
    $filecontents = '<?php

$lan = array(

#### INSERT HERE ####

);

    ?>';
  }
  
  $filecontents = preg_replace("/\n/","@@NL@@",$filecontents);
  $filecontents = str_replace('#### INSERT HERE ####','  '.$text."\n#### INSERT HERE ####",$filecontents);
  $filecontents = str_replace("@@NL@@","\n",$filecontents);

  $dir = dirname($file);
  if (!is_writable($dir) || (is_file($file) && !is_writable($file))) {
    $newfile = basename($file);
    $file = '/tmp/'.$newfile;
  }

  file_put_contents($file,$filecontents);
}
