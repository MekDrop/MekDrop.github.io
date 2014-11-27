<?php /* Smarty version 2.6.26, created on 2014-11-04 22:05:38
         compiled from core/html/meta.html */ ?>
  <?php if ($this->_tpl_vars['use_charset']): ?>
    <?php if ($this->_tpl_vars['icms_meta_charset']): ?><meta charset="<?php echo $this->_tpl_vars['icms_charset']; ?>
"><?php endif; ?>
  <?php endif; ?>

  <title><?php if ($this->_tpl_vars['icms_pagetitle']): ?><?php echo $this->_tpl_vars['icms_pagetitle']; ?>
 <?php echo $this->_tpl_vars['title_sep']; ?>
 <?php endif; ?><?php echo $this->_tpl_vars['icms_sitename']; ?>
</title>

  <?php if (! $this->_tpl_vars['htaccess_on']): ?>
    <meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1">
  <?php endif; ?>

  <?php if ($this->_tpl_vars['use_robots']): ?>
    <meta name="robots" content="<?php echo $this->_tpl_vars['icms_meta_robots']; ?>
">
  <?php endif; ?>
  <?php if ($this->_tpl_vars['use_keywords']): ?>
    <?php if ($this->_tpl_vars['icms_meta_keywords']): ?><meta name="keywords" content="<?php echo $this->_tpl_vars['icms_meta_keywords']; ?>
"><?php endif; ?>
  <?php endif; ?>
  <?php if ($this->_tpl_vars['use_description']): ?>
    <?php if ($this->_tpl_vars['icms_meta_description']): ?><meta name="description" content="<?php echo $this->_tpl_vars['icms_meta_description']; ?>
"><?php endif; ?>
  <?php endif; ?>
  <?php if ($this->_tpl_vars['use_rating']): ?>
    <?php if ($this->_tpl_vars['icms_meta_rating']): ?><meta name="rating" content="<?php echo $this->_tpl_vars['icms_meta_rating']; ?>
"><?php endif; ?>
  <?php endif; ?>
  <?php if ($this->_tpl_vars['use_humans']): ?>
      <link rel="author" href="<?php echo $this->_tpl_vars['icms_imageurl']; ?>
media/policy/humans.txt">
  <?php else: ?>
    <?php if ($this->_tpl_vars['use_author']): ?>
      <?php if ($this->_tpl_vars['icms_meta_author']): ?><meta name="author" content="<?php echo $this->_tpl_vars['icms_meta_author']; ?>
"><?php endif; ?>    
    <?php endif; ?>
  <?php endif; ?>
  <?php if ($this->_tpl_vars['use_copyright']): ?>
    <?php if ($this->_tpl_vars['icms_meta_copyright']): ?><meta name="copyright" content="<?php echo $this->_tpl_vars['icms_meta_copyright']; ?>
"><?php endif; ?>
  <?php endif; ?>
  <?php if ($this->_tpl_vars['use_generator']): ?>
    <meta name="generator" content="ImpressCMS - Boiler Theme Framework" />
  <?php endif; ?>

  <meta name="viewport" content="width=device-width">

  <?php if ($this->_tpl_vars['use_iphone_icons']): ?>
    <!-- For iPhone 4 with high-resolution Retina display: -->
    <link rel="apple-touch-icon-precomposed" sizes="114x114" href="<?php echo $this->_tpl_vars['icms_imageurl']; ?>
media/icons/apple-touch-icon-114x114-precomposed.png">
    <!-- For first-generation iPad: -->
    <link rel="apple-touch-icon-precomposed" sizes="72x72" href="<?php echo $this->_tpl_vars['icms_imageurl']; ?>
media/icons/apple-touch-icon-72x72-precomposed.png">
    <!-- For non-Retina iPhone, iPod Touch, and Android 2.1+ devices: -->
    <link rel="apple-touch-icon-precomposed" href="<?php echo $this->_tpl_vars['icms_imageurl']; ?>
media/icons/apple-touch-icon-precomposed.png">
  <?php endif; ?>

  <link rel="shortcut icon" type="image/ico" href="<?php echo $this->_tpl_vars['icms_imageurl']; ?>
media/icons/favicon.ico" />
  <link rel="icon" type="image/png" href="<?php echo $this->_tpl_vars['icms_imageurl']; ?>
media/icons/icon.png" />

  <script type="text/javascript">
    var hasBootstrap = true;
  </script>

  <!-- Loading scripts from system -->
  <?php echo $this->_tpl_vars['head']; ?>

  <?php echo $this->_tpl_vars['module']; ?>

  <!-- End system scripts -->
  
  <script type="text/javascript">
    icms.router.push(icms.config.themeRoute + 'main');
  </script>
  <link rel="stylesheet" href="<?php echo $this->_tpl_vars['icms_imageurl']; ?>
media/css/bootstrap/bootstrap.min.css" />
  <?php if ($this->_tpl_vars['enable_responsive']): ?>
    <link rel="stylesheet" href="<?php echo $this->_tpl_vars['icms_imageurl']; ?>
media/css/bootstrap/responsive.min.css" />
  <?php endif; ?>

  <!--[if lt IE 9]>
    <link rel="stylesheet" href="<?php echo $this->_tpl_vars['icms_imageurl']; ?>
media/css/font-awesome/font-awesome-ie7.css">
  <![endif]-->

  <link rel="stylesheet" href="<?php echo $this->_tpl_vars['icms_imageurl']; ?>
media/css/boiler/boiler.css" />

  <?php if ($this->_tpl_vars['skin'] !== ''): ?>
    <!-- if your skin is responsive - use style.css to set global styles (DRY) -->
    <link rel="stylesheet" href="<?php echo $this->_tpl_vars['icms_imageurl']; ?>
skins/<?php echo $this->_tpl_vars['skin']; ?>
/style.css" />  
    <?php if ($this->_tpl_vars['enable_responsive']): ?>
      <link rel='stylesheet' media='screen and (min-width: 0px) and (max-width: 760px)' href='<?php echo $this->_tpl_vars['icms_imageurl']; ?>
skins/<?php echo $this->_tpl_vars['skin']; ?>
/media/css/responsive/mobile.css' />
      <link rel='stylesheet' media='screen and (min-width: 760px) and (max-width: 9800px)' href='<?php echo $this->_tpl_vars['icms_imageurl']; ?>
skins/<?php echo $this->_tpl_vars['skin']; ?>
/media/css/responsive/narrow.css' />
      <link rel='stylesheet' media='screen and (min-width: 980px)<?php if ($this->_tpl_vars['enable_wides']): ?> and (max-width: 1280px)<?php endif; ?>' href='<?php echo $this->_tpl_vars['icms_imageurl']; ?>
skins/<?php echo $this->_tpl_vars['skin']; ?>
/media/css/responsive/normal.css' />
      <?php if ($this->_tpl_vars['enable_wides']): ?>
        <link rel='stylesheet' media='screen and (min-width: 1280px)' href='<?php echo $this->_tpl_vars['icms_imageurl']; ?>
skins/<?php echo $this->_tpl_vars['skin']; ?>
/media/css/responsive/wide.css' />
      <?php endif; ?>
    <?php endif; ?>
  <?php endif; ?>

  <?php if ($this->_tpl_vars['add_meta']): ?>
    <?php $this->_smarty_include(array('smarty_include_tpl_file' => ($this->_tpl_vars['theme_name'])."/skins/".($this->_tpl_vars['skin'])."/html/add_meta.html", 'smarty_include_vars' => array()));
 ?>
  <?php endif; ?>