define(['jquery', 'app/controls/control/get', 'app/controls/info/console', 'locale/controls'], function (jQuery, getControl, console, language) {
    
    var app =  {
            ajaxError: function (e, x, settings, exception) {
                var message;
                if (x.status) {
                    message = language.server[x.status];
                    if(!message){
                        message = language.request.unknown_error;
                    }
                }else if(e=='parsererror'){
                    message=language.request.parse_error;
                }else if(e=='timeout'){
                    message=language.request.timeout;
                }else if(e=='abort'){
                    message=language.request.abort;
                }else {
                    message=language.request.unknown_error;
                }
                var api_msg = require('app/controls/info/message');
                api_msg.show(message, language.controls.error, api_msg.type.error);
                getControl(id).hideGlobalAnimation();
            },
            DOMAttrModified: function (event) {
                var obj = jQuery(event.target);
                switch (event.attrChange) {
                    case MutationEvent.MODIFICATION:
                        if (event.attrName == 'id')
                            event.preventDefault();
                        else
                            obj.trigger('changedAttr', [event.attrName, event.prevValue, event.newValue]);
                        break;
                    case MutationEvent.ADDITION:
                        obj.trigger('addedAttr', [event.attrName, event.newValue]);
                        break;
                    case MutationEvent.REMOVAL:
                        if (event.attrName == 'id')
                            event.preventDefault();
                        else
                            obj.trigger('removedAttr', [event.attrName, event.prevValue]);
                        break;
                }
            },
            propertychange: function (event) {
                if (event.propertyName == 'id')
                    throw language.controls.id_attr_cant_be_modified_error;
                obj.trigger('changedAttr', [event.propertyName, undefined, obj.attr(event.propertyName)]);
            },
            DOMNodeRemoved: function (event) {
                var obj = jQuery(event.target);
                obj.trigger('removeNode');
            },
            DOMNodeRemovedFromDocument: function (event) {
                var obj = jQuery(event.target);
                obj.trigger('removeNode', event.target);
            },
            changedAttr: function (event, name, oldValue, newValue) {
                var ctl = getControl(jQuery(this).attr('id'));
                if (!ctl || !ctl.configuration || !ctl.configuration.serverEvents)
                    return;
                if ('propertyChanged' in ctl.configuration.serverEvents) {
                    if (name in ctl.configuration.fields) {
                        var actionQueue = require('app/controls/queue/actions');
                        actionQueue.module.addAction(ctl.attr('id'), 'propertyChanged', {
                            name:name, 
                            newValue:newValue, 
                            oldValue:oldValue
                        });
                    }                            
                }
            },
            removedAttr: function (event, name, oldValue) {
                var ctl = getControl(jQuery(this).attr('id'));
                if (!ctl || !ctl.configuration || !ctl.configuration.serverEvents)
                    return;
                if ('propertyChanged' in ctl.configuration.serverEvents) {
                    if (name in ctl.configuration.fields) {
                        var actionQueue = require('app/controls/queue/actions');
                        actionQueue.module.addAction(ctl.attr('id'), 'propertyChanged', {
                            name:name, 
                            newValue:'', 
                            oldValue:oldValue
                        });
                    }                            
                }
            },
            addedAttr: function (event, name, newValue) {
                var ctl = getControl(jQuery(this).attr('id'));
                if (!ctl || !ctl.configuration || !ctl.configuration.serverEvents)
                    return;
                if ('propertyChanged' in ctl.configuration.serverEvents) {
                    if (name in ctl.configuration.fields) {
                        var actionQueue = require('app/controls/queue/actions');
                        actionQueue.module.addAction(ctl.attr('id'), 'propertyChanged', {
                            name:name, 
                            oldValue:'', 
                            newValue:newValue
                        });
                    }                            
                }
            },
            execFinished: function (event, data) {
                var obj = this;
                if (data.error) {
                    var msg_api = require('app/controls/info/message');
                    msg_api.show(data.error, language.controls.error, msg_api.type.error);
                } else if (data.errors) {
                    var msg_api = require('app/controls/info/message');
                    for (var i = 0; i < data.errors.length; i++)
                        msg_api.show(data.errors[i], language.controls.error, msg_api.type.error);
                } else {
                    if (data[icms.consts.special.response_key.inner_html] != undefined) {
                        var ctl = obj;
                        if (data[icms.consts.special.response_key.selector]) {
                            var n_ctl = jQuery(data[icms.consts.special.response_key.selector], ctl);
                            if (n_ctl.length == 0) {
                                n_ctl = obj.getOwnerControl();
                                if (n_ctl)	
                                    n_ctl = jQuery(data[icms.consts.special.response_key.selector], n_ctl);
                                if (!n_ctl) {
                                    console.log('IMControls', 'ERROR: Wrong selector in response');
                                    return;
                                } else
                                    ctl = n_ctl;
                            } else
                                ctl = n_ctl;
                        } 
                        var tagName = ctl.get(0).tagName;
                        jQuery(require('app/controls/selector/get')(), ctl.children()).each(
                            function () {
                                var obj = jQuery(this);
                                if (!require('app/controls/control/isKnown')(obj))
                                    return;
                                var id = obj.attr('id');
                                delete window.imcontrols[id];
                                console.log('IMControls', '#' + id + ' removed');
                            }
                            );
                        var new_obj = jQuery('<' + tagName + '>' + data[icms.consts.special.response_key.inner_html] + '</' + tagName + '>');
                        ctl.empty();
                        var nchildren = new_obj.children();
                        ctl.append(nchildren);
                        jQuery(require('app/controls/selector/get'), nchildren).each(
                            function () {
                                var obj = jQuery(this);
                                var id = obj.attr('id');
                                if (!require('app/controls/controls/isKnown')(obj))
                                    return;
                                console.log('IMControls', '#' + id + ' added');
                                obj.getControl();
                            }
                            );
                    }
                    
                    if (data[icms.consts.special.response_key.changed_properties] != undefined) {
                        for(var x in data[icms.consts.special.response_key.changed_properties]) {
                            var sel_obj = getControl(x);
                            for (var y in data[icms.consts.special.response_key.changed_properties][x])
                                sel_obj.setVar(y, data[icms.consts.special.response_key.changed_properties][x][y]);
                        }
                    }
                    if (data.message) {
                        var msg_api = require('app/controls/info/message');
                        msg_api.show(data.message, language.controls.info, msg_api.type.info);
                    }                            
                    
                /*var self = this;
                    setTimeout(function() {
                        window.ImpressCMS.core.controls.update(self);
                    }, 500);*/
                }
                getControl[id].hideGlobalAnimation();
            },
            controlInitialized: function (e) {
                e.stopPropagation();
                var obj = this;
                if (typeof(obj.controlInitialized) == 'function')
                    obj.controlInitialized();
            }
        };   
            
    return app;
            
});