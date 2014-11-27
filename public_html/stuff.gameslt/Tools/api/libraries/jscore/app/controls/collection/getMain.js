define(['jquery'], function (jQuery) {    

    var app = function () {            
        var rez = {};
        var skipControls = [];
        for (var x in window.imcontrols) {
            if (!window.imcontrols[x])
                continue;
            rez[x] = window.imcontrols[x];
            window.imcontrols[x].getChildren().each(
                function (index) {
                    var obj = jQuery(this);
                    skipControls.push(obj.attr('id'));
                }
                );
        }
        for(var i=0; i<skipControls.length;i++)
            if (rez[skipControls[i]])
                delete rez[skipControls[i]];
        return rez;
    };

    return app;

});
