<?php get_header(); ?>

<?php if (is_front_page() && is_home() && home_url() == 'http://mekdrop.name' ) : ?>
	<?php include(__DIR__ .'/entry.php'); ?>
<?php else: ?>
	<div class="same-height">
	<div class="row">
		<div class="col-md-8 col-sm-8 col-sm-height">

		<div id="posts" class="list">
			<?php /*include (TEMPLATEPATH . '/featured-posts.php');/**/ ?>

			<?php if (have_posts()) : while (have_posts()) : the_post(); ?>

				<div class="single-post row">
					<div class="col-xs-3">
						<div class="thumbnail">
						<?php post_image_thumbnail(); ?>
						</div>

					

					</div>
					<div class="col-xs-9">
						<h3><a href="<?php the_permalink() ?>" rel="bookmark" title="Permanent Link to <?php the_title(); ?>"><?php the_title(); ?></a></h3>
						<div class="meta">
							Paskelbta: <span><?php the_time('M d Y'); ?></span><?php if (comments_open()) { ?> - <?php comments_popup_link('Palik komentarą', '1 Komentaras', '% Komentarai(-ų)'); } ?>
						</div><!--meta--> 
						<div class="single-post-content"><?php limits2(160, ""); ?></div>
					</div>
				</div>

				<?php endwhile; ?>

				<div class="text-center posts-navigation">
					<div class="posts-navigation-next"><?php next_posts_link('Senesni įrašai &raquo;') ?></div>
					<div class="posts-navigation-prev"><?php previous_posts_link('&laquo; Naujesni įrašai') ?></div>
					<div class="clearfix"></div>
				</div>

			<?php endif; ?>

		</div>


		</div>
		<?php get_sidebar(); ?>
	</div>	
	</div>
<?php endif; ?>

<?php get_footer(); ?>
