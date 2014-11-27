define(['jquery', 'app/controls/control/isKnown', 'app/controls/control/get', 'app/controls/selector/get'], function (jQuery, isKnownControl, getControl, getSelector) {    

    var app = function (tag) {
            if (isKnownControl(tag))
                return jQuery(tag).getControl();
            var ctl = jQuery(tag).closest(getSelector()).get(0);
            return getControl(ctl.id);
        };

    return app;

});
