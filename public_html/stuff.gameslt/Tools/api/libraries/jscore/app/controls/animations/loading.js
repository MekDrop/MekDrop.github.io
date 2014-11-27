define(['jquery'], function ($) {
 
    var app = function (canvas) {
        var id = app.prepareForAnimation(canvas)
        , obj = $(canvas)
        , i, c, current;
      
        current[id].colors = ['black'];
        
        for(i = 0; i < 5; i++) {
          c = Math.floor(255 / i);
          current[id].colors.push('rgb(' + c + ',' + c + ',' + c + ')');
        }
        
        app.current[id].center = {
          x: obj.width() / 2,
          y: obj.height() / 2
        };
        
        current[id].context.translate(current[id].center.x, current[id].center.y);
        current[id].angle = {
          all: 30 * Math.PI / 180
          , item: 360 / current[id].colors.length * Math.PI / 180
        };
        
        obj.bind('updateCanvas', function (e, current) {
          current.context.rotate(current.angle.all);
          
          for(i = 0; i < current.colors.length; i++) {
            current.context.rotate(current.angle.item);
            current.context.fillStyle=current.colors[i];
            current.context.fillRect(0, 0, 20, 10);
          }
        });
        
        current = current[id];
        for(c = 0; c < 9; c++) {
          current.context.rotate(current.angle.all);
          for(i = 0; i < current.colors.length; i++) {
            current.context.rotate(current.angle.item);
            current.context.fillStyle=current.colors[i];
            current.context.fillRect(0, 0, 20, 10);
          }
        }
      };
 
});