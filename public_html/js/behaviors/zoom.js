define(['jquery', 'jquery.mousewheel'], function ($, mouseWheel) {
	return function (obj, zoomLvl) {
		obj = $(obj);
		obj.data('zoom', zoomLvl);
		obj.mousewheel(function(event) {
			obj.data('zoom', obj.data('zoom') + event.deltaY);
			if (obj.data('zoom') < 1) {
				obj.data('zoom', 1);
			}
			event.preventDefault();
			obj.trigger('zoom');
		});
	};
});