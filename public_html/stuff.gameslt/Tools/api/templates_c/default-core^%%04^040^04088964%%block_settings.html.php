<?php /* Smarty version 2.6.26, created on 2014-11-04 22:05:38
         compiled from core/block_settings.html */ ?>
<?php if (! $this->_tpl_vars['inAdmin']): ?>
  <?php $this->assign('leftLoop', $this->_tpl_vars['xoBlocks']['canvas_left']); ?>
  <?php $this->assign('rightLoop', $this->_tpl_vars['xoBlocks']['canvas_right']); ?>
  <?php $this->assign('topLeftLoop', $this->_tpl_vars['xoBlocks']['page_topleft']); ?>
  <?php $this->assign('topRightLoop', $this->_tpl_vars['xoBlocks']['page_topright']); ?>
  <?php $this->assign('topCenterLoop', $this->_tpl_vars['xoBlocks']['page_topcenter']); ?>
  <?php $this->assign('bottomLeftLoop', $this->_tpl_vars['xoBlocks']['page_bottomleft']); ?>
  <?php $this->assign('bottomRightLoop', $this->_tpl_vars['xoBlocks']['page_bottomright']); ?>
  <?php $this->assign('bottomCenterLoop', $this->_tpl_vars['xoBlocks']['page_bottomcenter']); ?>  
    
  <?php if ($this->_tpl_vars['xoBlocks']['canvas_left'] && $this->_tpl_vars['show_leftblocks'] && $this->_tpl_vars['xoBlocks']['canvas_right'] && $this->_tpl_vars['show_rightblocks']): ?>
    <?php $this->assign('content_grid', '6'); ?>
    <?php $this->assign('content_grid_extra_classes', ''); ?>
    <?php $this->assign('topcenter_grid', '6'); ?>
    <?php $this->assign('topcenter_grid_extra_classes', 'alpha omega'); ?>
    <?php if ($this->_tpl_vars['xoBlocks']['page_topleft'] && ! $this->_tpl_vars['xoBlocks']['page_topright'] || ! $this->_tpl_vars['xoBlocks']['page_topleft'] && $this->_tpl_vars['xoBlocks']['page_topright']): ?>
      <?php $this->assign('topleft_grid', '6'); ?>
      <?php $this->assign('topright_grid', '6'); ?>
      <?php $this->assign('topleft_grid_extra_classes', 'alpha omega'); ?>
      <?php $this->assign('topright_grid_extra_classes', 'alpha omega'); ?>
    <?php else: ?>
      <?php $this->assign('topleft_grid', '3'); ?>
      <?php $this->assign('topright_grid', '3'); ?>
      <?php $this->assign('topleft_grid_extra_classes', 'alpha'); ?>
      <?php $this->assign('topright_grid_extra_classes', 'omega'); ?>
    <?php endif; ?>
    <?php $this->assign('bottomcenter_grid', '6'); ?>
    <?php $this->assign('bottomcnter_grid_extra_classes', 'alpha omega'); ?>
    <?php if ($this->_tpl_vars['xoBlocks']['page_bottomleft'] && ! $this->_tpl_vars['xoBlocks']['page_bottomright'] || ! $this->_tpl_vars['xoBlocks']['page_bottomleft'] && $this->_tpl_vars['xoBlocks']['page_bottomright']): ?>
      <?php $this->assign('bottomleft_grid', '6'); ?>
      <?php $this->assign('bottomright_grid', '6'); ?>
      <?php $this->assign('bottomleft_grid_extra_classes', 'alpha omega'); ?>
      <?php $this->assign('bottomright_grid_extra_classes', 'alpha omega'); ?>
    <?php else: ?>
      <?php $this->assign('bottomleft_grid', '3'); ?>
      <?php $this->assign('bottomright_grid', '3'); ?>
      <?php $this->assign('bottomleft_grid_extra_classes', 'alpha'); ?>
      <?php $this->assign('bottomright_grid_extra_classes', 'omega'); ?>    
    <?php endif; ?>
  <?php elseif ($this->_tpl_vars['xoBlocks']['canvas_left'] && ! $this->_tpl_vars['xoBlocks']['canvas_right'] || ! $this->_tpl_vars['xoBlocks']['canvas_left'] && $this->_tpl_vars['xoBlocks']['canvas_right'] || ! $this->_tpl_vars['show_leftblocks'] && $this->_tpl_vars['show_rightblocks'] || $this->_tpl_vars['show_leftblocks'] && ! $this->_tpl_vars['show_rightblocks']): ?>
    <?php $this->assign('content_grid', '9'); ?>
    <?php $this->assign('topcenter_grid', '9'); ?>
    <?php $this->assign('topcenter_grid_extra_classes', 'alpha omega'); ?>
    <?php if ($this->_tpl_vars['xoBlocks']['page_topleft'] && ! $this->_tpl_vars['xoBlocks']['page_topright'] || ! $this->_tpl_vars['xoBlocks']['page_topleft'] && $this->_tpl_vars['xoBlocks']['page_topright']): ?>
      <?php $this->assign('topleft_grid', '9'); ?>
      <?php $this->assign('topright_grid', '9'); ?>
      <?php $this->assign('topleft_grid_extra_classes', 'alpha omega'); ?>
      <?php $this->assign('topright_grid_extra_classes', 'alpha omega'); ?>    
    <?php else: ?>
      <?php $this->assign('topleft_grid', '3'); ?>
      <?php $this->assign('topright_grid', '6'); ?>
      <?php $this->assign('topleft_grid_extra_classes', 'alpha'); ?>
      <?php $this->assign('topright_grid_extra_classes', 'omega'); ?>    
    <?php endif; ?>
    <?php $this->assign('bottomcenter_grid', '9'); ?>
    <?php $this->assign('bottomcenter_grid_extra_classes', 'alpha omega'); ?>
    <?php if ($this->_tpl_vars['xoBlocks']['page_bottomleft'] && ! $this->_tpl_vars['xoBlocks']['page_bottomright'] || ! $this->_tpl_vars['xoBlocks']['page_bottomleft'] && $this->_tpl_vars['xoBlocks']['page_bottomright']): ?>
      <?php $this->assign('bottomleft_grid', '9'); ?>
      <?php $this->assign('bottomright_grid', '9'); ?>
      <?php $this->assign('bottomleft_grid_extra_classes', 'alpha omega'); ?>
      <?php $this->assign('bottomright_grid_extra_classes', 'alpha omega'); ?>    
    <?php else: ?>
      <?php $this->assign('bottomleft_grid', '6'); ?>
      <?php $this->assign('bottomright_grid', '3'); ?>
      <?php $this->assign('bottomleft_grid_extra_classes', 'alpha'); ?>
      <?php $this->assign('bottomright_grid_extra_classes', 'omega'); ?>        
    <?php endif; ?>
  <?php else: ?>
    <?php $this->assign('content_grid', '12'); ?>
    <?php $this->assign('content_grid_extra_classes', 'alpha omega'); ?>
    <?php $this->assign('topcenter_grid', '12'); ?>
    <?php $this->assign('topcenter_grid_extra_classes', 'alpha omega'); ?>
    <?php if ($this->_tpl_vars['xoBlocks']['page_topleft'] && ! $this->_tpl_vars['xoBlocks']['page_topright'] || ! $this->_tpl_vars['xoBlocks']['page_topleft'] && $this->_tpl_vars['xoBlocks']['page_topright']): ?>
      <?php $this->assign('topleft_grid', '12'); ?>
      <?php $this->assign('topright_grid', '12'); ?>
      <?php $this->assign('topleft_grid_extra_classes', 'alpha omega'); ?>
      <?php $this->assign('topright_grid_extra_classes', 'alpha omega'); ?>     
    <?php else: ?>
      <?php $this->assign('topleft_grid', '6'); ?>
      <?php $this->assign('topright_grid', '6'); ?>
      <?php $this->assign('topleft_grid_extra_classes', 'alpha'); ?>
      <?php $this->assign('topright_grid_extra_classes', 'omega'); ?>      
    <?php endif; ?>
    <?php $this->assign('bottomcenter_grid', '12'); ?>
    <?php $this->assign('bottomcenter_grid_extra_classes', 'alpha omega'); ?>
    <?php if ($this->_tpl_vars['xoBlocks']['page_bottomleft'] && ! $this->_tpl_vars['xoBlocks']['page_bottomright'] || ! $this->_tpl_vars['xoBlocks']['page_bottomleft'] && $this->_tpl_vars['xoBlocks']['page_bottomright']): ?>
      <?php $this->assign('bottomleft_grid', '12'); ?>
      <?php $this->assign('bottomright_grid', '12'); ?>
      <?php $this->assign('bottomleft_grid_extra_classes', 'alpha omega'); ?>
      <?php $this->assign('bottomright_grid_extra_classes', 'alpha omega'); ?>       
    <?php else: ?>
      <?php $this->assign('bottomleft_grid', '6'); ?>
      <?php $this->assign('bottomright_grid', '6'); ?>
      <?php $this->assign('bottomleft_grid_extra_classes', 'alpha'); ?>
      <?php $this->assign('bottomright_grid_extra_classes', 'omega'); ?>        
    <?php endif; ?>
  <?php endif; ?>
<?php else: ?>
  <?php $this->assign('leftLoop', $this->_tpl_vars['xoBlocks']['canvas_left_admin']); ?>
  <?php $this->assign('rightLoop', $this->_tpl_vars['xoBlocks']['canvas_right_admin']); ?>
  <?php $this->assign('topLeftLoop', $this->_tpl_vars['xoBlocks']['page_topleft_admin']); ?>
  <?php $this->assign('topRightLoop', $this->_tpl_vars['xoBlocks']['page_topright_admin']); ?>
  <?php $this->assign('topCenterLoop', $this->_tpl_vars['xoBlocks']['page_topcenter_admin']); ?>
  <?php $this->assign('bottomLeftLoop', $this->_tpl_vars['xoBlocks']['page_bottomleft_admin']); ?>
  <?php $this->assign('bottomRightLoop', $this->_tpl_vars['xoBlocks']['page_bottomright_admin']); ?>
  <?php $this->assign('bottomCenterLoop', $this->_tpl_vars['xoBlocks']['page_bottomcenter_admin']); ?>
    
  <?php if ($this->_tpl_vars['xoBlocks']['canvas_left_admin'] && $this->_tpl_vars['show_leftblocks'] && $this->_tpl_vars['xoBlocks']['canvas_right_admin'] && $this->_tpl_vars['show_rightblocks']): ?>
    <?php $this->assign('content_grid', '6'); ?>
    <?php $this->assign('content_grid_extra_classes', ''); ?>
    <?php $this->assign('topcenter_grid', '6'); ?>
    <?php $this->assign('topcenter_grid_extra_classes', 'alpha omega'); ?>
    <?php if ($this->_tpl_vars['xoBlocks']['page_topleft_admin'] && ! $this->_tpl_vars['xoBlocks']['page_topright_admin'] || ! $this->_tpl_vars['xoBlocks']['page_topleft_admin'] && $this->_tpl_vars['xoBlocks']['page_topright_admin']): ?>
      <?php $this->assign('topleft_grid', '6'); ?>
      <?php $this->assign('topright_grid', '6'); ?>
      <?php $this->assign('topleft_grid_extra_classes', 'alpha omega'); ?>
      <?php $this->assign('topright_grid_extra_classes', 'alpha omega'); ?>
    <?php else: ?>
      <?php $this->assign('topleft_grid', '3'); ?>
      <?php $this->assign('topright_grid', '3'); ?>
      <?php $this->assign('topleft_grid_extra_classes', 'alpha'); ?>
      <?php $this->assign('topright_grid_extra_classes', 'omega'); ?>
    <?php endif; ?>
    <?php $this->assign('bottomcenter_grid', '6'); ?>
    <?php $this->assign('bottomcnter_grid_extra_classes', 'alpha omega'); ?>
    <?php if ($this->_tpl_vars['xoBlocks']['page_bottomleft_admin'] && ! $this->_tpl_vars['xoBlocks']['page_bottomright_admin'] || ! $this->_tpl_vars['xoBlocks']['page_bottomleft_admin'] && $this->_tpl_vars['xoBlocks']['page_bottomright_admin']): ?>
      <?php $this->assign('bottomleft_grid', '6'); ?>
      <?php $this->assign('bottomright_grid', '6'); ?>
      <?php $this->assign('bottomleft_grid_extra_classes', 'alpha omega'); ?>
      <?php $this->assign('bottomright_grid_extra_classes', 'alpha omega'); ?>
    <?php else: ?>
      <?php $this->assign('bottomleft_grid', '3'); ?>
      <?php $this->assign('bottomright_grid', '3'); ?>
      <?php $this->assign('bottomleft_grid_extra_classes', 'alpha'); ?>
      <?php $this->assign('bottomright_grid_extra_classes', 'omega'); ?>    
    <?php endif; ?>
  <?php elseif ($this->_tpl_vars['xoBlocks']['canvas_left_admin'] && ! $this->_tpl_vars['xoBlocks']['canvas_right_admin'] || ! $this->_tpl_vars['xoBlocks']['canvas_left_admin'] && $this->_tpl_vars['xoBlocks']['canvas_right_admin'] || ! $this->_tpl_vars['show_leftblocks'] && $this->_tpl_vars['show_rightblocks'] || $this->_tpl_vars['show_leftblocks'] && ! $this->_tpl_vars['show_rightblocks']): ?>
    <?php $this->assign('content_grid', '9'); ?>
    <?php $this->assign('topcenter_grid', '9'); ?>
    <?php $this->assign('topcenter_grid_extra_classes', 'alpha omega'); ?>
    <?php if ($this->_tpl_vars['xoBlocks']['page_topleft_admin'] && ! $this->_tpl_vars['xoBlocks']['page_topright_admin'] || ! $this->_tpl_vars['xoBlocks']['page_topleft_admin'] && $this->_tpl_vars['xoBlocks']['page_topright_admin']): ?>
      <?php $this->assign('topleft_grid', '9'); ?>
      <?php $this->assign('topright_grid', '9'); ?>
      <?php $this->assign('topleft_grid_extra_classes', 'alpha omega'); ?>
      <?php $this->assign('topright_grid_extra_classes', 'alpha omega'); ?>    
    <?php else: ?>
      <?php $this->assign('topleft_grid', '3'); ?>
      <?php $this->assign('topright_grid', '6'); ?>
      <?php $this->assign('topleft_grid_extra_classes', 'alpha'); ?>
      <?php $this->assign('topright_grid_extra_classes', 'omega'); ?>    
    <?php endif; ?>
    <?php $this->assign('bottomcenter_grid', '9'); ?>
    <?php $this->assign('bottomcenter_grid_extra_classes', 'alpha omega'); ?>
    <?php if ($this->_tpl_vars['xoBlocks']['page_bottomleft_admin'] && ! $this->_tpl_vars['xoBlocks']['page_bottomright_admin'] || ! $this->_tpl_vars['xoBlocks']['page_bottomleft_admin'] && $this->_tpl_vars['xoBlocks']['page_bottomright_admin']): ?>
      <?php $this->assign('bottomleft_grid', '9'); ?>
      <?php $this->assign('bottomright_grid', '9'); ?>
      <?php $this->assign('bottomleft_grid_extra_classes', 'alpha omega'); ?>
      <?php $this->assign('bottomright_grid_extra_classes', 'alpha omega'); ?>    
    <?php else: ?>
      <?php $this->assign('bottomleft_grid', '6'); ?>
      <?php $this->assign('bottomright_grid', '3'); ?>
      <?php $this->assign('bottomleft_grid_extra_classes', 'alpha'); ?>
      <?php $this->assign('bottomright_grid_extra_classes', 'omega'); ?>        
    <?php endif; ?>
  <?php else: ?>
    <?php $this->assign('content_grid', '12'); ?>
    <?php $this->assign('content_grid_extra_classes', 'alpha omega'); ?>
    <?php $this->assign('topcenter_grid', '12'); ?>
    <?php $this->assign('topcenter_grid_extra_classes', 'alpha omega'); ?>
    <?php if ($this->_tpl_vars['xoBlocks']['page_topleft_admin'] && ! $this->_tpl_vars['xoBlocks']['page_topright_admin'] || ! $this->_tpl_vars['xoBlocks']['page_topleft_admin'] && $this->_tpl_vars['xoBlocks']['page_topright_admin']): ?>
      <?php $this->assign('topleft_grid', '12'); ?>
      <?php $this->assign('topright_grid', '12'); ?>
      <?php $this->assign('topleft_grid_extra_classes', 'alpha omega'); ?>
      <?php $this->assign('topright_grid_extra_classes', 'alpha omega'); ?>     
    <?php else: ?>
      <?php $this->assign('topleft_grid', '6'); ?>
      <?php $this->assign('topright_grid', '6'); ?>
      <?php $this->assign('topleft_grid_extra_classes', 'alpha'); ?>
      <?php $this->assign('topright_grid_extra_classes', 'omega'); ?>      
    <?php endif; ?>
    <?php $this->assign('bottomcenter_grid', '12'); ?>
    <?php $this->assign('bottomcenter_grid_extra_classes', 'alpha omega'); ?>
    <?php if ($this->_tpl_vars['xoBlocks']['page_bottomleft_admin'] && ! $this->_tpl_vars['xoBlocks']['page_bottomright_admin'] || ! $this->_tpl_vars['xoBlocks']['page_bottomleft_admin'] && $this->_tpl_vars['xoBlocks']['page_bottomright_admin']): ?>
      <?php $this->assign('bottomleft_grid', '12'); ?>
      <?php $this->assign('bottomright_grid', '12'); ?>
      <?php $this->assign('bottomleft_grid_extra_classes', 'alpha omega'); ?>
      <?php $this->assign('bottomright_grid_extra_classes', 'alpha omega'); ?>       
    <?php else: ?>
      <?php $this->assign('bottomleft_grid', '6'); ?>
      <?php $this->assign('bottomright_grid', '6'); ?>
      <?php $this->assign('bottomleft_grid_extra_classes', 'alpha'); ?>
      <?php $this->assign('bottomright_grid_extra_classes', 'omega'); ?>        
    <?php endif; ?>
  <?php endif; ?>
<?php endif; ?>