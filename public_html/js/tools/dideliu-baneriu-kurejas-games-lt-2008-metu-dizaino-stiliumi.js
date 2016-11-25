define([
	"jquery", 
	"data/form", 
	"helpers/loading", 
	'helpers/init_canvas', 
	"download",
	'images/gamersgate',
	'images/made_in_lithuania',
	'draw/drawGradientBar',
	'draw/strokeText',
	'draw/outlineText',
	'draw/drawTransparentBackground',
	'helpers/readImageFromField',
	'draw/setImageSmoothingEnabled',
	'behaviors/move',
	'behaviors/zoom'
	], 
	function(
		$,
		jForm,
		loading,
		init_canvas,
		download,
		img_gamersgate,
		img_made_in_lithuania,
		draw_gradient_bar,
		strokeText,
		outlineText,
		transparentBackgroundDraw,
		readImageFromField,
		imageSmoothingEnabled,
		behaviorMove,
		behaviorZoom
	) {

	var form = jForm('tool', {
			banner_type: $('#banner_type'),
			game_name: $('#game_name'),
			game_platform: $('#game_platform'),
			banner: $('#banner'),
			game_flag: $('#game_flag'),
			game_image_size: $('#game_image_size')
		}),
		context = form.banner.get(0).getContext("2d"),
		image = {
			box: null,
			background: null,
			gamersgate: img_gamersgate,
			made_in_lithuania: img_made_in_lithuania
		},
		getCaption = function () {
			var caption = form.banner_type.val().toUpperCase(),
				gn = form.game_name.val();
			if (gn) {
				caption += ' | ' + gn;
			}
			var platform = form.game_platform.val()
			if (platform != 'PC')
				caption += ' (' + platform + ')';
			return caption;
		}

	imageSmoothingEnabled(context);
	
	var redraw = function (options) {
		if (!options)	{
			options = {};
		}

		var caption = getCaption();

		context.clearRect ( 0 , 0 , 625 , 190 );
		context.fillStyle="#BFBFBF";

		if (!options.noTransparent) {
			transparentBackgroundDraw(context, 625, 190, 7);
		}

		if (image.background)
			context.drawImage(	
						image.background, 
						form.banner.data('x'),
						form.banner.data('y'),
						image.background.width * form.banner.data('zoom') / 100,
						image.background.height * form.banner.data('zoom') / 100
						);						
						
		if (image[form.game_flag.val()]){
			context.drawImage(
				image[form.game_flag.val()],
				0,
				0
			);
		}
		
		draw_gradient_bar(context, 0, 190-32, 625, 190-(32-12), "#D9DAD5", "#D7D9D4");
		draw_gradient_bar(context, 0, 190-(32-12), 625, 190,  "#D7D9D4", "#B1B6B0");

		var active_width = 625;
		if (image.box) {
			switch (form.game_platform.val()) {
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

		outlineText(context, caption, textX, textY, 5, 255, 255, 255);					

		context.fillStyle = 'black';
		context.fillText(caption, textX, textY);

		context.fill();
		context.stroke();

		if (image.box) {
			context.shadowColor = 'black';
			context.shadowBlur = 10;
			context.shadowOffsetX = 0;
			context.shadowOffsetY = 0;
			switch (form.game_platform.val()) {
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
	form.game_image_size.change(function () {
		var val = parseInt($(this).val());
		if (val < 1) {
			val = 1;
			$(this).val(1);
		}
		form.banner.data('zoom', val);		
	});
	$('select, input', form.form).bind({
		change: redraw,
		keyup: redraw
	});

	behaviorZoom(form.banner, parseInt(form.game_image_size.val()));
	behaviorMove(form.banner);
	form.banner.bind({
		'moved': redraw,
		'zoom': function () {
			form.game_image_size.val(form.banner.data('zoom'));
			redraw();
		}
	});

	$('[data-role="changeImage"]', form.form).change(function () {
		var obj = $(this);
		readImageFromField(obj, obj.data('width'), obj.data('height')).catch(
			function (error) {
				form.reactions.error(error);
				image[obj.data('key')] = null;
				redraw();
			}).then(function (result) {
				if (typeof result == 'undefined') {
					return;
				}
				image[obj.data('key')] = result;
				redraw();
		});
	});

	form.form.bind({
		submit: function (e) {
			e.preventDefault();
			
			var filename = form.banner_type.val().toUpperCase(), gn = form.game_name.val();
			if (gn) {
				filename += ' - ' + gn;
			}
			filename += ' (' + form.game_platform.val() + ').png';

			redraw({noTransparent: true});
			var data = form.banner.get(0).toDataURL("image/png");
			redraw();

			download(data, filename, "image/png");
		},
		reset: function () {
			image.box = null;
			image.background = null;
			form.banner.data({
				x: 0,
				y: 0,
				zoom: 100
			});
			redraw();
		}
	});

	$('[data-role="changeImage"]', form.form).change();

});