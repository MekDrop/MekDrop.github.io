define(['jquery'], function (jQuery) {    

    var app = function (obj) {
        var obj2 = jQuery(obj);
        if (!obj2.hasClass(icms.config.controls['class']) || !obj2.attr('data-icms-control'))
            return false;
        return true;
    };

    return app;

});
