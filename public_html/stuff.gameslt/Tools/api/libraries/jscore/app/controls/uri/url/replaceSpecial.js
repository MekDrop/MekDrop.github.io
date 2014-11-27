define(['app/controls/uri/protocol/existingList', 'app/controls/control/findWhereTagBelongs', 'app/controls/queue/actions', 'locale/controls', 'jquery'], function (specialProtocols, findControlWhereTagBelongs, actionQueue, language, jQuery) {

    var app = function (context) {
            var prot = [];            
            jQuery.each(specialProtocols, 
                    function( intIndex, objValue ) { 
                         prot.push('[href^="' + objValue + '"]'); 
                    });
            var sel = prot.join(',');
            jQuery(sel, context).each(
                function () {
                    var obj = jQuery(this);
                    var href = obj.attr('href');
                    obj.attr('href', 'javascript:alert("'+ language.controls.link_in_same_window_error+'"); if (window.close) window.close();');
                    obj.bind('click', function (e) {
                                         var ctl = findControlWhereTagBelongs(this);
                                         actionQueue.processURL(href, null, null, ctl);
                                         e.preventDefault();
                                     });                    
                }
            );
        };

    return app;

});
