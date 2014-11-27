define(['app/controls/uri/params/get', 'app/controls/uri/request/make', 'app/controls/state/get'], function (getParamsArray, makeGetRequestString, getState) {    

    var app = function () {
            var url = location.protocol + '//' + location.host + location.pathname;
            var params = getParamsArray();            
            params['icms_page_state'] = getState();
            url += '?' + makeGetRequestString(params) + location.hash;
            return url;
        };

    return app;

});
