define(['app/controls/uri/protocol/existingList'], function (specialProtocols) {    

    var app = function (url) {
            for (var i = 0; i < specialProtocols.length; i++)
                if (url.substr(0, specialProtocols[i]) == specialProtocols[i])
                    return true;
            return false;
        };

    return app;

});
