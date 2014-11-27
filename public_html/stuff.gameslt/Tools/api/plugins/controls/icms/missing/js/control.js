define(['jquery'], function (jQuery) {
    var app = {
        controlInitialized: function () {
            var obj = jQuery(this);
            var span = jQuery('<span>');
            span.html(obj.html());
            obj.html('');
            obj.append(span);
            span.each(function() {
                var elem = $(this);
                setInterval(function() {
                    if (elem.css('visibility') == 'hidden') {
                        elem.css('visibility', 'visible');
                    } else {
                        elem.css('visibility', 'hidden');
                    }    
                }, 500);
            });
        }
    };

    return app;

});