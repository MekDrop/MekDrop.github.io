define(function () {
    var app = function (name,value,days) {
            var exdate=new Date();
            exdate.setDate(exdate.getDate() + days);
            document.cookie= name + "=" + escape(value) + ((days==null) ? '' : '; expires='+exdate.toUTCString());
    };
    return app;
});
