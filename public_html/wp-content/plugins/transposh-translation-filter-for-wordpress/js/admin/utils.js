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
(function(a){a(function(){a.ajaxSetup({cache:!1});a("#transposh-reset-options").click(function(){if(!confirm("Are you sure you want to do this?")||!confirm("Are you REALLY sure you want to do this, your configuration will be reset?"))return!1;a.post(ajaxurl,{action:"tp_reset"})});backupclick=function(){a("#transposh-backup").unbind("click").click(function(){return!1}).text("Backup In Progress");a.post(ajaxurl,{action:"tp_backup"},function(b){var c="red";"2"==b[0]&&(c="green");a("#backup_result").html(b).css("color",
c);a("#transposh-backup").unbind("click").click(backupclick).text("Do Backup Now")});return!1};a("#transposh-backup").click(backupclick);cleanautoclick=function(b,c){if(!confirm("Are you sure you want to do this?")||0==b&&!confirm("Are you REALLY sure you want to do this?"))return!1;var d=c.text();c.unbind("click").click(function(){return!1}).text("Cleanup in progress");a.post(ajaxurl,{action:"tp_cleanup",days:b},function(a){c.unbind("click").click(function(){cleanautoclick(b,c);return!1}).text(d)});
return!1};a("#transposh-clean-auto").click(function(){cleanautoclick(0,a(this));return!1});a("#transposh-clean-auto14").click(function(){cleanautoclick(14,a(this));return!1});maintclick=function(b){if(!confirm("Are you sure you want to do this?"))return!1;var c=b.text();b.unbind("click").click(function(){return!1}).text("Maintenance in progress");a.post(ajaxurl,{action:"tp_maint"},function(a){b.unbind("click").click(function(){maintclick(b);return!1}).text(c)});return!1};a("#transposh-maint").click(function(){maintclick(a(this));
return!1});do_translate_all=function(){a("#progress_bar_all").progressbar({value:0});stop_translate_var=!1;a("#tr_loading").data("done",!0);a.ajaxSetup({cache:!1});a.ajax({url:ajaxurl,dataType:"json",data:{action:"tp_translate_all"},cache:!1,success:function(b){dotimer=function(c){a("#tr_allmsg").text("");clearTimeout(timer2);a("#tr_loading").data("done")||4<a("#tr_loading").data("attempt")?(a("#progress_bar_all").progressbar("value",(c+1)/b.length*100),a("#tr_loading").data("attempt",0),translate_post(b[c]),
"undefined"===typeof b[c+1]||stop_translate_var||(timer2=setTimeout(function(){dotimer(c+1)},5E3),a("#tr_allmsg").text("Waiting 5 seconds..."))):(a("#tr_loading").data("attempt",a("#tr_loading").data("attempt")+1),timer2=setTimeout(function(){dotimer(c)},15E3),a("#tr_allmsg").text("Translation incomplete - Waiting 15 seconds - attempt "+a("#tr_loading").data("attempt")+"/5"))};timer2=setTimeout(function(){dotimer(0)},0)}});a("#transposh-translate").text("Stop translate");a("#transposh-translate").unbind("click").click(stop_translate);
return!1};stop_translate=function(){clearTimeout(timer2);stop_translate_var=!0;a("#transposh-translate").text("Translate All Now");a("#transposh-translate").unbind("click").click(do_translate_all);return!1};a("#transposh-translate").click(do_translate_all)})})(jQuery);
