define(['jquery'], function ($) {
	$('[data-role="canvas"]').each(function () {
		var canvas = $('<canvas></canvas>'),
			obj = $(this);
		canvas.attr(obj.data());
		obj.replaceWith(canvas);
	});
});