<?php /* Smarty version 2.6.26, created on 2014-11-04 22:05:38
         compiled from core/html/header.html */ ?>
<header class="header_outer <?php echo $this->_tpl_vars['header_wrapper_extra_classes']; ?>
">
  <?php if ($this->_tpl_vars['ml_is_enabled']): ?>
    <div class="header_utility_wrapper">
      <div id="utility" class="container utility">
          <div id="lang_wrapper" class="pull-right">[mlimg]</div>
      </div>
    </div>
  <?php endif; ?>
  <div class="header_wrapper <?php echo $this->_tpl_vars['header_grid_extra_classes']; ?>
">
    <div id="header" class="container header">

      <?php if ($this->_tpl_vars['show_logo']): ?>
        <div id="logo" role="banner" class="brand logo">
          <a href="<?php echo $this->_tpl_vars['icms_url']; ?>
" title="<?php echo $this->_tpl_vars['icms_sitename']; ?>
">
            <?php if ($this->_tpl_vars['logo_path'] != ''): ?>
              <span id="logo_img" class="logo_img">
                <img src="<?php echo $this->_tpl_vars['icms_imageurl']; ?>
<?php echo $this->_tpl_vars['logo_path']; ?>
" alt="<?php echo $this->_tpl_vars['icms_sitename']; ?>
 logo" />
              </span>
            <?php endif; ?>

            <?php if ($this->_tpl_vars['show_sitename']): ?>
              <span id="logo_sitename" class="logo_sitename">
                <?php echo $this->_tpl_vars['icms_sitename']; ?>

              </span>
            <?php endif; ?>

            <?php if ($this->_tpl_vars['show_slogan']): ?>
              <span id="logo_slogan" class="logo_slogan">
                <?php echo $this->_tpl_vars['icms_slogan']; ?>

              </span>
            <?php endif; ?>
          </a>
        </div>
      <?php endif; ?>

      <?php if ($this->_tpl_vars['show_search']): ?>
        <div id="header_search" class="header_search">
          <form action="<?php echo $this->_tpl_vars['icms_url']; ?>
/search.php" method="get" role="search">
            <span>
              <input aria-required="true" placeholder="<?php echo $this->_tpl_vars['search_input_text']; ?>
" type="text" name="query" size="14" />
              <input type="hidden" name="action" value="results" />
              <input type="submit" class="btn btn-clear" value="<?php echo $this->_tpl_vars['search_button_text']; ?>
" />              
            </span>
          </form>
        </div>
      <?php endif; ?>

      <?php if ($this->_tpl_vars['show_nav']): ?>
        <?php $this->_smarty_include(array('smarty_include_tpl_file' => ($this->_tpl_vars['theme_name'])."/html/nav.html", 'smarty_include_vars' => array()));
 ?>
      <?php endif; ?>      
    </div>
  </div>
</header>