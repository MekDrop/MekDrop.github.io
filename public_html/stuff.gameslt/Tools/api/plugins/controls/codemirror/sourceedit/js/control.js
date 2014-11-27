define(['jquery'], function (jQuery) {
    
    var app = {
        controlInitialized: function () {
            var self = this;
            self.editor = CodeMirror.fromTextArea(self.getVar('id'), {
                width: self.getVar('width') + 'px',
                height: self.getVar('height') + 'px',
                parserfile: [],
                stylesheet: [],
                path: jQuery(self).attr('data-editor-url') + '/js/',
                lineNumbers: self.getVar('line_numbers'),
                continuousScanning: self.getVar('continuous_scanning'),
                textWrapping: self.getVar('text_wrapping'),
                readOnly: self.getVar('disable')
            });
        }
    };
    
    return app;
    
});