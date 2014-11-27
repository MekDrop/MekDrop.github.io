define(['app/controls/control/getMainControls', 'app/controls/string/stringify'], function (getMainControls, stringify) {    

    var app = function (noCompress) {
        var rez = {};
        var controls = getMainControls();
        for (var x in controls) {
            var type = window.imcontrols[x].getControlType();
            if (typeof rez[type] == "undefined")
                rez[type] = {};
            rez[type][x] = window.imcontrols[x].getNotDefaultVars();
        }
                        
        var ret = stringify(rez);
            
        if (!noCompress)
            ret = Base64.toBase64(RawDeflate.deflate(escape(ret)));
            
        return ret;
    };

    return app;

});
