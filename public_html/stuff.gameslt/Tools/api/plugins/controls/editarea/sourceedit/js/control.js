define({
    controlInitialized: function () {
        var self = this;
        editAreaLoader.init({
            id: self.getVar('id'),
            syntax: self.getVar('syntax'),
            language: self.getVar('language')?self.getVar('language'):'en',
            start_highlight: self.getVar('start_highlight'),
            allow_resize: self.getVar('allow_resize'),
            allow_toggle: self.getVar('allow_toggle'),
            fullscreen: self.getVar('fullscreen'),
            is_editable: !self.getVar('disable'),
            autocompletion: self.getVar('autocompletion')
        });
    }
});