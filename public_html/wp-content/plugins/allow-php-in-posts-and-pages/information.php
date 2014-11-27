<div class="appeal">
	<script src="http://connect.facebook.net/en_US/all.js#xfbml=1"></script>
	<div id="fb-root">
	</div>
	<h2>Developed by <a href='http://www.hitreach.co.uk' target="_blank" style='text-decoration:none;'>Hit Reach</a></h2>
	<p>Please check out our other <a href='http://www.hitreach.co.uk/services/wordpress-plugins/' target="_blank" class="external_link">WordPress Plugins</a></p>
	<p><a href='http://www.hitreach.co.uk/wordpress-plugins/allow-php-in-posts-and-pages/' target="_blank" class="external_link">Plugin Support, Comments &amp; Questions</a></p>
	<h2>Please help! We need your support...</h2>
	<p>If this plugin has helped you, your clients or customers then please take a moment to 'say thanks'. </p>
	<p>By spreading the word you help increase awareness of us and our plugins which makes it easier to justify the time we spend on this project.</p>
	<p>Please <strong>help us keep this plugin free</strong> to use and allow us to provide on-going updates and support.</p>
	<p>Here are some quick, easy and free things you can do which all help and we would really appreciate.</p>
	<ol class="waystohelp">
		<li> <strong>Promote this plugin on Twitter</strong><br/>
			<a href="http://twitter.com/home?status=I'm using the Allow PHP in Posts and Pages WordPress plugin by @hitreach and it rocks! You can download it here: http://bit.ly/e2Q4Az" target="_blank"> <img src='<?php echo plugins_url('twitter.gif', __FILE__)?>' border="0" width='55' height='20'/> </a> </li>
		<li><strong>Link to us</strong><br/>
			By linking to <a href='http://www.hitreach.co.uk' target="_blank">www.hitreach.co.uk</a> from your site or blog it means you can help others find the plugin on our site and also let Google know we are trust and link worthy which helps our profile. </li>
		<li> <strong>Like us on Facebook</strong><br/>
			Just visit <a href='http://www.facebook.com/webdesigndundee' target="_blank">www.facebook.com/webdesigndundee</a> and hit the 'Like!' button!
			<fb:like href="http://www.facebook.com/webdesigndundee" send="true" width="400" show_faces="false" action="like" font="verdana"></fb:like>
		</li>
		<li> <strong>Share this plugin on Facebook</strong><br/>
			<fb:like href="http://www.hitreach.co.uk/wordpress-plugins/allow-php-in-posts-and-pages" send="true" width="420" show_faces="false" action="recommend" font="verdana"></fb:like>
			Share a link to the plugin page with your friends on Facebook </li>
		<li> <strong>Make A Donation</strong><br/>
			Ok this one isn't really free but hopefully it's still a lot cheaper than if you'd had to buy the plugin or pay for it to be made for your project. Any amount is appreciated
			<form action="https://www.paypal.com/cgi-bin/webscr" method="post" target="_blank">
				<input type="hidden" name="cmd" value="_donations">
				<input type="hidden" name="business" value="admin@hitreach.co.uk">
				<input type="hidden" name="lc" value="GB">
				<input type="hidden" name="item_name" value="Hit Reach">
				<input type="hidden" name="item_number" value="APIP-Plugin">
				<input type="hidden" name="no_note" value="0">
				<input type="hidden" name="currency_code" value="GBP">
				<input type="hidden" name="bn" value="PP-DonationsBF:btn_donate_LG.gif:NonHostedGuest">
				<input type="image" src="https://www.paypalobjects.com/en_GB/i/btn/btn_donate_LG.gif" border="0" name="submit" alt="PayPal - The safer, easier way to pay online.">
				<img alt="" border="0" src="https://www.paypalobjects.com/en_US/i/scr/pixel.gif" width="1" height="1">
			</form>
		</li>
	</ol>
</div>
<div class='information'>
<p><strong>Allow PHP in posts and pages</strong> adds the functionality to include PHP in your WordPress posts and pages by adding a shortcode [php] your code [/php]</p>
<p>This plugin attempts to strip away the automatically generated wordpress &lt;p&gt; and &lt;br/&gt; tags but still allows the addition of your own &lt;p&gt; and &lt;br/&gt; tags using a form of BBcode items such [p][/p] and [br /]</p>
<p>You can also save your most used bits of code as snippets for use across multiple pages.</p>
<p>With Version 2.2, the older tag replacement system has been revamped, hopefully reducing the need to escape some characters for example: [ and ] that shouldnt be changed &amp;lt; and &amp;gt; </p>
<p>With Version 2.3 comes an experimental advanced filter feature which allows you to use standard php code while taking advantange of variables thoughout the entire post content, and functions, as well as no pesky tag replacement.</p>
<p>With Version 3 comes entirely re-written code with support for code snippets being used in conjunction with the advanced filter feature as well as a class variable to share variables between saved snippets and code blocks. This version also comes with UI updates.</p>
<h3>Usage</h3>
<p>Using the plugin couldn't be simpler; the plugin has 2 variants of shortcode available, <code>[php]</code> and <code>[allowphp]</code><em>other versions of the shortcode may exist but are not fully supported.</em></p>
<p> To add the PHP code to your post or page simply place any PHP code inside the shortcode tags as follows:</p>
<pre class='code'>
[php]
	global $user_ID;
	if($user_ID == 1){
		echo &quot;Hello World&quot;;
	}
[/php]
<em>This code will output Hello World to only user id #1, and no one else</em>
</pre>
<p>The shortcode can take a some additional attributes to assist with PHP writing</p>
<ul>
	<li><strong>"debug"</strong> - [1/0] - Turns on error reporting and display errors for snippets</li>
	<li><strong>"silentdebug" </strong>- [1/0] - When used with "debug" shows errors in the source code only</li>
	<li><strong>"mode"</strong> - ["old"/"new] - Maintained for backwards compatibility only - When set to "old" enables the pre version 2.2.0 code replacement system for that shortcode, when set to "new" with the preparse option enabled it uses the newer code replacement system for that shortcode</li>
</ul>
<h4>Code Snippets</h4>
<p>In addition to these attributes, a new one has been added called &quot;function&quot;. The function attribute allows the addition of user defined code snippets into the content. The shortcode for snippets is &lt;code&gt;[php function=x]&lt;/code&gt; or &lt;code&gt;[allowphp function=x]&lt;/code&gt;</p>
<p>To integrate the snippets with the advanced filter, the shortcode should not contain any additional attributes or spaces</p>
<p>Code snippets can be added in the plugin's options page and can be re-used on as many pages as you like</p>

<h4>Advanced Filter</h4>
<p>The advanced filter is the newest feature of the plugin.</p>
<p>It allows the user to write standard html directly into the html post editor without needing tag replacements.</p>
<p>There are 2 ways to enable the Advanced Filter, the easiest way is to enable it in the plugin options page, the other way is to add &quot;useadvancedfilter&quot;onto the standard shortcode to use it on a shortcode by shortcode basis:</p>
<p><code>[php useadvancedfilter]...[/php useadvancedfilter]</code> or <code>[allowphp useadvancedfilter]...[/allowphp useadvancedfilter]</code></p>
<h4>Variable Sharing</h4>
<p>The plugin class contains an array with can be used to share variables around the page, between blocks of php code anywhere.</p>
<p>Variable delarations can be made by accessing the global variable $allow_php as follows:</p>
<pre class='code'>
[php]
	global $allow_php;
	$allow_php->_shared['my_key'] = 'my value';
[/php]
<em>This code will set "my value" to index "my_key" within the shared array</em>
[php]
	global $allow_php;
	echo $allow_php->_shared['my_key'];
[/php]
<em>This code will output the index "my_key" within the shared array</em>
</pre>
<p>This can be useful for passing post information to the sidebar :)</p>
<p>For more information about the plugin or for any question please go to the <a class="external_link" target="_blank" href="http://www.hitreach.co.uk/wordpress-plugins/allow-php-in-posts-and-pages/">plugin support page</a></p>
</div>