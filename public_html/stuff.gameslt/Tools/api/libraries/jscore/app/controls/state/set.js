define([], function () {    

    var app = function (state) {
            window.location.reload();
            // TODO: implement correct way
            /*var ret = Base64.btou(RawDeflate.inflate(Base64.fromBase64(state)));
            ret = jQuery.parseJSON(ret);
            window.ImpressCMS.console.log("Setting state", ret);
            var ctl_types = {};
            for (var x in ret) {
                ctl_types[x] = ret[x]['data-icms-control'];
                delete ret[x]['data-icms-control'];
            }
            for (var x in ret) {
                var ctl = window.ImpressCMS.core.controls.getControl(x);                
                if (!ctl || ctl.isSameControlType(ctl_types[x]))
                    window.location.reload();
                
                ctl.importArray(ret[x]);
            }               */     
        };

    return app;

});
