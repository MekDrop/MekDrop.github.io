define(['jquery'], function ($) {
	return function(parentSel) {
		this.getRow = function (self) {
			return $(self).closest('.block');
        };

	};
});