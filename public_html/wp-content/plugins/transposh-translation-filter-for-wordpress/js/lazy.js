/*
 * xLazyLoader 1.5 - Plugin for jQuery
 * 
 * Load js, css and images asynchron and get different callbacks
 *
 * Dual licensed under the MIT (http://www.opensource.org/licenses/mit-license.php)
 * and GPL (http://www.opensource.org/licenses/gpl-license.php) licenses.
 *
 * Depends:
 *   jquery.js
 *
 *  Copyright (c) 2010 Oleg Slobodskoi (jsui.de)
 */
(function(a){function n(){function f(b,a){n[b](a,function(b){"error"==b?g.push(a):k.push(a)&&c.each(a);r()},"lazy-loaded-"+(c.name?c.name:(new Date).getTime()),c[b+"Key"]?"?key="+c[b+"Key"]:"")}function h(a){c.complete(a,k,g);c[a]("error"==a?g:k);clearTimeout(s);clearTimeout(t)}function r(){k.length==l.length?h("success"):k.length+g.length==l.length&&h("error")}function u(){g.push(this.src);r()}var n=this,c,k=[],g=[],s,t,p,l=[];this.init=function(b){b&&(c=a.extend({},a.xLazyLoader.defaults,b),p={js:c.js,
css:c.css,img:c.img},a.each(p,function(a,b){"string"==typeof b&&(b=b.split(","));l=l.concat(b)}),l.length?(c.timeout&&(s=setTimeout(function(){var b=k.concat(g);a.each(l,function(d,c){-1==a.inArray(c,b)&&g.push(c)});h("error")},c.timeout)),a.each(p,function(b,d){a.isArray(d)?a.each(d,function(a,d){f(b,d)}):"string"==typeof d&&f(b,d)})):h("error"))};this.js=function(b,c,d,f){var q=a('script[src*="'+b+'"]');if(q.length)q.attr("pending")?q.bind("scriptload",c):c();else{var e=document.createElement("script");
e.setAttribute("type","text/javascript");e.setAttribute("charset","UTF-8");e.setAttribute("src",b+f);e.setAttribute("id",d);e.setAttribute("pending",1);e.onerror=u;a(e).bind("scriptload",function(){a(this).removeAttr("pending");c();setTimeout(function(){a(e).unbind("scriptload")},10)});var g=!1;e.onload=e.onreadystatechange=function(){g||this.readyState&&!/loaded|complete/.test(this.readyState)||(g=!0,e.onload=e.onreadystatechange=null,a(e).trigger("scriptload"))};m.appendChild(e)}};this.css=function(b,
c,d,g){if(a('link[href*="'+b+'"]').length)c();else{var f=a('<link rel="stylesheet" type="text/css" media="all" href="'+b+g+'" id="'+d+'"></link>')[0];a.browser.msie?f.onreadystatechange=function(){/loaded|complete/.test(f.readyState)&&c()}:a.browser.opera?f.onload=c:(d=location.hostname.replace("www.",""),b=/http:/.test(b)?/^(\w+:)?\/\/([^\/?#]+)/.exec(b)[2]:d,d!=b&&a.browser.mozilla?c():function(){try{f.sheet.cssRules}catch(a){t=setTimeout(arguments.callee,20);return}c()}());m.appendChild(f)}};this.img=
function(a,c,d,f){d=new Image;d.onload=c;d.onerror=u;d.src=a+f};this.disable=function(b){a("#lazy-loaded-"+b,m).attr("disabled","disabled")};this.enable=function(b){a("#lazy-loaded-"+b,m).removeAttr("disabled")};this.destroy=function(b){a("#lazy-loaded-"+b,m).remove()}}a.xLazyLoader=function(a,h){"object"==typeof a&&(h=a,a="init");(new n)[a](h)};a.xLazyLoader.defaults={js:[],css:[],img:[],jsKey:null,cssKey:null,imgKey:null,name:null,timeout:2E4,success:a.noop,error:a.noop,complete:a.noop,each:a.noop};
var m=document.getElementsByTagName("head")[0]})(t_jp.$);
