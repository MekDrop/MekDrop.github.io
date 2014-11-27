<?php /* Smarty version 2.6.26, created on 2014-03-09 23:18:03
         compiled from db:system_userinfo.html */ ?>
<div id="userinfoWrapper">
  <h3><?php echo $this->_tpl_vars['lang_allaboutuser']; ?>
</h3>

  <div id="userinfoContent">
    <table class="table table-striped table-bordered" cellpadding="0" cellspacing="0">
      <tr>
        <td>
          <div class="avatar">
            <img clas="img-polaroid" src="<?php echo $this->_tpl_vars['user_avatarurl']; ?>
" alt="Avatar" />
            <div class="img-caption"><?php if ($this->_tpl_vars['user_rankimage']): ?><?php echo $this->_tpl_vars['user_rankimage']; ?>
<br /><?php endif; ?><?php echo $this->_tpl_vars['user_ranktitle']; ?>
</div>
          </div>          
        </td>
        <td>
          <div class="btn-group">
            <?php echo $this->_tpl_vars['user_pmlink']; ?>

          
            <?php if ($this->_tpl_vars['user_ownpage'] == true || $this->_tpl_vars['xoops_isadmin'] == true): ?>
              <?php if ($this->_tpl_vars['user_ownpage'] == true): ?>
                <button type="button" class="btn btn-mini" onclick="location='edituser.php'"><?php echo $this->_tpl_vars['lang_editprofile']; ?>
</button>
              <?php else: ?>
                <button type="button" class="btn btn-mini" onclick="location='<?php echo $this->_tpl_vars['icms_url']; ?>
/modules/system/admin.php?fct=users&amp;uid=<?php echo $this->_tpl_vars['user_uid']; ?>
&amp;op=modifyUser'"><?php echo $this->_tpl_vars['lang_editprofile']; ?>
</button>
              <?php endif; ?>

              <?php if ($this->_tpl_vars['user_ownpage'] == true): ?>
                <button type="button" class="btn btn-mini" onclick="location='edituser.php?op=avatarform'"><?php echo $this->_tpl_vars['lang_avatar']; ?>
</button>
                <button type="button" class="btn btn-mini" onclick="location='viewpmsg.php'"><?php echo $this->_tpl_vars['lang_inbox']; ?>
</button>

                <?php if ($this->_tpl_vars['user_candelete'] == true): ?>
                  <button type="button" class="btn btn-mini btn-danger" onclick="location='user.php?op=delete'"><?php echo $this->_tpl_vars['lang_deleteaccount']; ?>
</button>
                <?php endif; ?>
              <?php else: ?>
                <button type="button" class="btn btn-mini btn-danger" onclick="location='<?php echo $this->_tpl_vars['icms_url']; ?>
/modules/system/admin.php?fct=users&amp;op=delUser&amp;uid=<?php echo $this->_tpl_vars['user_uid']; ?>
'"><?php echo $this->_tpl_vars['lang_deleteaccount']; ?>
</button>
              <?php endif; ?>

              <?php if ($this->_tpl_vars['user_ownpage'] == true): ?>
                <button type="button" class="btn btn-mini btn-warning" onclick="location='user.php?op=logout'"><?php echo $this->_tpl_vars['lang_logout']; ?>
</button>
              <?php endif; ?>
            <?php endif; ?>
          </div>
        </td>
      </tr>
      <?php if ($this->_tpl_vars['user_realname']): ?>
        <tr>
          <td><?php echo $this->_tpl_vars['lang_realname']; ?>
</td>
          <td><?php echo $this->_tpl_vars['user_realname']; ?>
</td>
        </tr>
      <?php endif; ?>
      <?php if ($this->_tpl_vars['user_posts']): ?>
        <tr>
          <td><?php echo $this->_tpl_vars['lang_posts']; ?>
</td>
          <td><?php echo $this->_tpl_vars['user_posts']; ?>
</td>
        </tr>
      <?php endif; ?>      
      <?php if ($this->_tpl_vars['user_joindate']): ?>
        <tr>
          <td><?php echo $this->_tpl_vars['lang_membersince']; ?>
</td>
          <td><?php echo $this->_tpl_vars['user_joindate']; ?>
</td>
        </tr>
      <?php endif; ?>
      <?php if ($this->_tpl_vars['user_lastlogin']): ?>
        <tr>
          <td><?php echo $this->_tpl_vars['lang_lastlogin']; ?>
</td>
          <td><?php echo $this->_tpl_vars['user_lastlogin']; ?>
</td>
        </tr>
      <?php endif; ?>      
      <?php if ($this->_tpl_vars['user_websiteurl']): ?>
        <tr>
          <td><?php echo $this->_tpl_vars['lang_website']; ?>
</td>
          <td><?php echo $this->_tpl_vars['user_websiteurl']; ?>
</td>
        </tr>
      <?php endif; ?>
      <?php if ($this->_tpl_vars['user_email']): ?>
        <tr>
          <td><?php echo $this->_tpl_vars['lang_email']; ?>
</td>
          <td><?php echo $this->_tpl_vars['user_email']; ?>
</td>
        </tr>
      <?php endif; ?>
      <?php if ($this->_tpl_vars['user_openid']): ?>
        <tr>
          <td><?php echo $this->_tpl_vars['lang_openid']; ?>
</td>
          <td><?php echo $this->_tpl_vars['user_openid']; ?>
</td>
        </tr>      
      <?php endif; ?>
      <?php if ($this->_tpl_vars['user_icq']): ?>
        <tr>
          <td><?php echo $this->_tpl_vars['lang_icq']; ?>
</td>
          <td><?php echo $this->_tpl_vars['user_icq']; ?>
</td>
        </tr>
      <?php endif; ?>
      <?php if ($this->_tpl_vars['user_aim']): ?>
        <tr>
          <td><?php echo $this->_tpl_vars['lang_aim']; ?>
</td>
          <td><?php echo $this->_tpl_vars['user_aim']; ?>
</td>
        </tr>
      <?php endif; ?>
      <?php if ($this->_tpl_vars['user_yim']): ?>
        <tr>
          <td><?php echo $this->_tpl_vars['lang_yim']; ?>
</td>
          <td><?php echo $this->_tpl_vars['user_yim']; ?>
</td>
        </tr>
      <?php endif; ?>      
      <?php if ($this->_tpl_vars['user_msnm']): ?>
        <tr>
          <td><?php echo $this->_tpl_vars['lang_msnm']; ?>
</td>
          <td><?php echo $this->_tpl_vars['user_msnm']; ?>
</td>
        </tr>
      <?php endif; ?>
      <?php if ($this->_tpl_vars['user_location']): ?>
        <tr>
          <td><?php echo $this->_tpl_vars['lang_location']; ?>
</td>
          <td><?php echo $this->_tpl_vars['user_location']; ?>
</td>
        </tr>
      <?php endif; ?>
      <?php if ($this->_tpl_vars['user_occupation']): ?>
        <tr>
          <td><?php echo $this->_tpl_vars['lang_occupation']; ?>
</td>
          <td><?php echo $this->_tpl_vars['user_occupation']; ?>
</td>
        </tr>
      <?php endif; ?>
      <?php if ($this->_tpl_vars['user_interest']): ?>
        <tr>
          <td><?php echo $this->_tpl_vars['lang_interest']; ?>
</td>
          <td><?php echo $this->_tpl_vars['user_interest']; ?>
</td>
        </tr>
      <?php endif; ?>
      <?php if ($this->_tpl_vars['user_extrainfo']): ?>
        <tr>
          <td colspan="2">
            <h4><?php echo $this->_tpl_vars['lang_extrainfo']; ?>
</h4>
            <?php echo $this->_tpl_vars['user_extrainfo']; ?>

          </td>
        </tr>
      <?php endif; ?>      
      <?php if ($this->_tpl_vars['user_signature']): ?>
        <tr>
          <td colspan="2">
            <h4><?php echo $this->_tpl_vars['lang_signature']; ?>
</h4>            
            <?php echo $this->_tpl_vars['user_signature']; ?>

          </td>
        </tr>
      <?php endif; ?>        
    </table>    
  </div>
</div>

<div id="userContentsWrapper">
  <h3><?php echo $this->_tpl_vars['lang_activity']; ?>
</h3>
  <div id="userContentsAccordion" class="accordion">
    <!-- start module search results loop -->
    <?php $_from = $this->_tpl_vars['modules']; if (!is_array($_from) && !is_object($_from)) { settype($_from, 'array'); }$this->_foreach['modloop'] = array('total' => count($_from), 'iteration' => 0);
if ($this->_foreach['modloop']['total'] > 0):
    foreach ($_from as $this->_tpl_vars['module']):
        $this->_foreach['modloop']['iteration']++;
?>
      <div class="accordion-group">
        <div class="accordion-heading">
          <a class="accordion-toggle" data-toggle="collapse" data-parent="#userContentsAccordion" href="#collapse_<?php echo $this->_tpl_vars['module']['id']; ?>
">
            <?php echo $this->_tpl_vars['module']['name']; ?>

          </a>
        </div>
        <div id="collapse_<?php echo $this->_tpl_vars['module']['id']; ?>
" class="accordion-body collapse<?php if ($this->_foreach['modloop']['iteration'] == 1): ?> in<?php endif; ?>">
          <div class="accordion-inner">
            <?php $_from = $this->_tpl_vars['module']['results']; if (!is_array($_from) && !is_object($_from)) { settype($_from, 'array'); }if (count($_from)):
    foreach ($_from as $this->_tpl_vars['result']):
?>
              <div class="media">
                <a class="pull-left" href="<?php echo $this->_tpl_vars['result']['link']; ?>
" title="<?php echo $this->_tpl_vars['result']['title']; ?>
">
                  <img src="<?php echo $this->_tpl_vars['result']['image']; ?>
" alt="<?php echo $this->_tpl_vars['module']['name']; ?>
" />
                </a>
                <div class="media-body">
                  <h4 class="media-heading">
                    <a href="<?php echo $this->_tpl_vars['result']['link']; ?>
" title="<?php echo $this->_tpl_vars['result']['title']; ?>
"><?php echo $this->_tpl_vars['result']['title']; ?>
</a>
                  </h4>
                  <?php echo $this->_tpl_vars['result']['time']; ?>

                </div>
              </div>
            <?php endforeach; endif; unset($_from); ?>
            <?php echo $this->_tpl_vars['module']['showall_link']; ?>

          </div>
        </div>
      </div>
    <?php endforeach; endif; unset($_from); ?>
  </div>
</div>