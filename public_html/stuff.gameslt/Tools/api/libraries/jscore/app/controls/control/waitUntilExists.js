define(['app/controls/control/exists'], function (controlExists) {    

    var app = function (control_id, func) {
            var exist = function() {
                if (!controlExists(control_id))
                    setTimeout(exist, 100);
                else
                    func();
            };
            exist();
        };

    return app;

});
