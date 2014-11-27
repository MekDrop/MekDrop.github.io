=== Allow PHP in Posts and Pages ===
Contributors: Hit Reach, JamieFraser
Donate link: 
Tags: post, pages, posts, code, php, shortcode, allow, sidebar, variables
Requires at least: 2.5
Tested up to: 3.5
Stable tag: 3.0.4

Allow PHP in posts and pages allows you to add php functionality to Wordpress Posts and Pages

== Description ==

Allow PHP in posts and pages adds the functionality to include PHP in your WordPress posts and pages by adding a shortcode [php] your code [/php]

This plugin attempts to strip away the automatically generated wordpress &lt;p&gt; and &lt;br/&gt; tags but still allows the addition of your own &lt;p&gt; and &lt;br/&gt; tags using a form of BBcode items such [p][/p] and [br /]

You can also save your most used bits of code as snippets for use across multiple pages.

With Version 2.2, the older tag replacement system has been revamped, hopefully reducing the need to escape some characters for example: [ and ] that shouldnt be changed &lt; and &gt; 

With Version 2.3 comes an experimental advanced filter feature which allows you to use standard php code while taking advantange of variables thoughout the entire post content, and functions, as well as no pesky tag replacement.

With Version 3 comes entirely re-written code with support for code snippets being used in conjunction with the advanced filter feature as well as a class variable to share variables between saved snippets and code blocks. This version also comes with UI updates.

== Usage ==

Using the plugin couldn't be simpler; the plugin has 2 variants of shortcode available, [php] and [allowphp] other versions of the shortcode may exist but are not fully supported.

To add the PHP code to your post or page simply place any PHP code inside the shortcode tags as follows:

`
[php]
	global $user_ID;
	if($user_ID == 1){
		echo "Hello World";
	}
[/php]
This code will output Hello World to only user id #1, and no one else
`

The shortcode can take a some additional attributes to assist with PHP writing

 * "debug" - [1/0] - Turns on error reporting and display errors for snippets
 * "silentdebug" - [1/0] - When used with "debug" shows errors in the source code only
 * "mode" - ["old"/"new] - Maintained for backwards compatibility only - When set to "old" enables the pre version 2.2.0 code replacement system for that shortcode, when set to "new" with the preparse option enabled it uses the newer code replacement system for that shortcode

= Code Snippets =

In addition to these attributes, a new one has been added called "function". The function attribute allows the addition of user defined code snippets into the content. The shortcode for snippets is `[php function=x]` or `[allowphp function=x]`

To integrate the snippets with the advanced filter, the shortcode should not contain any additional attributes or spaces

Code snippets can be added in the plugin's options page and can be re-used on as many pages as you like

= Advanced Filter =

The advanced filter is the newest feature of the plugin.

It allows the user to write standard html directly into the html post editor without needing tag replacements.

There are 2 ways to enable the Advanced Filter, the easiest way is to enable it in the plugin options page, the other way is to add "useadvancedfilter"onto the standard shortcode to use it on a shortcode by shortcode basis:

`[php useadvancedfilter]...[/php useadvancedfilter]` or `[allowphp useadvancedfilter]...[/allowphp useadvancedfilter]`

= Variable Sharing =

The plugin class contains an array with can be used to share variables around the page, between blocks of php code anywhere.

Variable delarations can be made by accessing the global variable $allow_php as follows:

`
[php]
	global $allow_php;
	$allow_php-&gt;_shared['my_key'] = 'my value';
[/php]
This code will set "my value" to index "my_key" within the shared array
[php]
	global $allow_php;
	echo $allow_php-&gt;_shared['my_key'];
[/php]
This code will output the index "my_key" within the shared array
`

This can be useful for passing post information to the sidebar :)


== Some Important Notes ==

This plugin strips away all instances of &lt;p&gt; and &lt;br /&gt; therefore code has been added so that if you wish to use tags in your output (e.g.):

	[php] 
		echo "hello &lt;br /&gt; world"; 
	[/php]

The &lt; and &gt; tags will need to be swapped for [ and ] respectively so &lt;p&gt; becomes [p] and &lt;/p&gt; becomes [/p] which is converted back to &lt;p&gt; at runtime. these [ ] work for all tags (p, strong, em etc.).

	[php] 
		echo "hello [br /] world"; 
	[/php]

With code written pre-version 2.2.0 you may need to turn on support for the older replacement method as you may experience issues with the code being disrupted as the replacement method has been changed, however you can set the tag replacement method to be the older version in the plugin options or by adding mode=old to the [php] tag, similarly, if you wish to use the new method when you have the old method turn on in the plugin options, just add mode=new to the [php] tag. In the current release, only known html tags are altered by the code, other tags and square bracket items (such as PHP arrays) are no longer affected.

The code replacement method isn't always perfect however, as certain items such as arrays cannot be accessed during echos and will need to be set as a variable before echo (this doesn't apply to the advanced filter)
`
	echo "[p]".$myArray[0]."[/p]"
as
	$mya = $myArray[0];
	echo "[p]".$mya."[/p];

`
== Installation ==

1. Extract the zip file and drop the contents in the wp-content/plugins/ directory of your WordPress installation
1. Activate the Plugin from Plugins page

== Change log ==
= 1.0 =
 * Initial Release
= 1.1 =
 * Bug fix for the conversion of the right square bracket
= 1.2 =
 * Character Conversion Fixes
= 1.2.3 =
 * Fixed major issue with 1.2.2
= 2.0.0.RC1 =
 * Addition of Code Snippets function to the plugin
 * Minor Bug Fixes
 * New Options Pages
 * TinyMCE editor button
 * allow shortcodes in text widgets by default
= 2.1.0 =
 * Overall file tightening and maintenance
= 2.1.05 =
 * fix issue with using the tinyMCE editor while the blog installation is in a sub folder
= 2.2.0:beta =
 * HTML Tag replacement method changed
 * UI Design Tweeks
= 2.2.0:beta:3=
 * Tag replacement Tweeks
= 2.2.0:RC1 =
 * Finalisation of the tag replacement tweeks
= 2.3 =
 * Addition of Advanced Filter Experimental Feature
= 3.0 =
 * Code re-haul, conversion to class
 * Advanced filter tweaks following it's success
 * UI Design change for a nicer look
 * Specific variable created for sharing variables between code blocks
 * Lots of tiny bugs squished  
= 3.0.1 = 
 * Change to the code replacement regex to recognise closing tags correctly
= 3.0.2 =
 * set table update to rename plugin table to correct case when upgrading
 * turned off the advanced filter by default
= 3.0.3 =
 * Fixed a small issue caused by improper use of wpdb->prepare.
 * Checked for WP 3.5 compatibility
= 3.0.4 =
 * Minor bug fix

== Frequently Asked Questions ==
= What Tags Are Automatically Removed? =
Currently all &lt;br /&gt; and &lt;p&gt; (and its closing counterpart) tags are removed from the input code because these are the tags that Wordpress automatically add.

= How Do I Add Tags Without Them Being Stripped? =
If you want to echo a paragraph tag or a line break, or any other tag (strong, em etc) instead of enclosing them in &lt; and &gt; tags, enclose them in [ ] brackets for example [p] instead of &lt;p&gt; The square brackets are converted after the inital tags are stripped and function as normal tags.

= Thats All Good But I want To Include A [ and ] In My Output! =
The tag replacement system only replaces [ and ] when they are paired up and text content inside e.g. it wont replace [] and wont replace [hello[ but it will replace [hello], to prevent this, escape the opening [ with a \ so write \[hello]

= Can I still connect to non-wordpress databases? = 
Yes you can, just use the standard mysql_connect or the mysql_pconnect and their parameters.

= A function that was working before upgrading, no longer works = 
If you are upgrading Allow PHP In Posts and Pages from a version before 2.2.0 you may experience issues with the code being disrupted as the replacement method has been changed, however you can set the tag replacement method to be the older version in the plugin options or by adding mode=old to the [php] tag, similarly, if you wish to use the new method when you have the old method turn on in the plugin options, just add mode=new to the [php] tag

= The sample code provided on the plugin page doesnt work! =
On the plugin page, the code is written with spaces in the [php] tag, these need to be removed before the tag will work.

= My code doesn't work =
First of all, check that the syntax is valid, make use of the debug feature and try to use snippets with variable sharing or the advanced filter, then if it still doesn't work, come leave a question on the support page

= I found a bug! =
We are constantly looking to improve the plugin, found a bug, or simply have a request, let us know on the support page!

= Upgrading broke my old code!!! =
If you are upgrading to 3.0.x from 2.3, make sure that advanced filter is turned off if you were not using it before, if you are upgrading from a version number lower than 2.2.0, make sure you enable the option to use the old code replacement method to ensure your code continues to work

= My question is unanswered =
We are very busy creating new WordPress plugins and we don't always check the support forums on wordpress.org, leave a question on our website and we will try to get back to you as soon as possible

= My Question Is Not Answered Here! =
100's of other questions have been asked on the [http://www.hitreach.co.uk/wordpress-plugins/allow-php-in-posts-and-pages/](http://www.hitreach.co.uk/wordpress-plugins/allow-php-in-posts-and-pages/ "Support Page"), go take a look and see if yours may be answered there!, if it isn't, leave a comment
