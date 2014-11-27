define(function() {
    var app = {
        get: function (path, defaultValue) {        
            if (sessionStorage[this.hashPath(path)] !== undefined)
                return sessionStorage[this.hashPath(path)];
            else
                return defaultValue;
        },
        set: function (path, value) {
            sessionStorage[this.hashPath(path)] = value;
        },
        hashPath: function (path) {
            var ret;
            if (jQuery.isArray(path)) {
                ret = 'array:' + path.join('/');
            } else if(typeof(path) != 'string') {
                ret = typeof(path) + ':' + path.toString();
            }
            return escape(ret);
        }
    };
    return app;
});