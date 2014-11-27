define(['app/controls/uri/request/make'], function (makeGetRequestString) {

    var app = function (module, file, params) {
           var url = icms.config.url + '/modules/';
           if (url.indexOf('%1') > 0) {
               url = url.replace('%1',module);
               url = url.replace('%2',file);
           } else {
               url += '/' + module + '/' + file;
           }
           if (params)
               url += '?' + makeGetRequestString(params);           
           return url;
        };

    return app;

});
