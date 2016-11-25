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
				'img' => get_the_post_thumbnail_data($post->ID, [1100, 1100])
			];
		}
		restore_current_blog();
	}

	krsort($posts);
	$latest_multisite_blog_items = array_values(array_slice($posts, 0, 17));
	
	set_transient( 'latest_multisite_blog_items', $latest_multisite_blog_items );
}

?>
<script type="text/javascript">
	var qfunc = {
		removeStdClass: function (newObj, oldObj) {
				newObj.removeClass('hidden');
				oldObj.removeClass('visible');
				oldObj.removeClass('appear');
				newObj.removeClass('disappear');
				oldObj.removeClass('up');
				newObj.removeClass('down');
		}
	};
	var action_roles = {
		moveUp: function () {
				var cindex = $('#frontpage-tool').data('index') - 1;
				if (cindex < 0) {
					cindex = 0;
					return;
				}
				$('#frontpage-tool').data('index', cindex);
				var newObj = $('#frontpage-tool h3[data-index="' + cindex + '"]');
				var oldObj = $('#frontpage-tool h3[data-index="' + (cindex + 1) + '"]');
				qfunc.removeStdClass(newObj, oldObj);
				newObj.addClass('animate');
				newObj.addClass('up');
				newObj.addClass('appear');
				oldObj.addClass('animate');
				oldObj.addClass('up');
				oldObj.addClass('disappear');
				$('#frontpage-tool button').attr('disabled', 'disabled');
				setTimeout(function () {
					$('#frontpage-tool button').removeAttr('disabled');
					if (cindex == 0) { 
						$('[data-role="moveUp"]').attr('disabled', 'disabled');
					}
					oldObj.addClass('hidden');
				}, 800);
			},
		moveDown: function() {
			var cindex = $('#frontpage-tool').data('index') + 1;
			if (cindex > ($('#frontpage-tool h3').length - 1)) {
				cindex = $('#frontpage-tool h3').length - 1;
				return;
			}
			$('#frontpage-tool').data('index', cindex);
			var newObj = $('#frontpage-tool h3[data-index="' + cindex + '"]');
			var oldObj = $('#frontpage-tool h3[data-index="' + (cindex - 1) + '"]');
			qfunc.removeStdClass(newObj, oldObj);
			newObj.addClass('animate');
			newObj.addClass('down');
			newObj.addClass('appear');
			oldObj.addClass('animate');
			oldObj.addClass('down');
			oldObj.addClass('disappear');
			$('#frontpage-tool button').attr('disabled', 'disabled');
			setTimeout(function () {
				$('#frontpage-tool button').removeAttr('disabled');
				if (cindex == (($('#frontpage-tool h3').length - 1))) { 
					$('[data-role="moveDown"]').attr('disabled', 'disabled');
				}
				oldObj.addClass('hidden');
			}, 800);
		}
	};

	$(function () {
		$('[data-role]').each(function () {
			var obj = $(this);
			obj.click(action_roles[obj.data('role')]);
		});
		$('[data-role="moveUp"]').attr('disabled', 'disabled');
    });
</script>

<div id="frontpage-tool" class="content" data-index="0">
		<div class="nav">
			<div class="content">
				<button type="button" class="btn btn-default" data-role="moveUp"><i class="fa fa-arrow-up"></i></button>
				<button type="button" class="btn btn-default" data-role="moveDown"><i class="fa fa-arrow-down"></i></button>
			</div>
		</div>
	<div class="cnt">
	<?php foreach ($latest_multisite_blog_items as $i => $post): ?>
		<h3 data-index="<?php echo $i; ?>" class="<?php echo ($i === 0)?'visible':'hidden'; ?>">
			<a href="<?php echo $post['link']; ?>"> 
				<img src="<?php echo $post['img']['src']; ?>" class="img-rounded img-responsive" alt="<?php echo $post['img']['alt']; ?>" />
				<div class="title"><?php echo $post['title']; ?></div>
			</a>
		</h3>
	<?php endforeach; ?>
	</div>
</div>

<!-- <div class="row" id="frontpage_grid">
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
</div> -->