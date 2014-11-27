<?php /* Smarty version 2.6.26, created on 2014-11-04 22:06:41
         compiled from db:system_common_form.html */ ?>
<?php require_once(SMARTY_CORE_DIR . 'core.load_plugins.php');
smarty_core_load_plugins(array('plugins' => array(array('function', 'cycle', 'db:system_common_form.html', 21, false),)), $this); ?>
<?php echo $this->_tpl_vars['form']['javascript']; ?>

<form id="<?php echo $this->_tpl_vars['form']['name']; ?>
" action="<?php echo $this->_tpl_vars['form']['action']; ?>
" method="<?php echo $this->_tpl_vars['form']['method']; ?>
" <?php echo $this->_tpl_vars['form']['extra']; ?>
>
  <table style="width: 100%" class="outer" cellspacing="1">
    <?php if ($this->_tpl_vars['form']['title']): ?><tr><th colspan="2"><?php echo $this->_tpl_vars['form']['title']; ?>
</th></tr><?php endif; ?>
    <!-- start of form elements loop -->
    <?php $_from = $this->_tpl_vars['form']['elements']; if (!is_array($_from) && !is_object($_from)) { settype($_from, 'array'); }if (count($_from)):
    foreach ($_from as $this->_tpl_vars['element']):
?>
      <?php if ($this->_tpl_vars['element']['section'] == true): ?>
      <tr><th colspan="2"><?php echo $this->_tpl_vars['element']['body']; ?>
</th></tr>
      <?php elseif ($this->_tpl_vars['element']['section_close'] == true): ?>
      <tr><td class="even" colspan="2">&nbsp;</td></tr>
      <?php elseif ($this->_tpl_vars['element']['hidden'] != true): ?>
      <tr id="<?php echo $this->_tpl_vars['element']['name']; ?>
_row">
        <td class="head">
        <label for='<?php echo $this->_tpl_vars['element']['name']; ?>
'><?php echo $this->_tpl_vars['element']['caption']; ?>
 <?php if ($this->_tpl_vars['element']['required']): ?> <span style='color:#f00'>*</span><?php endif; ?>
        <?php if ($this->_tpl_vars['element']['description']): ?>
        	<img class="helptip" style="float:<?php echo @_GLOBAL_RIGHT; ?>
;padding-top: 2px;" title="<?php echo @_MD_AM_HELP_TIP; ?>
" alt="<?php echo @_MD_AM_HELP_TIP; ?>
" src="<?php echo @ICMS_IMAGES_SET_URL; ?>
/actions/acp_help.png" alt="<?php echo @_MD_AM_HELP_TIP; ?>
">
        	<span class="helptext" style="display: none;"><?php echo $this->_tpl_vars['element']['description']; ?>
</span>
        <?php endif; ?>
        </label>
        </td>
        <td class="<?php echo smarty_function_cycle(array('values' => "even,odd"), $this);?>
"><?php echo $this->_tpl_vars['element']['body']; ?>
</td>
      </tr>
      <?php else: ?>
      <?php echo $this->_tpl_vars['element']['body']; ?>

      <?php endif; ?>
    <?php endforeach; endif; unset($_from); ?>
    <!-- end of form elements loop -->
  </table>
</form>