define(function () {
	return function (context, width, height, stepSize) {
		var grey = false;		
		for (var x = 0; x < width; x += stepSize) {
			for (var y = 0; y < height; y += stepSize) {
				if (!(grey = !grey))
					continue;
				context.fillRect(x,y,stepSize,stepSize);
			}
			grey = !grey;
		}
	};
});