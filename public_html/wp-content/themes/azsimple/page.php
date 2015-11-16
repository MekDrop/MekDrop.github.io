<?php get_header(); ?>

	<div id="content"<?php if (is_front_page()) { echo ' class="frontpage blog'.$GLOBALS['blog_id'].'"'; } ?>>

		<div id="posts">

			<?php if (have_posts()) : while (have_posts()) : the_post(); ?>

				<div class="full-post" id="post-<?php the_ID(); ?>"> 

					<?php if (!is_front_page()) { ?>

						<h2><a href="<?php the_permalink() ?>" rel="bookmark" title="Permanent Link to <?php the_title(); ?>"><?php the_title(); ?></a></h2>
						<div class="meta">
							Paskelbta: <span><?php the_time('M d Y'); ?></span>
						</div><!--meta-->

					<?php } else {  ?>
						<?php if (strstr(get_the_title(), '.php')) include_once(__DIR__ . '/mk/' . get_the_title()); ?>
					<?php } ?>
 
						<div class="full-post-content"><?php the_content(); ?></div>

						<div class="full-post-pages"><?php wp_link_pages(); ?></div>

					<?php if (!is_front_page()) { ?>

						<div class="meta"></div>

						<div class="clearfix"></div>					
					
					<?php } ?>

					<?php comments_template(); ?>

				</div><!-- full-post -->

				<?php endwhile; ?>

			<?php endif; ?>

		</div>

<?php 
	if (is_front_page()) {
		global $blog_id;
		if ($blog_id != 7) {
			get_sidebar(); 
		}
	} else {
		get_sidebar(); 
	}

	get_footer();
?>
