<?php get_header(); ?>

	<div class="same-height1">
<div class="row">
	<div class="col-md-8 col-sm-8 col-sm-height" >


		<div id="posts">

			<?php if (have_posts()) : ?>

				<div class="search-results"><h3>Paieškos rezultatai užklausai „<?php echo $_GET['s']; ?>“:</h3></div>

				<?php while (have_posts()) : the_post(); ?>

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

				<div class="posts-navigation">
					<div class="posts-navigation-next"><?php next_posts_link('Senesni įrašai &raquo;') ?></div>
					<div class="posts-navigation-prev"><?php previous_posts_link('&laquo; Naujesni įrašai') ?></div>
					<div class="clearfix"></div>
				</div>

			<?php else: ?>

				<div class="search-results"><h2>Nieko nerasta su užklauda „<?php echo $_GET['s']; ?>“!</h2></div>

			<?php endif; ?>

		</div>
</div>
	<?php get_sidebar(); ?>
</div>
</div>

<?php
	get_footer();
?>
