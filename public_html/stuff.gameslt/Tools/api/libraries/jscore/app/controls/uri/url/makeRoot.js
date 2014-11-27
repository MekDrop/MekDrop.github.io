define(['app/controls/uri/request/make'], function (makeGetRequestString) {    

    var app = function (file, params) {
           var url = icms.config.url;
           if (url.indexOf('%1') > 0) {
               url = url.replace('%1',file);
           } else {
               url += '/' + file;
           }
           if (params)
               url += '?' + makeGetRequestString(params); 
           return url;
        };

    return app;

});
