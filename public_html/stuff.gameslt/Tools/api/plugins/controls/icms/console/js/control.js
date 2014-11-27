define(['jquery'], function (jQuery) {

    var app = {
        buffer: new (function () {
            var data = [];
            var index = 0;
        
            this.add = function (cmd) {
                if ((data.length > 0) && (index != (data.length - 1)))
                    data = data.slice(0, index);
                data.push(cmd);
                index++;
            };
        
            this.next = function () {
                index++;
                if (index > (data.length - 1))
                    index--;
                return data[index];
            };
        
            this.previous = function () {
                index--;
                if (index < 0) {
                    index = 0;
                    return '';
                }                
                return data[index];
            };
        
            this.count = function () {
                return data.length;
            };
        
        })(),
        getCMDID: function () {
            return this.getVar('id') + '_cmd'; 
        },
        getCMDTextID: function () {
            return this.getVar('id') + '_cmd_text'; 
        },
        getCMDPromptID: function () {
            return this.getVar('id') + '_cmd_prompt'; 
        },
        getInputField: function () {
            return jQuery('#' + this.getCMDTextID(), jQuery(this));
        },
        isInteractive: function () {
            return this.getInputField().length > 0;
        },
        write: function (msg) {
            var line = jQuery('<li></li>');
            line.html(msg);
            var ifield = this.getInputField();
            if (ifield.length > 0) {
                line.insertBefore(ifield);
            } else {
                jQuery(this).append(line);
            }
        },
        getCurrentPrompt: function () {
        
            var format = this.getVar('prompt');
            var ret = format + '';
        
            var t = new Date();
        
            ret = ret.replace(new RegExp('$Q', 'g'),'=');
            ret = ret.replace(new RegExp('$$', 'g'),'$');
            ret = ret.replace(new RegExp('$T', 'g'),t.toLocaleTimeString());
            ret = ret.replace(new RegExp('$D', 'g'),t.toLocaleDateString());
            ret = ret.replace(new RegExp('$P', 'g'),'/');
            ret = ret.replace(new RegExp('$V', 'g'),'0.0.0');
            ret = ret.replace(new RegExp('$N', 'g'),'C:');
            ret = ret.replace(new RegExp('$G', 'g'),'>');
            ret = ret.replace(new RegExp('$L', 'g'),'<');
            ret = ret.replace(new RegExp('$B', 'g'),'|');
            ret = ret.replace(new RegExp('$H', 'g'),String.fromCharCode(8));
            ret = ret.replace(new RegExp('$E', 'g'),String.fromCharCode(27));
            ret = ret.replace(new RegExp('$_', 'g'),'<br />');
        
            return ret;
        },
        execCMD: function (cmd) {
            this.exec({
                action: 'execute', 
                params: {
                    'cmd': cmd
                }, 
                noAnimation: !true
                });
        },
        controlInitialized: function () {
            var self = this;
            var obj = jQuery(self);
            obj.keyup(function (event){
                switch (event.keyCode) {
                    case 13: // enter
                        var val = obj.val();
                        if (!jQuery.trim(val)) {
                            obj.val('');
                            break;
                        }                        
                        self.buffer.add(val);
                        var prompt = self.getCurrentPrompt();
                        this.write(prompt + val);
                        obj.val('');
                        jQuery('#' + self.getCMDPromptID()).text(prompt);
                        break;
                    case 38: // up
                        obj.val(self.buffer.next());
                        break;
                    case 40: // down
                        obj.val(self.buffer.previous());
                        break;
                }
            });
        }
    };

return app;
});