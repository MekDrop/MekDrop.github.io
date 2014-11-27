jQuery(function () {
    var banner = jQuery('#banner_small');
    var bgfile = jQuery('#game_image_small');
    var size = jQuery('#game_image_size_small');
    var context = banner.get(0).getContext("2d");
    context.imageSmoothingEnabled = true;
    context.webkitImageSmoothingEnabled = true;
    context.mozImageSmoothingEnabled = true;
    var dragmode = false;
    var dragX = 0;
    var dragY = 0;
    var bg_pos = {
        x: 0,
        y: 0,
        sx: 0,
        sy: 0
    };
    var image = {
        background: null
    };
    var transparentBackgroundDraw = function () {
        var grey = false;
        context.clearRect ( 0 , 0 , 310 , 155 );
        context.fillStyle="#BFBFBF";
        for (var x = 0; x < 310; x += 7) {
                for (var y = 0; y < 155; y += 7) {
                        if (!(grey = !grey))
                                continue;
                        context.fillRect(x,y,7,7);
                }
        }
    };    
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
    var redraw = function () {
         transparentBackgroundDraw();
         if (image.background)
            context.drawImage(	
                                image.background, 
                                bg_pos.x,
                                bg_pos.y,
                                image.background.width * size.val() / 100,
                                image.background.height * size.val() / 100
                                );
    }
    banner.mousewheel(function(event) {
	size.val(parseInt(size.val()) + event.deltaY);
	size.change();
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
        redraw();
    });
    bgfile.change(function () {
        readImageFromField('game_image_small', 'background', 310, 155);
    });
    size.bind({
	change: redraw,
	keyup: redraw
    });
    readImageFromField('game_image_small', 'background', 310, 155);
    redraw();
});