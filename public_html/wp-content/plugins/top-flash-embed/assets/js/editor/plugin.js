// closure to avoid namespace collision
(function(window, $, undefined){
	tinymce.create('tinymce.plugins.TopFlashEmbed', {
		// creates control instances based on the control's id.
		// our button's id is &quot;reg_button&quot;
		createControl : function(id, controlManager) {
			if (id == 'top_flash_button') {
				// creates the button
				var button = controlManager.createButton('top_flash_button', {
					title : window.TopFlashEmbed.Config.Locale.title, // title of the button
					image : window.TopFlashEmbed.Config.Locale.icon,  // path to the button's image
					onclick : function() {
						// do something when the button is clicked :)
						var width = $(window).width(), H = $(window).height(), W = ( 720 < width ) ? 720 : width;
						W = W - 80;
						H = H - 84;
						tb_show( window.TopFlashEmbed.Config.Locale.title, '#TB_inline?width=' + W + '&height=' + H + '&inlineId=top_flash_popup' );
					}
				});
				return button;
			}
			return null;
		}
	});
	
	// registers the plugin.
	tinymce.PluginManager.add('TopFlashEmbed', tinymce.plugins.TopFlashEmbed);
    
    // executes this when the DOM is ready
    $(function(){
        // creates a form to be displayed everytime the button is clicked
        var $cont=$('#_top_flash_popup_container');
        if (!$cont.length)
        {
            $cont=$('<div id="_top_flash_popup_container" style="display:none;"></div>');
            $('body').append($cont);
            $cont.load(window.TopFlashEmbed.Config.Settings.popup);
        }
    });
})(window, jQuery);