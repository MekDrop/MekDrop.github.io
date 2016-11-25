define('jquery', [], function() {
    return jQuery;
});

requirejs.config({
    "baseUrl": "/js/",
    "paths": {
	  "tinymce": "/js/bower_components/tinymce/tinymce.min",
	  "download": "/js/bower_components/download/download.min",
	  "Autolinker": "/js/bower_components/Autolinker.js/dist/Autolinker.min",
	  "jquery.mousewheel" : "/js/bower_components/jquery-mousewheel/jquery.mousewheel.min",
	  "highlightjs" : "/js/bower_components/highlightjs/highlight.pack",
    },
	"config": {
		"helpers/load_css": {
			"highlightjs" : "/js/bower_components/highlightjs/styles/default.css"
		}
	},
	packages: [
		{
			name: 'when', 
			location: '/js/bower_components/when/', 
			main: 'when' 
		}
	]
});

require(['jquery'], function ($) {
	$(function () {
		var file = $('script[data-main][data-what-to-load]').first().data('what-to-load');
		try
		{
			require([file], function () {
				console.log('Require.JS module loaded and initialized :)');
			});		
		}
		catch (ex)
		{
			$('.browserupgrade').show();
		}
	});	
});