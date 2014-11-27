define(['jquery'], function (jQuery) {

    var app = {
        controlInitialized: function () {
            var obj = jQuery(this);
            if (obj.data('auto_title'))
                obj.attr('title', parseInt(obj.val()) + 1);
            obj.change(
                function () {
                    var obj = jQuery(this);
                    if (obj.data('auto_title'))
                        obj.attr('title', parseInt(obj.val()) + 1);
                }                        
                );                             
        }
    };

return app;
});