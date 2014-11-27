2/* global icms: true */
/*
  Module: Notify
  Handles display notification if needed
  See: http://richardhsu.github.com/jquery.ambiance/#_ for options

  Method: initialize
  if notification are needed initialize is triggered and adds the needed resources to the page.
*/
define([
  'jquery'
  , 'css!app/modules/notify/notify.css'
  , 'plugins/jquery.ambiance'
]
, function($) {
  var notifyDefaults = {
    timeout: 4
  }
  , app = {
    showMessage: function(message, options) {
      if(typeof message !== 'undefined' && message !== false && message !== '') {
        notifyDefaults.message = message;

        if(typeof options !== 'undefined') {
          notifyDefaults.type = options.type !== 'undefined' ? options.type : 'default';
          notifyDefaults.title = options.title !== 'undefined' ? options.title : '';
          notifyDefaults.permanent = options.permanent !== 'undefined' ? options.permanent : false;
          notifyDefaults.timeout = options.timeout !== 'undefined' ? options.timeout : 2;
          notifyDefaults.fade = options.fade !== 'undefined' ? options.fade : true;
          notifyDefaults.width = options.width !== 'undefined' ? options.width : 300;
        }

        $.extend(notifyDefaults, options);

        $(document).ready(function() {
          $.ambiance(notifyDefaults);
        });
      }
    }
  };
  return app;
});
