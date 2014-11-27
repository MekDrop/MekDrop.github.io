// Controls Animation module
// Provides abstracted animation functions for controller

define(function(require) {
    var $ = require('jquery')
    , current = {}
    , app = {

        style: {
            overlay: {
                'text-align': 'center'
                , 
                'vertical-align': 'middle'
                , 
                'font-size': '2em'
                , 
                'overflow': 'hidden'
                , 
                'position': 'absolute'
                , 
                'opacity': 0.6
                , 
                'background-color': 'grey'
                , 
                'font-weight': 'bold'
                , 
                'color': 'white'
                , 
                'z-index': 2012
            }
        }

        , 
        prepareForAnimation: function(canvas, update_interval) {
            var id = app.getCanvasID(canvas)
            , obj = $(canvas);

            if (typeof update_interval === 'undefined') {
                update_interval = 250;
            }

            this.current[id] = {
                context: obj[0].getContext('2d')
                , 
                interval: setInterval(function () {
                    obj.trigger('updateCanvas', current[id]);
                }
                , update_interval
                )
                };

            obj.trigger('animationStarted', current[id]);

            return id;
        }   
        , 
        getCanvasID: function (canvas) {
            var obj = $(canvas)
            , id = obj.attr('id')
            , dt;
      
            if (typeof id === 'undefined') {
                dt = new Date();
                id = Base64.encode(dt.toDateString() + ' ' + Math.random());
                obj.attr('id', id);
            }
            return id;
        }

        , 
        stop: function (canvas) {
            var id = this.getCanvasID(canvas)
            , obj;
            if (typeof current[id] === 'undefined') {
                return;
            }
            
            clearInterval(current[id].interval);
            current[id].interval = null;
            
            obj = $(canvas);
            obj.trigger('animationFinished', current[id]);
            
            delete current[id];
        }

        , 
        init: {
            asOverlay: function (baseObj, animation) {
                if (!$.isFunction(animation)) {
                    animation = app.predefined.loading;
                }
                var obj = $(baseObj)
                , canvas = $('<canvas></canvas>');
        
                canvas.attr({
                    width: obj.width(),
                    height: obj.height(),
                    id: obj.attr('id') + '_animation'
                })
                .css(app.style.overlay)
                .css({
                    left: obj.offset().left
                    , 
                    top: obj.offset().top
                });
            
                this.stop = function () {
                    app.stop(canvas);
                };
            
                canvas.bind('animationFinished', function () {
                    canvas.remove();
                });
            
                $('body').append(canvas);
            
                canvas.show();
                animation(canvas);
            }
        }

    };
    return app;
});