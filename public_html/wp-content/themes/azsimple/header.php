<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head profile="http://gmpg.org/xfn/11">

	<title><?php 
	if (!is_home() && !is_front_page()) {
		wp_title(); 
		echo ' (';
		bloginfo('name');
		echo ')';
	} else {
		bloginfo('name');
		echo ' @ MekDrop.Name';
	}
	?>
	</title>

	<meta http-equiv="Content-Type" content="<?php bloginfo('html_type'); ?>; charset=<?php bloginfo('charset'); ?>" />
	<meta name="generator" content="WordPress <?php bloginfo('version'); ?>" /> <!-- leave this for stats please -->

<?php if (is_single()):
	$thumbnail_id = get_post_thumbnail_id($post->ID);
?>

	<?php if (get_bloginfo('name') == 'Įrankiai'): ?>
		<script data-main="/js/main" data-what-to-load="tools/<?php echo substr(get_permalink(get_the_ID()), strlen(get_site_url()) + 1, -1); ?>" type="text/javascript" src="https://cdnjs.cloudflare.com/ajax/libs/require.js/2.1.17/require.min.js"></script>
	<?php endif; ?>
<?php endif; ?>
        

        <link href="//maxcdn.bootstrapcdn.com/font-awesome/4.2.0/css/font-awesome.min.css" rel="stylesheet">            
        <link rel="stylesheet" href="css/lightbox.css" type="text/css" media="screen" />
	<link rel="stylesheet" href="<?php bloginfo('stylesheet_url'); ?>" type="text/css" media="screen" />
	<?php if (!in_array($GLOBALS['blog_id'], [4, 7])) { ?>
		<link rel="alternate" type="application/rss+xml" title="RSS 2.0" href="<?php bloginfo('rss2_url'); ?>" />
		<link rel="alternate" type="text/xml" title="RSS .92" href="<?php bloginfo('rss_url'); ?>" />
		<link rel="alternate" type="application/atom+xml" title="Atom 0.3" href="<?php bloginfo('atom_url'); ?>" />
		<link rel="pingback" href="<?php bloginfo('pingback_url'); ?>" />
	<?php } ?>

	<!-- jQuery -->
	<script type="text/javascript" src="<?php bloginfo('template_directory'); ?>/javascript/jquery-1.7.1.min.js" ></script>

	<!-- bxSlider for featured posts -->
	<script type="text/javascript" src="<?php bloginfo('template_directory'); ?>/javascript/jquery.bxSlider.min.js" ></script>
	<script type="text/javascript">
		$(document).ready(function(){
			$('#featured-posts-list').bxSlider({
				pager: true,
				pagerSelector: '#featured-posts-pages',
				controls: false
			});
		});
	</script>

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

	<!-- Favicon -->
	<link rel="shortcut icon" type="image/x-icon" href="<?php echo $azs_favicon; ?>" />

	<?php wp_head(); ?>

</head>

<body>
	<div id="header">
		<div class="header-top">
			<div class="main-menu-container">
				<?php wp_nav_menu(array('theme_location' => 'menu-1', 'container' => 'div', 'container_class' => 'main-menu')); ?>
				<div class="social">
					Sek mane: <a href="<?php echo $azs_facebook; ?>">Facebook</a>, <a href="http://twitter.com/<?php echo $azs_twitter; ?>">Twitter</a><?php if (!in_array($GLOBALS['blog_id'], [4, 7])) { ?>, <a href="<?php bloginfo('rss2_url'); ?>">RSS</a><?php } ?>
				</div>
			</div>
		</div>
		<div class="header-bottom">
			<div class="logo" style="background-image: url(<?php echo $azs_logourl; ?>);">
				<h1><a href="<?php echo get_option('home'); ?>/"><?php bloginfo('name'); ?></a></h1>
			</div>
			<div class="header-advertising"><?php echo stripslashes($azs_ads468x60); ?></div>
		</div>
	</div>



