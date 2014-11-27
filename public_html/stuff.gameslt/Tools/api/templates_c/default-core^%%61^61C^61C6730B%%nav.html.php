<?php /* Smarty version 2.6.26, created on 2014-11-04 22:05:38
         compiled from core/html/nav.html */ ?>
  <?php if ($this->_tpl_vars['nav_override_file'] != ''): ?>
    <?php $this->_smarty_include(array('smarty_include_tpl_file' => ($this->_tpl_vars['nav_override_file']), 'smarty_include_vars' => array()));
 ?>
  <?php else: ?>
    <nav id="primary_navigation">
      <div id="navigation" class="nav-collapse collapse" role="navigation">
        <ul>
          <li><a href="#">Home</a></li>
          <li><a href="#">About</a></li>
          <li><a href="#">Blog</a></li>
          <li><a href="#">Downloads</a></li>
          <li><a href="#">Forum</a></li>
        </ul>
      </div>
    </nav>
  <?php endif; ?>