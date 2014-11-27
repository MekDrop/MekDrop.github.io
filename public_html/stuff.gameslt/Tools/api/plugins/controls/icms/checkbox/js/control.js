define(['jquery'], 
    function (jQuery) {
        var app = {
            controlInitialized: function () {
                var self = this;
                jQuery(this).live('click', 
                    function (e) {
                        var c_msg = self.getVar('confirm_msg');
                        var c_act = self.getVar('change_action');
                        if (c_msg) {
                            if (window.confirm(c_msg)) {
                                if (c_act)
                                    eval(c_act + ';');
                            } else {
                                e.preventDefault();
                            }
                        } else {
                            if (c_act)
                                eval(c_act + ';');
                        }
                    }
                    );
            }
        };
        return app;
    });