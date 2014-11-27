Flayr flash video player.

Flayr is a flash video player developed by Dertig Media (http://www.30.nl) It has all the features you expect from a flash video player and the appearance can be configured the way you like.

Flayr plays FLV video and MP4 files. High Quality H264/ HE-AAC movie files can also be played when using flash player 9.0.115.0 or higher. 

Usage of the Flayr player is licensed by the Creative Commons License.

For more about the creative commons license visit http://creativecommons.org/licenses/by-nd/3.0/

The following parameters can be given to the flayr.swf flash movie:

REQUIRED
	movie = moviepath
	 
OPTIONAL
	name = moviename in the titlebar
	preview = preview image path
	controls = show(default), seek, hide
	autoplay = true, false(default)
	buffer = true, false(default)
	 
COLORS OR THEME
	color_controls = color hex
	color_background = color hex
	color_slider = color hex
	color_bar = color hex
	color_buffer = color hex
	alpha_buffer = alpha 0-100
	 
	theme = themepath for skins (when a theme is used, colors above dont apply)
	
	 
BRANDING
	logo_image = logopath, transparent png
	logo_position = TL, TR(default), BL, BR
	logo_url = url for logoclick


CUSTOM SKIN CREATION

A psd file for creating skins is included. Edit skin.psd to create your own skin file for flayr. When including flayr on your side you can point to the custom png skin by adding the theme parameter: &theme=example.png

When using your own skin you can still use the color_controls parameter to set the color of your title and timer status of the movie and color_buffer and alpha_buffer paramter.