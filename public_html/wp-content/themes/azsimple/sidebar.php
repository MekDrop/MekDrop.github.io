<?php
global $options;
foreach ($options as $value) {
	if (!isset($value['id'])) {
		continue;
	}
	if (get_option( $value['id'] ) === FALSE) {
		$$value['id'] =  isset($value['std'])?$value['std']:null;
	}
	else {
		$$value['id'] = get_option( $value['id'] );
	}
}
?>


<div id="sidebar">

	<?php if (!strstr($_SERVER['SERVER_NAME'], 'about')) { ?>
	<div class="search-form">
		<form action="<?php bloginfo('url'); ?>/" method="get">
			<input type="text" value="Įvesk tekstą ir paspausk Enter..." name="s" id="ls" class="searchfield" onfocus="if (this.value == 'Įvesk tekstą ir paspausk Enter...') {this.value = '';}" onblur="if (this.value == '') {this.value = 'Įvesk tekstą ir paspausk Enter...';}" />
		</form>
	</div>
	<?php } ?>

	<?php if ($azs_ads125x125 && $azs_ads125x125 != '!!!') { ?>
	<div class="sidebar-ads">
		<h2>Reklama</h2>
		<div class="sidebar-ads-wrap"><?php echo stripslashes($azs_ads125x125); ?></div>
	</div>
	<?php } ?>


	<ul class="sidebar-content">
	<?php if ( function_exists('dynamic_sidebar') && dynamic_sidebar(1) ) : else : ?>

        <li>
        <h2><?php _e('Categories'); ?></h2>
            <ul>
            <?php wp_list_cats('sort_column=name&hierarchical=0'); ?>
            </ul>
        </li>
      	
        <li>
        <h2><?php _e('Archives'); ?></h2>
            <ul>
            <?php wp_get_archives('type=monthly'); ?>
            </ul>
        </li>
        
        <li>
        <h2><?php _e('Links'); ?></h2>
            <ul>
             <?php get_links(2, '<li>', '</li>', '', TRUE, 'url', FALSE); ?>
             </ul>
        </li>
        
	<?php endif; ?>
	</ul>

</div>
