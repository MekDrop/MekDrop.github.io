<?php
global $options;
foreach ($options as $value) {
	if (!isset($value['id'])) {
		continue;
	}
	if (get_option( $value['id'] ) === FALSE) {
		$$value['id'] = isset($value['std'])?$value['std']:null;
	}
	else {
		$$value['id'] = get_option( $value['id'] );
	}
}

			// Random category
			if($azs_randomcat == true) {
				$categories = get_categories();
				$key = array_rand($categories, 1);
				$azs_featuredcat = ($categories[$key]->name);
			} 
			
			$query = 'showposts='.$azs_featurednr;
			if ($azs_featuredcat) {
			    $query.='&category_name='.$azs_featuredcat;
			}
			$my_query = new WP_Query($query);

?>

<div class="featured-posts">
	<ul id="featured-posts-list">

		<?php


		while ($my_query->have_posts()) : $my_query->the_post();

		?>

        	<li>
            		<div class="featured-post-image">
				<?php featured_post_image(); ?>
			</div>

			<div class="featured-post-text">
				<h2 class="featured-post-title"><a href="<?php the_permalink() ?>" rel="bookmark" title="<?php the_title(); ?>"><?php the_title(); ?></a></h2>                 
				<div class="featured-post-content"><?php limits(120, "Continue Reading"); ?></div>
			</div>
			<div class="clearfix"></div>
		</li>

		<?php endwhile; ?>

	</ul>
	<div class="featured-posts-nav">
		<div id="featured-posts-pages"></div>
	</div>  
</div><!-- featured-posts -->
