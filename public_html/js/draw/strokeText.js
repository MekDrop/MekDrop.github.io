define(function () {
	return function (context, text, x, y, lineWidth, color) {
		context.strokeStyle = color;
		context.lineWidth = lineWidth;
		context.strokeText(text, x, y);
	};
});