define(['jquery'], function ($) {
	return function (owner) {
		var obj = $(owner);
		this.error = function (error) {
			if (!error.split) {
				return;
			}
			var prefix = 'error' + error.split('-').map(function(txt){
				return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
			}).join('');
			switch(obj.data(prefix + 'Action')) {
				case 'alert':
					alert(obj.data(prefix + 'Msg'));
				break;
				case 'show':
					$(obj.data(prefix + 'Target')).show();
				break;
			}
		};
	};
});