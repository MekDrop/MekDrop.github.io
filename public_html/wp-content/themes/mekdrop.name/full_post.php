<div id="posts">

			<?php if (have_posts()) : while (have_posts()) : the_post(); ?>

				<div class="full-post" id="post-<?php the_ID(); ?>"> 

					<?php if (!is_front_page()) { ?>

						<h3><a href="<?php the_permalink() ?>" rel="bookmark" title="Permanent Link to <?php the_title(); ?>"><?php the_title(); ?></a></h3>
						<div class="meta">
								<span class="text-nowrap">
									Paskelbta: <span><?php the_time('M d Y'); ?></span>
								</span>
								<span class="text-nowrap separator"></span>
								<span class="text-nowrap share_area">
								   Pasidalinti:
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
								<?php $pages_count = count(explode('<!--nextpage-->', $post->post_content)); 
								if ($pages_count > 1):
								?>
								<span class="text-nowrap separator"></span>
								<span class="text-nowrap pages text-right">
								Puslapis: <?php echo (get_query_var('page')) ? get_query_var('page') : 1; ?> / <?php echo  $pages_count; ?>
								</span>		
								<?php endif; ?>
						</div><!--meta-->
					
					<?php } ?>
 
						<div class="full-post-content"><?php the_content(); ?></div>

						<div class="full-post-pages text-center"><?php wp_link_pages(); ?></div>

					<?php if (!is_front_page()) { ?>

						<div class="meta"></div>

						<div class="clearfix"></div>					
					
					<?php } ?>

					<?php comments_template(); ?>

				</div><!-- full-post -->

				<?php endwhile; ?>

			<?php endif; ?>

		</div>