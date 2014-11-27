define(['require', 'app/controls/selector/get', 'jquery'], function (require, getSelector, jQuery) {
    
    var app = {
        slider: null,
        prevButton: null,
        nextButton: null,
        updateControls: function () {
            var val = this.slider.val();
            this.setVar('page', val);
            var can_prev = (this.slider.getVar('min') != val);
            var can_next = (this.slider.getVar('max') != val);
            if (this.prevButton.is(':disabled') && can_prev) 
                this.prevButton.removeAttr('disabled');
            if (!this.prevButton.is(':disabled') && !can_prev) 
                this.prevButton.attr('disabled', 'disabled');
            if (this.nextButton.is(':disabled') && can_next) 
                this.nextButton.removeAttr('disabled');
            if (!this.nextButton.is(':disabled') && !can_next) 
                this.nextButton.attr('disabled', 'disabled');        
        },
        controlInitialized: function () {
            var obj = jQuery(this);
            var self = this;
            var childrens = jQuery(getSelector(), obj).getControl();
            this.prevButton = childrens[0];
            this.nextButton = childrens[2];
            this.slider = childrens[1];
            this.slider.change(
                function () {
				
                // alert();
                //alert(self.getCurrentState());
                //                obj.trigger('change');
                }
                );
            this.prevButton.click(
                function () {
                    self.slider.val(parseInt(self.slider.val()) - 1);
                    obj.trigger('change');
                }
                );
            this.nextButton.click(
                function () {
                    self.slider.val(parseInt(self.slider.val()) + 1);
                    obj.trigger('change');
                }
                );
            this.bind({
                changedVar: function (event, name) {
                    switch (name) {
                        case 'records_count':
                            var pages_count = Math.ceil(self.getVar('records_count') / self.getVar('per_page')) - 1;                        
                            self.slider.setVar('max', pages_count);
                            self.updateControls();
                            break;
                        case 'per_page':
                            var pages_count = Math.ceil(self.getVar('records_count') / self.getVar('per_page')) - 1;
                            self.slider.setVar('max', pages_count);
                            self.updateControls();
                            break;
                    }
                },
                change: function () {
                    self.updateControls();
                    if (self.getVar('autoupdate_url')) {
                        var updateCurrentURL = require('app/controls/uri/url/update');
                        updateCurrentURL();
                    }
                }
            });
        }
    }

    return app;
});