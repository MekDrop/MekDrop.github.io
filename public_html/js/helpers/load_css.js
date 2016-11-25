// source: http://requirejs.org/docs/faq-advanced.html
define(['module'], function (module) {
	var config = module.config("");
	return function loadCss(name) {
		var link = document.createElement("link");
		link.type = "text/css";
		link.rel = "stylesheet";
		link.href = config[name];
		document.getElementsByTagName("head")[0].appendChild(link);
	}
});