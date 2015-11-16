define(["jquery", "data/form", "helpers/loading"], function($, jForm, loading) {
	var obj = jForm('tool'),
		loader = loading('tool');
	obj.form.submit(function(e) {
		e.preventDefault();
		loader.start();
		$.ajax({
			type: "POST",
			async: true,
			url: '/php/adreso-konvertavimas-http-https-data.php',
			headers: {
				'fetch-url': obj.source.val()
			},
			crossDomain: true,
			success: function (data, textStatus, jqXHR) {
				obj.source.val('');
				obj.result.val(data);				
				loader.stop();
			},
			error: function (jqXHR, textStatus, errorThrown) {
				obj.result.val('ERR: ' + errorThrown);
				loader.stop();
			}
		});
	});
	obj.result.click(function () {
		obj.result.select();
	});
});