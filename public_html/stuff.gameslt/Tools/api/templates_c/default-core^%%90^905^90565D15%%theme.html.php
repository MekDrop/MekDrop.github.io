<?php /* Smarty version 2.6.26, created on 2014-11-04 22:05:38
         compiled from /home/mekdrop/domains/mekdrop.name/public_html/stuff.gameslt/Tools/api/themes/core/theme.html */ ?>
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