define(['app/controls/control/get'], function (getControl) {    

    var app = function (id) {
            if (!getControl(id))
                return false;
            return true;
    };

    return app;

});
