define(function() {
    var defaultHandler = (!window.console)?null:window.console,
    app = {
        customHandler: null,
        log: function (type, msg) {
            if (app.customHandler && app.customHandler.log) {
                app.customHandler.log(type, msg);
            } else if (defaultHandler && defaultHandler.log) {
                defaultHandler.log(type, msg);
            }
        },
        clear: function () {
            if (app.customHandler && app.customHandler.clear) {
                app.customHandler.clear();
            } else if (defaultHandler && defaultHandler.clear) {
                defaultHandler.clear();
            }
        }
    };
    return app;
});