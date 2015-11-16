define(function() {
	return function (obj) {
		obj = $(obj);
		obj.data({
			x: 0,
			y: 0
		});
		var bg_pos = {
			sx: 0,
			sy: 0
		};
		var dragmode = false;
		obj.bind({
			mousedown: function (event) {
				obj.css('cursor', 'move');					
				bg_pos.sx = event.clientX;
				bg_pos.sy = event.clientY;
				dragmode = true;
				obj.trigger('movedStarted');
			},
			mouseup: function (event) {
				obj.css('cursor', 'default');
				dragmode = false;
				obj.trigger('moveFinished');
			},
			mousemove: function (event) {
				if (!dragmode) 
					return;
				obj.data('x', obj.data('x') - (bg_pos.sx - event.clientX));
				obj.data('y', obj.data('y') - (bg_pos.sy - event.clientY));
				bg_pos.sx = event.clientX;
				bg_pos.sy = event.clientY;
				obj.trigger('moved');
			}
		});
	};
});