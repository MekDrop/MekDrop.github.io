<?php
global $wpdb;

$_POST = stripslashes_deep($_POST);
$_GET = stripslashes_deep($_GET);

$xyz_ihs_snippetId = intval($_GET['snippetId']);
$xyz_ihs_pageno = intval($_GET['pageno']);

if($xyz_ihs_snippetId=="" || !is_numeric($xyz_ihs_snippetId)){
	header("Location:".admin_url('admin.php?page=insert-html-snippet-manage'));
	exit();

}
$snippetCount = $wpdb->query($wpdb->prepare( 'SELECT * FROM '.$wpdb->prefix.'xyz_ihs_short_code WHERE id=%d LIMIT 0,1',$xyz_ihs_snippetId )) ;

if($snippetCount==0){
	header("Location:".admin_url('admin.php?page=insert-html-snippet-manage&xyz_ihs_msg=2'));
	exit();
}else{
	
	$wpdb->query($wpdb->prepare( 'DELETE FROM  '.$wpdb->prefix.'xyz_ihs_short_code  WHERE id=%d',$xyz_ihs_snippetId)) ;
	
	header("Location:".admin_url('admin.php?page=insert-html-snippet-manage&xyz_ihs_msg=3&pagenum='.$xyz_ihs_pageno));
	exit();
	
}
?>