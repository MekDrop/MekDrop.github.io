define(["jquery", "data/form", "helpers/loading", "download"], function($, jForm, loading, download) {
	var obj = jForm('tool'),
		loader = loading('tool'),
		another_files = $('#tool .another_files').first(),
		update_another_file_last = function () {
			var last = another_files.find('.file').last(),
				removeBtn = last.find('.remove'),
				input = last.find('[type=file]').first();
			removeBtn.prop('disabled', true);
			removeBtn.click(function () {
				last.remove();
				var files = another_files.find('.file');
				if (files.length == 0) {
					another_files.find('.block').append(files.last().clone());
					update_another_file_last();
				}
			});
			input.one('change', function () {
				removeBtn.prop('disabled', false);
				another_files.find('.block').append(last.clone());
				update_another_file_last();				
			});
		}

		update_another_file_last();
		another_files.show();

	obj.form.submit(function(e) {
		e.preventDefault();
		loader.start();
		var formData = new FormData($('#tool')[0])
		$.ajax({
			type: "POST",
			async: true,
			url: '/php/pasleptas-rar-archyvas-paveiksliuke.php',
			data: formData,
			dataType: 'json',
			cache: false,
            contentType: false,
            processData: false,
			crossDomain: true,
			success: function (data, textStatus, jqXHR) {
				download(data[1], data[0]);
				loader.stop();
			},
			error: function (jqXHR, textStatus, errorThrown) {
				alert('ERR: ' + errorThrown);
				loader.stop();
			}
		});
	});
});