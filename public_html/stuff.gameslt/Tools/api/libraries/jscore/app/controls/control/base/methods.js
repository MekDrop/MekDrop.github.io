define(['jquery', 'locale/controls', 'app/controls/types/render', 'app/controls/info/console'], function (jQuery, language, renderType, console) {

    var app =  {
        getControlType: function() {
            return this.attr('data-icms-control');
        },
        getOwnerControl: function () {
            var ret = this;
            var isKnownControl = require('app/controls/control/isKnown');
            while(ret == ret.parent()) {
                if (isKnownControl(ret))
                    break;
            }
            return ret;
        },
        toActionParams: function () {
            var vars = this.toArray();
            for(var name in vars)
                if (!this.configuration.fields[name])
                    continue;
                else
                    switch (this.configuration.fields[name][icms.consts['var'].param.type]) {
                        case icms.consts['var'].type.data_source:
                            vars[name] = vars[name][0];
                            break;
                    }
            return vars;
        },
        exec: function (action, params, objName, type, noAnimation) {
            if (arguments.length == 1) {
                if (jQuery.isArray(action)) {
                    for (var i = 0; i < action.length; i++)
                        this.exec(action[i]);
                    return;
                } else if (action.action) {
                    noAnimation = action.noAnimation;
                    type = action.type;
                    objName = action.objName;
                    params = action.params;
                    action = action.action;
                }
            }
                 
            if (!noAnimation)
                this.showGlobalAnimation('loading');
                 
            var actionTypes = require('app/controls/types/action'),
                actionQueue = require('app/controls/queue/actions');
                 
            if (!type)
                type = actionTypes.control;
            if (!objName)
                objName = this.getControlType();
                
            var act = null;
            if (type == actionTypes.control) {
                act = actionQueue.control.addAction(objName, action, params, this.toActionParams());
            } else {
                act = actionQueue.module.addAction(objName, action, params);
            }
            var obj = this;
            act.then(function (data) {
                obj.trigger('execFinished', data, {
                    action:action, 
                    params:params, 
                    objName:objName, 
                    type:type
                });
            });
        },
        getChildren: function () {
            var bad = [];
            var getSelector = require('app/controls/selector/get');
            var obj = this;
            var current = jQuery(getSelector(), obj);
            current.each(
                function () {
                    jQuery(getSelector(), jQuery(this)).each(
                        function () {
                            bad.push(jQuery(this).attr('id'));
                        }
                        );
                }
                );
            return current.filter(
                function () {
                    var obj = jQuery(this);
                    for(var i = 0; i < bad.length; i++)
                        if (obj.attr('id') == bad[i])
                            return false;
                    return true;
                }
                ).getControl();
        //return .getControl();
        },
        parseAttrValue: function (name, value) {
            if (value == undefined)
                value = "";
            switch (this.configuration.fields[name][icms.consts['vars'].param.type]) {
                case icms.consts['var'].type.string:
                case icms.consts['var'].type.criteria:
                    return value.toString();
                case icms.consts['var'].type.data_source:
                    var dt = Base64.btou(RawDeflate.inflate(Base64.fromBase64(value)));
                    if (!dt)
                        return value.toString();
                    dt = jQuery.parseJSON(dt);
                    if (dt.length != 2)
                        return null;
                    return dt;
                case icms.consts['var'].type.integer:
                    return parseInt(value);
                case icms.consts['var'].type['float']:
                    return parseFloat(value);
                case icms.consts['var'].type['boolean']:
                    if (typeof value == 'boolean')
                        return value;
                    if (typeof value == 'number')
                        return parseInt(value) != 0;
                    if (typeof value == 'object')
                        return false;
                    value = value.toString();
                    value = value.toLowerCase().replace(/^[\s]+/,'').replace(/[\s]+$/,'').replace(/[\s]{2,}/,' ');
                    return (value == 'yes') || (value == 'true') || (value == '1');
                case icms.consts['var'].type.file:
                    return value;
                    //throw "Undefined file type";
                    break;
                case icms.consts['var'].type.datetime:
                    var dt = new Date();
                    dt.setTime(value);
                    return dt;
                case icms.consts['var'].type.array:
                    switch (typeof value) {
                        case 'boolean':
                        case 'number':
                            return [value];
                        case 'string':
                            if (value == '')
                                return [];
                            try {
                                var rt = jQuery.parseJSON(value);
                                if (typeof rt != 'object')
                                    return [rt];
                                return rt;
                            } catch (e) {
                                return [value];
                            }
                        case 'object':
                            return value;
                        default:
                            alert(typeof value);
                    }
                    return value;
                    //throw "Undefined array type";
                    break;
                case icms.consts['var'].type.list:
                    return value.split(';');
                    //throw "Undefined list type";
                    break;
            }
        },
        getVar: function (name) {
            if (!this.configuration.fields[name])
                return null;
            var val;
            switch (this.configuration.fields[name].renderType) {
                case renderType.state:
                    if (this.hasAttr(name))
                        val = (this.attr(name) == name);
                    else
                        val = false;
                    break;
                case renderType.attribute:
                    if (this.hasAttr(name))
                        val = this.attr(name);
                    else
                        val = this.configuration.baseValues[name];
                    break;
                case renderType.style:
                    val = this.css(name);
                    break;
                case renderType.tag:
                    val = this.get(0).nodeName.toLowerCase();
                    break;
                case renderType.data:
                    var cname = 'data-' + name;
                    if (this.hasAttr(cname))
                        val = this.attr(cname);
                    else
                        val = this.configuration.baseValues[name];
                    break;
            }
            return this.parseAttrValue(name,  val);
        },
        hasAttr: function (name) {
            return this.get(0).hasAttribute(name);
        },
        encodeAttrValue: function (name, value) {
            if (value == undefined)
                value = "";
            switch (this.configuration.fields[name][icms.consts['vars'].param.type]) {
                case icms.consts['var'].type.string:						
                case icms.consts['var'].type.criteria:
                    return value.toString();
                case icms.consts['var'].type.data_source:
                    throw language.controls.unsupported_source_changing_error;
                    break;
                case icms.consts['var'].type.integer:
                    return parseInt(value);
                case icms.consts['var'].type['float']:
                    return parseFloat(value);
                case icms.consts['var'].type['boolean']:
                    return value?'1':'0';
                case icms.consts['var'].type.file:
                    return value;
                    //throw "Undefined file type";
                    break;
                case icms.consts['var'].type.datetime:
                    return value.toString();
                case icms.consts['var'].type.array:
                    if (typeof value != 'object')
                        value = [value];
                    var stringify = require('app/controls/string/stringify');
                    return stringify(value);                   
                    break;
                case icms.consts['var'].type.list:
                    return value.join(';');
                    break;
            }
        },
        setVar: function (name, value) {
            if (!this.configuration.fields[name] || (this.getVar(name) === value))
                return;
            switch (this.configuration.fields[name].renderType) {
                case renderType.attribute:
                    this.attr(name, this.encodeAttrValue(name, value));
                    break;
                case renderType.state:
                    if (value) {
                        this.attr(name);
                    } else {
                        this.removeAttr(name);
                    }
                    break;
                case renderType.style:
                    this.css(name, value);
                    break;
                case renderType.tag:
                    throw language.controls.tag_cant_be_modified_error;
                    break;
                case renderType.data:
                    this.attr('data-' + name, this.encodeAttrValue(name, value));
                    break;
            }
            this.trigger('changedVar', [name, value]);
        },
        getNotDefaultVars: function (getAllVars) {
            var rez = {};
            for(var x in this.configuration.fields) {
                if (x == '') 
                    continue;
                var val = this.getVar(x);
                if (this.configuration.baseValues[x] == val)
                    continue;
                if (x == 'class' || x == 'style' || x == 'id') 
                    continue;
                switch (this.configuration.fields[x].renderType) {
                    case renderType.tag:
                        continue;
                }
                switch (this.configuration.fields[x][icms.consts['vars'].param.type]) {
                    case icms.consts['var'].type.data_source:
                        if (!getAllVars) continue;
                        rez[x] = val;
                        break;
                    case icms.consts['var'].type.tag:
                        continue;
                    default:
                        rez[x] = val;
                }                    
            }
            return rez;
        },
        isSameControlType: function (type) {
            return type != this.getControlType();
        },
        importArray: function (arr) {
            var set = {};
            for(var x in this.configuration.fields) {
                if (x == 'class' || x == 'style' || x == 'id') 
                    continue;
                switch (this.configuration.fields[x].renderType) {
                    case renderType.tag:
                        continue;
                }
                switch (this.configuration.fields[x][icms.consts['vars'].param.type]) {
                    case icms.consts['var'].type.data_source:
                    case icms.consts['var'].type.tag:
                        continue;
                }
                set[x] = (typeof arr[x] == "undefined")?this.configuration.baseValues[x]:arr[x];
            }
            console.log(set);
            for(var x in set)
                this.setVar(x, set[x]);
        },
        toArray: function () {
            var rez = {};
            for(var x in this.configuration.fields) {
                if (x == '') 
                    continue;
                rez[x] = this.getVar(x);
                switch (this.configuration.fields[x][icms.consts['vars'].param.type]) {
                    case icms.consts['var'].type.list:
                        rez[x] = rez[x].join(';');
                        break;
                }
            }
            return rez;
        },
        getCurrentState: function () {     
            var rez = this.getNotDefaultVars();
            var ret = jQuery.param(rez, false);
            return ret;
        },
        setCurrentState: function (state) {
            var getParamsArray = require('app/controls/uri/params/get');
            var data = getParamsArray(state);
            for(var x in this.configuration.fields) { 
                if (!data[x])
                    this.setVar(x, this.configuration.baseValues[x]);
                else 
                    this.setVar(x, data[x]);
            }
        },
        showGlobalAnimation: function (animation) {
            if (!jQuery.isFunction(animation))
                animation = require('app/controls/animations/loading');
            else
                animation = require('app/controls/animations/' + animation);
                
            if (hData.animation)
                hData.animation.stop();
                    
            var animations = require('app/controls/animations');
            hData.animation = new animations.init.asOverlay(this, animation);
        },
        hideGlobalAnimation: function () {
            if (hData.animation && hData.animation.stop) {
                hData.animation.stop();
                delete hData.animation;
            }
        }
    };

    return app;

});