<?php get_header(); ?>

	<div id="content">

		<div id="posts">
			<?php /*include (TEMPLATEPATH . '/featured-posts.php');/**/ ?>

			<?php if (have_posts()) : while (have_posts()) : the_post(); ?>

				<div class="single-post" id="post-<?php the_ID(); ?>"> 

					<div class="single-post-image">
						<?php post_image_thumbnail(); ?>
					</div>
					<div class="single-post-text">
						<h2><a href="<?php the_permalink() ?>" rel="bookmark" title="Permanent Link to <?php the_title(); ?>"><?php the_title(); ?></a></h2>
						<div class="meta">
							Paskelbta: <span><?php the_time('M d Y'); ?></span><?php if (comments_open()) { ?> - <?php comments_popup_link('Palik komentarą', '1 Komentaras', '% Komentarai(-ų)'); } ?>
						</div><!--meta--> 
						<div class="single-post-content"><?php limits2(160, ""); ?></div>
					</div><!-- single-post-text -->
					<div class="clearfix"></div>
				</div><!-- single-post -->

				<?php endwhile; ?>

				<div class="posts-navigation">
					<div class="posts-navigation-next"><?php next_posts_link('Senesni įrašai &raquo;') ?></div>
					<div class="posts-navigation-prev"><?php previous_posts_link('&laquo; Naujesni įrašai') ?></div>
					<div class="clearfix"></div>
				</div>

			<?php endif; ?>

		</div>

<?php get_sidebar(); ?>

<?php get_footer(); ?>
