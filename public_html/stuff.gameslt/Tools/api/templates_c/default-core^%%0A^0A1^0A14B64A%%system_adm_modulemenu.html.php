<?php /* Smarty version 2.6.26, created on 2014-03-10 00:22:25
         compiled from /home/mekdrop/webs/stuff.gameslt.mekdrop.name/public_html/Tools/api/modules/system/templates/admin/system_adm_modulemenu.html */ ?>
<style type='text/css'>

</style>

<div id="wrap">
<div id="buttontop">
<div style="width: 100%; padding: 0;" cellspacing="0">
	<div style="font-size: 10px; text-align: <?php echo @_GLOBAL_LEFT; ?>
; color: #2F5376; padding: 0 6px; line-height: 18px;float:<?php echo @_GLOBAL_LEFT; ?>
;">
	<?php $_from = $this->_tpl_vars['headermenu']; if (!is_array($_from) && !is_object($_from)) { settype($_from, 'array'); }if (count($_from)):
    foreach ($_from as $this->_tpl_vars['itemnum'] => $this->_tpl_vars['menuitem']):
?>
		<a class="nobutton" href="<?php echo $this->_tpl_vars['menuitem']['link']; ?>
"><?php echo $this->_tpl_vars['menuitem']['title']; ?>
</a>
		<?php if (( $this->_tpl_vars['itemnum'] + 1 ) <> $this->_tpl_vars['headermenucount']): ?>
		 |
		<?php endif; ?>
	<?php endforeach; endif; unset($_from); ?>
	</div>
	<div style="font-size: 10px; text-align: <?php echo @_GLOBAL_RIGHT; ?>
; color: #2F5376; padding: 0 6px; line-height: 18px;float:<?php echo @_GLOBAL_RIGHT; ?>
;">
		<?php echo $this->_tpl_vars['breadcrumb']; ?>

	</div>
</div>
</div>
<div id="buttonbar">
	<ul>
	<?php $_from = $this->_tpl_vars['adminmenu']; if (!is_array($_from) && !is_object($_from)) { settype($_from, 'array'); }if (count($_from)):
    foreach ($_from as $this->_tpl_vars['itemnum'] => $this->_tpl_vars['menuitem']):
?>
	<?php if ($this->_tpl_vars['itemnum'] == $this->_tpl_vars['current']): ?>
			<li id="current">
		<?php else: ?>
			<li>
		<?php endif; ?>
		<a href="../<?php echo $this->_tpl_vars['menuitem']['link']; ?>
"><span><?php echo $this->_tpl_vars['menuitem']['title']; ?>
</span></a>
		</li>
	<?php endforeach; endif; unset($_from); ?>
	</ul>
</div>
<?php if ($this->_tpl_vars['submenus']): ?>
	<div id="submenuswrap">
	<div id="submenus">
		<?php $_from = $this->_tpl_vars['submenus']; if (!is_array($_from) && !is_object($_from)) { settype($_from, 'array'); }if (count($_from)):
    foreach ($_from as $this->_tpl_vars['itemnum'] => $this->_tpl_vars['submenuitem']):
?>
			<?php if ($this->_tpl_vars['itemnum'] == $this->_tpl_vars['currentsub']): ?>
				<div id="currentsubitem"><?php echo $this->_tpl_vars['submenuitem']['title']; ?>

			<?php else: ?>
				<div class="subitem"><a href="<?php echo $this->_tpl_vars['submenuitem']['link']; ?>
"><?php echo $this->_tpl_vars['submenuitem']['title']; ?>
</a>
			<?php endif; ?>
			<?php if (( $this->_tpl_vars['itemnum'] + 1 ) <> $this->_tpl_vars['submenuscount']): ?>
			 |
			<?php endif; ?>
			</div>
		<?php endforeach; endif; unset($_from); ?>
	</div>
	</div>
<?php endif; ?>
</div> <!-- end wrap -->
<br style="clear: both;" />