jQuery(document).ready(function($) {

	// The following is based on this snippet of HTML. 
	//     <tr class="jm_mut_mimetype_tr">
	//     <td class="jm_mut_extension_td">$extension</td>
	//     <td class="jm_mut_mimetype_td">$mimetype </td>
	//     <td class="jm_mut_delete_td"><a>delete</a></td></tr>
	// We iterate over each row in the table of mimetypes and add an onclick handler
	// for each delete link targeting the extension in this row's jm_mut_extension_td cell. 
	$('tr.jm_mut_mimetype_tr').each(function() { 
		var table_row = this;
		var extension = $('td.jm_mut_extension_td', table_row)[0].innerHTML;

		$('td.jm_mut_delete_td a', this).click(function(event) { 
			ok = confirm("Are you SURE you want to disallow uploading files with " +
			             "an extension matched by '" + extension + "'?" );
			if (!ok) return;
			var data = {
				action: 'jm_mut_delete_type',
				extension_to_delete: extension,
				nonce: JmMut.delNonce
			};

		        // The ajaxurl variable should be defined for us and point to admin-ajax.php
			// This requires WordPress version 2.8 or greater.
			jQuery.post(ajaxurl, data, function(response) {
				// FIXME: Response should be checked before hiding the row.
				$(table_row).hide(500);
			});
		});
	});



	// Add the onclick handler for the add button. 
	$('#jm_mut_add_button').click(function(event) {
		extension = $('#jm_mut_add_extension').val();
		mimetype  = $('#jm_mut_add_mimetype').val();
		var data = { 
			action: 'jm_mut_add_type',
			extension_to_add: extension,
			mimetype_to_add: mimetype,
			nonce: JmMut.addNonce
		};
		jQuery.post(ajaxurl, data, function(response) { 
                        location.reload();
		}); 
	});
});

