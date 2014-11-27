define(function () {
    var parseRecord = function (unparsed) {
        var i = unparsed.indexOf("=");
        var name = unparsed.substr(0,i);
        return  {
            name: name.replace(/^\s+|\s+$/g,""),
            value: unescape(unparsed.substr(i+1))
        };
    },
    app = function (name) {
        var cookies=document.cookie.split(";");
        for (i=0;i<cookies.length;i++) {
            var ret = parseRecord(cookies[i]);
            if (ret.name == name)
                return ret.value;
        }
        return null;
    };
    return app;
});
