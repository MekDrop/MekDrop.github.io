<?php get_header(); ?>

	<div id="content">

		<div id="posts">

			<?php if (have_posts()) : while (have_posts()) : the_post(); ?>

				<div class="full-post" id="post-<?php the_ID(); ?>"> 

					<h2><a href="<?php the_permalink() ?>" rel="bookmark" title="Permanent Link to <?php the_title(); ?>"><?php the_title(); ?></a></h2>
					<div class="meta">
						Paskelbta: <span><?php the_time('M d Y'); ?></span>.
						<span class="share_area">
						   Pasidalinti galima per:
						    <?php
						       $curl = rawurlencode(get_permalink());
						       $title = rawurlencode(get_the_title());
						    ?>
						    <a href="https://www.facebook.com/sharer.php?u=<?php echo $curl; ?>" rel="nofollow" target="share">
						    <img src="http://blog.mekdrop.name/wp-content/plugins/simple-share-buttons-adder/buttons/simple/facebook.png" alt="FaceBook" width="16" height="16" /></a>
						    <a href="https://plus.google.com/share?url=<?php echo $curl; ?>" target="_blank" rel="nofollow" target="share">
							<img src="http://blog.mekdrop.name/wp-content/plugins/simple-share-buttons-adder/buttons/simple/google.png" alt="Google+" width="16" height="16" /></a>
						    <a href="http://twitter.com/share?url=<?php echo $curl; ?>&text=<?php echo $title; ?>" target="share" rel="nofollow">
						    <img src="http://blog.mekdrop.name/wp-content/plugins/simple-share-buttons-adder/buttons/simple/twitter.png" alt="Twitter" width="16" height="16" /></a>
						    <a href="http://www.linkedin.com/shareArticle?mini=true&url=<?php echo $curl; ?>" target="share" rel="nofollow"">
						    <img src="http://blog.mekdrop.name/wp-content/plugins/simple-share-buttons-adder/buttons/simple/linkedin.png" alt="LinkedIn" width="16" height="16" /></a>
						    <a href="mailto:?Subject=<?php echo $title; ?>&Body=<?php echo $curl; ?>" target="_self" rel="nofollow">
						    <img src="http://blog.mekdrop.name/wp-content/plugins/simple-share-buttons-adder/buttons/simple/email.png" alt="E-paštas" width="16" height="16" /></a>
						</span>
					</div><!--meta-->
 
					<div class="full-post-content"><?php the_content(); ?></div>

					<div class="full-post-pages"><?php wp_link_pages(); ?></div>

					<div class="meta">
						Kategorija: <?php the_category(', ') ?> <?php the_tags( 'Žymos: ', ', ', ''); ?> <?php edit_post_link('Redaguoti', ' &#124; ', ''); ?>
					</div>

					<div class="clearfix"></div>

					<?php comments_template(); ?>

				</div><!-- full-post -->

				<?php endwhile; ?>

			<?php endif; ?>

		</div>

<?php get_sidebar(); ?>

<?php get_footer(); ?>
