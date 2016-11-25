<?php

error_reporting(0);
ini_set('error_reporting', 0);

/* ------- Adding a custom menu ------- */
add_theme_support('menus');

add_action( 'init', 'register_my_menus' );

function register_my_menus() {
	register_nav_menus(
		array(
			'menu-1' => __( 'Menu 1' ),
		)
	);
}

/* ------- Register sidebar ------- */
if ( function_exists('register_sidebars') )
    register_sidebars(1);


/* ------- Show Featured Images ------- */
add_theme_support( 'post-thumbnails' );




/* ------- Functions ------- */

function post_image_thumbnail() {
	global $post;
    if (has_post_thumbnail($post->ID)) {
        $image = wp_get_attachment_image_src( get_post_thumbnail_id( $post->ID ), 'thumbnail' );
        echo '<a href="'.get_permalink().'" rel="bookmark" title="'.get_the_title().'"><img src="'.$image[0].'" alt="'.get_the_title().'" /></a>';
    }
    else {
        echo '<a href="'.get_permalink().'" rel="bookmark" title="'.get_the_title().'">'.zt_get_thumbnail().'</a>';
    }
}

function featured_post_image() {
    if (has_post_thumbnail($post->ID)) {
        $image = wp_get_attachment_image_src( get_post_thumbnail_id( $post->ID ), 'single-post-thumbnail' );
        echo '<a href="'.get_permalink().'" rel="bookmark" title="'.get_the_title().'"><img src="'.get_bloginfo("template_directory").'/timthumb.php?src='.$image[0].'&amp;w=214&amp;h=160" alt="'.get_the_title().'" /></a>';
    }
    else if (imagesrc()) {
        echo '<a href="'.get_permalink().'" rel="bookmark" title="'.get_the_title().'"><img src="'.get_bloginfo("template_directory").'/timthumb.php?src='.imagesrc().'&amp;w=214&amp;h=160" alt="'.get_the_title().'" /></a>';
    }
}

function limits($max_char, $more_link_text = '(more...)', $stripteaser = 0, $more_file = '') {
    $content = get_the_content($more_link_text, $stripteaser, $more_file);
    $content = apply_filters('the_content', $content);
    $content = str_replace(']]>', ']]&gt;', $content);
	$content = strip_tags($content, '');

   if (strlen($_GET['p']) > 0) {
      echo $content;
   }
   else if ((strlen($content)>$max_char) && ($espacio = strpos($content, " ", $max_char ))) {
        $content = substr($content, 0, $espacio);
        $content = $content;
        echo $content;

        echo "...";
        echo "<div class=";
		echo "'continue-reading'>";
		echo "<a href='";
        the_permalink();
        echo "'>".$more_link_text."</a></div>";
   }
   else {
      echo $content;
   }
}
function limits2($max_char, $more_link_text = '(more...)', $stripteaser = 0, $more_file = '') {
    $content = get_the_content($more_link_text, $stripteaser, $more_file);
    $content = apply_filters('the_content', $content);
    $content = str_replace(']]>', ']]&gt;', $content);
	$content = strip_tags($content, '');

   if (isset($_GET['p']) && strlen($_GET['p']) > 0) {
      echo $content;
   }
   else if ((strlen($content)>$max_char) && ($espacio = strpos($content, " ", $max_char ))) {
        $content = substr($content, 0, $espacio);
        $content = $content;
        echo $content;

        echo "...";
   }
   else {
      echo $content;
   }
}
function zt_get_thumbnail($postid=0, $size='thumbnail', $attributes='') {
	if ($postid<1) $postid = get_the_ID();
	if ($images = get_children(array(
		'post_parent' => $postid,
		'post_type' => 'attachment',
		'numberposts' => 1,
		'post_mime_type' => 'image', )))
		foreach($images as $image) {
			$thumbnail=wp_get_attachment_image_src($image->ID, $size);
			?>
<img src="<?php echo $thumbnail[0]; ?>" <?php echo $attributes; ?> alt="<?php the_title(); ?>" />
<?php
		}
	else {
?>
<img src="<?php bloginfo('template_directory'); ?>/images/noimage.jpg" alt="<?php the_title(); ?>" />
<?php
	}
	
}
function imagesrc() {
global $post, $posts;
$first_img = '';
ob_start();
ob_end_clean();
$output = preg_match_all('/<img.+src=[\'"]([^\'"]+)[\'"].*>/i', $post->post_content, $matches);
$first_img = $matches [1] [0];
if (!($first_img))
{
	$attachments = get_children(array('post_parent' => get_the_ID(), 'post_type' => 'attachment', 'post_mime_type' => 'image', 'orderby' => 'menu_order'));
if (is_array($attachments))
	{
	$count = count($attachments);
	$first_attachment = array_shift($attachments);
	$imgsrc = wp_get_attachment_image_src($first_attachment->ID, 'large');
	$first_img = $imgsrc[0];
	}
}
return $first_img;
}
?>
<?php

/* ------- Theme Options ------- */

$themename = "Azsimple";
$shortname = "azs";
$options = array (

array(
"name" => "Azsimple Theme Options",
"type" => "title"),

array(
"type" => "open"),

array(
"name" => "Logo URL",
"desc" => "Enter the logo URL. Maximum logo width = 400px. Maximum logo height = 50px.",
"id" => $shortname."_logourl",
"std" => "http://azmind.com/wp-themes-demo2/wp-content/themes/azsimple/images/logo.jpg",
"type" => "text"),

array(
"name" => "Favicon URL",
"desc" => "Enter the favicon URL",
"id" => $shortname."_favicon",
"std" => "http://azmind.com/wp-themes-demo2/wp-content/themes/azsimple/images/favicon.ico",
"type" => "text"),

array(
"name" => "Featured Posts Category",
"desc" => "Enter the name of the category that contains the featured posts",
"id" => $shortname."_featuredcat",
"std" => "Uncategorized",
"type" => "text"),

array(
"name" => "Random Featured Posts Category",
"desc" => "Display posts from a random category",
"id" => $shortname."_randomcat",
"type" => "checkbox"),

array(
"name" => "Number of Featured Posts",
"desc" => "Enter the number of featured posts you want to show",
"id" => $shortname."_featurednr",
"std" => 4,
"type" => "text"),

array(
"name" => "Facebook URL",
"desc" => "Enter your Facebook URL: http://....",
"id" => $shortname."_facebook",
"std" => "http://www.facebook.com/pages/Azmindcom/196582707093191",
"type" => "text"),

array(
"name" => "Twitter ID",
"desc" => "Enter your Twitter ID",
"id" => $shortname."_twitter",
"std" => "anli_zaimi",
"type" => "text"),

array(
"name" => "Number of Tweets",
"desc" => "Enter the number of tweets you want to show in the footer",
"id" => $shortname."_tweetsnr",
"std" => 4,
"type" => "text"),

array(
"name" => "Feedburner ID",
"desc" => "Enter your Feedburner ID",
"id" => $shortname."_feedburner",
"std" => "Azmind",
"type" => "text"),

array(
"name" => "About Us",
"desc" => "Enter a short presentation text",
"id" => $shortname."_aboutus",
"std" => "Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Quisque sed felis. Aliquam sit amet felis. Mauris semper, velit semper laoreet dictum, <a href='http://azmind.com'>quam diam</a> dictum urna, nec placerat elit nisl in quam.
<br />Etiam augue pede, molestie eget, rhoncus at, convallis ut, eros. Aliquam pharetra. Nulla in tellus eget odio sagittis blandit. Maecenas at nisl.",
"type" => "textarea"),

array(
"name" => "Header Advertising 468x60",
"desc" => "Enter advertising code",
"id" => $shortname."_ads468x60",
"std" => "<img src='http://azmind.com/wp-themes-demo2/wp-content/themes/azsimple/images/header-advertising.jpg' alt='advertising' />",
"type" => "textarea"),

array(
"name" => "Sidebar Advertising",
"desc" => "Enter advertising code",
"id" => $shortname."_ads125x125",
"std" => "<img src='http://azmind.com/wp-themes-demo2/wp-content/themes/azsimple/images/sidebar-advertising.jpg' alt='advertising' /> <img src='http://azmind.com/wp-themes-demo2/wp-content/themes/azsimple/images/sidebar-advertising.jpg' alt='advertising' />",
"type" => "textarea"),


array(
"type" => "close")

);

/* ------- Add a Theme Options Page ------- */
function mytheme_add_admin() {

    global $themename, $shortname, $options;

    if ( isset($_GET['page']) && $_GET['page'] == basename(__FILE__) ) {

        if ( 'save' == $_REQUEST['action'] ) {

                foreach ($options as $value) {
                    update_option( $value['id'], $_REQUEST[ $value['id'] ] ); }

                foreach ($options as $value) {
                    if( isset( $_REQUEST[ $value['id'] ] ) ) { update_option( $value['id'], $_REQUEST[ $value['id'] ]  ); } else { delete_option( $value['id'] ); } }

                header("Location: themes.php?page=functions.php&saved=true");
                die;

        } else if( 'reset' == $_REQUEST['action'] ) {

            foreach ($options as $value) {
                delete_option( $value['id'] ); }

            header("Location: themes.php?page=functions.php&reset=true");
            die;

        }
    }

    add_theme_page($themename." Options", "".$themename." Options", 'edit_themes', basename(__FILE__), 'mytheme_admin');

}

function mytheme_admin() {

    global $themename, $shortname, $options;

    if ( $_REQUEST['saved'] ) echo '<div id="message" class="updated fade"><p><strong>'.$themename.' settings saved.</strong></p></div>';
    if ( $_REQUEST['reset'] ) echo '<div id="message" class="updated fade"><p><strong>'.$themename.' settings reset.</strong></p></div>';

?>
<div class="wrap" style="margin:0 auto; padding:20px 0px 0px;">

<form method="post">

<?php foreach ($options as $value) {
switch ( $value['type'] ) {

case "open":
?>
<div style="width:808px; background:#eee; border:1px solid #ddd; padding:20px; overflow:hidden; display: block; margin: 0px 0px 30px;">

<?php break;

case "close":
?>

</div>

<?php break;

case "misc":
?>
<div style="width:808px; background:#fffde2; border:1px solid #ddd; padding:20px; overflow:hidden; display: block; margin: 0px 0px 30px;">
	<?php echo $value['name']; ?>
</div>
<?php break;

case "title":
?>

<div style="width:810px; height:22px; background:#555; padding:9px 20px; overflow:hidden; margin:0px; font-family:Verdana, sans-serif; font-size:18px; font-weight:normal; color:#EEE;">
	<?php echo $value['name']; ?>
</div>

<?php break;

case 'text':
?>

<div style="width:808px; padding:0px 0px 10px; margin:0px 0px 10px; border-bottom:1px solid #ddd; overflow:hidden;">
	<span style="font-family:Arial, sans-serif; font-size:16px; font-weight:bold; color:#444; display:block; padding:5px 0px;">
		<?php echo $value['name']; ?>
	</span>
	<?php if ($value['image'] != "") {?>
		<div style="width:808px; padding:10px 0px; overflow:hidden;">
			<img style="padding:5px; background:#FFF; border:1px solid #ddd;" src="<?php bloginfo('template_url');?>/images/<?php echo $value['image'];?>" alt="image" />
		</div>
	<?php } ?>
	<input style="width:200px;" name="<?php echo $value['id']; ?>" id="<?php echo $value['id']; ?>" type="<?php echo $value['type']; ?>" value="<?php if ( get_option( $value['id'] ) != "") { echo stripslashes(get_settings( $value['id'] )); } else { echo stripslashes($value['std']); } ?>" />
	<br/>
	<span style="font-family:Arial, sans-serif; font-size:11px; font-weight:bold; color:#444; display:block; padding:5px 0px;">
		<?php echo $value['desc']; ?>
	</span>
</div>

<?php
break;

case 'textarea':
?>

<div style="width:808px; padding:0px 0px 10px; margin:0px 0px 10px; border-bottom:1px solid #ddd; overflow:hidden;">
	<span style="font-family:Arial, sans-serif; font-size:16px; font-weight:bold; color:#444; display:block; padding:5px 0px;">
		<?php echo $value['name']; ?>
	</span>
	<?php if ($value['image'] != "") {?>
		<div style="width:808px; padding:10px 0px; overflow:hidden;">
			<img style="padding:5px; background:#FFF; border:1px solid #ddd;" src="<?php bloginfo('template_url');?>/images/<?php echo $value['image'];?>" alt="image" />
		</div>
	<?php } ?>
	<textarea name="<?php echo $value['id']; ?>" style="width:400px; height:200px;" type="<?php echo $value['type']; ?>" cols="" rows=""><?php if ( get_option( $value['id'] ) != "") { echo stripslashes(get_settings( $value['id'] )); } else { echo stripslashes($value['std']); } ?></textarea>
	<br/>
	<span style="font-family:Arial, sans-serif; font-size:11px; font-weight:bold; color:#444; display:block; padding:5px 0px;">
		<?php echo $value['desc']; ?>
	</span>
</div>

<?php
break;

case 'select':
?>

<div style="width:808px; padding:0px 0px 10px; margin:0px 0px 10px; border-bottom:1px solid #ddd; overflow:hidden;">
	<span style="font-family:Arial, sans-serif; font-size:16px; font-weight:bold; color:#444; display:block; padding:5px 0px;">
		<?php echo $value['name']; ?>
	</span>
	<?php if ($value['image'] != "") {?>
		<div style="width:808px; padding:10px 0px; overflow:hidden;">
			<img style="padding:5px; background:#FFF; border:1px solid #ddd;" src="<?php bloginfo('template_url');?>/images/<?php echo $value['image'];?>" alt="image" />
		</div>
	<?php } ?>
		<select style="width:240px;" name="<?php echo $value['id']; ?>" id="<?php echo $value['id']; ?>">
	<?php foreach ($value['options'] as $option_value => $option_text) { 
	   $checked = ' ';
        if (isset($value['id']) && get_option($value['id']) == $option_text) {
            $selected = ' selected="selected" ';
        }
        else if (isset($value['id']) && get_option($value['id']) === FALSE && $value['std'] == $option_text){
            $selected = ' selected="selected" ';
        }
        else {
            $selected = ' ';
        }
    ?>
    <option <?php echo "value=".$option_text." ".$selected; ?> ><?php echo $option_text; ?></option>
	<?php } ?>
    </select>
	<br/>
	<span style="font-family:Arial, sans-serif; font-size:11px; font-weight:bold; color:#444; display:block; padding:5px 0px;">
		<?php echo $value['desc']; ?>
	</span>
</div>

<?php
break;

case "checkbox":
?>

<div style="width:808px; padding:0px 0px 10px; margin:0px 0px 10px; border-bottom:1px solid #ddd; overflow:hidden;">
	<span style="font-family:Arial, sans-serif; font-size:16px; font-weight:bold; color:#444; display:block; padding:5px 0px;">
		<?php echo $value['name']; ?>
	</span>
	<?php if ($value['image'] != "") {?>
		<div style="width:808px; padding:10px 0px; overflow:hidden;">
			<img style="padding:5px; background:#FFF; border:1px solid #ddd;" src="<?php bloginfo('template_url');?>/images/<?php echo $value['image'];?>" alt="image" />
		</div>
	<?php } ?>
	<?php if(get_option($value['id'])){ $checked = "checked=\"checked\""; }else{ $checked = "";} ?>
	<input type="checkbox" name="<?php echo $value['id']; ?>" id="<?php echo $value['id']; ?>" value="true" <?php echo $checked; ?> />
	<br/>
	<span style="font-family:Arial, sans-serif; font-size:11px; font-weight:bold; color:#444; display:block; padding:5px 0px;">
		<?php echo $value['desc']; ?>
	</span>
</div>


<?php
break;

case "submit":
?>

<p class="submit">
<input name="save" type="submit" value="Save changes" />
<input type="hidden" name="action" value="save" />
</p>

<?php break;
}
}
?>

<p class="submit">
<input name="save" type="submit" value="Save changes" />
<input type="hidden" name="action" value="save" />
</p>
</form>
<form method="post">
<p class="submit">
<input name="reset" type="submit" value="Reset" />
<input type="hidden" name="action" value="reset" />
</p>
</form>

<?php
}
function mytheme_wp_head() { ?>
<?php }
add_action('wp_head', 'mytheme_wp_head');
add_action('admin_menu', 'mytheme_add_admin'); ?>
