define(["jquery", 'data/result', 'data/source', 'helpers/reactions'], function($, res, src, reaction) {
	return function (id, otherObjs) {
		var ret = {
			form: $('#' + id),
			source: src(id),
			result: res(id),
			'reactions': new reaction('#' + id)
		};
		if (otherObjs) {
			for (var x in otherObjs) {
				ret[x] = otherObjs[x];
			}
		}
		return ret;
	}
});