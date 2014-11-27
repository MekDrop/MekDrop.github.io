<?php /* Smarty version 2.6.26, created on 2014-11-04 22:06:02
         compiled from db:giveaways_admin_type.html */ ?>
<?php if ($this->_tpl_vars['content_table']): ?>
    <?php echo $this->_tpl_vars['content_table']; ?>

<?php endif; ?>
<?php if ($this->_tpl_vars['additem']): ?>
    <?php $this->_smarty_include(array('smarty_include_tpl_file' => 'db:system_common_form.html', 'smarty_include_vars' => array('form' => $this->_tpl_vars['additem'])));
 ?>
<?php endif; ?>