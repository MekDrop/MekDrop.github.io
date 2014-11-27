<?php /* Smarty version 2.6.26, created on 2014-09-02 21:21:46
         compiled from db:banner_planner_add.html */ ?>
<?php require_once(SMARTY_CORE_DIR . 'core.load_plugins.php');
smarty_core_load_plugins(array('plugins' => array(array('modifier', 'intval', 'db:banner_planner_add.html', 22, false),)), $this); ?>
<script type="text/javascript" src="<?php echo @ICMS_MODULES_URL; ?>
/bannersplanner/js/load-jquery-ui-styles.js"></script>
<link rel='stylesheet' type='text/css' href='http://ajax.googleapis.com/ajax/libs/jqueryui/1.10.3/themes/ui-darkness/jquery-ui.css'>
<script src="http://ajax.googleapis.com/ajax/libs/jqueryui/1.10.3/jquery-ui.min.js"></script>
<script type="text/javascript" src="<?php echo @ICMS_MODULES_URL; ?>
/bannersplanner/js/jquery.mousewheel.min.js" defer="defer"></script>
<script type="text/javascript" src="<?php echo @ICMS_MODULES_URL; ?>
/bannersplanner/js/unserialize.js" defer="defer"></script>
<script type="text/javascript" src="<?php echo @ICMS_MODULES_URL; ?>
/bannersplanner/js/big-image-editor.js" defer="defer"></script>
<script type="text/javascript" src="<?php echo @ICMS_MODULES_URL; ?>
/bannersplanner/js/small-image-editor.js" defer="defer"></script>
<script type="text/javascript" src="<?php echo @ICMS_MODULES_URL; ?>
/bannersplanner/js/add-gui.js"></script>
<h1>Banerio pridėjimas į eilę</h1>
<form method="post" action="" class="add">
    <input type="hidden" name="op" value="add" />
    <input type="hidden" name="op_from_form" value="1" />
    <input type="hidden" name="banner_id" value="<?php echo $this->_tpl_vars['banner_id']; ?>
" />
    <table border="0" class="outer" cellspacing="1" style="font-size: 8.15999991874pt;">
        <tr id="row-type">
            <td>
                Tipas *
            </td>
            <td>
                <select name="type" required="required">
                    <?php $_from = $this->_tpl_vars['types']; if (!is_array($_from) && !is_object($_from)) { settype($_from, 'array'); }if (count($_from)):
    foreach ($_from as $this->_tpl_vars['key'] => $this->_tpl_vars['value']):
?>
                        <option data-showgameselector="<?php echo intval($this->_tpl_vars['value']['showgameselector']); ?>
" data-size-d="<?php echo intval($this->_tpl_vars['value']['sizes']['d']); ?>
" data-size-m="<?php echo intval($this->_tpl_vars['value']['sizes']['m']); ?>
" data-firstgame="<?php echo intval($this->_tpl_vars['value']['firstgame']); ?>
" value="<?php echo $this->_tpl_vars['key']; ?>
" <?php if ($this->_tpl_vars['type'] == $this->_tpl_vars['key']): ?>selected="selected"<?php endif; ?>><?php echo $this->_tpl_vars['value']['name']; ?>
</option>
                    <?php endforeach; endif; unset($_from); ?>
                </select>
            </td>
        </tr>        
        <tr id="row-platform">
            <td>
                Platforma *
            </td>
            <td>
                <select name="platform">
                    <?php $_from = $this->_tpl_vars['platforms']; if (!is_array($_from) && !is_object($_from)) { settype($_from, 'array'); }if (count($_from)):
    foreach ($_from as $this->_tpl_vars['value']):
?>
                        <option value="<?php echo $this->_tpl_vars['value']; ?>
" <?php if ($this->_tpl_vars['platform'] == $this->_tpl_vars['value']): ?>selected="selected"<?php endif; ?>><?php echo $this->_tpl_vars['value']; ?>
</option>
                    <?php endforeach; endif; unset($_from); ?>
                </select>
            </td>
        </tr>
        <tr id="row-game">
            <td>
                Žaidimas *
            </td>
            <td>
                <input type="text" name="game" value="<?php echo $this->_tpl_vars['game']; ?>
" />
                <input type="hidden" name="game_id" value="<?php echo $this->_tpl_vars['game_id']; ?>
" />
            </td>
        </tr>
        <tr id="row-url">
            <td>
                Nuoroda *
            </td>
            <td>
                <input type="url" name="url" value="<?php echo $this->_tpl_vars['url']; ?>
" required="required" /> <br />
                <input type="text" name="name" value="<?php echo $this->_tpl_vars['name']; ?>
" required="required" readonly="readonly" style="background-color: transparent;" /> 
            </td>
        </tr>        
        <tr id="row-size">
            <td>
                Dydis *
            </td>
            <td>
                <input type="radio" name="size" value="1" id="size-small"<?php if ($this->_tpl_vars['size'] == 1): ?> checked="checked"<?php endif; ?> required="required" />
                <label for="size-small">Mažas (verta aplankyti)</label>
                <input type="radio" name="size" value="2" id="size-large"<?php if ($this->_tpl_vars['size'] == 2): ?> checked="checked"<?php endif; ?> required="required" />
                <label for="size-large">Didelis</label>
            </td>
        </tr>
        <tr id="row-image">
            <td>
                Paveikslėlis
            </td>
            <td>
                <div id="small_image_editor">
                        <fieldset>
                            <legend>Duomenys</legend>
                            <table border="0" class="outer" cellspacing="1" style="font-size: 8.15999991874pt;">                                    
                                    <tr>
                                            <tr>
                                                    <td>
                                                            <label for="game_image_small">
                                                                    Fono paveiksliukas (bent 310x155) *
                                                            </label>
                                                    </td>
                                                    <td>
                                                            <input type="file" name="game_image_small" id="game_image_small" accept="image/*" />							
                                                    </td>
                                            </tr>
                                            <tr>
                                                    <td>
                                                            <label for="game_image_size_small">
                                                                    Fono paveiksliuko dydis
                                                            </label>
                                                    </td>
                                                    <td>
                                                            <input type="number" min="1" max="100" name="game_image_size_small" id="game_image_size_small" value="100" />
                                                    </td>
                                            </tr>                                            
                                    </tr>
                            </table>
                        </fieldset>
                    <fieldset>
                            <legend>Rezultatas</legend>
                            <canvas id="banner_small" width="310" height="155" style="border-style: solid; border-width: 1px;"></canvas>                        
                    </fieldset>
                </div>
                <div id="large_image_editor">
                    <fieldset>
			<legend>Duomenys</legend>
			<table border="0" class="outer" cellspacing="1" style="font-size: 8.15999991874pt;">
				<tr>
					<td>
						<label for="game_name">
							Rodomas žaidimo pavadinimas *
						</label>
					</td>
					<td>
						<input type="text" maxlength="255" name="game_name" id="game_name" value="<?php echo $this->_tpl_vars['game_name']; ?>
" />
					</td>
				</tr>
				<tr>
					<td>
						<label for="game_platform">
							Platforma *
						</label>
					</td>
					<td>
						<select name="game_platform" id="game_platform">
                                                    <?php $_from = $this->_tpl_vars['platforms']; if (!is_array($_from) && !is_object($_from)) { settype($_from, 'array'); }if (count($_from)):
    foreach ($_from as $this->_tpl_vars['value']):
?>
                                                    <option value="<?php if ($this->_tpl_vars['game_platform'] == 'rev'): ?>Wii<?php else: ?><?php echo $this->_tpl_vars['value']; ?>
<?php endif; ?>" <?php if ($this->_tpl_vars['game_platform'] == $this->_tpl_vars['value']): ?>selected="selected"<?php endif; ?>><?php echo $this->_tpl_vars['value']; ?>
</option>
                                                    <?php endforeach; endif; unset($_from); ?>
                                                    <option value="Naršyklinis" <?php if ($this->_tpl_vars['game_platform'] == "Naršyklinis"): ?>selected="selected"<?php endif; ?>>Web</value>
                                                    <option value="iOS" <?php if ($this->_tpl_vars['game_platform'] == 'iOS'): ?>selected="selected"<?php endif; ?>>iOS</value>
                                                    <option value="Android" <?php if ($this->_tpl_vars['game_platform'] == 'Android'): ?>selected="selected"<?php endif; ?>>Android</value>
                                                    <option value="WP7" <?php if ($this->_tpl_vars['game_platform'] == 'WP7'): ?>selected="selected"<?php endif; ?>>Windows Phone 7</value>
                                                    <option value="WP8" <?php if ($this->_tpl_vars['game_platform'] == 'WP8'): ?>selected="selected"<?php endif; ?>>Windows Phone 8</value>
						</select>
					</td>
					<tr>
						<td>
							<label for="game_box">
								Dėžutės paveiksliukas (bent 190x190)
							</label>
						</td>
						<td>
							<input type="file" name="game_box" id="game_box" accept="image/*" />
						</td>
					</tr>
					<tr>
						<td>
							<label for="game_image">
								Fono paveiksliukas (bent 625x190) *
							</label>
						</td>
						<td>
							<input type="file" name="game_image" id="game_image" accept="image/*" />							
						</td>
					</tr>
					<tr>
						<td>
							<label for="game_image_size">
								Fono paveiksliuko dydis
							</label>
						</td>
						<td>
							<input type="number" min="1" max="100" name="game_image_size" id="game_image_size" value="100" />
						</td>
					</tr>
					<tr>
						<td>
							<label for="game_flag">
								Ženkliukas
							</label>							
						</td>
						<td>
							<select name="game_flag" id="game_flag">
								<option>Joks</option>
								<option value="gamersgate">GamersGate</option>
								<option value="made_in_lithuania">Pagaminta Lietuvoje!</option>
							</select>
						</td>
					</tr>
				</tr>
			</table>
                    </fieldset>
		<fieldset>
			<legend>Rezultatas</legend>
			<canvas id="banner" width="625" height="190" style="border-style: solid; border-width: 1px;"></canvas>                        
		</fieldset>
                </div>
                <input type="hidden" name="image" value="<?php echo $this->_tpl_vars['image']; ?>
" />
            </td>
        </tr>
		<tr id="row-social-message">
            <td style="max-width: 150px; width: 150px;">
                Žinutė socialiniuose tinkluose *
            </td>
            <td>
                <input type="text" maxlength="255" name="social_message" value="" /> <br />
            </td>
        </tr>
		<tr id="row-social-image">
            <td style="max-width: 150px; width: 150px;">
                Paveiksliukas socialiniams tinklams (visur, išskyrus Twitter) *
            </td>
            <td>
				<input type="hidden" name="social_image" value="<?php echo $this->_tpl_vars['social_image']; ?>
" />
                <input type="file" name="social_image_file" value="" id="social_image_file" accept="image/*" /> <br />
            </td>
        </tr>
        <tr id="row-notify-email">
            <td style="max-width: 150px; width: 150px;">
                E-paštas pranešti apie banerio paskelbimą
            </td>
            <td>
                <input type="email" name="notify_email" value="mek@team.games.lt" /> <br />
            </td>
        </tr>
        <tr id="row-buttons">
            <td colspan="2" style="text-align: center;">
                <button type="button">Pridėti</button>
            </td>
        </tr>
    </table>
	<sub>* Būtini užpildyti laukai</sub>
</form>