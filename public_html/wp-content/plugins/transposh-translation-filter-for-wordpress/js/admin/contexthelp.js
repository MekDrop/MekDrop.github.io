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
(function(a){a(".tp_help").live("click",function(b){b.preventDefault();window.scrollTo(0,0);a("#tab-link-"+jQuery(this).attr("rel")+" a").trigger("click");a("#contextual-help-link").hasClass("screen-meta-active")||a("#contextual-help-link").trigger("click")})})(jQuery);
