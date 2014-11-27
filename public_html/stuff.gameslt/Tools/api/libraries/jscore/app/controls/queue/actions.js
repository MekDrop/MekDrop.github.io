define(['jquery', 
        'app/controls/session', 
        'app/controls/uri/url/makeForControl', 
        'app/controls/uri/url/parse', 
        'app/controls/uri/url/makeRoot', 
        'app/controls/info/console', 
        'app/controls/uri/url/makeForModule', 
        'app/controls/types/action', 
        'app/controls/control/get',
        'impresscms/language',
        'app/controls/string/stringify'
    ], 
    function(jQuery, session, makeControlUrl, parseURL, makeRootUrl, console, makeModuleUrl, actionType, getControl, language, stringify) {
   
    var core = {
        data: {
            list: [[]],
            index: {
                adding: 0,
                processing: 0,
                last: -1
            },
            handler: {
                ajax: null,
                timeout: null
            }
        },
        enqueue: function (params) {
            var actions = {};
            core.data.index.last++;
            core.data.list[core.data.index.adding].push([params, new jQuery.Deferred()]);           
            
            if (app.state == app.possibleStates.stopped) {
                core.data.handler.timeout = setTimeout(core.exec, app.cacheInterval);
                app.trigger('changedState', app.possibleStates.waiting);
            }                
            
            return core.data.list[core.data.index.adding][core.data.index.last][1].promise();
        },
        load: {
            css: function (url) {
                // idea from http://stackoverflow.com/a/4295395
                return jQuery.ajax({
                    url: url,
                    dataType: 'css',
                    success: function(){                  
                        jQuery('<link rel="stylesheet" type="text/css" href="'+url+'" />').appendTo("head");
                        app.trigger('loadedFile', 'css', url);
                    }
                });
            },
            js: function (url) {
                return jQuery.ajax({
                    url: url,
                    dataType: 'script',
                    success: function(){                  
                        //jQuery('<script type="text/javascript" src="'+url+'"></script>').appendTo("body");
                        app.trigger('loadedFile', 'js', url);
                    }
                });
            },
            list: function (urls) {
                var files = [];
                for (var x in urls) {
                    var type = parseInt(x);
                    for (var n in icms.consts.url.type)
                        if (type == parseInt(icms.consts.url.type[n])) {
                            type = n;
                            break;
                        }
                    if (!core.load[type])
                        continue;
                    for(var i = 0; i < urls[x].length; i++)
                        files.push(core.load[type](urls[x][i]));
                }
                var that = jQuery.when.apply(null, files);             
                return that;
            }
        },
        exec: function () {
            app.trigger('changedState', app.possibleStates.running);
            core.data.list.push([]);
            core.data.index.processing = core.data.index.adding++;
            core.data.index.last = -1;
            // Clearing timeout
            core.data.handler.timeout = null;
            return jQuery.ajax(core.getParamsForAjax());
        },
        getExtDataParams: function() {
            var ext_data = {};
            ext_data[icms.consts.special.param.dummy] = (new Date()).getTime();
            ext_data[icms.consts.special.param.base_controls] = [];
            var baseControls = require('app/controls/collection/getBase')();
            for (var x in baseControls)
                if (typeof baseControls[x] == 'object')
                    ext_data[icms.consts.special.param.base_controls].push(x);
            ext_data[icms.consts.special.param.base_controls] = ext_data[icms.consts.special.param.base_controls].join(';');
            // ext_data['logging_enabled'] = 1;
            // ext_data['show_headers'] = 1;
            return ext_data;
        },
        getParamsActions: function () {
            var actions = {};
            var get_str = parseURL(window.location.href, 'query');
            if (get_str) {
                if (get_str['icms_page_state'])
                    delete get_str['icms_page_state'];
                for (var x in get_str)
                    for (var i = 0; i < core.data.list[core.data.index.processing].length; i++) {
                        if (!actions[x])
                            actions[x] = {};
                        actions[x][i] = get_str[x];
                    }
            }
            for (var i = 0; i < core.data.list[core.data.index.processing].length; i++)
                for (var x in core.data.list[core.data.index.processing][i][0]) {
                    if (!actions[x])
                        actions[x] = {};
                    actions[x][i] = core.data.list[core.data.index.processing][i][0][x];
                }
            return actions;
        },
        getParamsForAjax: function () {            
            var act_type = app.requestType;
            var send_data = jQuery.extend({}, core.getParamsActions(), core.getExtDataParams());
            var true_url = makeRootUrl('process.php');
            if (act_type == 'get') 
                true_url += '?icms:1:' + escape(Base64.toBase64(RawDeflate.deflate(Base64.utob(stringify(send_data)))));
            console.log(true_url);
            var ret = {
                success: core.processAjax,
                url: true_url,
                data: (act_type != 'get')?send_data:'',
                dataType: 'json',
                type: act_type
            }
            return ret;
        },
        filter_result: {
            system_log: function (data) {               
                for (var x in data)
                    for (var i = 0; i < data[x].length; i++)
                        console.log(x, data[x][i]);
                return true;
            },
            load_files: function (data) {
                return core.load.list(data);
            }
        },
        clearResponse: function (data) {
            var rez = [];
            for (var x in data) {
                if (parseInt(x).toString() != x)
                    continue;
                rez.push(data[x]);
            }
            return rez;
        },
        processEachResponse: function (data) {
            for(var i = 0; i < data.length; i++) {
                var ret = data[i];
                var def = core.data.list[core.data.index.processing][i][1];
                def.resolve(ret);
            }
        },
        processAjax: function (data) {
            var when = [];
            var then = [];
            for (var x in core.filter_result)
                if (data[x] && jQuery.isFunction(core.filter_result[x])) {
                    when.push(core.filter_result[x](data[x]));
                    then.push(function () {
                        delete data[x];
                    });
            };
            var def = null;
            if (when.length > 0) {
                def = jQuery.when.apply(null, when);                   
            } else {
                var df = new jQuery.Deferred();
                def = df.promise();
                df.resolve();
            }
            def.done(function () {
                for(var i=0; i<then.length; i++)
                    then[i]();
                data = core.clearResponse(data);
                core.processEachResponse(data);                    
                core.data.list[core.data.index.processing] = null;
                core.data.index.processing = -1;
                if (core.data.list[core.data.index.adding].length > 0) {
                    core.data.handler.timeout = setTimeout(core.exec, app.cacheInterval);
                    app.trigger('changedState', app.possibleStates.waiting);
                } else {
                    core.data.index.adding = 0;
                    core.data.list = [[]];
                    app.trigger('changedState', app.possibleStates.stopped);                        
                }
            });
            return def;
        }
    },
    orig_obj = {
        cacheInterval: 100,
        get requestType() {
            return session.get('ImpressCMS/ActionQueue/Type','post');
        },
        set requestType(type) {
            session.set('ImpressCMS/ActionQueue/Type',type);
        },
        possibleStates: {
            stopped: 0,
            waiting: 1,
            running: 2
        },
        get state() {
            if ((core.data.handler.timeout == null) && (core.data.handler.ajax == null))
                return orig_obj.possibleStates.stopped;
            if (core.data.handler.ajax == null)
                return orig_obj.possibleStates.running;
            return orig_obj.possibleStates.waiting;
        },
        module: {
            addAction: function (module, action, params) {
                var p2 = jQuery.extend({}, params);
                p2[icms.consts.special.param.action] = action;
                p2[icms.consts.special.param.module] = module;
                return core.enqueue(p2);
            },
            addCSS: function (module, cssfile) {
                var url = makeModuleUrl(module, cssfile);
                return core.load.css(url);
            },
            addJS: function (module, jsfile) {
                var url = makeModuleUrl(module, jsfile);                
                return jQuery.getScript(url);
            }
        },        
        control: {
            addAction: function (control_type, action, params, config) { 
                var p2 = jQuery.extend({logging_enabled:1}, params);
                p2[icms.consts.special.param.action] = action;
                p2[icms.consts.special.param.control] = control_type;
                p2[icms.consts.special.param.params] = config;
                return core.enqueue(p2);
            },
            addCSS: function (control_type, cssfile) {
                var url = makeControlUrl(control_type, cssfile);
                return core.load.css(url);
            },
            addJS: function (control_type, jsfile) {
                var url = makeControlUrl(control_type, jsfile);             
                return jQuery.getScript(url);
            }
        },
        processURL: function (url, params, func, handler_ctl,noAnimation) {
            var location = parseURL(url);
            if (!params)
                params = {};
            jQuery.extend(true, params, location.query);
            switch (location.scheme) {
                case 'control':
                    var type = actionType[location.scheme];
                    var ctl = getControl(location.host);
                    if (!ctl) {
                        var format = require('app/controls/string/format');
                        throw new format(language.controls.control_not_found_error, location.host);
                    }
                    if (func)
                        ctl.bind( 'execFinished', func );
                    ctl.exec(location.path[0], params, ctl.getControlType(), type, noAnimation);
                    return false;
                case 'module':
                    var type = actionType[location.scheme];
                    if (func)
                        handler_ctl.bind( 'execFinished', func );
                    handler_ctl.exec(location.path[0], params, location.host, type, noAnimation);
                    // var type = window.ImpressCMS.core.controls.actionType[location.scheme];                    
                    //   self.module.addAction(location.host, location.path[0], params, func);
                    return false;
            }
            return true;
        }        
    },
    app = jQuery().extend(orig_obj);
   
    return app;
   
});