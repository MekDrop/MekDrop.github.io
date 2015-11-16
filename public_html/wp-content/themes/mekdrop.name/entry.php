<?php

$latest_multisite_blog_items = null;// get_transient('latest_multisite_blog_items');

if (!$latest_multisite_blog_items) {

	$blogs = wp_get_sites( );

	$latest_multisite_blog_items = [];
	
	$posts = [];
	foreach($blogs as $blog){
		switch_to_blog($blog['blog_id']);
		foreach(get_posts('posts_per_page=10') as $post) {
			$posts[strtotime($post->post_date_gmt)] = [
				'id' => $post->ID,
				'blog_id' => $blog->blog_id,
				'comment_count' => $post->comment_count,
				'title' => $post->post_title,
				'date' => $post->post_date_gmt,
				'link' => get_permalink($post->ID),
				'img' => get_the_post_thumbnail_data($post->ID, [200, 200])
			];
		}
		restore_current_blog();
	}

	krsort($posts);
	$latest_multisite_blog_items = array_values(array_slice($posts, 0, 17));
	
	set_transient( 'latest_multisite_blog_items', $latest_multisite_blog_items );
}

$first = array_shift($latest_multisite_blog_items);

?>

<div class="row" id="frontpage_grid">
    <div class="col-md-3 col-sm-12 col-xs-12">
        <a href="<?php echo $first['link']; ?>">
			<div class="thumbnail">   
			<img src="<?php echo $first['img']['src']; ?>" class="img-rounded" alt="<?php echo $first['img']['alt']; ?>" />
			</div>
			<h4 class="text-center"><?php echo $first['title']; ?></h4>
        </a>
    </div>
    <div class="col-md-9 col-sm-12 col-xs-12">
        <div class="row latest-items">
			<?php 
				end($latest_multisite_blog_items);
				$last = key($latest_multisite_blog_items);
				reset($latest_multisite_blog_items);
				foreach ($latest_multisite_blog_items as $i => $post): ?>				
                <div class="col-md-3 col-sm-4 col-xs-12">
				<a href="<?php echo $post['link']; ?>" title="<?php echo htmlentities($post['title']); ?>" <?php if ($last == $i):?> class="hidden-sm"<?php endif; ?>>
				<div class="t">
					<div class="r">
					<div class="text-center c bg thumbnail" style="background-image: url('<?php echo $post['img']['src']; ?>');">
						<div class="thumbnail">                    
							<img src="<?php echo $post['img']['src']; ?>"  alt="<?php echo $post['img']['alt']; ?>" />
							</div>
						</div>
					</div>
					<div class="r">
						<div class="c">
						<h5 class="text-center"><?php echo $post['title']; ?></h5>
						</div>
					</div>
					</div>
					 </a>
                </div>
			<?php endforeach; ?>
        </div>
    </div>
</div>