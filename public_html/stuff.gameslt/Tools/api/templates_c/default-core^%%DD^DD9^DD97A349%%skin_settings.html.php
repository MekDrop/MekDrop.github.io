<?php /* Smarty version 2.6.26, created on 2014-11-04 22:05:38
         compiled from core/skins/v1/skin_settings.html */ ?>
<?php $this->assign('enable_responsive', 1); ?>
<?php $this->assign('enable_wides', 0); ?>
  <?php $this->assign('add_meta', 1); ?>
  <?php $this->assign('use_facebook_sdk', 0); ?>
  <?php $this->assign('enable_twitter_intents', 0); ?>
<?php $this->assign('show_logo', 1); ?>
<?php $this->assign('show_sitename', 0); ?>
<?php $this->assign('show_slogan', 0); ?>
<?php $this->assign('show_search', 1); ?>
<?php $this->assign('show_preface', 1); ?>
<?php if (! $this->_tpl_vars['xoBlocks']['canvas_left']): ?>
  <?php $this->assign('show_leftblocks', 0); ?>
<?php endif; ?>
<?php if (! $this->_tpl_vars['xoBlocks']['canvas_right']): ?>
  <?php $this->assign('show_rightblocks', 0); ?>
<?php endif; ?>
<?php $this->assign('use_html_path_instead', 1); ?>
<?php $this->assign('footer_grid_extra_classes', ''); ?>