jQuery(document).delegate('a[href*=".png"], a[href*=".jpeg"], a[href*=".jpg"], a[href*=".gif"], .fancybox-iframe', {
	click: function(a) {
	    a.preventDefault();
		jQuery(this).ekkoLightbox();
	},	
});

jQuery(function() {
    jQuery('a[href*=".png"] img, a[href*=".jpeg"] img, a[href*=".jpg"] img, a[href*=".gif"] img').addClass("thumbnail").removeAttr("width").removeAttr("height");
	jQuery('[data-role="tooltip"]').click(function (e) {
		e.preventDefault();
		e.stopPropagation();
	}).tooltip(); 
});

