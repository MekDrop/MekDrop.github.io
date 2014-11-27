jQuery(function () {
	var banner = jQuery('#banner');
	var context = banner.get(0).getContext("2d");
	var draw_gradient_bar = function (x1, y1, x2, y2, color1, color2) {
		var grd=context.createLinearGradient(0,y1,0, y2);
		grd.addColorStop(0,color1);
		grd.addColorStop(1,color2);

		context.fillStyle=grd;
		context.fillRect(x1,y1,x2-x1,y2-y1);
	};
	var strokeText = function (text, x, y, lineWidth, color) {
		context.strokeStyle = color;
		context.lineWidth = lineWidth;
		context.strokeText(text, x, y);
	};
	var outlineText = function (text, x, y, lineWidth, red, green, blue) {
		for(var i = lineWidth; i > 0; i--)
			strokeText(text, x, y, i, "rgba("+red+","+green+","+blue+","+(1.1-(1/lineWidth)*i)+")");
	};
	var transparentBackgroundDraw = function () {
		var grey = false;
		context.clearRect ( 0 , 0 , 625 , 190 );
		context.fillStyle="#BFBFBF";
		for (var x = 0; x < 625; x += 7) {
			for (var y = 0; y < 190; y += 7) {
				if (!(grey = !grey))
					continue;
				context.fillRect(x,y,7,7);
			}
			grey = !grey;
		}
	};
	var image = {
		box: null,
		background: null,
		gamersgate: new Image(),
		made_in_lithuania: new Image()
	};		
	image.gamersgate.src = 'data:image/gif;base64,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';
	image.made_in_lithuania.src = 'data:image/gif;base64,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';
	var dragmode = false;
	var dragX = 0;
	var dragY = 0;
	var readImageFromField = function (fieldid, imagename, minWidth, minHeight) {
		var file = jQuery('#' + fieldid).get(0).files[0];
		var fr = new FileReader();
		fr.onload = function () {
			image[imagename] = new Image();
			image[imagename].onerror = function () {
				alert('Klaida: nepavyko perskaityti paveikslėlio!');
				image[imagename] = null;
				jQuery('#' + fieldid).val('');
			};
			image[imagename].onload = function () {
				if (image[imagename].width < minWidth) {
					alert('Klaida: pasirinktas per mažo pločio paveikslėlis!');
					image[imagename] = null;
					jQuery('#' + fieldid).val('');
				} else if (image[imagename].height < minHeight) {
					alert('Klaida: pasirinktas per mažo aukščio paveikslėlis!');
					image[imagename] = null;
					jQuery('#' + fieldid).val('');
				}
				redraw();
			};
			image[imagename].src = fr.result;
		};
		try {
			fr.readAsDataURL(file); 	
		} catch (ex) {
			console.log(ex);
		}					
	};
	context.imageSmoothingEnabled = true;
	context.webkitImageSmoothingEnabled = true;
	context.mozImageSmoothingEnabled = true;
	var bg_pos = {
		x: 0,
		y: 0,
		sx: 0,
		sy: 0
	};
	var redraw = function () {
		var caption = 'APŽVALGA | ' + jQuery('#game_name').val();
		var platform = jQuery('#game_platform').val()
		if (platform != 'PC')
			caption += ' (' + platform + ')';

		transparentBackgroundDraw();

		if (image.background)
			context.drawImage(	
						image.background, 
						bg_pos.x,
						bg_pos.y,
						image.background.width * jQuery('#game_image_size').val() / 100,
						image.background.height * jQuery('#game_image_size').val() / 100
						);				
		
						
		if (image[jQuery('#game_flag').val()]){
			context.drawImage(
				image[jQuery('#game_flag').val()],
				0,
				0
			);
		}
		
		draw_gradient_bar(0, 190-32, 625, 190-(32-12), "#D9DAD5", "#D7D9D4");
		draw_gradient_bar(0, 190-(32-12), 625, 190,  "#D7D9D4", "#B1B6B0");

		var active_width = 625;
		if (image.box) {
			switch (platform) {
				case 'Android':
				case 'iOS':
					active_width -= 190 / 1.79 - (190 / 2.21 - 190 / 1.89);
				break;
				default:
					var ih = (image.box.height > 190)?190:image.box.height;
					var iw = image.box.width / (image.box.height / 190);
					active_width -= iw;
				break;
			}
		}

		context.font="19px Verdana";

		var textX = (active_width - context.measureText(caption).width) / 2;
		var textY = 190 - (32 - 19) / 1.6;

		outlineText(caption, textX, textY, 5, 255, 255, 255);					

		context.fillStyle = 'black';
		context.fillText(caption, textX, textY);

		context.fill();
		context.stroke();

		if (image.box) {
			context.shadowColor = 'black';
			context.shadowBlur = 10;
			context.shadowOffsetX = 0;
			context.shadowOffsetY = 0;
			switch (platform) {
				case 'Android':
				case 'iOS':									
						context.drawImage(	
							image.box,
							625-190 / 1.79,
							190 - 190 / 1.89,
							190 / 2.21,
							190 / 2.21
						);									
				break;
				default:									
						context.drawImage(	
							image.box,
							625 - iw,
							0,
							iw,
							ih
						);
				break;
			}
			context.shadowBlur = 0;
		}
			   
	};
	jQuery('#game_name, #game_platform, #game_image_size, #game_flag').bind({
		change: redraw,
		keyup: redraw
	});
	banner.mousewheel(function(event) {
		jQuery('#game_image_size').val(parseInt(jQuery('#game_image_size').val()) + event.deltaY);
		jQuery('#game_image_size').change();
		event.preventDefault();
	});
	banner.mousedown(function (event) {
		banner.css('cursor', 'move');					
		bg_pos.sx = event.clientX;
		bg_pos.sy = event.clientY;
		dragmode = true;
	});
	banner.mouseup(function (event) {
		banner.css('cursor', 'default');
		dragmode = false;
	});
	banner.mousemove(function (event) {
		if (!dragmode) 
			return;
		bg_pos.x -= bg_pos.sx - event.clientX;
		bg_pos.y -= bg_pos.sy - event.clientY;
		bg_pos.sx = event.clientX;
		bg_pos.sy = event.clientY;
//					console.log(x);
//					console.log(bg_pos.y);
		redraw();
	});
	jQuery('#game_box').change(function () {
		readImageFromField('game_box', 'box', 100, 190);
	});
	jQuery('#game_image').change(function () {
		readImageFromField('game_image', 'background', 625, 158);
	});
	jQuery('#game_save').click(function() {
		jQuery('#banner_data').val(banner.get(0).toDataURL());
		jQuery('#banner_name').val(jQuery('#game_name').val() + ' (' + jQuery('#game_platform').val() + ') [' + (new Date()).getTime() + ']');
		alert(banner.get(0).toDataURL());
		jQuery(jQuery('#banner_data').get(0).form).submit();
	});
	readImageFromField('game_box', 'box', 100, 190);
	readImageFromField('game_image', 'background', 625, 158);
	redraw();
});