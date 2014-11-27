<?php
/*
Plugin Name: SEO Redirection
Plugin URI: http://www.clogica.com
Description: By this plugin you can manage all your website redirection types easily.
Author: Fakhri Alsadi
Version: 2.2
Author URI: http://www.clogica.com
*/

session_start();

require_once ('common/controls.php');
require_once ('custom/controls.php');

define( 'WP_SEO_REDIRECTION_OPTIONS', 'wp-seo-redirection-group' );
$util= new clogica_util();
$util->set_option_gruop(WP_SEO_REDIRECTION_OPTIONS);
$util->set_plugin_folder(basename(dirname(__FILE__)));

add_action('admin_enqueue_scripts', 'WPSR_header_code');
add_action('admin_menu', 'WPSR_admin_menu');
add_action('wp', 'WPSR_redirect');
add_action( 'save_post', 'WPSR_get_post_redirection');
add_action( 'add_meta_boxes', 'adding_WPSR_custom_meta_boxes', 10, 3 );
add_action( 'admin_head', 'WPSR_check_redirection_base' );

register_activation_hook( __FILE__ , 'WPSR_install' );
register_uninstall_hook( __FILE__ , 'WPSR_uninstall' ); 

/////////////////////////////////////////////////////////////////////////

function adding_WPSR_custom_meta_boxes() {
	global $util;
	if($util->get_option_value('show_redirect_box')=='1'){

    	$screens = array( 'post', 'page' );
    
    	foreach ( $screens as $screen ) {
    
    		add_meta_box(
    			'WPSR_meta_box',
    			__( 'SEO Redirection'),
    			'WPSR_render_meta_box',
    			$screen
    		);
    	}
	
	}

}


function WPSR_render_meta_box($post)
{

global $wpdb,$table_prefix,$util ;
$table_name = $table_prefix . 'WP_SEO_Redirection';

	if(get_post_status()!='auto-draft')
	{
		$permalink="";
		if (in_array($post->post_status, array('draft', 'pending'))) {
		list( $permalink, $postname ) = get_sample_permalink( $post->ID);
    		$permalink = str_replace( '%postname%', $postname, $permalink );

		} else {
		    	
				$permalink = get_permalink($post->ID);
		}

		$postID=$post->ID;
		


$theurl = $wpdb->get_row(" select redirect_to,redirect_from from $table_name where postID='$postID'  ");

$urlredirect_to='';
   if($wpdb->num_rows>0)
     $urlredirect_to=$theurl->redirect_to;

if($urlredirect_to !='' && $theurl->redirect_from != $permalink )
	{
	// the post_name field changed!
	$wpdb->query(" update $table_name set redirect_from='$permalink'  where postID='$postID' ");
	if($util->get_option_value('reflect_modifications')=='1'){
		$wpdb->query(" update $table_name set redirect_to='$permalink'  where redirect_to='" . $theurl->redirect_from . "' ");
		$util->info_option_msg('<b>SEO Redirection</b> has detected a change in Permalink, this will be reflected to the redirection records!');
	}
	//-------------------------------------------
	}

echo '
<table border="0" width="100%" cellpadding="2">
	<tr>
		<td width="99%"><input onchange="redirect_check_click()" type="checkbox" name="redirect_check"  id="redirect_check" value="ON">
		Redirect&nbsp;<font color="#008000">' . $permalink . '</font><input type="hidden" name="wp_seo_redirection_url_from" value="' . $permalink . '"></td>
	</tr>
</table>
<div id="redirect_frame">
<table border="0" width="100%" cellpadding="2">
	<tr>
		<td><b>Redirect to</b> <input type="text" name="wp_seo_redirection_url" id="wp_seo_redirection_url" value="' . $urlredirect_to .  '" size="62"></td>
	</tr>
	<tr>
		<td>
		<ul>
			<li>To make a redirection, put the full <b>URL</b> including <b>\'http://\'</b> in the text field above and then click the button <b>Update</b>.</li>
			<li>If you have a caching plugin installed, clear cache to reflect the
			changes immediately.</li>

			<li>To remove the redirection, just uncheck the check box above and then click the button <b>Update</b>.</li>
		</ul>
		</td>
	</tr>
</table>
</div>';

echo "

<script type='text/javascript'>
function WSR_check_status(x)
{
	if(x==0)
	{
		document.getElementById('redirect_check').checked=false;
		document.getElementById('redirect_frame').style.display = 'none';
		document.getElementById('wp_seo_redirection_url').value='';
	}else
	{
	   	document.getElementById('redirect_check').checked=true;
	   	document.getElementById('redirect_frame').style.display= 'block';
	}

}

function redirect_check_click()
{
	if(document.getElementById('redirect_check').checked)
	WSR_check_status(1);
	else
	WSR_check_status(0);
}
</script>
";

	if($urlredirect_to =='')
	echo "<script type='text/javascript'>WSR_check_status(0);</script>";
	else
	echo "<script type='text/javascript'>WSR_check_status(1);</script>";


	}else
	{
		echo 'You can not make a redirection for the new posts before saving them.';
	}
}

//////////////////////////////////////////////////////////////////////////

function  WPSR_check_redirection_base()
{
	global $wpdb,$table_prefix,$util ;	
	$redirection_base = $util->get_option_value('redirection_base');
	$site=site_url();
	if($redirection_base !=$site && $redirection_base!='')
	{
		
		$table_redirection= $table_prefix . 'WP_SEO_Redirection'; //redirect_from,redirect_to
		$table_404_links = $table_prefix . 'WP_SEO_404_links'; // link,referrer
		$table_log = $table_prefix . 'WP_SEO_Redirection_LOG'; //rfrom,rto,referrer
		
		$wpdb->query(" update $table_redirection set redirect_from=REPLACE(redirect_from, '$redirection_base', '$site'), redirect_to=REPLACE(redirect_to, '$redirection_base', '$site') ");
		$wpdb->query(" update $table_404_links set referrer=REPLACE(referrer, '$redirection_base', '$site'), link=REPLACE(link, '$redirection_base', '$site')  ");
		$wpdb->query(" update $table_log set referrer=REPLACE(referrer, '$redirection_base', '$site'), rfrom=REPLACE(rfrom, '$redirection_base', '$site') , rto=REPLACE(rto, '$redirection_base', '$site')");
		
		$msg="It seems that you moved your site from <b>$redirection_base</b> to <b>$site</b>, this has been reflected to redirection data!";
		$msg = " update $table_redirection set redirect_from=REPLACE(redirect_from, $redirection_base, $site), redirect_to=REPLACE(redirect_to, $redirection_base, $site) ";
		$util->warning_option_msg($msg);
		
		$util->update_option('redirection_base',$site);
		
	}
	
	WPSR_check_default_permalink();
}

//--------------------------------------------------------------------------------------------


    function WPSR_check_default_permalink()
    {
       global $util,$wp_rewrite;
       
       $file= get_home_path() . "/.htaccess";
       $filestr ="";
       $begin_marker = "# BEGIN WordPress";
       $end_marker = "# END WordPress";
       $content="ErrorDocument 404 /index.php?error=404";
       $findword = "ErrorDocument 404";
       
       if($wp_rewrite->permalink_structure =='')
       {
        
        if(file_exists($file)){
            
           $f = @fopen( $file, 'r+' );
           $filestr = @fread($f , filesize($file)); 
           
           if (strpos($filestr , $findword) === false)
            {
               if (strpos($filestr , $begin_marker) === false)
                    {
                        $filestr = $begin_marker . PHP_EOL . $content . PHP_EOL . $end_marker . PHP_EOL . $filestr ;
                        fwrite($f ,  $filestr); 
                        fclose($f);
                    }
                    else
                    {
                        fclose($f);
                        $f = fopen($file, "w");
                        $n=strpos($filestr , $begin_marker) + strlen('# BEGIN WordPress');;
                        $div1= substr($filestr,0,$n);
                        $div2= substr($filestr,($n+1),strlen($filestr));
                        $filestr = $div1 . PHP_EOL . $content . PHP_EOL . $div2;
                        fwrite($f ,  $filestr); 
                        fclose($f);
                        
                    }
            }
            
        }else
        {
          
          $filestr = $begin_marker . PHP_EOL . $content . PHP_EOL . $end_marker ;
          if($f = @fopen( $file, 'w' )){
            fwrite($f ,  $filestr); 
            fclose($f);
            $util->warning_option_msg('SEO Redirection: The <b>.htaccess</b> has been created!');
            }
            else
            {
            $util->warning_option_msg('SEO Redirection: Could not create the file <b>.htaccess</b>!');
            }
        }
       
       }
       
    }

//--------------------------------------------------------------------------------------------

//------------------------------------------------------------------------

function  WPSR_get_post_redirection($post_id)
{

global $wpdb,$util,$table_prefix ;
$table_name = $table_prefix . 'WP_SEO_Redirection';

// Autosave
if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) 
        return;
// AJAX
if ( defined( 'DOING_AJAX' ) && DOING_AJAX ) 
        return;
// Post revision
if ( false !== wp_is_post_revision( $post_id ) )
        return;

$redirect_from=$util->post('wp_seo_redirection_url_from');
$redirect_to=$util->post('wp_seo_redirection_url');

if($redirect_to!=''){


	$wpdb->get_results("select ID from $table_name where postID='$post_id'  ");

	if ($wpdb->num_rows > 0) {

	$sql = "update $table_name set redirect_to='$redirect_to',redirect_from='$redirect_from',redirect_type='301',url_type=2 where postID='$post_id'";
		$wpdb->query($sql);

	}else
	{
		$sql = "insert into $table_name(redirect_from,redirect_to,redirect_type,url_type,postID) values ('$redirect_from','$redirect_to','301',2,'$post_id') ";
		$wpdb->query($sql);
	}


	}else
	{
	$wpdb->query("delete from $table_name where postID='$post_id'");
	}
	
}



//-------------------------------------------------------------

function WPSR_log_404_redirection($link)
{
	global $wpdb,$table_prefix,$util ;
	$table_name = $table_prefix . 'WP_SEO_404_links';
    
	$referrer=$util->get_ref();
	$ip=$util->get_visitor_IP();
	$country=$util->get_visitor_country();
	$os=$util->get_visitor_OS();
	$browser=$util->get_visitor_Browser();

	if($os!='Unknown' || $browser!='Unknown'){
		$wpdb->query(" insert IGNORE into $table_name(ctime,link,referrer,ip,country,os,browser) values(NOW(),'$link','$referrer','$ip','$country','$os','$browser') ");
	}
}


//-------------------------------------------------------------

function WPSR_log_redirection_history($rID,$postID, $rfrom, $rto, $rtype,$rsrc)
{
	global $wpdb,$table_prefix,$util ;
	$table_name = $table_prefix . 'WP_SEO_Redirection_LOG';

	$referrer=$util->get_ref();
	$ip=$util->get_visitor_IP();
	$country=$util->get_visitor_country();
	$os=$util->get_visitor_OS();
	$browser=$util->get_visitor_Browser();

	$wpdb->query(" insert into $table_name(rID,postID,rfrom,rto,rtype,rsrc,ctime,referrer,ip,country,os,browser) values('$rID','$postID','$rfrom','$rto','$rtype','$rsrc',NOW(),'$referrer','$ip','$country','$os','$browser') ");
    
    $limit= $util->get_option_value('history_limit');
    
    $expdate = date('Y-n-j', time() - (intval($limit) * 24 * 60 * 60));
    $wpdb->query("delete FROM $table_name WHERE date_format(date(ctime),'%Y-%m-%d') < date_format(date('$expdate'),'%Y-%m-%d')");

}

//-------------------------------------------------------------

function WPSR_make_redirect($redirect_to,$redirect_type,$redirect_from,$obj='')
{ 
    global $util;
    
        if($redirect_to == $redirect_from)
        return 0;

	if(is_object($obj) && $obj->redirect_to_type=='Folder' && $obj->redirect_to_folder_settings=='2' ){

		if($obj->redirect_from_type=='Folder')
		{

			if($obj->redirect_from_folder_settings=='2' || $obj->redirect_from_folder_settings=='3')
			{
				$difference=str_ireplace($obj->redirect_from,'',$redirect_from);
				if($difference!=$redirect_from)
				$redirect_to = $redirect_to . $difference;
			}

		}
		else if ($obj->redirect_from_type=='Regex')
		{
			$page=substr(strrchr($redirect_from, "/"), 1);
			$redirect_to = $redirect_to . '/' . $page;
		}

	}


	$rID=0;
	$rsrc='404';
	$postID=0;

	if(is_object($obj))
	{
		$rID=$obj->ID;
		$postID=$obj->postID;
		if($obj->url_type==1)
		$rsrc='Custom';
		else if($obj->url_type==2)
		$rsrc='Post';
	}

    if($util->get_option_value('history_status')=='1'){
	WPSR_log_redirection_history($rID,$postID, $redirect_from, $redirect_to, $redirect_type,$rsrc);
    }

	if($redirect_type=='301')
	{
  		header ('HTTP/1.1 301 Moved Permanently');
		header ("Location: " . $redirect_to);
		exit();
	}
	else if($redirect_type=='307')
	{
		header ('HTTP/1.0 307 Temporary Redirect');
		header ("Location: " . $redirect_to);
		exit();
	}
	else if($redirect_type=='302')
	{
		header ("Location: " . $redirect_to);
		exit();
	}

}


//-------------------------------------------------------------

function WPSR_redirect()
{

global $wpdb,$table_prefix,$util ;
$table_name = $table_prefix . 'WP_SEO_Redirection';
$permalink=$util->get_current_URL();


if($util->get_option_value('plugin_status')=='1'){
if (($util->get_option_value('redirect_control_panel')!='1') || ($util->get_option_value('redirect_control_panel')=='1' && !preg_match('/^' . str_replace('/','\/', get_admin_url()) . '/i', $permalink) && !preg_match('/^' . str_replace('/','\/', site_url()) . '\/wp-login.php/i', $permalink))){


$theurl = $wpdb->get_row(" select * from $table_name where enabled=1 and regex='' and redirect_from='$permalink'  ");

	if($wpdb->num_rows>0 && $theurl->redirect_to!=''){
    	WPSR_make_redirect($theurl->redirect_to,$theurl->redirect_type,$permalink,$theurl);
	}

$theurl = $wpdb->get_row(" select * from $table_name where enabled=1 and regex<>'' and '$permalink' regexp regex order by LENGTH(regex) desc ");
	if($wpdb->num_rows>0 && $theurl->redirect_to!=''){
	WPSR_make_redirect($theurl->redirect_to,$theurl->redirect_type,$permalink,$theurl);
	}


	if(is_404())
	{

		 if($util->get_option_value('p404_discovery_status')=='1'){
		 WPSR_log_404_redirection($permalink);
		 }

	 	$options= $util->get_my_options();
	 	if($options['p404_status']=='1'){

		 	 WPSR_make_redirect($options['p404_redirect_to'],'301',$permalink);

		}
	}
}}}

//---------------------------------------------------------------

function WPSR_header_code()
{

	if( is_admin() ) {
	wp_register_style( 'c_admin_css_common', WP_PLUGIN_URL . '/' . basename(dirname(__FILE__)) . '/common/' . "style.css" );
	wp_register_style( 'c_admin_css_custom', WP_PLUGIN_URL . '/' . basename(dirname(__FILE__)) . '/custom/' . "style.css" );
	wp_enqueue_script('jquery');
	wp_enqueue_style('c_admin_css_common');
	wp_enqueue_style('c_admin_css_custom');
	}
}

//---------------------------------------------------------------

function WPSR_admin_menu() {
	add_options_page('SEO Redirection', 'SEO Redirection', 'manage_options', basename(__FILE__), 'WPSR_options_menu'  );
}

//---------------------------------------------------------------
function WPSR_options_menu() {
global $util;

	if (!current_user_can('manage_options'))  {
			wp_die( __('You do not have sufficient permissions to access this page.') );
		}


	if($util->get_option_value('plugin_status')!='1')
		$util->info_option_msg('SEO Redirection is disabled now, you can go to option tab and enable it!');

	echo '<div class="wrap"><h2>SEO Redirection</h2><br/>';

	$mytabs = new phptab();
	
	$mytabs->set_ignore_parameter(array('del','search','page_num','add','edit','page404'));
	$mytabs->add_file_tab('cutom','Custom Redirections','option_page_custome_redirection.php','file');
	$mytabs->add_file_tab('posts','Post Redirections','option_page_post_redirection_list.php','file');
	$mytabs->add_file_tab('404','404 Error Links','option_page_404.php','file');
	$mytabs->add_file_tab('history','Redirection History','option_page_history.php','file');
	$mytabs->add_file_tab('goptions','Options','option_page_goptions.php','file');
	$mytabs->run();
    
    
	echo "<div class='procontainer'><div class='ad'>";
	
	$propath = $util->get_plugin_url('custom/images/buttons.png');
	
	echo '<map name="proFPMap0">
    <area target="_blank" href="http://codecanyon.net/item/seo-redirection-pro/7596396?ref=fakhri" shape="rect" coords="7, 5, 113, 44">
    <area target="_blank" href="http://codecanyon.net/theme_previews/7596396-seo-redirection-pro?url_name=seo-redirection-pro&ref=fakhri" shape="rect" coords="119, 5, 228, 44">
    <area target="_blank" href="http://www.clogica.com/downloads/documentation/documentation.zip" shape="rect" coords="232, 7, 352, 42">
    </map>
    <img border="0" src="' . $propath . '" width="360" height="51" usemap="#proFPMap0">';
	
	echo "</div></div></div>";

}

//-----------------------------------------------------
function WPSR_install(){
global $wpdb,$table_prefix ;
	
	$options=get_option(WP_SEO_REDIRECTION_OPTIONS);
	if(!is_array($options))
	{
		add_option(WP_SEO_REDIRECTION_OPTIONS);
		$options= array();
	}
	
	
	    if(!array_key_exists('plugin_status',$options))
			$options['plugin_status']= '1';
	
		if(!array_key_exists('redirection_base',$options))
       		$options['redirection_base']= site_url();
	
        if(!array_key_exists('redirect_control_panel',$options))
			$options['redirect_control_panel']= '1';
	
        if(!array_key_exists('show_redirect_box',$options))
			$options['show_redirect_box']= '1';
	
		if(!array_key_exists('reflect_modifications',$options))
			$options['reflect_modifications']= '1';
	
        if(!array_key_exists('history_status',$options))
			$options['history_status']= '1';
	
        if(!array_key_exists('history_limit',$options))
			$options['history_limit']= '30';
	
        if(!array_key_exists('p404_discovery_status',$options))
			$options['p404_discovery_status']= '1';
	
        if(!array_key_exists('p404_redirect_to',$options))
			$options['p404_redirect_to']= site_url();
	
        if(!array_key_exists('p404_status',$options))
			$options['p404_status']= '2';
	
        if(!array_key_exists('keep_data',$options))
			$options['keep_data']= '1';	
	
    	update_option(WP_SEO_REDIRECTION_OPTIONS,$options);
	

	$table_name = $table_prefix . 'WP_SEO_Redirection';
		if($wpdb->get_var("show tables like '$table_name'") != $table_name) {
			$sql = "
                  CREATE TABLE IF NOT EXISTS `$table_name` (
                  `ID` int(11) unsigned NOT NULL AUTO_INCREMENT,
                  `enabled` int(1) NOT NULL DEFAULT '1',
                  `redirect_from` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
                  `redirect_from_type` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
                  `redirect_from_folder_settings` int(1) NOT NULL,
                  `redirect_from_subfolders` int(1) NOT NULL DEFAULT '1',
                  `redirect_to` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
                  `redirect_to_type` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
                  `redirect_to_folder_settings` int(1) NOT NULL DEFAULT '1',
                  `regex` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
                  `redirect_type` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
                  `url_type` int(2) NOT NULL DEFAULT '1',
                  `postID` int(11) unsigned DEFAULT NULL,
                  PRIMARY KEY (`ID`),
                  UNIQUE KEY `redirect_from` (`redirect_from`)
                );";
			$wpdb->query($sql);
		}
		
		
	$table_name = $table_prefix . 'WP_SEO_404_links';
		if($wpdb->get_var("show tables like '$table_name'") != $table_name) {
			$sql = "
			CREATE TABLE IF NOT EXISTS `$table_name` (
              `ID` int(11) unsigned NOT NULL AUTO_INCREMENT,
              `ctime` datetime NOT NULL,
              `link` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
              `referrer` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
              `ip` varchar(20) COLLATE utf8_unicode_ci NOT NULL,
              `country` varchar(100) COLLATE utf8_unicode_ci NOT NULL,
              `os` varchar(20) COLLATE utf8_unicode_ci NOT NULL,
              `browser` varchar(20) COLLATE utf8_unicode_ci NOT NULL,
              PRIMARY KEY (`ID`),
              UNIQUE KEY `link` (`link`)
            ) ;
			";
			$wpdb->query($sql);
		}
		
		
		$table_name = $table_prefix . 'WP_SEO_Redirection_LOG';
		if($wpdb->get_var("show tables like '$table_name'") != $table_name) {
			$sql = "
    		CREATE TABLE IF NOT EXISTS `$table_name` (
              `ID` int(11) unsigned NOT NULL AUTO_INCREMENT,
              `rID` int(11) unsigned DEFAULT NULL,
              `postID` int(11) unsigned DEFAULT NULL,
              `ctime` datetime NOT NULL,
              `rfrom` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
              `rto` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
              `rtype` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
              `rsrc` varchar(20) COLLATE utf8_unicode_ci NOT NULL,
              `referrer` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
              `ip` varchar(20) COLLATE utf8_unicode_ci NOT NULL,
              `country` varchar(100) COLLATE utf8_unicode_ci NOT NULL,
              `os` varchar(20) COLLATE utf8_unicode_ci NOT NULL,
              `browser` varchar(20) COLLATE utf8_unicode_ci NOT NULL,
              PRIMARY KEY (`ID`)
            ) ;
			";
			
			$wpdb->query($sql);
		}
		
}


//---------------------------------------------------------------


function WPSR_uninstall(){
    global $wpdb,$table_prefix ;
    
    $util= new clogica_util();
    $util->set_option_gruop('wp-seo-redirection-group');
    $util->set_plugin_folder(basename(dirname(__FILE__)));

    
    if($util->get_option_value('keep_data')!='1'){
        
        $table_name = $table_prefix . 'WP_SEO_Redirection';
        $wpdb->query(" DROP TABLE `$table_name`  ");
        
        $table_name = $table_prefix . 'WP_SEO_404_links';
        $wpdb->query(" DROP TABLE `$table_name`  ");
        
        $table_name = $table_prefix . 'WP_SEO_Redirection_LOG';
        $wpdb->query(" DROP TABLE `$table_name`  ");
        
        
		$util->delete_my_options();    
    }
	
	

}

//---------------------------------------------------------------

?>