<?php

function file_get_contents_curl($url){
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_HEADER, 0);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_FOLLOWLOCATION, 1);
    $data = curl_exec($ch);
    curl_close($ch);
    return $data;
}

$url = $_GET['url'];
$html = file_get_contents_curl($url);

preg_match('/<title>(.+)<\/title>/Ui',$html,$matches);
$title = $matches[1];

header('Content-Type: text/html; charset=UTF-8');

$title = iconv('windows-1257', 'UTF-8', $title);
echo $title;
//echo base64_encode($title);