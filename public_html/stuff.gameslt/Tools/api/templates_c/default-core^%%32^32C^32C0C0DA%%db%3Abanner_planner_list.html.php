<?php /* Smarty version 2.6.26, created on 2014-11-04 23:13:52
         compiled from db:banner_planner_list.html */ ?>
<?php if ($this->_tpl_vars['types']): ?>
    <h1>Pasirinkite banerių formatą sąrašo peržiūrai</h1>
    <ul>
    <?php $_from = $this->_tpl_vars['types']; if (!is_array($_from) && !is_object($_from)) { settype($_from, 'array'); }if (count($_from)):
    foreach ($_from as $this->_tpl_vars['key'] => $this->_tpl_vars['value']):
?>        
        <li>
            <a href="?op=list&type=<?php echo $this->_tpl_vars['key']; ?>
"><?php echo $this->_tpl_vars['value']; ?>
</a>
        </li>        
    <?php endforeach; endif; unset($_from); ?>
    </ul>
    <form action="index.php" method="post">
        <input type="hidden" name="op" value="add" />
        <button type="submit">Suplanuoti naują</button>
    </form>    
<?php else: ?>
    <h1>Baneriai</h1>
    <h3>Suplanuoti baneriai</h3>
    <?php $_from = $this->_tpl_vars['planned_banners']; if (!is_array($_from) && !is_object($_from)) { settype($_from, 'array'); }$this->_foreach['banners'] = array('total' => count($_from), 'iteration' => 0);
if ($this->_foreach['banners']['total'] > 0):
    foreach ($_from as $this->_tpl_vars['banner']):
        $this->_foreach['banners']['iteration']++;
?>
    <p>
        <a href="<?php echo $this->_tpl_vars['banner']['url']; ?>
" tager="gamelt"><img src="<?php echo $this->_tpl_vars['banner']['image']; ?>
" alt="<?php echo $this->_tpl_vars['banner']['game']; ?>
" title="<?php echo $this->_tpl_vars['banner']['name']; ?>
" style="max-width: 80%;" /></a>
        <?php if (! ($this->_foreach['banners']['iteration'] == $this->_foreach['banners']['total'])): ?>
            <br /><br />
        <?php endif; ?>
    </p>
    <?php endforeach; else: ?>
        <p>Šiuo metu tokių nėra</p>
    <?php endif; unset($_from); ?>
    <h3>Dabar rodomi baneriai</h3>
    <?php $_from = $this->_tpl_vars['current_banners']; if (!is_array($_from) && !is_object($_from)) { settype($_from, 'array'); }if (count($_from)):
    foreach ($_from as $this->_tpl_vars['banner']):
?>
    <p>
        <a href="<?php echo $this->_tpl_vars['banner']['url']; ?>
" tager="gamelt"><img src="<?php echo $this->_tpl_vars['banner']['src']; ?>
" alt="<?php echo $this->_tpl_vars['banner']['title']; ?>
" title="<?php echo $this->_tpl_vars['banner']['text']; ?>
" style="max-width: 80%;" /></a><br />
        <b>Liko laiko:</b> <?php if ($this->_tpl_vars['banner']['time_left_parts']['days'] > 0): ?>
            <?php echo $this->_tpl_vars['banner']['time_left_parts']['days']; ?>

            <?php if ($this->_tpl_vars['banner']['time_left_parts']['days'] % 10 == 1): ?>
                diena
            <?php else: ?>
                dienos
            <?php endif; ?>             
        <?php else: ?>
            Pasibaigęs laikas
        <?php endif; ?>
    </p>
    <?php endforeach; endif; unset($_from); ?>
<?php endif; ?>