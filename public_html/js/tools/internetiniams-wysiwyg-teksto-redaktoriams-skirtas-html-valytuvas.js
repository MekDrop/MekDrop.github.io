define(["jquery", "data/form", "helpers/loading", "tinymce"], function($, jForm, loading, tmce) {
	$(function () {
		tinymce.init({
			selector: "textarea",
		    theme: 'modern',
		    toolbar: "insertfile undo redo  | bold italic | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | l      ink image | print preview media fullpage | forecolor backcolor emoticons",
		    auto_focus: true,
			menu: {
			}
	   });
	});

	var obj = jForm('tool'),
		loader = loading('tool'),
		replace = [
			[
				/\r/igm,
				' '
			],
			[
				/\n/igm,
				' '
			],
			[
				/<(p|li)[^>]*?(\/?)>/igm,
				"<\$1\$2>"
			],
			[
				/<p><br \/><\/p>/igm,
				''
			],
			[
				/<div><br \/><\/div>/igm,
				''
			],
			[
				/<div>([ ]+)<p>/i,
				'<div><p>'
			],
			[
				/<li>([ ]+)<p>/i,
				'<li><p>'
			],
			[
				/<\/p>([ ]+)<\/li>/i,
				'</p></li>'
			],
			[
				/<span>(.*?)<\/span>/i,
				"\$1"
			],
			[
				/<\/li>([ ]+)<li>/i,
				'</li><li>'
			],
			[
				/<\/p>([ ]+)<p>/i,
				'</p><p>'
			],
			[
				/<li><p>(.*?)<\/p><\/li>/i,
				"<li>\$1</li>"
			],
			[
				/<p>(.*?)<\/p>/i,
				"<div>\$1</div>",
				'p_to_div'
			],
			[
				/<li>(.*?)<\/li>/i,
				"<div style=\"display: list-item;\">\$1</div>",
				'list_to_div'
			],
			[
				/<ul>(.*?)<\/ul>/i,
				"<div style=\"list-style-type: disc;\">\$1</div>",
				'list_to_div'
			],
			[
				/<ol>(.*?)<\/ol>/i,
				"<div style=\"list-style-type: hebrew;\">\$1</div>",
				'list_to_div'
			],
			[
				/<\/div>(\s+)<div>/i,
				'</div><div>'
			]
		];

	obj.form.submit(function(e) {
		e.preventDefault();
		loader.start();

		var ret = tinyMCE.activeEditor.getContent();		
		for(var i = 0; i < replace.length; i++) {
			if (replace[i][2] !== undefined && !$('[name=' + replace[i][2] + ']').first().is(':checked')) {
				continue;
			}
			ret = ret.replace(replace[i][0], replace[i][1]);	
		}

		tinyMCE.get('result').setContent(ret);

		loader.stop();
	});
	obj.result.click(function () {
		obj.result.select();
	});
});