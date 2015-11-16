<!doctype html>
<!--[if lt IE 7]>      <html class="no-js lt-ie9 lt-ie8 lt-ie7" lang=""> <![endif]-->
<!--[if IE 7]>         <html class="no-js lt-ie9 lt-ie8" lang=""> <![endif]-->
<!--[if IE 8]>         <html class="no-js lt-ie9" lang=""> <![endif]-->
<!--[if gt IE 8]><!--> <html class="no-js" lang=""> <!--<![endif]-->
    <head>
        <meta charset="utf-8">
        <meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1" />

        <meta name="viewport" content="width=device-width, initial-scale=1" />
		<link rel="apple-touch-icon" href="<?php bloginfo('template_directory'); ?>/apple-touch-icon.png">

        <script defer="defer" async="async" src="<?php bloginfo('template_directory'); ?>/build/js/main.min.js" type="text/javascript"></script>

		<meta http-equiv="Content-Type" content="<?php bloginfo('html_type'); ?>; charset=<?php bloginfo('charset'); ?>" />
		<meta name="generator" content="WordPress <?php bloginfo('version'); ?>" />

		<?php if (is_single()):
//	$thumbnail_id = get_post_thumbnail_id($post->ID);
?>

	<?php if (get_bloginfo('name') == 'Įrankiai'): ?>
		<script data-main="/js/main" defer="defer" async="async" data-what-to-load="tools/<?php echo substr(get_permalink(get_the_ID()), strlen(get_site_url()) + 1, -1); ?>" type="text/javascript" src="/js/bower_components/requirejs/require.js"></script>
	<?php endif; ?>
<?php endif; ?>

	<link rel="stylesheet" href="<?php bloginfo('stylesheet_url'); ?>" type="text/css" media="screen" />
	
	<?php if (get_option( 'disable_feeds_redirect', null ) === null): ?>
		<link rel="alternate" type="application/rss+xml" title="RSS 2.0" href="<?php bloginfo('rss2_url'); ?>" />
		<link rel="alternate" type="text/xml" title="RSS .92" href="<?php bloginfo('rss_url'); ?>" />
		<link rel="alternate" type="application/atom+xml" title="Atom 0.3" href="<?php bloginfo('atom_url'); ?>" />
		<link rel="pingback" href="<?php bloginfo('pingback_url'); ?>" />
	<?php endif; ?>
        
		<?php wp_head(); ?>

		<?php
	global $options;
	foreach ($options as $value) {
		if (!isset($value['id'])) {
			continue;
		}
		if ( get_option( $value['id'] ) === FALSE) {
			$$value['id'] = isset($value['std'])?$value['std']:null;
		}
		else {
			$$value['id'] = get_option( $value['id'] );
		}
	}
	?>

	<?php wp_get_archives('type=monthly&format=link'); ?>
	<?php //comments_popup_script(); // off by default ?>
	<?php if (function_exists('wp_enqueue_script') && function_exists('is_singular')) : ?>
	<?php if ( is_singular() ) wp_enqueue_script( 'comment-reply' ); ?>
	<?php endif; ?>
        
    </head>
    <body>

            <div class="alert alert-warning browserupgrade alert-dismissible container hidden" role="alert">
<div class="row">
<div class="col-sm-11">
Jūs naudojatės <strong>sena</strong> interneto naršykle. Prašome <a href="http://browsehappy.com/">atnaujinti savo naršyklę</a>, priešingu atveju kai kurios šio tinklalapio dalys gali neveikti taip kaip turėtų.
</div>
<div class="col-sm-1">
<button data-dismiss="alert" class="btn btn-warning pull-right">x</button>
</div>
</div>
</div>
        
    <nav class="navbar" role="navigation">
      <div class="container">
        <div class="navbar-header">
			<div class="pull-right menu visible-xs dropdown">
				<a href="#" class="dropdown-toggle" data-toggle="dropdown" role="button" aria-expanded="false"><i class="fa fa-bars"></i></a>
          
          <ul class="dropdown-menu" role="menu">
            <?php
			$cblog_id = get_current_blog_id();
			foreach (mek_get_main_menu() as $blog): ?>
	            <li<?php if ($cblog_id == $blog['blog_id']) echo ' class="active"';?>>
				<a href="//<?php echo $blog['domain']; ?>">
					<span><i class="fa fa-<?php echo $blog['icon']; ?>"></i></span>
					<?php echo $blog['name']; ?>
				</a>
				</li>
			<?php endforeach; ?> 
          </ul>

		  </div>
          <a class="navbar-brand" href="http://mekdrop.name">
              <div class="website">MekDrop<span class="blue">.</span>Name</div>
              <div class="description hidden-xs"><?php bloginfo('description'); ?></div>
          </a>
		  
        </div>
        <ul class="nav navbar-nav navbar-right hidden-xs">
			<?php 			
			$cblog_id = get_current_blog_id();
			foreach (mek_get_main_menu() as $blog): ?>
	            <li<?php if ($cblog_id == $blog['blog_id']) echo ' class="active"';?>><a href="//<?php echo $blog['domain']; ?>"><div><i class="fa fa-<?php echo $blog['icon']; ?>"></i></div><div><?php echo $blog['name']; ?></div></a></li>
			<?php endforeach; ?>        
        </ul>
      </div>
    </nav>   

    <div class="container content">       