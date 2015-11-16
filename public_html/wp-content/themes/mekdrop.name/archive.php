<?php get_header(); ?>

	<div class="same-height">
	<div class="row">
		<div class="col-md-8 col-sm-8 col-sm-height">

		<div id="posts">

			<?php if (have_posts()) : ?>

				<?php $post = $posts[0]; // Hack. Set $post so that the_date() works. ?>
				<?php /* If this is a category archive */ if (is_category()) { ?>
					<div class="search-results"><h3>Archyvas „<?php single_cat_title(); ?>“ kategorijai:</h3></div>
				<?php /* If this is a tag archive */ } elseif (is_tag()) { ?>
					<div class="search-results"><h3>Įrašai sužymėti „<?php single_tag_title(); ?>“ žyme:</h3></div>
				<?php /* If this is a daily archive */ } elseif (is_day()) { ?>
					<div class="search-results"><h3>Archyvas datai <?php the_time('F jS, Y'); ?>:</h3></div>
				<?php /* If this is a monthly archive */ } elseif (is_month()) { ?>
					<div class="search-results"><h3>Archyvas datai  <?php the_time('F, Y'); ?>:</h3></div>
				<?php /* If this is a yearly archive */ } elseif (is_year()) { ?>
					<div class="search-results"><h3>Archyvas metams <?php the_time('Y'); ?>:</h3></div>
				<?php /* If this is an author archive */ } elseif (is_author()) { ?>
					<div class="search-results"><h3>Autoriaus archyvas:</h3></div>
				<?php /* If this is a paged archive */ } elseif (isset($_GET['paged']) && !empty($_GET['paged'])) { ?>
					<div class="search-results"><h3>Tinklaraščio archyvas:</h3></div>
				<?php } ?>

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

			<?php endif; ?>

		</div>

</div>

<?php get_sidebar(); ?>

</div>

<?php get_footer(); ?>
