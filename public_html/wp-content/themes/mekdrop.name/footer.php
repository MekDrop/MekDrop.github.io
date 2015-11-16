<?php
	$current_url = urlencode(home_url(add_query_arg(array(),$wp->request)));
?>
		</div></div>
		<footer class="container">				
				<div class="block pull-right text-nowrap">
					<strong class="hidden-xs">Sek mane:</strong>
					<a href="https://twitter.com/mekdrop" target="_blank">
						<i class="fa fa-twitter"></i>
					</a>
					<a href="http://www.facebook.com/mekdrop" target="_blank">
						<i class="fa fa-facebook"></i>
					</a>
					<a href="https://plus.google.com/+RaimondasRimkevičius" target="_blank">
						<i class="fa fa-google-plus"></i>
					</a>
					<a href="http://www.linkedin.com/in/mekdrop" target="_blank">
						<i class="fa fa-linkedin"></i>
					</a>				

<?php if (get_option( 'disable_feeds_redirect', null ) === null): ?>
<span class="dropup">
  <button class="btn btn-default dropdown-toggle btn-xs" type="button" id="dropdownMenu2" data-toggle="dropdown" aria-expanded="true">
    <i class="fa fa-rss-square"></i>
    <span class="caret"></span>
  </button>
  <ul class="dropdown-menu dropdown-menu-right" role="menu" aria-labelledby="dropdownMenu2">
			<li role="presentation" class="rss"><a role="menuitem" tabindex="-1" href="<?php bloginfo('rss2_url'); ?>" title="<?php _e('Syndicate this site using RSS'); ?>"><?php _e('<abbr title="Really Simple Syndication">RSS</abbr>'); ?></a></li>
			<li role="presentation" class="atom"><a role="menuitem" tabindex="-1" href="<?php bloginfo('atom_url'); ?>" title="<?php _e('Syndicate this site using Atom'); ?>"><?php _e('Atom'); ?></a></li>
			<li role="presentation" class="rss"><a role="menuitem" tabindex="-1" href="<?php bloginfo('comments_rss2_url'); ?>" title="<?php _e('The latest comments to all posts in RSS'); ?>"><?php _e('Comments <abbr title="Really Simple Syndication">RSS</abbr>'); ?></a></li>

  </ul>
</span>
<?php endif; ?>

					
						
				</div>
				<div class="block">
					&copy; 2009 - <?php echo date('Y'); ?>	<strong>MekDrop.Name</strong>
				</div>
      </footer>

	<?php wp_footer(); ?>
	
<!-- Quantcast Tag -->
<script type="text/javascript">
var _qevents = _qevents || [];

(function() {
var elem = document.createElement('script');
elem.src = (document.location.protocol == "https:" ? "https://secure" : "http://edge") + ".quantserve.com/quant.js";
elem.async = true;
elem.type = "text/javascript";
var scpt = document.getElementsByTagName('script')[0];
scpt.parentNode.insertBefore(elem, scpt);
})();

_qevents.push({
qacct:"p-fdGfTv6Zf57VB"
});
</script>

<noscript>
<div style="display:none;">
<img src="//pixel.quantserve.com/pixel/p-fdGfTv6Zf57VB.gif" style="border:0" height="1" width="1" alt="Quantcast"/>
</div>
</noscript>
<!-- End Quantcast tag -->
</body>
</html>
