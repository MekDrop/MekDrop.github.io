define(['jquery'], function (jQuery) {
    var app = {
        controlInitialized: function () {
        
        },
        getLeanParams: function () {
            return {
                'top': this.getVar('top') + 'px',
                'overlay': this.getVar('overlay'),
                'closeButton': this.getVar('close-button')
            }
        },
        show: function () {
            jQuery('#' + this.id()).leanModal(this.getLeanParams());
        },
        hide: function () {
            jQuery('#' + this.id()).hide();
        }
    };

return app;
});