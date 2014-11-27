/*
 * Transposh v0.9.5.1
 * http://transposh.org/
 *
 * Copyright 2014, Team Transposh
 * Licensed under the GPL Version 2 or higher.
 * http://transposh.org/license
 *
 * Date: Sat, 25 Jan 2014 01:19:04 +0200
 */
(function(a){a(function(){a("#sortable").sortable({placeholder:"highlight",update:function(c,b){b.item.unbind("click");b.item.one("click",function(b){b.stopImmediatePropagation();a(this).click(clickfunction)})}});a("#sortable").disableSelection();a("#changename").click(function(){a(".langname").toggleClass("hidden");return!1});a("#selectall").click(function(){a("#sortable .languages").addClass("lng_active");a("#sortable .lng_active").each(function(){a("input",this).val(a(this).attr("id")+",v")});
return!1});clickfunction=function(){a(this).attr("id")!=a("#default_list li").attr("id")&&(a(this).toggleClass("lng_active"),a("input",this).val(a(this).attr("id")+(a(this).hasClass("lng_active")?",v":",")))};a(".languages").dblclick(clickfunction).click(clickfunction);a("#default_lang").droppable({accept:".languages",activeClass:"highlight_default",drop:function(c,b){a("#default_list").empty();a(b.draggable.clone().removeAttr("style").removeClass("lng_active")).appendTo("#default_list").show("slow");
a("#default_list .logoicon").remove();a("#sortable").find("#"+b.draggable.attr("id")).addClass("lng_active")}});a("#sortiso").click(function(){a("#sortable li").sort(function(c,b){return a(c).attr("id")==a("#default_list li").attr("id")?-1:a(b).attr("id")==a("#default_list li").attr("id")?1:a(c).attr("id")>a(b).attr("id")?1:-1}).remove().appendTo("#sortable").dblclick(clickfunction).click(clickfunction);return!1});a("#sortname").click(function(){a("#sortable li").sort(function(c,b){langa=a(".langname",
c).filter(function(){return!a(this).hasClass("hidden")}).text();langb=a(".langname",b).filter(function(){return!a(this).hasClass("hidden")}).text();langdef=a(".langname","#default_list li").filter(function(){return!a(this).hasClass("hidden")}).text();return langa==langdef?-1:langb==langdef?1:langa>langb?1:-1}).remove().appendTo("#sortable").dblclick(clickfunction).click(clickfunction);return!1})})})(jQuery);
