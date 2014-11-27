define(['jquery', 'require'], function (jQuery, require){    
    
    var toJSON = function (data) {
                switch (typeof data) {
                    case 'number':
                        return data;
                    case 'string':
                        return '"' + data.replace(/\\/g,'\\\\').replace(/\'/g,'\\\'').replace(/\"/g,'\\"').replace(/\0/g,'\\0') + '"';
                    case 'boolean':
                        return data?'true':'false';
                    case 'undefined':
                        return 'null';
                    case 'object':
                        if (data === null)
                            return 'null';
                        else {
                            var ret = [];
                            for (var x in data)
                                ret.push('"' + x + '":' + toJSON(data[x]));
                            return '{' + ret.join(',') + '}';
                        }                                            
                    default:
                        var language = require('locale/controls'),
                            format = require('app/controls/string/format');
                        return format(language.controls.unknown_data_in_core_error, typeof data);
                } 
            },
        app = null;
    
    if (jQuery.stringify)
        app = jQuery.stringify;
    else {
        app = toJSON;        
    }
    
    return app;
    
});