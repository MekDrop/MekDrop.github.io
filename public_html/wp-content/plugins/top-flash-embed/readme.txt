=== Top Flash Embed ===
Contributors: Nikos M.
Tags: flash,swf,video,youtube,vimeo,embed,editor,easy,shortcode
Requires at least: 3.0
Tested up to: 3.6
Stable tag: tags/0.3.4

Easily embed SWF Movies from Media Library or external SWFs into posts or pages through rich editor using shortcodes.

== Description ==

!!!Further development on this project has stopped!!!

This plugin allows to easily embed SWF Movies from Media Library or external SWFs into posts or pages through rich editor using shortcodes.

= Features =

* Autodetect SWF dimensions
* Embed SWF movie directly through [Add Media] popup or through tinyMce Button
* Allow to embed extrenal SWF (eg Youtube swf player)
* Allow for extra parameters like wmode,flashVars, allowFullScreen (swf needs to support full screen mode also)
* Valid XHTMl object markup (does NOT use SWFObject)

== Installation ==

1. Download plugin and upload contents to the `/wp-content/plugins/` directory
2. Activate the plugin through the 'Plugins' menu in WordPress
3. In "Add Media" menu/popup you will see options to embed the swf in the editor
4. Alternatively the Editor Fl button alows you to embed any swf in your media library directly or even an external swf as URL
5. Insert [topswf] shortcode directly or through tinyMCE editor in the page or post you want the flash to appear.

=Example:= [topswf swf='http://foo.com/flash.swf' width='350' height='200']

== Frequently Asked Questions ==

http://nikos-web-development.netai.net/

== Screenshots ==

1. screenshot-1.png Add Media options to embed swf movie

2. screenshot-2.png TinyMce Editor Button options to embed swf movie

3. screenshot-3.png swf shortcode inserted in post content


== Changelog ==
= 0.3.4 =
* add _quality_ , _scale_ flash options for further fine-tuning
= 0.3.3 =
* fix issue with allowfullscreen param in add Media popup
* add Keep Proportional setting when embedding swf movie
* change checkboxes to dropdowns (more intuitive)
= 0.3.2 =
* Fix issue with allowfullscreen param (thanks to Luk De Voght)
= 0.3.1 =
* Allow to embed swf directly from the [Add Media] Popup
* Auto detect SWF width/height dimensions
= 0.3 =
* Update for WP 3.5.1
* Works for swfs in Media Library and externals
= 0.2.2 =
* Minor fix for correct validation of width/height values
= 0.2.1 =
* Readme changes
= 0.2 =
* Changed Documentation
= 0.1 =
* Initial release