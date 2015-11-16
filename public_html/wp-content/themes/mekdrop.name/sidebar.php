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

<div class="col-md-4 col-sm-4 col-same-height hidden-xs"  id="sidebar">

	<?php if (!strstr($_SERVER['SERVER_NAME'], 'about')) { ?>
	<div class="search-form">
		<form action="<?php bloginfo('url'); ?>/" method="get">
			<input type="text" name="s" id="ls" value="<?php echo isset($_GET['s'])?$_GET['s']:'';?>" class="searchfield" placeholder="Įvesk tekstą ir paspausk Enter..." />
		</form>
	</div>
	<?php } ?>	

	<ul class="sidebar-content">
	<?php dynamic_sidebar(1); ?>        
	</ul>
</div>

