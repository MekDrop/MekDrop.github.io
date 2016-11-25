define(["jquery"], function($) {
	return function (id) {
		return $('#' +  id + ' [name=source], #' +  id + ' [name="source[]"]');
	}
});