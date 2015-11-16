define(function () {
	return function (context, x1, y1, x2, y2, color1, color2) {
		var grd=context.createLinearGradient(0,y1,0, y2);
		grd.addColorStop(0,color1);
		grd.addColorStop(1,color2);

		context.fillStyle=grd;
		context.fillRect(x1,y1,x2-x1,y2-y1);
	};
});