require.config({
   paths: {
		jquery: '../javascript/jquery-1.7.1.min.js',
		bxSlider: '../javascript/jquery.bxSlider.min.js',
		underscore: 'http://cdnjs.cloudflare.com/ajax/libs/underscore.js/1.6.0/underscore.js',
		backbone: 'http://cdnjs.cloudflare.com/ajax/libs/backbone.js/1.1.2/backbone-min.js',
		bootstrap: 'http://maxcdn.bootstrapcdn.com/bootstrap/3.2.0/js/bootstrap.min.js',
		handlebars: 'http://cdnjs.cloudflare.com/ajax/libs/handlebars.js/2.0.0-alpha.4/handlebars.min.js',
   },
   // Shim declaration
  'shim': {
		'underscore': {
			'exports': '_'
		},
		'backbone': {
			'deps': [
				'jquery',
				'underscore'
			],
			'exports': 'Backbone'
		},
		'handlebars': {
			'exports': 'Handlebars'
		}
  }
});

require('base/bxSlider');
require('base/piwik');
require('base/Quantcast');