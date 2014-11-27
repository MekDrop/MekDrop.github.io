define(function (require) {
    var jQuery = require('jquery'),
    controlMethods = require('app/controls/control/base/methods'), 
    controlEvents = require('app/controls/control/base/events'),
    req = require,
    app = function (obj2) {
        var obj = jQuery(obj2);
        var id = obj.attr('id');
        var type = obj.attr('data-icms-control');    
            
        if (!window.imcontrols)
            window.imcontrols = {};

        if (!(id in window.imcontrols)) {                
         
            var eType = type.replace(/_/g, '__').replace(/-/g, '_').replace(/\//g, '-'),
            baseControl = obj.hasClass('icms_controls_hasJS')?require('icms_plugins/controls/' + type + '/js/control'):{};//,
            configuration = req('icms/cache/controls/' + eType);
            if (!baseControl || !configuration) {
                var language = require('locale/controls'),
                format = require('app/controls/string/format'),
                console = require('app/controls/info/console');
                console.log("init", format(language.controls.undefined_control_error, type));
                return null;
            }
          
            jQuery.extend(true, obj, baseControl, controlMethods, {
                configuration: configuration
            });

            if (obj.configuration.parentType)
                obj.parentControl = jQuery.extend(true, {}, obj, obj.parentControl);
         
            obj.bind(controlEvents);
         
            window.imcontrols[id] = obj;
            window.imcontrols[id].trigger('controlInitialized');
         
        }
        return window.imcontrols[id];
    };
    return app;
});