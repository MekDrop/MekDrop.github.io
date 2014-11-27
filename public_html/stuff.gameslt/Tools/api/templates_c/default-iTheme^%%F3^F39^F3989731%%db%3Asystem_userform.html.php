<?php /* Smarty version 2.6.26, created on 2014-11-04 22:05:33
         compiled from db:system_userform.html */ ?>
<?php if ($this->_tpl_vars['lang_reset'] !== 1): ?>
	<div class="tabbable tabs-left">
	  <ul class="nav nav-tabs">
	    <li class="active">
	      <a href="#login_form"><?php echo @_MB_SYSTEM_OPENID_NORMAL_LOGIN; ?>
</a>
	    </li>
    	<?php if ($this->_tpl_vars['auth_openid']): ?>
		    <li>
		      <a href="#openid-form"><?php echo @_MB_SYSTEM_OPENID_LOGIN; ?>
</a>
		    </li>
		  <?php endif; ?>
	    <li>
	    	<a href="#lostpass-form"><?php echo $this->_tpl_vars['lang_lostpassword']; ?>
</a>
	    </li>
	  </ul>

	  <div class="tab-content">

	    <div id="login_form" class="tab-pane active">
	      <form class="form-horizontal" action="<?php echo $this->_tpl_vars['icms_url']; ?>
/user.php" method="post">
					<div class="control-group">
	        	<label class="control-label" for="userLoginName"><?php echo $this->_tpl_vars['lang_username']; ?>
</label>
	        	<div class="controls">
	          	<input type="text" id="userLoginName" class="uname" name="uname" value="<?php echo $this->_tpl_vars['usercookie']; ?>
" />
	        	</div>
	        </div>

	        <div class="control-group">
	        	<label class="control-label" for="userLoginPass"><?php echo $this->_tpl_vars['lang_password']; ?>
</label>
	        	<div class="controls">
	          	<input type="password" id="userLoginPass" name="pass" />
	          </div>
	        </div>

					<?php if ($this->_tpl_vars['rememberme']): ?>
		      	<div class="control-group">
		      		<label for="rememberme">
		      			<input type="checkbox" name="rememberme" id="rememberme" value="On" />
		      			<?php echo $this->_tpl_vars['lang_rememberme']; ?>

		      		</label>
		      	</div>
          <?php endif; ?>
	        
	        <div class="control-group">
	        	<input type="hidden" name="icms_redirect" value="<?php echo $this->_tpl_vars['redirect_page']; ?>
" />
	          <input type="hidden" name="op" value="login" />
	          <input class="btn btn-primary" type="submit" value="<?php echo $this->_tpl_vars['lang_login']; ?>
" />
	          <?php echo $this->_tpl_vars['sslloginlink']; ?>

	        </div>
	      </form>
	    </div>

			<?php if ($this->_tpl_vars['auth_openid']): ?>  
		    <div id="openid-form" class="tab-pane">
		      <form class="form-inline" method="get" action="<?php echo $this->_tpl_vars['icms_url']; ?>
/try_auth.php">
		        <div>
		          <?php echo @_MB_SYSTEM_OPENID_URL; ?>

		          <input type="hidden" name="action" value="verify" />
		          <input type="text" class="openid_url" name="openid_identifier" size="12" value="" />
		          <input class="btn btn-primary" type="submit" value="<?php echo $this->_tpl_vars['lang_login']; ?>
" />          
		        </div>
		      </form>
		    </div>
		  <?php endif; ?>

		  <div id="lostpass-form" class="tab-pane">
		  	<p><?php echo $this->_tpl_vars['lang_noproblem']; ?>
</p>
				<form class="form-inline" action="<?php echo $this->_tpl_vars['icms_url']; ?>
/lostpass.php" method="post">
					<div>
						<input type="text" name="email" size="26" maxlength="60" placeholder="<?php echo $this->_tpl_vars['lang_youremail']; ?>
" />
						<input type="hidden" name="op" value="mailpasswd" />
						<input type="hidden" name="t" value="<?php echo $this->_tpl_vars['mailpasswd_token']; ?>
" />
			     	<input class="btn btn-primary" type="submit" value="<?php echo $this->_tpl_vars['lang_sendpassword']; ?>
" />
			     </div>
				</form>		  	
		  </div>

	  </div>
	</div>
	
	<?php if ($this->_tpl_vars['allow_registration']): ?>
		<div id="allowRegistration" class="allowRegistration">
			<?php echo $this->_tpl_vars['lang_notregister']; ?>

		</div>
	<?php endif; ?>
<?php else: ?>
	<div id="passwordResetWrapper" class="passwordResetWrapper">
		<h2><?php echo @_US_RESETPASSTITLE; ?>
</h2>
		<p><?php echo @_US_RESETPASSINFO; ?>
</p>

		<form action="<?php echo $this->_tpl_vars['icms_url']; ?>
/resetpass.php" method="post">
			<div>
				<input type="text" name="email" size="26" maxlength="100" placeholder="<?php echo $this->_tpl_vars['lang_youremail']; ?>
" class="wide" /><br />
				<input type="username" name="username" size="26" maxlength="60" value="<?php echo $this->_tpl_vars['lang_uname']; ?>
" placeholder="<?php echo $this->_tpl_vars['lang_username']; ?>
" class="wide" /><br />
				<input type="password" name="c_password" size="26" maxlength="255" placeholder="<?php echo $this->_tpl_vars['lang_currentpass']; ?>
" class="wide" /><br />
				<input type="password" name="password" size="26" maxlength="255" placeholder="<?php echo $this->_tpl_vars['lang_newpass']; ?>
" class="wide" /><br />
				<input type="password" name="password2" size="26" maxlength="255" placeholder="<?php echo $this->_tpl_vars['lang_newpass2']; ?>
" class="wide" /><br />
				<input type="hidden" name="op" value="resetpass" />
				<input type="hidden" name="t" value="<?php echo $this->_tpl_vars['resetpassword_token']; ?>
" />
	     	<input type="submit" value="<?php echo @_US_RESETPASSWORD; ?>
" />
	    </div>
		</form>
	</div>
<?php endif; ?>