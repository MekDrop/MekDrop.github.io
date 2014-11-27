<?php /* Smarty version 2.6.26, created on 2014-03-07 23:20:02
         compiled from /home/mekdrop/webs/stuff.gameslt.mekdrop.name/public_html/Tools/api/themes/iTheme/theme.html */ ?>
<?php require_once(SMARTY_CORE_DIR . 'core.load_plugins.php');
smarty_core_load_plugins(array('plugins' => array(array('modifier', 'substr', '/home/mekdrop/webs/stuff.gameslt.mekdrop.name/public_html/Tools/api/themes/iTheme/theme.html', 70, false),)), $this); ?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="<?php echo $this->_tpl_vars['icms_langcode']; ?>
">
<head>
<!-- Center block custom positioning -->
		<?php $this->assign('theme_top_order', 'lrc'); ?>
	<?php $this->assign('theme_bottom_order', 'lcr'); ?>
	
<!-- Theme name -->
	<?php $this->assign('theme_name', $this->_tpl_vars['xoTheme']->folderName); ?>

<!-- Title and meta -->
	<title><?php if ($this->_tpl_vars['icms_pagetitle'] != ''): ?><?php echo $this->_tpl_vars['icms_pagetitle']; ?>
 : <?php endif; ?><?php echo $this->_tpl_vars['icms_sitename']; ?>
</title>
	<meta http-equiv="content-type" content="text/html; charset=<?php echo $this->_tpl_vars['icms_charset']; ?>
" />	
	<meta name="robots" content="<?php echo $this->_tpl_vars['icms_meta_robots']; ?>
" />
	<meta name="keywords" content="<?php echo $this->_tpl_vars['icms_meta_keywords']; ?>
" />
	<meta name="description" content="<?php echo $this->_tpl_vars['icms_meta_description']; ?>
" />
	<meta name="rating" content="<?php echo $this->_tpl_vars['icms_meta_rating']; ?>
" />
	<meta name="author" content="<?php echo $this->_tpl_vars['icms_meta_author']; ?>
" />
	<meta name="copyright" content="<?php echo $this->_tpl_vars['icms_meta_copyright']; ?>
" />
	<meta name="generator" content="ImpressCMS" />

<!-- Module Header -->
<?php echo $this->_tpl_vars['icms_module_header']; ?>

	
<!-- Favicon -->
	<link rel="shortcut icon" type="image/ico" href="<?php 
echo 'http://stuff.gameslt.mekdrop.name/Tools/api/themes/iTheme/icons/favicon.ico'; ?>" />
	<link rel="icon" type="image/png" href="<?php 
echo 'http://stuff.gameslt.mekdrop.name/Tools/api/themes/iTheme/icons/icon.png'; ?>" />
	
<!-- Sheet Css -->
	<link rel="stylesheet" type="text/css" media="all" href="<?php echo $this->_tpl_vars['icms_imageurl']; ?>
<?php if ($this->_tpl_vars['icms_rtl']): ?>rtl/<?php endif; ?>style.css" />
</head>

<body id="<?php echo $this->_tpl_vars['icms_dirname']; ?>
" class="<?php echo $this->_tpl_vars['icms_langcode']; ?>
">
<?php if ($this->_tpl_vars['xoBlocks']['canvas_left'] && $this->_tpl_vars['xoBlocks']['canvas_right']): ?>
<?php $this->assign('columns_layout', 'threecolumns-layout'); ?>
<?php elseif ($this->_tpl_vars['xoBlocks']['canvas_left']): ?>
<?php $this->assign('columns_layout', 'leftcolumn-layout'); ?>
<?php elseif ($this->_tpl_vars['xoBlocks']['canvas_right']): ?>
<?php $this->assign('columns_layout', 'rightcolumn-layout'); ?>
<?php endif; ?>
<div id="xo-canvas"<?php if ($this->_tpl_vars['columns_layout']): ?> class="<?php echo $this->_tpl_vars['columns_layout']; ?>
"<?php endif; ?>>
	<!-- Header -->
    <div id="xo-header">
	    <div id="xo-headerlogo"><a href="<?php echo 'http://stuff.gameslt.mekdrop.name/Tools/api/'; ?>" title=""><img src="<?php echo $this->_tpl_vars['icms_imageurl']; ?>
img/logo.png" alt="<?php echo $this->_tpl_vars['icms_sitename']; ?>
" /></a></div>
    </div>

	<!-- Content -->
	<div id="xo-canvas-content">
		<div id="xo-canvas-columns">
			<!-- Left column -->
				<?php if ($this->_tpl_vars['icms_rtl']): ?>
			<?php if ($this->_tpl_vars['xoBlocks']['canvas_right']): ?>
			<?php $this->_smarty_include(array('smarty_include_tpl_file' => ($this->_tpl_vars['theme_name'])."/blockszone.html", 'smarty_include_vars' => array('blocks' => $this->_tpl_vars['xoBlocks']['canvas_right'],'zoneClass' => 'xo-canvas-column','zoneId' => 'xo-canvas-rightcolumn')));
 ?>
			<?php endif; ?>
			<?php else: ?>
			<?php if ($this->_tpl_vars['xoBlocks']['canvas_left']): ?>
			<?php $this->_smarty_include(array('smarty_include_tpl_file' => ($this->_tpl_vars['theme_name'])."/blockszone.html", 'smarty_include_vars' => array('blocks' => $this->_tpl_vars['xoBlocks']['canvas_left'],'zoneClass' => 'xo-canvas-column','zoneId' => 'xo-canvas-leftcolumn')));
 ?>
			<?php endif; ?>
			<?php endif; ?>
			<!-- Center column / page -->
			<div id="xo-page">
				<!-- Top blocks -->
				<?php if ($this->_tpl_vars['xoBlocks']['page_topleft'] || $this->_tpl_vars['xoBlocks']['page_topcenter'] || $this->_tpl_vars['xoBlocks']['page_topright']): ?>
				<div class="xo-blockszone xo-<?php echo $this->_tpl_vars['theme_top_order']; ?>
pageblocks" id="xo-page-topblocks">
					<?php $this->_smarty_include(array('smarty_include_tpl_file' => ($this->_tpl_vars['theme_name'])."/centerblocks.html", 'smarty_include_vars' => array('topbottom' => 'top','lcr' => ((is_array($_tmp=$this->_tpl_vars['theme_top_order'])) ? $this->_run_mod_handler('substr', true, $_tmp, 0, 1) : substr($_tmp, 0, 1)))));
 ?>
					<?php $this->_smarty_include(array('smarty_include_tpl_file' => ($this->_tpl_vars['theme_name'])."/centerblocks.html", 'smarty_include_vars' => array('topbottom' => 'top','lcr' => ((is_array($_tmp=$this->_tpl_vars['theme_top_order'])) ? $this->_run_mod_handler('substr', true, $_tmp, 1, 1) : substr($_tmp, 1, 1)))));
 ?>
					<?php $this->_smarty_include(array('smarty_include_tpl_file' => ($this->_tpl_vars['theme_name'])."/centerblocks.html", 'smarty_include_vars' => array('topbottom' => 'top','lcr' => ((is_array($_tmp=$this->_tpl_vars['theme_top_order'])) ? $this->_run_mod_handler('substr', true, $_tmp, 2, 1) : substr($_tmp, 2, 1)))));
 ?>
				</div>
				<?php endif; ?>
				<!-- Module content -->
				<?php if ($this->_tpl_vars['icms_contents']): ?>
				<div id="xo-content"><?php echo $this->_tpl_vars['icms_contents']; ?>
</div>
				<?php endif; ?>
				<!-- Bottom blocks -->
				<?php if ($this->_tpl_vars['xoBlocks']['page_bottomleft'] || $this->_tpl_vars['xoBlocks']['page_bottomcenter'] || $this->_tpl_vars['xoBlocks']['page_bottomright']): ?>
				<div class="xo-blockszone xo-<?php echo $this->_tpl_vars['theme_bottom_order']; ?>
pageblocks" id="xo-page-bottomblocks">
					<?php $this->_smarty_include(array('smarty_include_tpl_file' => ($this->_tpl_vars['theme_name'])."/centerblocks.html", 'smarty_include_vars' => array('topbottom' => 'bottom','lcr' => ((is_array($_tmp=$this->_tpl_vars['theme_bottom_order'])) ? $this->_run_mod_handler('substr', true, $_tmp, 0, 1) : substr($_tmp, 0, 1)))));
 ?>
					<?php $this->_smarty_include(array('smarty_include_tpl_file' => ($this->_tpl_vars['theme_name'])."/centerblocks.html", 'smarty_include_vars' => array('topbottom' => 'bottom','lcr' => ((is_array($_tmp=$this->_tpl_vars['theme_bottom_order'])) ? $this->_run_mod_handler('substr', true, $_tmp, 1, 1) : substr($_tmp, 1, 1)))));
 ?>
					<?php $this->_smarty_include(array('smarty_include_tpl_file' => ($this->_tpl_vars['theme_name'])."/centerblocks.html", 'smarty_include_vars' => array('topbottom' => 'bottom','lcr' => ((is_array($_tmp=$this->_tpl_vars['theme_bottom_order'])) ? $this->_run_mod_handler('substr', true, $_tmp, 2, 1) : substr($_tmp, 2, 1)))));
 ?>
				</div>
				<?php endif; ?>
			</div>
			<!-- Right column -->
				<?php if ($this->_tpl_vars['icms_rtl']): ?>
			<?php if ($this->_tpl_vars['xoBlocks']['canvas_left']): ?>
			<?php $this->_smarty_include(array('smarty_include_tpl_file' => ($this->_tpl_vars['theme_name'])."/blockszone.html", 'smarty_include_vars' => array('blocks' => $this->_tpl_vars['xoBlocks']['canvas_left'],'zoneClass' => 'xo-canvas-column','zoneId' => 'xo-canvas-leftcolumn')));
 ?>
			<?php endif; ?>
			<?php else: ?>
			<?php if ($this->_tpl_vars['xoBlocks']['canvas_right']): ?>
			<?php $this->_smarty_include(array('smarty_include_tpl_file' => ($this->_tpl_vars['theme_name'])."/blockszone.html", 'smarty_include_vars' => array('blocks' => $this->_tpl_vars['xoBlocks']['canvas_right'],'zoneClass' => 'xo-canvas-column','zoneId' => 'xo-canvas-rightcolumn')));
 ?>
			<?php endif; ?>
			<?php endif; ?>
		</div>
	</div>
</div>
	<!-- Footer -->
	<div id="xo-footer">
	<div style="margin-left: auto; margin-right: auto;"><?php echo $this->_tpl_vars['icms_footer']; ?>
</div>
	</div>
        
</body>
</html>