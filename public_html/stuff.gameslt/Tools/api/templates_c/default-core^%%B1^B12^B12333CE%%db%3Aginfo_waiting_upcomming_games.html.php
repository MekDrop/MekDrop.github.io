<?php /* Smarty version 2.6.26, created on 2014-11-04 22:05:38
         compiled from db:ginfo_waiting_upcomming_games.html */ ?>
<?php require_once(SMARTY_CORE_DIR . 'core.load_plugins.php');
smarty_core_load_plugins(array('plugins' => array(array('modifier', 'strtoupper', 'db:ginfo_waiting_upcomming_games.html', 4, false),array('modifier', 'count', 'db:ginfo_waiting_upcomming_games.html', 4, false),array('modifier', 'date_format', 'db:ginfo_waiting_upcomming_games.html', 7, false),)), $this); ?>
<?php if (count ( $this->_tpl_vars['games'] ) > 0): ?>
    <ol>
    <?php $_from = $this->_tpl_vars['games']; if (!is_array($_from) && !is_object($_from)) { settype($_from, 'array'); }if (count($_from)):
    foreach ($_from as $this->_tpl_vars['game']):
?>    
        <li><a href="http://www.games.lt/g/game.apie/<?php echo $this->_tpl_vars['game']['id']; ?>
" target="gamelt"><?php echo $this->_tpl_vars['game']['title']; ?>
</a> (<?php echo strtoupper($this->_tpl_vars['game']['system']); ?>
; <?php echo count($this->_tpl_vars['game']['users']); ?>
)
            <dl>
                <dt>Išleidimo data</dt>
                 <dd><?php if (! $this->_tpl_vars['game']['date']): ?>Nežinoma<?php else: ?><?php echo ((is_array($_tmp=$this->_tpl_vars['game']['date'])) ? $this->_run_mod_handler('date_format', true, $_tmp) : smarty_modifier_date_format($_tmp)); ?>
<?php endif; ?></dd>
              <dt>Kas laukia?</dt>
               <dd>
                   <?php $_from = $this->_tpl_vars['game']['users']; if (!is_array($_from) && !is_object($_from)) { settype($_from, 'array'); }$this->_foreach['users'] = array('total' => count($_from), 'iteration' => 0);
if ($this->_foreach['users']['total'] > 0):
    foreach ($_from as $this->_tpl_vars['id'] => $this->_tpl_vars['nick']):
        $this->_foreach['users']['iteration']++;
?>
                        <?php if (! ($this->_foreach['users']['iteration'] <= 1)): ?>, <?php endif; ?>
                        <a href="http://www.games.lt/g/user.apie/<?php echo $this->_tpl_vars['id']; ?>
" target="gamelt"><?php echo $this->_tpl_vars['nick']; ?>
</a>
                   <?php endforeach; endif; unset($_from); ?>
               </dd>
               
            </dl>
            </li>
    <?php endforeach; endif; unset($_from); ?>
    </ol>
<?php else: ?>
    Šiuo metu sąrašas tusčias
<?php endif; ?>