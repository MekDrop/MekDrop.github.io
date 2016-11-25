<?php

// source: https://wordpress.org/support/topic/how-to-return-the-basic-url-of-a-thumbnail?replies=12
function get_the_post_thumbnail_data($intID, $size) {
    $objDom = new SimpleXMLElement(get_the_post_thumbnail($intID, $size));
    $arrDom = (array)$objDom;
    return (array)$arrDom['@attributes'];
}

global $wpdb;
$blogs = $wpdb->get_results($wpdb->prepare("SELECT * FROM $wpdb->blogs WHERE spam = '0' AND deleted = '0' and archived = '0' and public='1'"));
if(!empty($blogs)){
	$original_blog_id = get_current_blog_id();
	$posts = [];
    foreach($blogs as $blog){
		if ($blog->domain == 'mekdrop.name') {
			continue;
		}
		switch_to_blog($blog->blog_id);
		foreach(get_posts('posts_per_page=10') as $post) {
			$posts[strtotime($post->post_date_gmt)] = [
				'id' => $post->ID,
				'blog_id' => $blog->blog_id,
				'comment_count' => $post->comment_count,
				'title' => $post->post_title,
				'date' => $post->post_date_gmt
			];
		}
	}
	krsort($posts);
	$posts = array_slice($posts, 0, 16);
	echo '<ul class="latest_items">';
	$first = true;
	foreach ($posts as $post) {
		switch_to_blog($post['blog_id']);
		echo '<li title="'.$post['title'].'">';
		if ($first) {
			echo '<span class="last_post"> Paskutinis įrašas: <span class="date">' . date('Y.m.d', strtotime($post['date']))  . '</span></span>';
		}
		$img = get_the_post_thumbnail_data($post['id'], $first?array(200, 200):array(100, 100));
		echo '<a href="' .  get_permalink($post['id']) . '">';
		echo '<span class="image" style="background-image: url(\''.$img['src'].'\');"></span>';
		echo '<span class="title">'.$post['title'].'</span>';
		echo '<span class="comment-count" data-count="' . $post['comment_count'] . '">' . $post['comment_count'] . '</span>';
		echo '</a>';
		echo '</li>';
		if ($first) {
			$first = false;
		}
	}
	echo '</ul>';
	switch_to_blog( $original_blog_id );
}
/*

global $wpdb;
$blogs = $wpdb->get_results($wpdb->prepare("SELECT * FROM $wpdb->blogs WHERE spam = '0' AND deleted = '0' and archived = '0' and public='1'"));
$feeds = [];
if(!empty($blogs)){
    foreach($blogs as $blog){
        $details = get_blog_details($blog->blog_id);
        if($details != false){
            $addr = $details->siteurl;
            $name = $details->blogname;
			$feeds[] = $addr . '/feed/';
        }
    }
}

$icon= [
	'stories' => 'book',
	'blog' => 'pencil',
	'tools' => 'archive'
];

$rss = fetch_feed($feeds);
$count = 10;
if ( ! is_wp_error( $rss ) ) {
	$maxitems = $rss->get_item_quantity( $count );
    $rss_items = $rss->get_items( 0, $maxitems );
	?>
	<ul class="latest-list">
	<?php
    foreach ($rss_items as $item) {		
		$subdomain = current(explode('.', parse_url($item->get_permalink(), PHP_URL_HOST)));
		?>
			<li class="<?php echo $subdomain; ?>">
				<h2><i class="fa fa-<?php echo $icon[$subdomain]; ?>"></i> <a href="<?php echo $item->get_permalink(); ?>"><?php echo $item->get_title(); ?></a></h2>
			</li>
		<?php
	}
	?>
	</ul>
	<?php
}
*/
