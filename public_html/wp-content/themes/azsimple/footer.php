<?php
global $options;
foreach ($options as $value) {
	if (!isset($value['id'])) {
		continue;
	}
	if (get_option( $value['id'] ) === FALSE) {
		$$value['id'] = isset($value['std'])?$value['std']:null;
	}
	else {
		$$value['id'] = get_option( $value['id'] );
	}
}
?>

		<div id="footer">

			<div class="about-us">
				<h2>Apie</h2>
				<p><?php echo stripslashes($azs_aboutus); ?></p>
			</div> <!-- about-us -->

			<div class="donate">
				<h2>Aktyvumas internete</h2>
                                <ul class="social-activity">
				<?php
                                
  include_once __DIR__ . '/mk/feeds.php';
  $items = mkFeeds::fetch(3);
  if (empty($items)) {
      ?><li class="empty">Naujų įrašų nerasta</li><?php
  } else {
      foreach ( $items as $item ) {
          extract($item);          
          ?>
      <li>
          <p><span class="<?php echo esc_html( $class ); ?>"></span>
          <a href="<?php echo esc_url( $url ); ?>" data-subscribe-url="<?php echo esc_url( $subscribe_url ); ?>">
              <?php echo esc_html( $title ); ?>              
          </a></p>
      </li>
      <?php
      }
  }
  ?>
                                </ul>
			</div> 

			<div class="subscribe">
                		<h2>Užsisakyk naujienlaikraštį</h2>
										<?php if (!strstr($_SERVER['SERVER_NAME'], 'about') && !strstr($_SERVER['SERVER_NAME'], 'tools')) { ?>
				<p>Įvesk savo elektroninio pašto adresą, kad gautum naujausius atnaujinimus:</p>
				<form action="http://feedburner.google.com/fb/a/mailverify" class="feedburner" method="post" target="popupwindow" onsubmit="window.open('http://feedburner.google.com/fb/a/mailverify?uri=<?php echo $azs_feedburner; ?>', 'popupwindow', 'scrollbars=yes,width=550,height=520');return true">
				<input type="text" name="email" class="enteremail" value="Įvesk savo e-pašto adresą" onfocus="if (this.value == 'Įvesk savo e-pašto adresą') {this.value = '';}" onblur="if (this.value == '') {this.value = 'Įvesk savo e-pašto adresą';}" /><input type="hidden" value="<?php echo $azs_feedburner; ?>" name="uri"/><input type="hidden" name="loc" value="en_US"/>
				<input type="submit" value="Užsisakyk" class="formsubmit" />
				</form>
				<?php } else { ?>
					<p>Deja, apie MekDrop'ą naujielaikraščio užsisakyti neįmanoma, bet galima užsisakyti kitus su jo tekstais - tereikia užsukti į atitinkamą tinklalapio dalį (jos išvardintos pačiame puslapio viršuje)</p>
				<?php } ?>
			</div> <!-- subscribe -->

			<div id="footer-credits">
				<div class="footer-credits-left">
					&#169; 2009 - <?php echo date('Y'); ?> <strong>MekDrop.Name</strong>
				</div>
				<div class="footer-credits-right">
					Naudojamas <a href="http://www.wordpress.org">Wordpress</a> su Azsimple tema, sukurta <a href="http://azmind.com" title="Free Wordpress Themes and Web Design Resources">Azmind.com</a>
				</div>
			</div>

		</div> <!-- footer -->

	</div> <!-- content -->

	<?php wp_footer(); ?>
	
	<!-- Piwik -->
	<script type="text/javascript"> 
	  var _paq = _paq || [];
	    _paq.push(['trackPageView']);
	      _paq.push(['enableLinkTracking']);
	        (function() {
	            var u=(("https:" == document.location.protocol) ? "https" : "http") + "://stats.mekdrop.name//";
	                _paq.push(['setTrackerUrl', u+'piwik.php']);
	                    _paq.push(['setSiteId', 1]);
	                        var d=document, g=d.createElement('script'), s=d.getElementsByTagName('script')[0]; g.type='text/javascript';
	                            g.defer=true; g.async=true; g.src=u+'piwik.js'; s.parentNode.insertBefore(g,s);
	                              })();
	                              
	                              </script>
	                              <noscript><p><img src="http://stats.mekdrop.name/piwik.php?idsite=1" style="border:0" alt="" /></p></noscript>
	                              <!-- End Piwik Code --> 
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
<img src="//pixel.quantserve.com/pixel/p-fdGfTv6Zf57VB.gif" border="0" height="1" width="1" alt="Quantcast"/>
</div>
</noscript>
<!-- End Quantcast tag -->
</body>
</html>
