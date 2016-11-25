define(['jquery'], function ($) {
	return new (function () {
		this.showUpgradeNeeded = function () {
			$('.browserupgrade').show();
		};
	})();
});