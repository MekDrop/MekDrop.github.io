define(['draw/strokeText', 'draw/rgba'], function (strokeText, rgba) {
	return function (context, text, x, y, lineWidth, red, green, blue) {
		for(var i = lineWidth; i > 0; i--)
			strokeText(context, text, x, y, i, rgba(red, green, blue, 1.1-(1/lineWidth)*i));
	};
});