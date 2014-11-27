<?php /* Smarty version 2.6.26, created on 2014-11-04 22:05:38
         compiled from core/html/footer.html */ ?>
<?php if ($this->_tpl_vars['show_footer']): ?>
  <?php if ($this->_tpl_vars['use_html_path_instead']): ?>
    <?php $this->_smarty_include(array('smarty_include_tpl_file' => ($this->_tpl_vars['html_footer_path']), 'smarty_include_vars' => array()));
 ?>
  <?php else: ?>
    <footer class="footer_wrapper <?php echo $this->_tpl_vars['footer_wrapper_extra_classes']; ?>
">
      <div id="footer" class="footer container <?php echo $this->_tpl_vars['footer_grid_extra_classes']; ?>
" role="footer">
        <div id="footer_inner" class="footer_inner">
          <?php echo $this->_tpl_vars['icms_footer']; ?>

        </div>
      </div>
    </footer>
  <?php endif; ?>
<?php endif; ?>