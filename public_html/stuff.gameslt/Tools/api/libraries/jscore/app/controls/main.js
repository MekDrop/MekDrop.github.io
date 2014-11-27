define(
    function (require) {
        
        var jQuery = require('jquery'), 
            getSelector = require('app/controls/selector/get'), 
            isKnownControl = require('app/controls/control/isKnown'),
            makeAlive = require('app/controls/control/makeAlive');
   
    jQuery.fn.getControl = function() {    
        return this.filter(
            function (index) {
                return isKnownControl(this);
            }
            ).map(function() {
          
            return makeAlive(this);
            
        });

    };   
    
    jQuery(
        function () {
            jQuery(getSelector()).getControl();
            jQuery(window).bind('popstate', function () {
                var getParamsArray = require('app/controls/uri/params/get'),
                    setState = require('app/controls/state/set');
                var state = getParamsArray();
                if (state.icms_page_state == undefined)
                    return;
                if (jQuery.isArray(state.icms_page_state))                
                    state = state.icms_page_state[0];
                else
                    state = state.icms_page_state;
                setState(unescape(state));
            });
        }
        );
    
});