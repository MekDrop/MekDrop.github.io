define(["jquery", "helpers/loading", "Autolinker", "highlightjs", "helpers/load_css", "download"], function ($, loading, Autolinker, highlightJS, load_css, download) {

    load_css('highlightjs');

    var loader = loading("api_form");

    // Params table
    var lib = {
        helpers: {
            highlight: function (obj) {
                hljs.highlightBlock(obj);
            },
            makeLinks: function () {
                $('.full-post code').each(function () {
                    var obj = $(this);
                    obj.html(
                            Autolinker.link(
                                    obj.html(),
                                    {
                                        replaceFn: function (autolinker, match) {
                                            var href = match.getAnchorHref();
                                            if (match.getType() == 'url' && href.substr(href.length - 1, 1) == "'")
                                            {
                                                return '<a href="' + href.substr(0, href.length - 1) + '" target="_blank">' + match.getAnchorText() + '</a>' + "'";
                                            } else {
                                                return true;
                                            }
                                        }
                                    }
                            )
                            );
                });
            }
        },
        global: {
            defaultData: {
                server: {
                    url: '',
                    request: {
                        type: 'post',
                        ext: '',
                        format: 'default',
                        http_version: 'auto'
                    },
                    result: {
                        type: 'json'
                    },
                    cookies: {
                        save: 'no'
                    }
                },
                params: []
            },
            getRow: function (self) {
                return $(self).closest('.block');
            },			
            convert: {
				objToArray: function (obj) {
					if ($.isArray(obj)) 
						return obj;
					var tr = [];
					for(var k in obj) {
						tr.push(obj[k]);
					}
					return tr;
				},
                from: {
                    '0.1': function (ret) {
                        var tmpRet = {
                            server: {
                                url: ret.server_url,
                                request: {
                                    type: ret.server_request_type,
                                    ext: ret.server_request_ext,
									http_version: ret.server_request_http_version,
									format: ret.server_request_format
                                },
                                result: {
                                    type: ret.server_result_type
                                },
                                cookies: {
                                    save: ret.save_cookies
                                }
                            },
                            params: []
                        };

						ret.param_name = lib.global.convert.objToArray(ret.param_name);
						ret.param_type = lib.global.convert.objToArray(ret.param_type);
						ret.param_value = lib.global.convert.objToArray(ret.param_value);
						
                        for (var i = 0; i < ret.param_name.length; i++) {
                            tmpRet.params.push({
                                name: ret.param_name[i],
                                type: ret.param_type[i],
                                value: ret.param_value[i]
                            });
                        }
						return tmpRet;
                    }
                }
            },
			getFileName: function (form) {
				return $("[name=server_url]").first().val().replace(/.*?:\/\//g, "") + '(' + $("[name=server_request_type]").first().val() + ';' + $("[name=server_result_type]").first().val() + ').json';
			},
			saveToString: function (form) {
                var ret = {
                    server: {
                        url: $("[name=server_url]").first().val(),
                        request: {
                            type: $("[name=server_request_type]").first().val(),
                            ext: $("[name=server_request_ext]").first().val(),
                            format: $("[name=server_request_format]").first().val(),
                            http_version: $("[name=server_request_http_version]").first().val(),
                        },
                        result: {
                            type: $("[name=server_result_type]").first().val(),
                        },
                        cookies: {
                            save: $("#save_cookie_yes").first().attr("checked") ? true : false
                        }
                    },
                    params: []
                };
                $(".params_table .block").each(function () {
                    var tr = $(this);
                    ret.params.push({
                        name: $(".param_name_changer", tr).val(),
                        type: $(".param_type_changer", tr).val(),
                        value: $(".param_value_changer", tr).val()
                    });
                });
                return window.JSON.stringify(ret);
			},
			getFieldTypes: function () {
				var ret = [];
				$('.params_table .block:first-child [name="param_type"] option').each(function () {
					ret.push($(this).val());
				});
				return ret;
			},
            loadFromString: function (str, form) {
                var ret = $.parseJSON(str);
                if (ret.server_url) {
                    ret = lib.global.convert.from['0.1'](ret);
                }
                if (!ret || !ret.server) {                    
                    return false;
                }
                ret = $.extend(true, {}, lib.global.defaultData, ret);
                $("[name=server_url]", form).val(ret.server.url);
                $("[name=server_request_type]", form).val(ret.server.request.type);
                $("[name=server_request_ext]", form).val(ret.server.request.ext);
                $("[name=server_result_type]", form).val(ret.server.result.type);
                $("[name=server_request_format]", form).val(ret.server.request.format);
                $("[name=server_request_http_version]", form).val(ret.server.request.http_version);
                if (ret.server.cookies.save == 'yes') {
                    $("#save_cookie_yes", form).attr("checked", "checked");
                    $("#save_cookie_no", form).removeAttr("checked");
                } else {
                    $("#save_cookie_yes", form).removeAttr("checked");
                    $("#save_cookie_no", form).attr("checked", "checked");
                }
                var needs = ret.params.length - 1;
				var field_types = lib.global.getFieldTypes();
				//if (needs > 0) {
					$(".params_table .block:gt(" + needs + ")", form).remove();
					var ecount = $(".params_table .block", form).length;
					for (var i = ecount; i < (needs + 1); i++) {
						lib.add_button.click();
					}
					var m = 0;
					$(".params_table .block", form).each(function () {
						var tr = $(this);
						$(".param_name_changer", tr).val(ret.params[m].name);
						$(".param_type_changer", tr).val(($.inArray(ret.params[m].type, field_types) != -1)?ret.params[m].type:'text');
						$(".param_value_changer", tr).val(ret.params[m].value);
						m++;
					});
				//}                
                $('.server_request_type_changer').click();
                $('.server_request_format_changer').click();
                $('.server_request_format_changer').change();
                $('.server_request_type_changer').change();
				return true;
            },
            language: {
                get: function (lang) {
                    var id = "#language_table #lang_" + lang;
                    return $(id).html();
                }
            },
            error: {
                show: function (msg) {
                    var obj = $('#page_error');
                    obj.html(msg);
                    obj.show();
                    return obj;
                },
                hide: function () {
                    var obj = $('#page_error');
                    obj.hide();
                }
            }
        },
        param_name_changer: {
            keyup: function () {
                var obj = $(this);
                var row = lib.global.getRow(obj);
                var clear_row = $(".clear_row", row);

                var v1 = obj.val();
                var v2 = $(".param_value_changer", row).val();

                /*if (v1 == "" || v2 == "") {
                    clear_row.attr("disabled", "disabled");
                } else {
                    clear_row.removeAttr("disabled");
                }*/
            }
        },
        param_value_changer: {
            keyup: function () {
                var obj = $(this);
                var row = lib.global.getRow(obj);
                var clear_row = $(".clear_row", row);

                var v1 = obj.val();
                var v2 = $(".param_name_changer", row).val();

               /* if (v1 == "" || v2 == "") {
                    clear_row.attr("disabled", "disabled");
                } else {
                    clear_row.removeAttr("disabled");
                }*/
            }
        },
        param_type_changer: {
            change: function () {
                var obj = $(this);
                var row = lib.global.getRow(obj);
                var param_value_changer = $("input.param_value_changer", row);
                var ninput = $("<input />");
                var value = $("option:selected", obj).attr("value");
                ninput.attr("type", value);
                ninput.attr("name", param_value_changer.attr("name"));
                ninput.attr("class", param_value_changer.attr("class"));
                ninput.attr("style", param_value_changer.attr("style"));
                ninput.val(param_value_changer.val());
                param_value_changer.replaceWith(ninput);
            }
        },
        dublicate_row: {
            click: function () {
                var row = lib.global.getRow(this);
                var r2 = row.clone();
                var table = row.parent();
                table.append(r2);
                r2.show();
                $(".param_type_changer", r2).change(lib.param_type_changer.change);
                $(".param_type_changer", r2).val($("input.param_value_changer", r2).attr("type"));
                $(".dublicate_row", r2).click(lib.dublicate_row.click);
                $(".clear_row", r2).click(lib.clear_row.click);
                $(".param_name_changer", r2).keyup(lib.param_name_changer.keyup);
                $(".param_value_changer", r2).keyup(lib.param_value_changer.keyup);
                $(".remove_row", r2).click(lib.remove_row.click);
                $(".remove_row", r2).removeAttr("disabled");
            }
        },
        clear_row: {
            click: function () {
                var row = lib.global.getRow(this);
                $("input.param_value_changer", row).val("");
                $("input.param_name_changer", row).val("");
                //$(this).attr("disabled", "disabled");
				if(typeof(Storage) !== "undefined") {
					sessionStorage.clear();
					$('input, select', $('#api_form')).change();
				}
            }
        },
        remove_row: {
            click: function () {
                var row = lib.global.getRow(this);
                row.remove();
				if(typeof(Storage) !== "undefined") {
					sessionStorage.clear();
					$('input, select', $('#api_form')).change();
				}
            }
        },
        add_button: {
            click: function () {
                var row = $(".params_table .block").first();
                $(".dublicate_row", row).click();
                $(".params_table .block:last input.param_name_changer").val("");
                $(".params_table .block:last input.param_value_changer").val("");
            }
        },
        clear_form: {
            click: function () {
                var i = 0;
                $(".params_table tbody tr").each(
                        function () {
                            if (i > 0) {
                                var obj = $(this);
                                obj.remove();
                            }
                            i++;
                        }
                );
				if(typeof(Storage) !== "undefined") {
					sessionStorage.clear();
					$('input, select', $('#api_form')).change();
				}				
            }
        },
        load_button: {
            click: function () {
                var file = $("<input type=\"file\" accept=\"application/json\" />");
                var obj = $(this);
                var form = obj.closest("form");
                var fobj = file;
                file.change(function () {
                    var file = fobj.get(0).files[0];
                    var reader = new FileReader();
                    reader.onload = function (fileData) {
                        if (!lib.global.loadFromString(reader.result, form)){
							alert(lib.global.language.get('bad_format'));
                        }
						$('input, select', $('#api_form')).change();
                    };
                    reader.readAsText(file);
                });
                file.click();
            }
        },
        save_button: {
            click: function () {
                var obj = $(this)
					jRet = lib.global.saveToString(null),
                    filename = lib.global.getFileName(null);
                download(jRet, filename, "image/png");
            }
        },
        server_request_type_changer: {
            change: function () {
                var obj = $(this);
                switch (obj.val()) {
                    case 'delete':
                    case 'options':
                    case 'trace':
                        $('.request_params').hide();
                        break;
                    case 'get':
                    case 'post':
                    case 'put':
                    case 'patch':
                        $('.request_params').show();
                        break;
                    default:
                        $('.request_params').show();
                }
            },
        },
        server_request_format_changer: {
            change: function () {
                var obj = $(this);
                switch (obj.val()) {
                    case 'special_header':
                        $('.ext_server_data').show();
                        break;
                    default:
                        $('.ext_server_data').hide();
                }
            },
        }
    };
    $(".param_type_changer").change(lib.param_type_changer.change);
    $(".dublicate_row").click(lib.dublicate_row.click);
    $(".clear_row").click(lib.clear_row.click);
    $(".remove_row").click(lib.remove_row.click);
    $(".param_name_changer").keyup(lib.param_name_changer.keyup);
    $(".param_value_changer").keyup(lib.param_value_changer.keyup);
    $(".add_button").click(lib.add_button.click);
    $(".clear_form").click(lib.clear_form.click);
    $(".load_button").click(lib.load_button.click);
    $(".save_button").click(lib.save_button.click);
    $('.server_request_type_changer').click(lib.server_request_type_changer.change);
    $('.server_request_type_changer').change(lib.server_request_type_changer.change);
    $('.server_request_type_changer').change();
    $('.server_request_format_changer').change(lib.server_request_format_changer.change);
    $('.server_request_format_changer').change();

    $('form[data-previously-submited]').each(
            function () {
                var form = $(this);
                var str = decodeURIComponent(form.data('previously-submited'));
                if (str) {
                    if (lib.global.loadFromString(str, form)) {
                        $('.result_area', form).show()
                    }
                    ;
                }
            }
    );


    $('a[data-for]').each(function () {
        var obj = $(this);
        obj.attr('href', '');
        obj.click(function () {
            var obj = $(this);
            var form = $('#' + obj.data('for'));
            var s2 = obj.data('linkdata');
            var str = decodeURIComponent(s2);
            if (str && confirm(lib.global.language.get('load_this'))) {
                lib.global.loadFromString(str, form);
				$('input, select', $('#api_form')).change();
			}
            return false;
        });
    });

    // Needs Script
    $('.need_script').show();

	if(typeof(Storage) !== "undefined") {
		var da = {};
		var ls_prefix = 'form.data.';
		for (var x in sessionStorage) {
			if (x.indexOf(ls_prefix) === 0)
			{
				var name = x.substr(ls_prefix.length);
				if (name.substr(name.length - 1 ) == ']') {
					var o = name.indexOf('[');
					var sname = name.substr(0, o);
					var index = name.substr(o + 1, name.length - 2 -o);
					if (!da[sname]) {
						da[sname] = {};
					}
					da[sname][index] = sessionStorage[x];
				} else {
					da[name] = sessionStorage[x];
				}
			}
		}
		lib.global.loadFromString(window.JSON.stringify(da), $('#api_form'));
		$('#api_form').delegate('input, select', 'change', function () {
			var obj = $(this);
			var name = ls_prefix  + obj.attr('name');
			if (name.substr(name.length - 2) == '[]') {
				var index = $('[name="' + obj.attr('name') + '"]').index(obj);
				name = name.substr(0, name.length - 2) + '[' + index + ']';
			}
			sessionStorage[name] = [obj.val()];
		});
	}

    // form
    $('#api_form').submit(function (e) {
        e.preventDefault();
        loader.start('Apdorojama');
        var formData = new FormData($('#api_form')[0])
        $.ajax({
            type: "POST",
            async: true,
            url: '/php/http-uzklausu-tikrintuvas.php',
            data: formData,
            dataType: 'html',
            cache: false,
            contentType: false,
            processData: false,
            crossDomain: true,
            success: function (data, textStatus, jqXHR) {
                var result = $('#api_form .result_area').first();
                code = result.find('code').first();
                code.html(data);
                code.removeClass();
                switch (jqXHR.getResponseHeader ? jqXHR.getResponseHeader("content-type").split(';', 1)[0] : null) {
                    case 'text/html':
                        code.addClass('html').addClass('pre');
                        break;
                    case 'application/json':
                        code.addClass('json').addClass('pre');
                        code.html(code.html().replace(/\\\//g, '/'));
                        break;
                    case 'application/header':
                        code.addClass('http').addClass('pre');
                        break;
                    default:
                        code.addClass('nohighlight');
                        break;
                }
                result.show();
                loader.stop();
                lib.helpers.makeLinks();
                lib.helpers.highlight(code.get(0));
            },
            error: function (jqXHR, textStatus, errorThrown) {
                lib.global.error.show(errorThrown);
                loader.stop();
            }
        });
    });

});