define(function () {    

    var app = function(params) {
            var rez = '';
            for (var x in params)
                rez += encodeURIComponent(x) + '=' + encodeURIComponent(params[x]) + '&';
            if (rez.length > 1)
               rez = rez.substr(0, rez.length - 1);
            return rez;
        };

    return app;

});
