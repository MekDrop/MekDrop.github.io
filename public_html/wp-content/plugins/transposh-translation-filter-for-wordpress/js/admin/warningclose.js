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
(function(a){a(function(){a(".warning-close").click(function(){a(this).parents("div:first").hide();a.post(ajaxurl,{action:"tp_close_warning",id:a(this).attr("id")})})})})(jQuery);
