<?php /* Smarty version 2.6.26, created on 2014-03-13 22:44:52
         compiled from db:admin/modules/system_adm_modules.html */ ?>
<div class="CPbigTitle" style="background-image: url(<?php echo $this->_tpl_vars['icms_url']; ?>
/modules/system/admin/modules/images/modules_big.png)"><?php echo $this->_tpl_vars['lang_madmin']; ?>
</div>

<div class="cpDashPanel Panel">
  <div class="tabbable tabs-left">
    <ul class="nav nav-tabs">
      <li class="active">
        <a href="#installedPanel"><?php echo $this->_tpl_vars['lang_installed']; ?>
</a>
      </li>
      <li>
        <a href="#uninstalledPanel"><?php echo $this->_tpl_vars['lang_noninstall']; ?>
</a>
      </li>      
    </ul>

    <div class="tab-content">

      <div id="installedPanel" class="tab-pane active">
        <form action="admin.php" method="post" name="moduleadmin" id="moduleadmin">
          <div class="inner modulesAdminPanel">
            <?php $_from = $this->_tpl_vars['modules']; if (!is_array($_from) && !is_object($_from)) { settype($_from, 'array'); }if (count($_from)):
    foreach ($_from as $this->_tpl_vars['module']):
?>
              <div class="cpPanelItem">
                <div class="inner">
                  <div class="clearfix moduleIcon">
                    <?php if ($this->_tpl_vars['module']['hasadmin'] == 1 && $this->_tpl_vars['module']['isactive'] == '1'): ?>
                    <a href="<?php echo $this->_tpl_vars['icms_url']; ?>
/modules/<?php echo $this->_tpl_vars['module']['dirname']; ?>
/<?php echo $this->_tpl_vars['module']['adminindex']; ?>
">
                    <?php else: ?>
                    <a href="javascript: void(0);">
                    <?php endif; ?>
                      <h4 class="originalModuleName"><?php echo $this->_tpl_vars['module']['name']; ?>
 - <?php echo $this->_tpl_vars['module']['version']; ?>
 <?php echo $this->_tpl_vars['module']['status']; ?>
</h4>
                      <img src="<?php echo $this->_tpl_vars['icms_url']; ?>
/modules/<?php echo $this->_tpl_vars['module']['dirname']; ?>
/<?php echo $this->_tpl_vars['module']['image']; ?>
" alt="<?php echo $this->_tpl_vars['module']['name']; ?>
" title="<?php echo $this->_tpl_vars['module']['name']; ?>
" />
                    </a><br />
                    <small><strong><?php echo $this->_tpl_vars['lang_lastup']; ?>
:</strong> <span><?php echo $this->_tpl_vars['module']['last_update']; ?>
</span></small>
                  </div>

                  <div class="clearfix moduleInfo">
                    <div class="clearfix moduleActive">
                      <span class="moduleActiveTitle"><?php echo $this->_tpl_vars['lang_active']; ?>
: </span>
                      <?php if ($this->_tpl_vars['module']['dirname'] == 'system'): ?>
                        <input type="checkbox" id="newstatus_system_placeholder" name="newstatus_system_placeholder" value="1" checked="checked" disabled />
                        <input type="hidden" name="newstatus[<?php echo $this->_tpl_vars['module']['mid']; ?>
]" value="<?php if ($this->_tpl_vars['module']['status'] == 1): ?>0<?php else: ?>1<?php endif; ?>" />
                        <input type="hidden" name="oldstatus[<?php echo $this->_tpl_vars['module']['mid']; ?>
]" value="<?php echo $this->_tpl_vars['module']['status']; ?>
" />
                      <?php else: ?>
                        <input type="checkbox" id="newstatus_<?php echo $this->_tpl_vars['module']['mid']; ?>
" name="newstatus[<?php echo $this->_tpl_vars['module']['mid']; ?>
]" value="<?php if ($this->_tpl_vars['module']['isactive'] == '1'): ?>0<?php else: ?>1<?php endif; ?>"<?php if ($this->_tpl_vars['module']['isactive'] == '1'): ?> checked<?php endif; ?> />
                        <input type="hidden" name="oldstatus[<?php echo $this->_tpl_vars['module']['mid']; ?>
]" value="<?php echo $this->_tpl_vars['module']['isactive']; ?>
" />
                      <?php endif; ?>
                    </div>

                    <div class="clearfix newModuleName">
                      <label for="newname_<?php echo $this->_tpl_vars['module']['mid']; ?>
"><?php echo $this->_tpl_vars['lang_moduletitle']; ?>
</label>
                      <input type="text" id="newname_<?php echo $this->_tpl_vars['module']['mid']; ?>
" name="newname[<?php echo $this->_tpl_vars['module']['mid']; ?>
]" placeholder="<?php echo $this->_tpl_vars['module']['title']; ?>
" value="<?php echo $this->_tpl_vars['module']['title']; ?>
" maxlength="150" size="30" />
                      <input type="hidden" name="oldname[<?php echo $this->_tpl_vars['module']['mid']; ?>
]" value="<?php echo $this->_tpl_vars['module']['title']; ?>
" />
                    </div>

                    <div class="clearfix moduleOrder">
                      <span class="moduleOrderTitle"><?php echo $this->_tpl_vars['lang_order']; ?>
: </span>
                      <?php if ($this->_tpl_vars['module']['hasmain'] == '1'): ?>
                        <input type="hidden" name="oldweight[<?php echo $this->_tpl_vars['module']['mid']; ?>
]" value="<?php echo $this->_tpl_vars['module']['weight']; ?>
" />
                        <input type="text" id="weight_<?php echo $this->_tpl_vars['module']['mid']; ?>
" name="weight[<?php echo $this->_tpl_vars['module']['mid']; ?>
]" size="3" maxlength="5" placeholder="<?php echo $this->_tpl_vars['module']['weight']; ?>
" value="<?php echo $this->_tpl_vars['module']['weight']; ?>
" />
                      <?php else: ?>
                        <input type="hidden" name="oldweight[<?php echo $this->_tpl_vars['module']['mid']; ?>
]" value="0" />
                        <input type="text" id="weight_<?php echo $this->_tpl_vars['module']['mid']; ?>
" name="weight[<?php echo $this->_tpl_vars['module']['mid']; ?>
]" size="3" maxlength="5" placeholder="0" value="0" disabled />
                      <?php endif; ?>
                      <span class="moduleOrderInfo"><small><?php echo $this->_tpl_vars['lang_order0']; ?>
</small></span>
                    </div>

                    <div class="clearfix moduleActions">
                      <?php if ($this->_tpl_vars['module']['isactive'] == '1'): ?>
                        <a class="smallButton" title="<?php echo $this->_tpl_vars['lang_update']; ?>
" href="<?php echo $this->_tpl_vars['icms_url']; ?>
/modules/system/admin.php?fct=modules&amp;op=update&amp;module=<?php echo $this->_tpl_vars['module']['dirname']; ?>
">
                          <img src="<?php echo $this->_tpl_vars['icms_url']; ?>
/images/kfaenza/actions/reload.png" alt="<?php echo $this->_tpl_vars['lang_update']; ?>
"/>
                          <?php echo $this->_tpl_vars['lang_update']; ?>

                        </a>
                      <?php endif; ?>

                      <?php if ($this->_tpl_vars['module']['isactive'] != '1'): ?>
                        <a class="smallButton" title="<?php echo $this->_tpl_vars['lang_unistall']; ?>
" href="<?php echo $this->_tpl_vars['icms_url']; ?>
/modules/system/admin.php?fct=modules&amp;op=uninstall&amp;module=<?php echo $this->_tpl_vars['module']['dirname']; ?>
">
                          <img src="<?php echo $this->_tpl_vars['icms_url']; ?>
/images/kfaenza/actions/button_cancel.png" alt="<?php echo $this->_tpl_vars['lang_unistall']; ?>
" />
                          <?php echo $this->_tpl_vars['lang_unistall']; ?>

                        </a>
                      <?php endif; ?>  
                      <a class="smallButton modalButton" title="<?php echo $this->_tpl_vars['lang_info']; ?>
" data-scrolling="yes" data-width="900" data-height="580" href="<?php echo $this->_tpl_vars['icms_url']; ?>
/modules/system/admin.php?fct=version&amp;mid=<?php echo $this->_tpl_vars['module']['mid']; ?>
">
                        <img src="<?php echo $this->_tpl_vars['icms_url']; ?>
/images/kfaenza/actions/help.png" alt="<?php echo $this->_tpl_vars['lang_info']; ?>
" />
                        <?php echo $this->_tpl_vars['lang_info']; ?>

                      </a>
                      <?php if ($this->_tpl_vars['module']['support_site_url'] != '' && $this->_tpl_vars['module']['isactive'] == '1'): ?>
                        <a class="smallButton" title="<?php echo $this->_tpl_vars['lang_support']; ?>
" href="<?php echo $this->_tpl_vars['module']['support_site_url']; ?>
" rel="external">
                          <img src="<?php echo $this->_tpl_vars['icms_url']; ?>
/images/kfaenza/actions/gohome.png" alt="<?php echo $this->_tpl_vars['lang_support']; ?>
"/>
                          <?php echo $this->_tpl_vars['lang_support']; ?>

                        </a>
                      <?php endif; ?>
                      <input type="hidden" name="module[]" value="<?php echo $this->_tpl_vars['module']['mid']; ?>
" />                      
                    </div>

                  </div>
                </div>
              </div>
            <?php endforeach; endif; unset($_from); ?>

            <div class="clearfix controlButtons">
              <input type="hidden" name="fct" value="modules" />
              <input type="hidden" name="op" value="confirm" />
              <input class="btn btn-primary" type="submit" name="submit" value="<?php echo $this->_tpl_vars['lang_submit']; ?>
" />
            </div>
          </div>
        </form>
      </div>

      <div id="uninstalledPanel" class="tab-pane">
        <div class="inner modulesAdminPanel">
          <?php if ($this->_tpl_vars['avmodules']): ?>
            <?php $_from = $this->_tpl_vars['avmodules']; if (!is_array($_from) && !is_object($_from)) { settype($_from, 'array'); }$this->_foreach['dashloop'] = array('total' => count($_from), 'iteration' => 0);
if ($this->_foreach['dashloop']['total'] > 0):
    foreach ($_from as $this->_tpl_vars['module']):
        $this->_foreach['dashloop']['iteration']++;
?>
              <div class="cpPanelItem">
                <div class="inner">
                  <div class="clearfix moduleIcon">
                    <a href="javascript: void(0);">
                      <h4 class="originalModuleName"><?php echo $this->_tpl_vars['module']['name']; ?>
 - <?php echo $this->_tpl_vars['module']['version']; ?>
 <?php echo $this->_tpl_vars['module']['status']; ?>
</h4>
                    </a>
                    <img src="<?php echo $this->_tpl_vars['icms_url']; ?>
/modules/<?php echo $this->_tpl_vars['module']['dirname']; ?>
/<?php echo $this->_tpl_vars['module']['image']; ?>
" alt="<?php echo $this->_tpl_vars['module']['name']; ?>
" title="<?php echo $this->_tpl_vars['module']['name']; ?>
" /><br />
                  </div>      
                  
                  <div class="clearfix moduleInfo">
                    <div class="clearfix moduleActions">
                      <a class="smallButton" title="<?php echo $this->_tpl_vars['lang_install']; ?>
" href="<?php echo $this->_tpl_vars['icms_url']; ?>
/modules/system/admin.php?fct=modules&amp;op=install&amp;module=<?php echo $this->_tpl_vars['module']['dirname']; ?>
">
                        <img src="<?php echo $this->_tpl_vars['icms_url']; ?>
/images/kfaenza/actions/compfile.png" alt="<?php echo $this->_tpl_vars['lang_install']; ?>
" />
                        <?php echo $this->_tpl_vars['lang_install']; ?>

                      </a>
                      <a class="smallButton modalButton" title="<?php echo $this->_tpl_vars['lang_info']; ?>
" href="<?php echo $this->_tpl_vars['icms_url']; ?>
/modules/system/admin.php?fct=version&amp;mid=<?php echo $this->_tpl_vars['module']['dirname']; ?>
">
                        <img src="<?php echo $this->_tpl_vars['icms_url']; ?>
/images/kfaenza/actions/help.png" alt="<?php echo $this->_tpl_vars['lang_info']; ?>
" />
                        <?php echo $this->_tpl_vars['lang_info']; ?>

                      </a>
                    </div>
                  </div>
                </div>
              </div>
            <?php endforeach; endif; unset($_from); ?>
          <?php else: ?>
            <h3>No Modules available for Installation</h3>
            <a class="smallButton modalButton" title="ImpressCMS Addons" data-scrolling="yes" data-width="1000" data-height="780" rel="external" href="http://addons.impresscms.org">Need a module?</a>
          <?php endif; ?>
        </div>
      </div>

    </div>
  </div>
</div>