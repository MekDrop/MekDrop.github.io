<?php /* Smarty version 2.6.26, created on 2014-11-04 22:05:38
         compiled from core/html/page.html */ ?>
<?php require_once(SMARTY_CORE_DIR . 'core.load_plugins.php');
smarty_core_load_plugins(array('plugins' => array(array('modifier', 'truncate', 'core/html/page.html', 13, false),)), $this); ?>
<div id="page" class="page clearfix">
  <div id="page_inner" class="page_inner">
    <?php if ($this->_tpl_vars['show_preface'] && ! $this->_tpl_vars['inAdmin'] && $this->_tpl_vars['preface_blockzone'] != '' || $this->_tpl_vars['use_preface_override_file'] != ''): ?>
      <?php if ($this->_tpl_vars['use_preface_override_file'] != ''): ?>
        <?php $this->_smarty_include(array('smarty_include_tpl_file' => ($this->_tpl_vars['use_preface_override_file']), 'smarty_include_vars' => array()));
 ?>
      <?php else: ?>
        <div id="preface_wrapper" class="preface_wrapper">
          <div id="preface" class="preface container">
            <?php if ($this->_tpl_vars['preface_block_id'] == ''): ?>
              <?php $_from = $this->_tpl_vars['xoBlocks'][$this->_tpl_vars['preface_blockzone']]; if (!is_array($_from) && !is_object($_from)) { settype($_from, 'array'); }$this->_foreach['prefaceblocks'] = array('total' => count($_from), 'iteration' => 0);
if ($this->_foreach['prefaceblocks']['total'] > 0):
    foreach ($_from as $this->_tpl_vars['block']):
        $this->_foreach['prefaceblocks']['iteration']++;
?>
                <div id="block_<?php echo $this->_tpl_vars['block']['id']; ?>
" class="block block_<?php echo $this->_tpl_vars['block']['id']; ?>
 preface_block preface_block_<?php echo $this->_foreach['prefaceblocks']['iteration']; ?>
 span<?php echo $this->_tpl_vars['preface_grid']; ?>
 <?php echo $this->_tpl_vars['preface_grid_extra_classes']; ?>
">
                  <div class="block_inner">                  
                    <?php if ($this->_tpl_vars['show_preface_block_titles'] && $this->_tpl_vars['block']['title'] != '' && ! ((is_array($_tmp=$this->_tpl_vars['block']['title'])) ? $this->_run_mod_handler('truncate', true, $_tmp, 1, "", true) : smarty_modifier_truncate($_tmp, 1, "", true)) == '_'): ?>
                      <h3 class="title"><span><?php echo $this->_tpl_vars['block']['title']; ?>
<span></h3 class="title">
                    <?php endif; ?>
                    <?php if ($this->_tpl_vars['block']['content']): ?>
                      <div class="preface_content block_content">
                        <?php echo $this->_tpl_vars['block']['content']; ?>

                      </div>
                    <?php endif; ?>
                  </div>
                </div>
              <?php endforeach; endif; unset($_from); ?>
            <?php else: ?>
              <div id="single_preface_block" class="block single_preface_block preface_block span<?php echo $this->_tpl_vars['preface_grid']; ?>
 <?php echo $this->_tpl_vars['preface_grid_extra_classes']; ?>
">
                <div class="block_inner">
                  <?php if ($this->_tpl_vars['show_preface_block_titles'] && $this->_tpl_vars['xoBlocks'][$this->_tpl_vars['preface_blockzone']][$this->_tpl_vars['preface_block_id']]['title'] && ((is_array($_tmp=$this->_tpl_vars['xoBlocks'][$this->_tpl_vars['preface_blockzone']][$this->_tpl_vars['preface_block_id']]['title'])) ? $this->_run_mod_handler('truncate', true, $_tmp, 1, "", true) : smarty_modifier_truncate($_tmp, 1, "", true)) != '_'): ?>
                    <h3 class="title"><span><?php echo $this->_tpl_vars['xoBlocks'][$this->_tpl_vars['preface_blockzone']][$this->_tpl_vars['preface_block_id']]['title']; ?>
</span></h3 class="title">
                  <?php endif; ?>
                  <?php if ($this->_tpl_vars['xoBlocks'][$this->_tpl_vars['preface_blockzone']][$this->_tpl_vars['preface_block_id']]['content']): ?>
                    <div class="preface_content block_content">
                      <?php echo $this->_tpl_vars['xoBlocks'][$this->_tpl_vars['preface_blockzone']][$this->_tpl_vars['preface_block_id']]['content']; ?>

                    </div>
                  <?php endif; ?>
                </div>
              </div>
            <?php endif; ?>
          </div>
        </div>
      <?php endif; ?>
    <?php endif; ?>

    <div id="main_wrapper" class="main_wrapper">
      <div id="main" role="main" class="main container">

          <?php if ($this->_tpl_vars['show_leftblocks'] && $this->_tpl_vars['leftLoop']): ?>
            <aside id="leftside_wrapper" class="leftside_wrapper span<?php echo $this->_tpl_vars['leftcolumn_grid']; ?>
 <?php echo $this->_tpl_vars['leftcolumn_grid_extra_classes']; ?>
">
              <div id="leftside" class="leftside">
                <?php $_from = $this->_tpl_vars['leftLoop']; if (!is_array($_from) && !is_object($_from)) { settype($_from, 'array'); }$this->_foreach['leftblocks'] = array('total' => count($_from), 'iteration' => 0);
if ($this->_foreach['leftblocks']['total'] > 0):
    foreach ($_from as $this->_tpl_vars['block']):
        $this->_foreach['leftblocks']['iteration']++;
?>
                  <div id="block_<?php echo $this->_tpl_vars['block']['id']; ?>
" class="block block_<?php echo $this->_tpl_vars['block']['id']; ?>
 leftside_block leftside_block_<?php echo $this->_foreach['leftblocks']['iteration']; ?>
">
                    <div class="block_inner">
                      <?php if ($this->_tpl_vars['block']['title'] != '' && ((is_array($_tmp=$this->_tpl_vars['block']['title'])) ? $this->_run_mod_handler('truncate', true, $_tmp, 1, "", true) : smarty_modifier_truncate($_tmp, 1, "", true)) != '_'): ?>
                        <h3 class="title"><span><?php echo $this->_tpl_vars['block']['title']; ?>
</span></h3 class="title">
                      <?php endif; ?>
                      <?php if ($this->_tpl_vars['block']['content']): ?>
                        <div class="leftblock_content block_content clearfix">
                          <?php echo $this->_tpl_vars['block']['content']; ?>

                        </div>
                      <?php endif; ?>
                    </div>
                  </div>
                <?php endforeach; endif; unset($_from); ?>
              </div>
            </aside>
          <?php endif; ?>

          <div id="content_wrapper" class="content_wrapper span<?php echo $this->_tpl_vars['content_grid']; ?>
 <?php echo $this->_tpl_vars['content_grid_extra_classes']; ?>
">

            <?php if ($this->_tpl_vars['show_topblocks_in_content'] && $this->_tpl_vars['topLeftLoop'] || $this->_tpl_vars['topRightLoop'] || $this->_tpl_vars['topCenterLoop']): ?>
              <div id="top_blocks_wrapper" class="top_blocks_wrapper">
                <div id="topblocks" class="topblocks">

                  <?php if ($this->_tpl_vars['topLeftLoop']): ?>
                    <div id="topleft_blocks" class="topleft_blocks span<?php echo $this->_tpl_vars['topleft_grid']; ?>
 <?php echo $this->_tpl_vars['topleft_grid_extra_classes']; ?>
">
                      <?php $_from = $this->_tpl_vars['topLeftLoop']; if (!is_array($_from) && !is_object($_from)) { settype($_from, 'array'); }$this->_foreach['topleftblocks'] = array('total' => count($_from), 'iteration' => 0);
if ($this->_foreach['topleftblocks']['total'] > 0):
    foreach ($_from as $this->_tpl_vars['block']):
        $this->_foreach['topleftblocks']['iteration']++;
?>
                        <div id="block_<?php echo $this->_tpl_vars['block']['id']; ?>
" class="block block_<?php echo $this->_tpl_vars['block']['id']; ?>
 topleft_block topleft_block_<?php echo $this->_foreach['topleftblocks']['iteration']; ?>
">
                          <div class="block_inner">
                            <?php if ($this->_tpl_vars['block']['title'] != '' && ((is_array($_tmp=$this->_tpl_vars['block']['title'])) ? $this->_run_mod_handler('truncate', true, $_tmp, 1, "", true) : smarty_modifier_truncate($_tmp, 1, "", true)) != '_'): ?>
                              <h3 class="title"><span><?php echo $this->_tpl_vars['block']['title']; ?>
</span></h3 class="title">
                            <?php endif; ?>
                            <?php if ($this->_tpl_vars['block']['content']): ?>
                              <div class="topleftblock_content block_content">
                                <?php echo $this->_tpl_vars['block']['content']; ?>

                              </div>
                            <?php endif; ?>
                          </div>
                        </div>
                      <?php endforeach; endif; unset($_from); ?>
                    </div>
                  <?php endif; ?>

                  <?php if ($this->_tpl_vars['topRightLoop']): ?>
                    <div id="topright_blocks" class="topright_blocks span<?php echo $this->_tpl_vars['topright_grid']; ?>
 <?php echo $this->_tpl_vars['topright_grid_extra_classes']; ?>
">
                      <?php $_from = $this->_tpl_vars['topRightLoop']; if (!is_array($_from) && !is_object($_from)) { settype($_from, 'array'); }$this->_foreach['toprightblocks'] = array('total' => count($_from), 'iteration' => 0);
if ($this->_foreach['toprightblocks']['total'] > 0):
    foreach ($_from as $this->_tpl_vars['block']):
        $this->_foreach['toprightblocks']['iteration']++;
?>
                        <div id="block_<?php echo $this->_tpl_vars['block']['id']; ?>
" class="block block_<?php echo $this->_tpl_vars['block']['id']; ?>
 topright_block topright_block_<?php echo $this->_foreach['toprightblocks']['iteration']; ?>
">
                          <div class="block_inner">
                            <?php if ($this->_tpl_vars['block']['title'] != '' && ((is_array($_tmp=$this->_tpl_vars['block']['title'])) ? $this->_run_mod_handler('truncate', true, $_tmp, 1, "", true) : smarty_modifier_truncate($_tmp, 1, "", true)) != '_'): ?>
                              <h3 class="title"><span><?php echo $this->_tpl_vars['block']['title']; ?>
</span></h3 class="title">
                            <?php endif; ?>
                            <?php if ($this->_tpl_vars['block']['content']): ?>
                              <div class="toprightblock_content block_content">
                                <?php echo $this->_tpl_vars['block']['content']; ?>

                              </div>
                            <?php endif; ?>
                          </div>
                        </div>
                      <?php endforeach; endif; unset($_from); ?>
                    </div>
                  <?php endif; ?>

                  <?php if ($this->_tpl_vars['topCenterLoop']): ?>
                    <div id="topcenter_blocks" class="topcenter_blocks span<?php echo $this->_tpl_vars['topcenter_grid']; ?>
 <?php echo $this->_tpl_vars['topcenter_grid_extra_classes']; ?>
">
                      <?php $_from = $this->_tpl_vars['topCenterLoop']; if (!is_array($_from) && !is_object($_from)) { settype($_from, 'array'); }$this->_foreach['topcenterblocks'] = array('total' => count($_from), 'iteration' => 0);
if ($this->_foreach['topcenterblocks']['total'] > 0):
    foreach ($_from as $this->_tpl_vars['block']):
        $this->_foreach['topcenterblocks']['iteration']++;
?>
                        <div id="block_<?php echo $this->_tpl_vars['block']['id']; ?>
" class="block block_<?php echo $this->_tpl_vars['block']['id']; ?>
 topcenter_block topcenter_block_<?php echo $this->_foreach['topcenterblocks']['iteration']; ?>
">
                          <div class="block_inner">
                            <?php if ($this->_tpl_vars['block']['title'] != '' && ((is_array($_tmp=$this->_tpl_vars['block']['title'])) ? $this->_run_mod_handler('truncate', true, $_tmp, 1, "", true) : smarty_modifier_truncate($_tmp, 1, "", true)) != '_'): ?>
                              <h3 class="title"><span><?php echo $this->_tpl_vars['block']['title']; ?>
</span></h3 class="title">
                            <?php endif; ?>
                            <?php if ($this->_tpl_vars['block']['content']): ?>
                              <div class="topcenterblock_content block_content">
                                <?php echo $this->_tpl_vars['block']['content']; ?>

                              </div>
                            <?php endif; ?>
                          </div>
                        </div>
                      <?php endforeach; endif; unset($_from); ?>
                    </div>
                  <?php endif; ?>

                </div>
              </div>
            <?php endif; ?>

            <?php if ($this->_tpl_vars['icms_contents']): ?>
              <div id="content" class="content <?php echo $this->_tpl_vars['content_grid_extra_classes']; ?>
">
                <div id="content_inner" class="content_inner">
                  <?php echo $this->_tpl_vars['icms_contents']; ?>

                </div>
              </div>
            <?php endif; ?>

            <?php if ($this->_tpl_vars['show_bottomblocks_in_content'] && $this->_tpl_vars['bottomCenterLoop'] || $this->_tpl_vars['bottomLeftLoop'] || $this->_tpl_vars['bottomRightLoop']): ?>
              <div id="bottom_blocks_wrapper" class="bottom_blocks_wrapper">
                <div id="bottomblocks" class="bottomblocks">

                  <?php if ($this->_tpl_vars['bottomCenterLoop']): ?>
                    <div id="bottomcenter_blocks" class="bottomcenter_blocks span<?php echo $this->_tpl_vars['bottomcenter_grid']; ?>
 <?php echo $this->_tpl_vars['bottomcenter_grid_extra_classes']; ?>
">
                      <?php $_from = $this->_tpl_vars['bottomCenterLoop']; if (!is_array($_from) && !is_object($_from)) { settype($_from, 'array'); }$this->_foreach['bottomcenterblocks'] = array('total' => count($_from), 'iteration' => 0);
if ($this->_foreach['bottomcenterblocks']['total'] > 0):
    foreach ($_from as $this->_tpl_vars['block']):
        $this->_foreach['bottomcenterblocks']['iteration']++;
?>
                        <div id="block_<?php echo $this->_tpl_vars['block']['id']; ?>
" class="block block_<?php echo $this->_tpl_vars['block']['id']; ?>
 bottomcenter_block bottomcenter_block_<?php echo $this->_foreach['bottomcenterblocks']['iteration']; ?>
">
                          <div class="block_inner">
                            <?php if ($this->_tpl_vars['block']['title'] != '' && ((is_array($_tmp=$this->_tpl_vars['block']['title'])) ? $this->_run_mod_handler('truncate', true, $_tmp, 1, "", true) : smarty_modifier_truncate($_tmp, 1, "", true)) != '_'): ?>
                              <h3 class="title"><span><?php echo $this->_tpl_vars['block']['title']; ?>
</span></h3 class="title">
                            <?php endif; ?>
                            <?php if ($this->_tpl_vars['block']['content']): ?>
                              <div class="bottomcenterblock_content block_content">
                                <?php echo $this->_tpl_vars['block']['content']; ?>

                              </div>
                            <?php endif; ?>
                          </div>
                        </div>
                      <?php endforeach; endif; unset($_from); ?>
                    </div>
                  <?php endif; ?>

                  <?php if ($this->_tpl_vars['bottomLeftLoop']): ?>
                    <div id="bottomleft_blocks" class="bottomleft_blocks span<?php echo $this->_tpl_vars['bottomleft_grid']; ?>
 <?php echo $this->_tpl_vars['bottomleft_grid_extra_classes']; ?>
">
                      <?php $_from = $this->_tpl_vars['bottomLeftLoop']; if (!is_array($_from) && !is_object($_from)) { settype($_from, 'array'); }$this->_foreach['bottomleftblocks'] = array('total' => count($_from), 'iteration' => 0);
if ($this->_foreach['bottomleftblocks']['total'] > 0):
    foreach ($_from as $this->_tpl_vars['block']):
        $this->_foreach['bottomleftblocks']['iteration']++;
?>
                        <div id="block_<?php echo $this->_tpl_vars['block']['id']; ?>
" class="block block_<?php echo $this->_tpl_vars['block']['id']; ?>
 bottomleft_block bottomleft_block_<?php echo $this->_foreach['bottomleftblocks']['iteration']; ?>
">
                          <div class="block_inner">
                            <?php if ($this->_tpl_vars['block']['title'] != '' && ((is_array($_tmp=$this->_tpl_vars['block']['title'])) ? $this->_run_mod_handler('truncate', true, $_tmp, 1, "", true) : smarty_modifier_truncate($_tmp, 1, "", true)) != '_'): ?>
                              <h3 class="title"><span><?php echo $this->_tpl_vars['block']['title']; ?>
</span></h3 class="title">
                            <?php endif; ?>
                            <?php if ($this->_tpl_vars['block']['content']): ?>
                              <div class="bottomleftblock_content block_content">
                                <?php echo $this->_tpl_vars['block']['content']; ?>

                              </div>
                            <?php endif; ?>
                          </div>
                        </div>
                      <?php endforeach; endif; unset($_from); ?>
                    </div>
                  <?php endif; ?>

                  <?php if ($this->_tpl_vars['bottomRightLoop']): ?>
                    <div id="bottomright_blocks" class="bottomright_blocks span<?php echo $this->_tpl_vars['bottomright_grid']; ?>
 <?php echo $this->_tpl_vars['bottomright_grid_extra_classes']; ?>
">
                      <?php $_from = $this->_tpl_vars['bottomRightLoop']; if (!is_array($_from) && !is_object($_from)) { settype($_from, 'array'); }$this->_foreach['bottomrightblocks'] = array('total' => count($_from), 'iteration' => 0);
if ($this->_foreach['bottomrightblocks']['total'] > 0):
    foreach ($_from as $this->_tpl_vars['block']):
        $this->_foreach['bottomrightblocks']['iteration']++;
?>
                        <div id="block_<?php echo $this->_tpl_vars['block']['id']; ?>
" class="block block_<?php echo $this->_tpl_vars['block']['id']; ?>
 bottomright_block bottomright_block_<?php echo $this->_foreach['bottomrightblocks']['iteration']; ?>
">
                          <div class="block_inner">
                            <?php if ($this->_tpl_vars['block']['title'] != '' && ((is_array($_tmp=$this->_tpl_vars['block']['title'])) ? $this->_run_mod_handler('truncate', true, $_tmp, 1, "", true) : smarty_modifier_truncate($_tmp, 1, "", true)) != '_'): ?>
                              <h3 class="title"><span><?php echo $this->_tpl_vars['block']['title']; ?>
</span></h3 class="title">
                            <?php endif; ?>
                            <?php if ($this->_tpl_vars['block']['content']): ?>
                              <div class="bottomrightblock_content block_content">
                                <?php echo $this->_tpl_vars['block']['content']; ?>

                              </div>
                            <?php endif; ?>
                          </div>
                        </div>
                      <?php endforeach; endif; unset($_from); ?>
                    </div>
                  <?php endif; ?>

                </div>
              </div>
            <?php endif; ?>

          </div>

          <?php if ($this->_tpl_vars['rightLoop']): ?>
            <aside id="rightside_wrapper" class="rightside_wrapper span<?php echo $this->_tpl_vars['rightcolumn_grid']; ?>
 <?php echo $this->_tpl_vars['rightcolumn_grid_extra_classes']; ?>
">
              <div id="rightside" class="rightside">
                <?php $_from = $this->_tpl_vars['rightLoop']; if (!is_array($_from) && !is_object($_from)) { settype($_from, 'array'); }$this->_foreach['rightblocks'] = array('total' => count($_from), 'iteration' => 0);
if ($this->_foreach['rightblocks']['total'] > 0):
    foreach ($_from as $this->_tpl_vars['block']):
        $this->_foreach['rightblocks']['iteration']++;
?>
                  <div id="block_<?php echo $this->_tpl_vars['block']['id']; ?>
" class="block block_<?php echo $this->_tpl_vars['block']['id']; ?>
 rightside_block rightside_block_<?php echo $this->_foreach['rightblocks']['iteration']; ?>
">
                    <div class="block_inner">
                      <?php if ($this->_tpl_vars['block']['title'] != '' && ((is_array($_tmp=$this->_tpl_vars['block']['title'])) ? $this->_run_mod_handler('truncate', true, $_tmp, 1, "", true) : smarty_modifier_truncate($_tmp, 1, "", true)) != '_'): ?>
                        <h3 class="title"><span><?php echo $this->_tpl_vars['block']['title']; ?>
</span></h3 class="title">
                      <?php endif; ?>
                      <?php if ($this->_tpl_vars['block']['content']): ?>
                        <div class="rightblock_content block_content">
                          <?php echo $this->_tpl_vars['block']['content']; ?>

                        </div>
                      <?php endif; ?>
                    </div>
                  </div>
                <?php endforeach; endif; unset($_from); ?>
              </div>
            </aside>
          <?php endif; ?>

      </div>
    </div>

    <?php if ($this->_tpl_vars['show_postscript'] && ! $this->_tpl_vars['inAdmin'] && postscript_blockzone != '' || $this->_tpl_vars['use_poostscript_override_file'] != ''): ?>
      <div id="postscript_wrapper" class="postscript_wrapper">
        <div id="postscript" class="postscript container">
          <?php if ($this->_tpl_vars['postscript_block_id'] == ''): ?>
            <?php $_from = $this->_tpl_vars['xoBlocks'][$this->_tpl_vars['postscript_blockzone']]; if (!is_array($_from) && !is_object($_from)) { settype($_from, 'array'); }$this->_foreach['postscriptblocks'] = array('total' => count($_from), 'iteration' => 0);
if ($this->_foreach['postscriptblocks']['total'] > 0):
    foreach ($_from as $this->_tpl_vars['block']):
        $this->_foreach['postscriptblocks']['iteration']++;
?>
              <div id="block_<?php echo $this->_tpl_vars['block']['id']; ?>
" class="block block_<?php echo $this->_tpl_vars['block']['id']; ?>
 postscript_block postscript_block_<?php echo $this->_foreach['postscriptblocks']['iteration']; ?>
 span<?php echo $this->_tpl_vars['postscript_grid']; ?>
 <?php echo $this->_tpl_vars['postscript_grid_extra_classes']; ?>
">
                <div class="block_inner">
                  <?php if ($this->_tpl_vars['show_postscript_block_titles'] && $this->_tpl_vars['block']['title'] != '' && ((is_array($_tmp=$this->_tpl_vars['block']['title'])) ? $this->_run_mod_handler('truncate', true, $_tmp, 1, "", true) : smarty_modifier_truncate($_tmp, 1, "", true)) != '_'): ?>
                    <h3 class="title"><span><?php echo $this->_tpl_vars['block']['title']; ?>
</span></h3 class="title">
                  <?php endif; ?>
                  <?php if ($this->_tpl_vars['block']['content']): ?>
                    <div class="postscript_content block_content">
                      <?php echo $this->_tpl_vars['block']['content']; ?>

                    </div>
                  <?php endif; ?>
                </div>
              </div>
            <?php endforeach; endif; unset($_from); ?>
          <?php else: ?>
            <div id="single_postscript_block" class="block single_postscript_block postscript_block span<?php echo $this->_tpl_vars['postscript_grid']; ?>
 <?php echo $this->_tpl_vars['postscript_grid_extra_classes']; ?>
">
              <div class="block_inner">
                <?php if ($this->_tpl_vars['show_postscript_block_titles'] && $this->_tpl_vars['xoBlocks'][$this->_tpl_vars['postscript_blockzone']][$this->_tpl_vars['postscript_block_id']]['title'] && ((is_array($_tmp=$this->_tpl_vars['xoBlocks'][$this->_tpl_vars['postscript_blockzone']][$this->_tpl_vars['postscript_block_id']]['title'])) ? $this->_run_mod_handler('truncate', true, $_tmp, 1, "", true) : smarty_modifier_truncate($_tmp, 1, "", true)) != '_'): ?>
                  <h3 class="title"><span><?php echo $this->_tpl_vars['xoBlocks'][$this->_tpl_vars['postscript_blockzone']][$this->_tpl_vars['postscript_block_id']]['title']; ?>
</span></h3 class="title">
                <?php endif; ?>
                <?php if ($this->_tpl_vars['xoBlocks'][$this->_tpl_vars['postscript_blockzone']][$this->_tpl_vars['postscript_block_id']]['content']): ?>
                  <div class="postscript_content block_content">
                    <?php echo $this->_tpl_vars['xoBlocks'][$this->_tpl_vars['postscript_blockzone']][$this->_tpl_vars['postscript_block_id']]['content']; ?>

                  </div>
                <?php endif; ?>
              </div>
            </div>
          <?php endif; ?>
        </div>
      </div>
    <?php endif; ?>
  </div>
</div>