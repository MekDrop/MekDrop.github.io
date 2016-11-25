define(["jquery"], function($) {
	return function (id) {
		return $('#' +  id + ' [name=result]');
	}
});