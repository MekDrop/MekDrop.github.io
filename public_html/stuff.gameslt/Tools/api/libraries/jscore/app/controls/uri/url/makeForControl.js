define(['app/controls/uri/request/make'], function (makeGetRequestString) {    

    var app = function (control_type, file, params) {
           var url = icms.config.url + '/plugins/controls';
           if (url.indexOf('%1')) {
               url = url.replace('%1',control_type);
               url = url.replace('%2',file);
           } else {
               url += '/' + control_type + '/' + file;
           }
           if (params)
               url += '?' + makeGetRequestString(params);           
           return url;
        };

    return app;

});
