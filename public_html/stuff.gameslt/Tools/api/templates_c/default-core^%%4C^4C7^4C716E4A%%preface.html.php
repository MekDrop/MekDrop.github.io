<?php /* Smarty version 2.6.26, created on 2014-11-04 22:05:38
         compiled from core/skins/v1/html/preface.html */ ?>
<div id="preface_wrapper" class="preface_wrapper">
  <div id="preface" class="preface">
    <div id="preface_inner" class="clearfix container preface_inner">
      <div class="block">
        <div class="block_inner">
          <?php if ($this->_tpl_vars['ishome']): ?>
            <div class="flexslider" data-module="<?php echo $this->_tpl_vars['icms_imageurl']; ?>
app/modules/flexslider/main">
              <ul class="slides">
                <li>
                  <img src="<?php echo $this->_tpl_vars['icms_imageurl']; ?>
skins/<?php echo $this->_tpl_vars['skin']; ?>
/img/slides/sample_1.jpg" />
                </li>
                <li>
                  <img src="<?php echo $this->_tpl_vars['icms_imageurl']; ?>
skins/<?php echo $this->_tpl_vars['skin']; ?>
/img/slides/sample_2.jpg" />
                </li>
                <li>
                  <img src="<?php echo $this->_tpl_vars['icms_imageurl']; ?>
skins/<?php echo $this->_tpl_vars['skin']; ?>
/img/slides/sample_3.jpg" />
                </li>
                <li>
                  <img src="<?php echo $this->_tpl_vars['icms_imageurl']; ?>
skins/<?php echo $this->_tpl_vars['skin']; ?>
/img/slides/sample_4.jpg" />
                </li>                
              </ul>
            </div>
          <?php else: ?>
            <h1><?php echo $this->_tpl_vars['icms_pagetitle']; ?>
</h1>
          <?php endif; ?>
        </div>
      </div>
    </div>
  </div>
</div>