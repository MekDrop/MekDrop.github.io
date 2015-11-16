define(["jquery", "data/form", "helpers/loading"], function($, jForm, loading) {
	require(["php.js/functions/strings/htmlentities", "php.js/functions/strings/nl2br", "php.js/functions/strings/get_html_translation_table"]);

	var obj = jForm('tool'),
		loader = loading('tool'),
		replace = [
			[
				/\[code\](.*?)\[\/code\]/igm,
				"<pre>\$1</pre>"
			],
			[
				/\[li\](.*?)\[\/li\]/igm,
				"<div><b>*</b> \$1</div>"
			],
			[
				/\[b\](.*?)\[\/b\]/igm,
				"<b>\$1</b>"
			],
			[
				/\[i\](.*?)\[\/i\]/igm,
				"<i>\$1</i>"
			],
			[
				 /\[u\](.*?)\[\/u\]/igm,
				"<u>\$1</u>"
			],
			[
				/\[s\](.*?)\[\/s\]/igm,
				"<span style=\"text-decoration: line-through;\">\$1</span>"
			],
			[
				/\[c\](.*?)\[\/c\]/igm,
				"<cite>\$1</cite>"
			],
			[
				/\[tt\](.*?)\[\/tt\]/igm,
				"<span style=\"font-family:monospace;\">\$1</span>"
			],
			[
				/\[ttext\](.*?)\[\/ttext\]/igm,
				"<span style=\"font-family:monospace;\">\$1</span>"
			],
			[
				/\[color=(.*)\](.*?)\[\/color\]/igm,
				"<span style=\"color: \$1\">\$2</span>"
			],
			[
				/\[colour=(.*?)\](.*)\[\/colour\]/igm,
				"<span style=\"color: \$1\">\$2</span>"
			],
			[
				/\[size=(.*?)\](.*?)\[\/size\]/igm,
				"<span style=\"font-size: \$1;\">\$2</span>"
			],
			[
				/\[img\](.*?)\[\/img\]/igm,
				"<img src=\"\$1\" alt=\"\" title=\"\" />"
			],
			[
				/\[img=(.*)\](.*?)\[\/img\]/igm,
				"<img src=\"\$1\" alt=\"\$2\" title=\"\$2\" />"
			],
			[
				/\[img (.*?)\](.*?)\[\/img\]/igm,
				"<img src=\"\$1\" alt=\"\$2\" title=\"\$2\" />"
			],
			[
				/\[url=(.*)\](.*?)\[\/url\]/igm,
				"<a href=\"\$1\">\$2</a>"
			],
			[
				/\[url (.*?)\](.*?)\[\/url\]/igm,
				"<a href=\"\$1\">\$2</a>"
			],
			[
				/\[url\](.*?)\[\/url\]/igm,
				"<a href=\"\$1\">\$1</a>"
			],
			[
				/\[quote\](.*?)\[\/quote\]/igm,
				"<blockquote>\$1</blockquote>"
			],
			[
				/""(.*?)""/igm,
				"\"\$1\""
			]
		];

	obj.form.submit(function(e) {
		e.preventDefault();
		loader.start();

		var ret = nl2br(obj.source.val());
		for(var i = 0; i < replace.length; i++) {
			ret = ret.replace(replace[i][0], replace[i][1]);	
		}

		obj.result.val(ret);

		loader.stop();
	});
	obj.result.click(function () {
		obj.result.select();
	});
});