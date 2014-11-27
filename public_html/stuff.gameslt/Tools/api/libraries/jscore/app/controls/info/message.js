define(['mediator'], function(mediator) {

    var app = {
        type: {
            none: 0,
            info: 1,
            exclamation: 2,
            asterisk: 3,
            error: 4,
            question: 5,
            stop: 6,
            warning: 7
        },
        data: [
        { //0
            image: ''
        },
        { // 1
            image: 'infomsg_icon.gif'
        },
        { // 2
            image: ''
        },
        { // 3
            image: ''
        },
        { // 4
            image: 'errormsg_icon.gif'
        },
        { // 5
            image: 'kfaenza/help.png'
        },
        { // 6
            image: 'kfaenza/stop.png'
        },
        { // 7
            image: ''
        }        
        ],
        show: function (msg, header, type) {
            if (!header)
                header = '';
            if (!type)
                type = app.type.none;
            var typestr = 'unknown';
            for(var x in app.type) 
                if (app.type[x] == type) {
                    typestr = x;
                    break;
                }                    
            var img = icms.config.url + '/images/' + app.data[type].image;
            var options = {
                sticky:false
            };
            options.header = ((app.data[type].image == '')?'':'<img src="' + img + '" alt="icon" />') + ' ' + header;
            var notifSettings = {
              type: typestr
              , timeout: 5
            };
            mediator.publish('addNotification', msg , notifSettings);
            
            //if (type == window.ImpressCMS.message.error)
            //    options.speed = 'slow';
            //jQuery.jGrowl(msg, options);
        }
    };

return app;
});