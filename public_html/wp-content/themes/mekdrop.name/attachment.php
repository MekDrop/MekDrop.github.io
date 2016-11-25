<?php get_header(); ?>

<div class="same-height">
<div class="row">
	<div class="col-md-8 col-sm-8">
	
<div id="posts">
	<?php if (have_posts()) : while (have_posts()) : the_post(); ?>
				<div class="full-post" id="post-<?php the_ID(); ?>"> 
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
					
 
						<div class="full-post-content"><?php the_content(); ?></div>

						<?php if ( wp_attachment_is_image() ) :
	        $attachments = array_values( get_children( array( 'post_parent' => $post->post_parent, 'post_status' => 'inherit', 'post_type' => 'attachment', 'post_mime_type' => 'image', 'order' => 'ASC', 'orderby' => 'menu_order ID' ) ) );
	        foreach ( $attachments as $k => $attachment ) {
	                if ( $attachment->ID == $post->ID )
	                        break;
	        }
	
	        // If there is more than 1 image attachment in a gallery
	        if ( count( $attachments ) > 1 ) {
	                $k++;
	                if ( isset( $attachments[ $k ] ) )
	                        // get the URL of the next image attachment
	                        $next_attachment_url = get_attachment_link( $attachments[ $k ]->ID );
	                else
	                        // or get the URL of the first image attachment
	                        $next_attachment_url = get_attachment_link( $attachments[0]->ID );
	        } else {
	                // or, if there's only 1 image attachment, get the URL of the image
	                $next_attachment_url = wp_get_attachment_url();
	        }			
			
	?>

	<img src="<?php echo esc_url( wp_get_attachment_url() ); ?>" title="<?php the_title_attribute(); ?>" class="img-responsive" />

<?php else : ?>
<div class="row file">
	<div class="col-md-1 icon">
<?php
  $file_ext = substr(wp_get_attachment_url(), strrpos(wp_get_attachment_url(), '.') +1); 
?>
		<a href="<?php echo esc_url( wp_get_attachment_url() ); ?>" title="<?php the_title_attribute(); ?>" rel="nofolow">
		<img data-ext="<?php echo $file_ext; ?>" class="img-responsive" src="<?php echo get_template_directory_uri() . '/img/file/512px/'. (file_exists(get_template_directory() . '/img/file/512px/' . $file_ext . '.png'  )?$file_ext:'_blank') . '.png'; ?>" alt="<?php the_title_attribute(); ?>" />
		</a>
	</div>
		<h4 class="col-md-11 name">
			         <a href="<?php echo esc_url( wp_get_attachment_url() ); ?>" title="<?php the_title_attribute(); ?>" rel="nofolow"><?php echo esc_html( basename( wp_get_attachment_url() ) ); ?></a>
</h4>
</div>


	<?php endif; ?>

						<div class="full-post-pages text-center"><?php wp_link_pages(); ?></div>

				</div><!-- full-post -->

				<?php endwhile; ?>

			<?php endif; ?>

		</div>	
	
	</div>
	<?php get_sidebar(); ?>
</div>
</div>

<?php
	get_footer();
?>