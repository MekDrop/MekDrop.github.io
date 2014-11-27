jQuery(function () {
	var updateImageEditorView = function () {            
		if (jQuery("#row-game").is(":visible") && !jQuery('#row-game input[name=game_id]').val()) {
			jQuery('#row-image').hide();
		} else {
			switch (parseInt(jQuery('#row-size input:checked').val())) {
				case 1:
					jQuery('#row-image, #small_image_editor').show();
					jQuery('#large_image_editor').hide();
                                        jQuery('#game_image_small, #game_image_size_small').attr('required', 'required');
                                        jQuery('#game_name, #game_platform, #game_image, #game_image_size, #game_flag').removeAttr('required');
				break;
				case 2:
					jQuery('#row-image, #large_image_editor').show();
					jQuery('#small_image_editor').hide();
                                        jQuery('#game_image_small, #game_image_size_small').removeAttr('required');
                                        jQuery('#game_name, #game_platform, #game_image, #game_image_size, #game_flag').attr('required', 'required');
				break;
				default:
					jQuery('#row-image').hide();
				break;
			}
		}
	};
        var updateButtons = function () {
            var disabled = false;
            jQuery('form.add input[type=text][required], form.add input[type=number][required], form.add input[type=url][required], form.add input[type=file][required]').each (function () {
                var obj = jQuery(this);
                console.log(obj.attr('name') + '=' + obj.val());
                if (!obj.val())
                    disabled = true;
            });            
            if (disabled)
                jQuery('#row-buttons button').attr('disabled', 'disabled');
            else
                jQuery('#row-buttons button').removeAttr('disabled');
        };
        jQuery(jQuery('#row-buttons button').get(0)).click(function () {
            var image_field = jQuery('#row-image input[name=image]');
            switch (parseInt(jQuery('#row-size input:checked').val())) {
                    case 1:
                            image_field.val(jQuery('#banner_small').get(0).toDataURL());
                    break;
                    case 2:
                            image_field.val(jQuery('#banner').get(0).toDataURL());
                    break;                   
            }
            jQuery('#row-image div').remove();
            jQuery('#row-buttons button').get(0).form.submit();
        });
        jQuery('#game_name, #game_platform, #game_image, #game_image_size, #game_flag, #game_image_small, #game_image_size_small').bind({
            keyup: updateButtons,
            click: updateButtons,
            change: updateButtons
        });
        jQuery('#row-size input').bind({
            click: updateImageEditorView,
            change: updateImageEditorView
        });
        jQuery('#row-url input[name=url]').change(function () {
            jQuery.ajax({
                url: 'gettitle.php',
                data: {
                    url: jQuery('#row-url input[name=url]').val()
                },
                method: 'get',
                dataType: 'text',
                success: function( data, status, xhr ) {
                        //data = atob(data);
                        console.log("Title: " + data);
                        jQuery('#row-url input[name=name]').val(data);
                },
                error: function () {
                        jQuery('#row-url input[name=name]').val('');
                }
            });
        });
        jQuery('#row-url input[name=url]').keypress(jQuery('#row-url input[name=url]').change);
        jQuery('#row-size input, #row-url input').bind({
            click: updateButtons,
            change: updateButtons,
            keyup: updateButtons
        });
	jQuery('#row-type select').change(function () {
		var option = jQuery(this).find('option:selected');
		if (option.attr('data-showgameselector') == 0) {
			jQuery('#row-platform select, #row-game input').removeAttr('required');     
			jQuery('#row-platform, #row-game').hide();
		} else {
			jQuery('#row-platform select, #row-game input').attr('required', 'required');
			jQuery('#row-platform, #row-game').show();
		}
		jQuery('#row-game input[name=game_id]').data('firstgame', option.attr('data-firstgame'));
		if (option.attr('data-size-m') == 0) {
			jQuery('#size-small').attr('disabled', 'disabled');
			jQuery('#size-small').removeAttr('checked');
			jQuery('#size-large').attr('checked', 'checked');
		} else {
			jQuery('#size-small').removeAttr('disabled');
		} 
		if (option.attr('data-size-d') == 0) {
			jQuery('#size-large').attr('disabled', 'disabled');
			jQuery('#size-large').removeAttr('checked');
			jQuery('#size-small').attr('checked', 'checked');
		} else {                
			jQuery('#size-large').removeAttr('disabled');
		}
		updateImageEditorView();
                updateButtons();
	});
	jQuery('#row-type select').change();        
	jQuery('#row-platform select').data('prev-platform', jQuery('#row-platform select').val());
	jQuery('#row-platform select').change(function () {
		var input = jQuery('#row-game input[name=game]');
		var input2 = jQuery('#row-game input[name=game_id]');
		var select = jQuery(this);
		var nval = select.val();
		input.data(select.data('prev-platform'), input.val());
		input2.data(select.data('prev-platform'), input2.val());
		select.data('prev-platform', nval);
		var oval = input.data(nval);
		if (!oval)
			oval = '';
		input.val(oval);
		oval = input2.data(nval);
		if (!oval)
			oval = '';
		input2.val(oval);
		jQuery('#game_platform').val(nval);
		jQuery('#game_platform').change();
		updateImageEditorView();
                updateButtons();
	});
	jQuery( "#row-game input[name=game]").change(function () {
		jQuery( "#row-game input[name=game_id]" ).val('');
		updateImageEditorView();
                updateButtons();
	});        
	jQuery( "#row-game input[name=game]").autocomplete({
	  minLength: 2,
	  select: function( event, ui ) {
		 jQuery( "#row-game input[name=game_id]" ).val(ui.item.id);
 		 jQuery('#game_name').val(ui.item.label);
		 jQuery('#game_name').change();
		 if (jQuery('#row-game input[name=game_id]').data('firstgame') == 1) {
			// TODO: add some logics
		 }
		 updateImageEditorView();
                 updateButtons();
	  },
	  source: function( request, response ) {            
		jQuery.ajax({
			url: 'http://games.lt/team-link/',
			data: {
				token: 'YxXpMUdBDUUq8qk1mGWKfETPPHsXsVlcQ2vedV9HyisNeo9Mk6',
				cmd: 'get',
				action: 'games',
				system: jQuery('#row-platform select').val(),
				tb: request.term
			},
			jsonp: 'callback',
			dataType: 'jsonp',
			crossDomain: true,
			success: function( data, status, xhr ) {
				data = atob(data);
				data = unserialize(data);
				var ret = [];
				for(var x in data) {
					ret.push({id: x, label: data[x]});
				}
				response(ret);
			}
		});
	}
	});
});