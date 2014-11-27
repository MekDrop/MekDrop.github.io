<?php get_header(); ?>

	<div id="content">

		<div id="posts">

			<?php if (have_posts()) : ?>

				<?php $post = $posts[0]; // Hack. Set $post so that the_date() works. ?>
				<?php /* If this is a category archive */ if (is_category()) { ?>
					<div class="search-results"><h2>Archyvas „<?php single_cat_title(); ?>“ kategorijai:</h2></div>
				<?php /* If this is a tag archive */ } elseif (is_tag()) { ?>
					<div class="search-results"><h2>Įrašai sužymėti „<?php single_tag_title(); ?>“ žyme:</h2></div>
				<?php /* If this is a daily archive */ } elseif (is_day()) { ?>
					<div class="search-results"><h2>Archyvas datai <?php the_time('F jS, Y'); ?>:</h2></div>
				<?php /* If this is a monthly archive */ } elseif (is_month()) { ?>
					<div class="search-results"><h2>Archyvas datai  <?php the_time('F, Y'); ?>:</h2></div>
				<?php /* If this is a yearly archive */ } elseif (is_year()) { ?>
					<div class="search-results"><h2>Archyvas metams <?php the_time('Y'); ?>:</h2></div>
				<?php /* If this is an author archive */ } elseif (is_author()) { ?>
					<div class="search-results"><h2>Autoriaus archyvas:</h2></div>
				<?php /* If this is a paged archive */ } elseif (isset($_GET['paged']) && !empty($_GET['paged'])) { ?>
					<div class="search-results"><h2>Tinklaraščio archyvas:</h2></div>
				<?php } ?>

				<?php while (have_posts()) : the_post(); ?>

				<div class="single-post" id="post-<?php the_ID(); ?>"> 

					<div class="single-post-image">
						<?php post_image_thumbnail(); ?>
					</div>
					<div class="single-post-text">
						<h2><a href="<?php the_permalink() ?>" rel="bookmark" title="Permanent Link to <?php the_title(); ?>"><?php the_title(); ?></a></h2>
						<div class="meta">
							Paskelbta: <span><?php the_time('M d Y'); ?></span> - <?php comments_popup_link('Palik komentarą', '1 Komentaras', '% Komentarai(-ų)'); ?>
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
