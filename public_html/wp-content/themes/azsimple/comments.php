<div id="comments-wrap">
<?php // Do not delete these lines
	if (!empty($_SERVER['SCRIPT_FILENAME']) && 'comments.php' == basename($_SERVER['SCRIPT_FILENAME']))
		die ('Please do not load this page directly. Thanks!');

	if ( post_password_required() ) { ?>
		<p class="nocomments">Šis įrašas prieinamas tik tiems, kurie žino slaptažodį. Jei žinai, įvesk.</p>
	<?php
		return;
	}
?>

<!-- You can start editing here. -->
<?php // Begin Comments & Trackbacks ?>
<?php if ( have_comments() ) : ?>
<h3 id="comments-number"><?php comments_number('No Comments', 'One Comment', '% Comments' );?> to &#8220;<?php the_title(); ?>&#8221;</h3>

<ol class="commentlist">
	<?php wp_list_comments(); ?>
</ol>

	<div class="comments-navigation">
		<div class="alignleft"><?php previous_comments_link() ?></div>
		<div class="alignright"><?php next_comments_link() ?></div>
	</div>

<?php // End Comments ?>

 <?php else : // this is displayed if there are no comments so far ?>

	<?php if ('open' == $post->comment_status) : ?>
		<!-- If comments are open, but there are no comments. -->

	 <?php else : // comments are closed ?>
		<!-- If comments are closed. -->
		<p><?php /* _e('Sorry, the comment form is closed at this time.'); */ ?></p>

	<?php endif; ?>
<?php endif; ?>

<?php if ('open' == $post->comment_status) : ?>

<div id="respond">

<h3 class="postcomment"><?php comment_form_title( 'Palik komentarą', 'Pakomentuok %s išsakytas mintis' ); ?></h3>

<div class="cancel-comment-reply">
	<small><?php cancel_comment_reply_link(); ?></small>
</div>

<?php if ( get_option('comment_registration') && !$user_ID ) : ?>
<p>Tu turi būti <a href="<?php echo get_option('siteurl'); ?>/wp-login.php?redirect_to=<?php echo urlencode(get_permalink()); ?>">prisijungęs(-usi)</a>, kad parašytum komentarą.</p>

<?php else : ?>

<form action="<?php echo get_option('siteurl'); ?>/wp-comments-post.php" method="post" id="commentform">

	<?php if ( $user_ID ) : ?>

<p>Prisijungęs(-usi) kaip <a href="<?php echo get_option('siteurl'); ?>/wp-admin/profile.php"><?php echo $user_identity; ?></a>. <a href="<?php echo wp_logout_url(get_permalink()); ?>" title="Log out of this account">Atsijungti &raquo;</a></p>

	<?php else : ?>

	<p>
	<input type="text" name="author" id="author" class="textarea" value="<?php echo $comment_author; ?>" size="28" tabindex="1" />
	<label for="author"><?php _e('Name'); ?></label> <?php if ($req) _e('*'); ?>
	</p>

	<p>
	<input type="text" name="email" id="email" value="<?php echo $comment_author_email; ?>" size="28" tabindex="2" class="textarea" />
	<label for="email"><?php _e('E-mail'); ?></label> <?php if ($req) _e('*'); ?>
	</p>

	<p>
	<input type="text" name="url" id="url" value="<?php echo $comment_author_url; ?>" size="28" tabindex="3" class="textarea" />
	<label for="url"><?php _e('<acronym title="Uniform Resource Identifier">URI</acronym>'); ?></label>
	</p>

	<?php endif; ?>

	<p>
	<textarea name="comment" id="comment" cols="60" rows="10" tabindex="4" class="textarea"></textarea>
	</p>

	<p>
	<input name="submit" id="submit" type="submit" tabindex="5" value="<?php _e('Submit Comment'); ?>" class="Cbutton" />
	<?php comment_id_fields(); ?>
	</p>
	<?php do_action('comment_form', $post->ID); ?>
</form>
<?php endif; ?>
</div>
<?php else : // Comments are closed ?>
<p><?php /*_e('Sorry, the comment form is closed at this time.');/**/ ?></p>
<?php endif; ?>
</div>
