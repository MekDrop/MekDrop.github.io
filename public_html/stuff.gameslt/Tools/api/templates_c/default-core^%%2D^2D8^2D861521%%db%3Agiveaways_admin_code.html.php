<?php /* Smarty version 2.6.26, created on 2014-11-04 22:07:44
         compiled from db:giveaways_admin_code.html */ ?>
<?php if ($this->_tpl_vars['content_table']): ?>
    <?php echo $this->_tpl_vars['content_table']; ?>

    <form method="post" enctype="multipart/form-data" action="">
        Codes to import:
        <p><textarea name="codes" rows="40" cols="80"></textarea></p>
        <p><button type="submit">Import</button></p>
        <input type="hidden" name="op" value="import" />
        <input type="hidden" name="type_id" value="<?php echo $_REQUEST['type_id']; ?>
" />
    </form>
<?php endif; ?>
<?php if ($this->_tpl_vars['additem']): ?>
    <?php $this->_smarty_include(array('smarty_include_tpl_file' => 'db:system_common_form.html', 'smarty_include_vars' => array('form' => $this->_tpl_vars['additem'])));
 ?>
<?php endif; ?>