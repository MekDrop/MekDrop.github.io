define(['jquery', 'app/controls/uri/url/get'], function (jQuery, getCurrentURL) {    

    var app = function () {
            var title = jQuery(jQuery('title').get(0)).text();
            history.pushState({}, title, getCurrentURL());
        };

    return app;

});
