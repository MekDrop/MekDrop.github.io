<?php /* Smarty version 2.6.26, created on 2014-03-07 23:18:54
         compiled from /home/mekdrop/webs/stuff.gameslt.mekdrop.name/public_html/Tools/api/themes/core/theme.html */ ?>
<?php $this->assign('theme_name', $this->_tpl_vars['xoTheme']->folderName); ?>
<?php $this->assign('inAdmin', 0); ?>
<?php 
$urls = icms_getCurrentUrls();

if($urls['isHomePage']) {
  $this->assign('ishome',true);
}else{
  $this->assign('ishome',false);
}
 ?>
<?php $this->_smarty_include(array('smarty_include_tpl_file' => ($this->_tpl_vars['theme_name'])."/theme_settings.html", 'smarty_include_vars' => array()));
 ?>
<?php $this->_smarty_include(array('smarty_include_tpl_file' => ($this->_tpl_vars['theme_name'])."/block_settings.html", 'smarty_include_vars' => array()));
 ?>
<?php $this->_smarty_include(array('smarty_include_tpl_file' => ($this->_tpl_vars['theme_name'])."/skins/".($this->_tpl_vars['skin'])."/skin_settings.html", 'smarty_include_vars' => array()));
 ?>
<?php $this->_smarty_include(array('smarty_include_tpl_file' => ($this->_tpl_vars['theme_name'])."/html/html.html", 'smarty_include_vars' => array()));
 ?>