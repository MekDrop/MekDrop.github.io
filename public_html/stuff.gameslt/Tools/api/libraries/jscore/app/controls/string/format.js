define(function () {
    var app = function() {
        var formatted = arguments[0];    
        for (var i = 1; i < arguments.length; i++) {
            var regexp = new RegExp('\\{'+i+'\\}', 'gi');
            formatted = formatted.replace(regexp, arguments[i]);
        }
        return formatted;
    };
    
    return app;
});