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
(function(e){function w(b,a){q+=1;e("#progress_bar").progressbar("value",q/r*100);e("#p").text("("+a+") "+b);q===r&&e("#tr_loading").data("done",!0)}function m(b,a,d,f){a=e("<div>"+e.trim(a)+"</div>").text();w(a,d);clearTimeout(s);g+=1;h.push(b);k.push(a);l.push(d);n.push(f);s=setTimeout(function(){var a={action:"tp_translation",items:g},c;for(c=0;c<g;c+=1)h[c]!==h[c-1]&&(a["tk"+c]=h[c]),l[c]!==l[c-1]&&(a["ln"+c]=l[c]),k[c]!==k[c-1]&&(a["tr"+c]=k[c]),n[c]!==n[c-1]&&(a["sr"+c]=n[c]);e.ajax({type:"POST",
url:t_jp.ajaxurl,data:a,success:function(){},error:function(){}});g=0;k=[];h=[];l=[];n=[]},200)}function x(b,a,d){var f=d;"zh"===f?f="zh-chs":"zh-tw"===f&&(f="zh-cht");t_jp.dmt(a,function(a){e(a).each(function(a){m(b[a],this.TranslatedText,d,2)})},f)}function y(b,a,d){t_jp.dat(a,function(a){200<=a.responseStatus&&300>a.responseStatus&&(void 0!==a.responseData.translatedText?m(b[0],a.responseData.translatedText):e(a.responseData).each(function(a){200===this.responseStatus&&m(b[a],this.responseData.translatedText,
d,3)}))},d)}function t(b,a,d){t_jp.dgpt(a,function(a){e(a.results).each(function(a){m(b[a],this,d,1)})},d)}function z(b,a,d){t_jp.dgt(a,function(f){"undefined"!==typeof f.error?t(b,a,d):e(f.data.translations).each(function(a){m(b[a],this.translatedText,d,1)})},d)}function u(b,a,d){-1!==t_be.m_langs.indexOf(d)&&"2"===t_jp.preferred?x(b,a,d):-1===t_be.a_langs.indexOf(d)||"en"!==t_jp.olang&&"es"!==t_jp.olang?t_jp.google_key?z(b,a,d):t(b,a,d):y(b,a,d)}function v(b){var a="",d=[],f=[],m,c,p,g=0,h=[],k=
[],l;e("#tr_loading").data("done",!1);e.ajax({url:ajaxurl,dataType:"json",data:{action:"tp_post_phrases",post:b},cache:!1,success:function(b){e("#tr_translate_title").html("Translating post: "+b.posttitle);if(void 0===b.length)e("#tr_loading").html("Nothing left to translate"),e("#tr_loading").data("done",!0);else{q=r=0;for(c in b.p)r+=b.p[c].l.length;e("#tr_loading").html('<br/>Translation: <span id="p"></span><div id="progress_bar"/>');e("#progress_bar").progressbar({value:0});for(var n in b.langs){a=
b.langs[n];f=[];d=[];for(c in b.p)p=b.p[c],-1!==p.l.indexOf(a)&&(f.push(unescape(c)),d.push(p.t),p.l.splice(p.l.indexOf(a),1),0===p.l.length&&(b.length-=1,delete b.p[c]));if(f.length){for(m in f)l=f[m],g+l.length>A&&(u(k,h,a),g=0,h=[],k=[]),g+=l.length,k.push(d[m]),h.push(l);u(k,h,a)}}}}})}var s,g=0,k=[],h=[],l=[],n=[],A=512,r=0,q=0;window.translate_post=v;e(function(){t_be.post&&v(t_be.post)})})(jQuery);
