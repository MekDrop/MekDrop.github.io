<?php /* Smarty version 2.6.26, created on 2014-11-04 22:06:02
         compiled from db:system_persistabletable_display.html */ ?>
<div id="<?php echo $this->_tpl_vars['icms_id']; ?>
" class="clearFix">
	<?php if ($this->_tpl_vars['icms_table_header']): ?>
		<?php echo $this->_tpl_vars['icms_table_header']; ?>

	<?php endif; ?>

	<?php if ($this->_tpl_vars['icms_introButtons'] || $this->_tpl_vars['icms_pagenav']): ?>
		<div class="buttonsPagerWrapper">
			<?php if ($this->_tpl_vars['icms_introButtons']): ?>
				<div class="introButtons">
					<?php $_from = $this->_tpl_vars['icms_introButtons']; if (!is_array($_from) && !is_object($_from)) { settype($_from, 'array'); }if (count($_from)):
    foreach ($_from as $this->_tpl_vars['introButton']):
?>
						<a href="<?php echo $this->_tpl_vars['introButton']['location']; ?>
" class="smallButton" title="<?php echo $this->_tpl_vars['introButton']['name']; ?>
">
							<span><?php echo $this->_tpl_vars['introButton']['value']; ?>
</span>
						</a>
					<?php endforeach; endif; unset($_from); ?>
				</div>
			<?php endif; ?>

			<?php if ($this->_tpl_vars['icms_pagenav']): ?>
				<div class="pageNavWrapper">
					<?php echo $this->_tpl_vars['icms_pagenav']; ?>

				</div>
			<?php endif; ?>	
		</div>
	<?php endif; ?>

	<?php if ($this->_tpl_vars['icms_showFilterAndLimit'] || $this->_tpl_vars['icms_quicksearch']): ?>
		<form class="quickSearchBoxFilterWrapper" action="<?php echo $this->_tpl_vars['icms_optionssel_action']; ?>
" method="post">
			<?php if ($this->_tpl_vars['icms_quicksearch']): ?>
				<div class="quickSearchBox">
					<label for="quicksearch_<?php echo $this->_tpl_vars['icms_id']; ?>
"><?php echo $this->_tpl_vars['icms_quicksearch']; ?>
</label>
					<input type="text" id="quicksearch_<?php echo $this->_tpl_vars['icms_id']; ?>
" name="quicksearch_<?php echo $this->_tpl_vars['icms_id']; ?>
" />
					<input type="submit" name="button_quicksearch_<?php echo $this->_tpl_vars['icms_id']; ?>
" value="<?php echo @_SEARCH; ?>
" />
				</div>
			<?php endif; ?>
			
			<?php if ($this->_tpl_vars['icms_showFilterAndLimit']): ?>
				<div class="filterAndLimit">
					<?php if ($this->_tpl_vars['icms_optionssel_filtersArray']): ?>
						<div class="singleObject">
							<label for="filtersel"><?php echo @_CO_ICMS_FILTER; ?>
</label>
							<select id="filtersel"name="filtersel" onchange="submit()">
								<?php $_from = $this->_tpl_vars['icms_optionssel_filtersArray']; if (!is_array($_from) && !is_object($_from)) { settype($_from, 'array'); }if (count($_from)):
    foreach ($_from as $this->_tpl_vars['key'] => $this->_tpl_vars['field']):
?>
									<option value="<?php echo $this->_tpl_vars['key']; ?>
" <?php echo $this->_tpl_vars['field']['selected']; ?>
><?php echo $this->_tpl_vars['field']['caption']; ?>
</option>
								<?php endforeach; endif; unset($_from); ?>
							</select>
						</div>
						<?php if ($this->_tpl_vars['icms_optionssel_filters2Array']): ?>
							<div class="singleObject">
								<select name="filtersel2" onchange="submit()">
									<?php $_from = $this->_tpl_vars['icms_optionssel_filters2Array']; if (!is_array($_from) && !is_object($_from)) { settype($_from, 'array'); }if (count($_from)):
    foreach ($_from as $this->_tpl_vars['key'] => $this->_tpl_vars['field']):
?>
										<option value="<?php echo $this->_tpl_vars['key']; ?>
" <?php echo $this->_tpl_vars['field']['selected']; ?>
><?php echo $this->_tpl_vars['field']['caption']; ?>
</option>
									<?php endforeach; endif; unset($_from); ?>
								</select>
							</div>
						<?php endif; ?>
					<?php endif; ?>
					<?php if (! $this->_tpl_vars['icms_isTree']): ?>
						<div class="singleObject">
							<label for="limitsel"><?php echo @_CO_ICMS_SHOW_ONLY; ?>
</label>
							<select id="limitsel" name="limitsel" onchange="submit()">
								<?php $_from = $this->_tpl_vars['icms_optionssel_limitsArray']; if (!is_array($_from) && !is_object($_from)) { settype($_from, 'array'); }if (count($_from)):
    foreach ($_from as $this->_tpl_vars['key'] => $this->_tpl_vars['field']):
?>
									<option value="<?php echo $this->_tpl_vars['key']; ?>
" <?php echo $this->_tpl_vars['field']['selected']; ?>
><?php echo $this->_tpl_vars['field']['caption']; ?>
</option>
								<?php endforeach; endif; unset($_from); ?>
							</select>
						</div>
					<?php endif; ?>
				</div>
			<?php endif; ?>
		</form>
	<?php endif; ?>

	<?php if ($this->_tpl_vars['icms_actionButtons'] || $this->_tpl_vars['icms_withSelectedActions']): ?>
		<form id="form_<?php echo $this->_tpl_vars['icms_id']; ?>
" method="post">
	<?php endif; ?>
		<table width='100%' cellspacing='1' cellpadding='3' border='0' class='outer'>
			<tr>
			 <?php $_from = $this->_tpl_vars['icms_columns']; if (!is_array($_from) && !is_object($_from)) { settype($_from, 'array'); }if (count($_from)):
    foreach ($_from as $this->_tpl_vars['column']):
?>
			 	<th width="<?php echo $this->_tpl_vars['column']['width']; ?>
" align='<?php echo $this->_tpl_vars['column']['align']; ?>
'><strong><?php echo $this->_tpl_vars['column']['caption']; ?>
</strong></th>
			 <?php endforeach; endif; unset($_from); ?>
			 <?php if ($this->_tpl_vars['icms_has_actions']): ?>
			 	<th width='<?php echo $this->_tpl_vars['icms_actions_column_width']; ?>
' align='center'>
			 		<?php if ($this->_tpl_vars['icms_show_action_column_title']): ?>
			 			<strong><?php echo @_CO_ICMS_ACTIONS; ?>
</strong>
			 		<?php endif; ?>
			 	</th>
			 <?php endif; ?>
			</tr>

			<?php if ($this->_tpl_vars['icms_persistable_objects']): ?>
				<?php $_from = $this->_tpl_vars['icms_persistable_objects']; if (!is_array($_from) && !is_object($_from)) { settype($_from, 'array'); }if (count($_from)):
    foreach ($_from as $this->_tpl_vars['icms_object']):
?>
					<?php if ($this->_tpl_vars['icms_actionButtons']): ?>
						<input type='hidden' name='<?php echo $this->_tpl_vars['icms_id']; ?>
_objects[]' id='listed_objects' value='<?php echo $this->_tpl_vars['icms_object']['id']; ?>
' />
					<?php endif; ?>
					<tr>
						<?php $_from = $this->_tpl_vars['icms_object']['columns']; if (!is_array($_from) && !is_object($_from)) { settype($_from, 'array'); }if (count($_from)):
    foreach ($_from as $this->_tpl_vars['column']):
?>
							<td class="<?php echo $this->_tpl_vars['column']['keyname']; ?>
 <?php echo $this->_tpl_vars['icms_object']['class']; ?>
" width="<?php echo $this->_tpl_vars['column']['width']; ?>
" align="<?php echo $this->_tpl_vars['column']['align']; ?>
"><?php echo $this->_tpl_vars['column']['value']; ?>
</td>
						<?php endforeach; endif; unset($_from); ?>
						<?php if ($this->_tpl_vars['icms_object']['actions']): ?>
							<td class="<?php echo $this->_tpl_vars['icms_object']['class']; ?>
" align='center'>
								<?php $_from = $this->_tpl_vars['icms_object']['actions']; if (!is_array($_from) && !is_object($_from)) { settype($_from, 'array'); }if (count($_from)):
    foreach ($_from as $this->_tpl_vars['action']):
?>
									<?php echo $this->_tpl_vars['action']; ?>

								<?php endforeach; endif; unset($_from); ?>
							</td>
						<?php endif; ?>
					</tr>
				<?php endforeach; endif; unset($_from); ?>
			<?php else: ?>
				<tr>
					<td class='head' style='text-align: center; font-weight: bold;' colspan="<?php echo $this->_tpl_vars['icms_colspan']; ?>
"><?php echo @_CO_ICMS_NO_OBJECT; ?>
</td>
				</tr>
			<?php endif; ?>
		</table>
		<?php if ($this->_tpl_vars['icms_actionButtons'] || $this->_tpl_vars['icms_withSelectedActions']): ?>
			<input type='hidden' name='op' id='op' value='' />
			<?php if ($this->_tpl_vars['icms_withSelectedActions']): ?>
				<div style="padding: 5px;text-align: <?php echo @_GLOBAL_LEFT; ?>
; border-left: 1px solid silver; border-bottom: 1px solid silver; border-right: 1px solid silver;">
				<?php echo @_CO_ICMS_WITH_SELECTED; ?>

				<select name='selected_action'>
					<option value = ''>---</option>
					<?php $_from = $this->_tpl_vars['icms_withSelectedActions']; if (!is_array($_from) && !is_object($_from)) { settype($_from, 'array'); }if (count($_from)):
    foreach ($_from as $this->_tpl_vars['key'] => $this->_tpl_vars['action']):
?>
						<option value = '<?php echo $this->_tpl_vars['key']; ?>
'><?php echo $this->_tpl_vars['action']; ?>
</option>
					<?php endforeach; endif; unset($_from); ?>
				</select>
				<input type="submit" name="<?php echo $this->_tpl_vars['actionButton']['op']; ?>
" onclick="this.form.elements.op.value='with_selected_actions'" value="<?php echo @_CO_ICMS_SUBMIT; ?>
" />
				</div>
			<?php endif; ?>
			<?php if ($this->_tpl_vars['icms_actionButtons']): ?>
				<div class="actionButtonTray">
					<?php $_from = $this->_tpl_vars['icms_actionButtons']; if (!is_array($_from) && !is_object($_from)) { settype($_from, 'array'); }if (count($_from)):
    foreach ($_from as $this->_tpl_vars['actionButton']):
?>
						<input type="submit" name="<?php echo $this->_tpl_vars['actionButton']['op']; ?>
" onclick="this.form.elements.op.value='<?php echo $this->_tpl_vars['actionButton']['op']; ?>
'" value="<?php echo $this->_tpl_vars['actionButton']['text']; ?>
" />
					<?php endforeach; endif; unset($_from); ?>
				</div>
			<?php endif; ?>

			<?php if ($this->_tpl_vars['icms_introButtons'] || $this->_tpl_vars['icms_pagenav']): ?>
				<div class="buttonsPagerWrapper">
					<?php if ($this->_tpl_vars['icms_introButtons']): ?>
						<div class="introButtons">
							<?php $_from = $this->_tpl_vars['icms_introButtons']; if (!is_array($_from) && !is_object($_from)) { settype($_from, 'array'); }if (count($_from)):
    foreach ($_from as $this->_tpl_vars['introButton']):
?>
								<a href="<?php echo $this->_tpl_vars['introButton']['location']; ?>
" class="smallButton" title="<?php echo $this->_tpl_vars['introButton']['name']; ?>
">
									<span><?php echo $this->_tpl_vars['introButton']['value']; ?>
</span>
								</a>
							<?php endforeach; endif; unset($_from); ?>
						</div>
					<?php endif; ?>

					<?php if ($this->_tpl_vars['icms_pagenav']): ?>
						<div class="pageNavWrapper">
							<?php echo $this->_tpl_vars['icms_pagenav']; ?>

						</div>
					<?php endif; ?>
				</div>
			<?php endif; ?>
		</form>
		<?php endif; ?>

		<?php if ($this->_tpl_vars['icms_table_footer']): ?>
			<?php echo $this->_tpl_vars['icms_table_footer']; ?>

		<?php endif; ?>
	</div>

	<?php if ($this->_tpl_vars['icms_printer_friendly_page']): ?>
		<a href="javascript:openWithSelfMain('<?php echo $this->_tpl_vars['icms_printer_friendly_page']; ?>
', 'smartpopup', 700, 519);"><img  src="<?php echo $this->_tpl_vars['xoops_url']; ?>
/modules/icms/images/actions/fileprint.png" alt="" /></a>
	<?php endif; ?>
</div>