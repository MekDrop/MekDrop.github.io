jQuery(document).ready(function(){
	// prepare the color picker (3.5+ only)
	jQuery('.color-field').wpColorPicker();
	
	// File uploader
	var file_frame;
	jQuery('#square_img_button').on('click', function( event ){
 
		event.preventDefault();
	 
		// If the media frame already exists, reopen it.
		if ( file_frame ) {
			file_frame.on( 'select', function() {
			  // We set multiple to false so only get one image from the uploader
			  attachment = file_frame.state().get('selection').first().toJSON();
			  jQuery('#squareimgurl').val(attachment.url);
			});

			file_frame.open();
			return;
		}
		// Create the media frame.
		file_frame = wp.media.frames.file_frame = wp.media({
		  title: 'Select an Image',
		  button: {
			text: 'Use this Image',
		  },
		  multiple: false  // only allow the one file to be selected
		});
		// When an image is selected, run a callback.
		file_frame.on( 'select', function() {
		  // We set multiple to false so only get one image from the uploader
		  attachment = file_frame.state().get('selection').first().toJSON();
		  jQuery('#squareimgurl').val(attachment.url);
		});
		// Finally, open the modal
		file_frame.open();
	});

	jQuery('#wide_img_button').on('click', function( event ){
 
		event.preventDefault();
	 
		// If the media frame already exists, reopen it.
		if ( file_frame ) {
			file_frame.on( 'select', function() {
			  // We set multiple to false so only get one image from the uploader
			  attachment = file_frame.state().get('selection').first().toJSON();
			  jQuery('#wideimgurl').val(attachment.url);
			});

			file_frame.open();

			return;
		}
		// Create the media frame.
		file_frame = wp.media.frames.file_frame = wp.media({
		  title: 'Select an Image',
		  button: {
			text: 'Use this Image',
		  },
		  multiple: false  // only allow the one file to be selected
		});
		// When an image is selected, run a callback.
		file_frame.on( 'select', function() {
		  // We set multiple to false so only get one image from the uploader
		  attachment = file_frame.state().get('selection').first().toJSON();
		  jQuery('#wideimgurl').val(attachment.url);
		});
		// Finally, open the modal
		file_frame.open();
	});
	
});

