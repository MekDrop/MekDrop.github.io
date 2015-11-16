define(['jquery'], function ($) {
	return function (parent_id) {
		var parent = $('#' + parent_id);
		var progress = $('<div><div><span class="glyphicon glyphicon-refresh refresh-animate" data-role="animation"></span> <span data-role="msg">Apdorojama...</span></div></div>');
		progress.hide();
		progress.msg = function (msg) {
			$('[data-role="msg"]', progress).html(msg);
		};
		progress.start = function (msg) {
			if (msg) {
				progress.msg(msg);
			}
			progress.show();
			parent.hide();			
		};
		progress.stop = function () {
			parent.show();
			progress.hide();
		};
		parent.after(progress);
		return progress;
	};
});