define(['require', 'jquery', 'app/controls/control/waitUntilExists'], function (require, jQuery, waitUntilControlExists) {
    var app = {
        controlInitialized: function () {
            var obj = jQuery(this);
            var div = jQuery('<div class="box_new_filter"></div>');
            var alink = jQuery('<button></button>');
            alink.css({
                /* 'background-image': icms.config.url+'/images/add.gif',*/
                'background-repeat': 'no-repeat',
                'display': 'none'
            });        
            alink.attr({
                'title': 'Add'
            });
            alink.text('Add');        
            var self = this;
            var fselect = jQuery('<select class="fields_select_box"></select>');
            div.append(fselect);
            div.append(alink);
            obj.append(div);
            this.field_selector = fselect;
            fselect.change(
                function () {
                    var val = jQuery(this).val();
                    var sindex = parseInt(val);
                    var types = self.cachedData.fields.types;                                
                    jQuery('.icomparision, .ivalue', obj).each(
                        function () {
                            var obj = jQuery(this);
                            obj.remove();
                        }
                        );
                    alink.hide(); 
                    if (val == '')
                        return;
                    var cmp = self.cachedData.fields.comparision[sindex];
                    if (cmp == undefined)
                        return;
                    var csel = jQuery('<select class="icomparision"></select>');
                    for(i = 0; i < cmp.length; i++)
                        csel.append(jQuery('<option></option>').attr('value', cmp[i]).text(cmp[i]));
                    csel.insertAfter(this);
                    csel.focus();
                    var finput;
                    switch (types[sindex]) {
                        case icms.consts['var'].type.datetime:
                            finput = jQuery('<input class="ivalue" type="datetime" maxlength="255" name="input" />');
                            finput.val((new Date()).toString());
                            break;
                        case icms.consts['var'].type['float']:
                        case icms.consts['var'].type.integer:
                            finput = jQuery('<input class="ivalue" type="number" maxlength="255" name="input" />');
                            finput.val(0);
                            break;
                        case icms.consts['var'].type['boolean']:
                            finput = jQuery('<select class="ivalue" name="input"><option value="1">True</option><option value="0">False</option></select>');
                            break;
                        case icms.consts['var'].type.string:
                        default:
                            finput = jQuery('<input class="ivalue" type="text" maxlength="255" name="input" value="" />');
                            break;
                    }
                    alink.show();
                    finput.insertAfter(csel);
                    finput.keypress(function(e) {
                        code= (e.keyCode ? e.keyCode : e.which);
                        if (code == 13) alink.click();
                    });                
                    csel.keypress(function(e) {
                        code= (e.keyCode ? e.keyCode : e.which);
                        if (code == 13) finput.focus();
                    });
                });
            alink.click(
                function () {            
                    var fields = self.cachedData.fields.names;
                    self.addFilterLine(fields[parseInt(fselect.val())], jQuery('.icomparision', obj).val(), jQuery('.ivalue', obj).val());
                    self.regenerateSQL();
                    jQuery('option:selected', fselect).removeAttr('selected');
                    fselect.change();
                    self.updateFieldsForComparision();                             
                }            
                );                                
        
            var id = this.getVar('linked_control');        
            waitUntilControlExists(id, function () {
                var filters = self.getVar('filter');
                for(var i = 0; i < filters.length; i++)
                    this.addFilterLine(filters[i][0], filters[i][1], filters[i][2]);
                self.updateCache();
                self.updateFieldsForComparision();
            });
        },
        cachedData: {
            fields: {
                names: [],
                types: [],
                visible: [],
                captions: []
            }
        },
        updateCache: function () {
            this.cachedData = {
                fields: {
                    names: [],
                    types: [],
                    visible: [],
                    captions: [],
                    comparision: []
                }
            };
            var control = this.getLinkedControlInstance();
            if (!control) return false;
            switch (this.getLinkedControlType()) {
                case 'icms/table':
                    var dt = control.getVar('source');
                    if (!dt[1])
                        return false;
                    for(var x in dt[1]) {
                        this.cachedData.fields.types.push(dt[1][x][icms.consts.var.param.type]);
                        this.cachedData.fields.names.push(x);
                        this.cachedData.fields.captions.push(dt[1][x][icms.consts.var.param.form_caption]);
                        var cmp = this.getComparisionOptionsByFieldType(dt[1][x][icms.consts.var.param.type]);                    
                        if (dt[1][x][icms.consts.var.param.data_handler] == undefined) {
                            if (this.isFieldInFilter(x))
                                this.cachedData.fields.visible.push(false);
                            else
                                this.cachedData.fields.visible.push((!cmp)?false:true);
                        } else
                            this.cachedData.fields.visible.push(false);
                        this.cachedData.fields.comparision.push(cmp);
                    }
                    var fl = control.getVar('hidden_filter');
                    return true;
                    break;
                default:
                    return false;
            }
        },
        getComparisionOptionsByFieldType: function (type) {
            switch (type) {
                case icms.consts['var'].type.string:
                    return ['contains', 'starts with', 'ends with', '=', '≠'];
                case icms.consts['var'].type.criteria:
                case icms.consts['var'].type.data_source:
                case icms.consts['var'].type.array:
                case icms.consts['var'].type.file:
                case icms.consts['var'].type.list:
                    return null;			
                case icms.consts['var'].type.datetime:
                    return ['=', '≠', '>', '<'];
                case icms.consts['var'].type['float']:                
                case icms.consts['var'].type.integer:
                    return ['=', '≠', '>', '<', '≪', '≫', '≤', '≥'];
                case icms.consts['var'].type['boolean']:
                    return ['=', '≠'];
            }
        },
        isFieldInFilter: function (field) {
            var filters = this.getVar('filter').concat(this.getVar('hidden_filter'));
            for(var i = 0; i < filters.length; i++)
                if (filters[i][0] == field)
                    return true;
            return false;
        },
        getLinkedControlInstance: function () {
            var getControl = require('app/controls/control/get');
            var control = getControl(this.getVar('linked_control'));        
            return control;
        },
        getLinkedControlType: function () {
            var control = this.getLinkedControlInstance();
            if (!control)
                return null;
            return control.getControlType();
        },
        updateFieldsForComparision: function () {
            this.field_selector.html('<option value=""></option>');
            for(var o = 0; o < this.cachedData.fields.names.length; o++) {            
                if (this.cachedData.fields.visible[o])
                    this.field_selector.append('<option value="' + o.toString() + '">' + ((!this.cachedData.fields.captions[o])?this.cachedData.fields.names[o]:this.cachedData.fields.captions[o]) + '</option>');
            }             
        },
        getFieldType: function (field) {
            var fnames = this.cachedData.fields.names;
            var ftypes = this.cachedData.fields.types;
            var o = null;
            for (var i=0; i<fnames.length; i++)
                if (fnames[i] == field) {
                    o = i;
                    break;
                }         
            if (o === null)
                return null;
            return ftypes[o];
        },
        addFilterLine: function (field, comparision, value) {
            var obj = jQuery(this);
            var self = this;
            var div = jQuery('<div class="filter_line"></div>');        
            var span1 = jQuery('<span class="field"><i>'+field+'</i></span>');
            var span2 = jQuery('<span class="comparision"> '+comparision+' </span>');        
            var span3 = jQuery('<span class="value"><i> '+value+' </i></span>');
            switch (this.getFieldType(field)) {
                case icms.consts['var'].type.datetime:
                    var dt = new Date(value);                
                    span3.text(dt.toUTCString());
            }
            var rlink = jQuery('<a href="#" title="Remove"></a>');
            var rimg = jQuery('<img src="'+icms.config.url+'/images/icons/delete.gif" title="Remove" alt="Remove" />');
            rlink.append(rimg);
            rlink.click(
                function () {                
                    div.remove();
                    var filters = self.getVar('filter');
                    var pos = parseInt(div.attr('data-position'));               
                    var divs = jQuery('.filter_line', self);
                    divs.each(
                        function () {
                            var div = jQuery(this);
                            var p2 = parseInt(div.attr('data-position'));
                            if (p2 > pos)
                                div.attr('data-position', p2-1);
                        }
                        );
                    var flt = self.getFieldIndex(filters[pos][0]); 
                    if (flt !== null)
                        self.cachedData.fields.visible[flt] = true;                
                    filters.splice(pos, 1);
                    self.setVar('filter', filters);
                    self.regenerateSQL();
                    self.updateFieldsForComparision();  
                    var fselect = jQuery('.fields_select_box', obj);
                    jQuery('option:selected', fselect).removeAttr('selected');
                    fselect.change();
                }
                );
            div.append(span1);
            div.append(span2);
            div.append(span3);
            div.append(rlink);
            obj.append(div);
            var filters = this.getVar('filter');
            filters.push([field, comparision, value]);
            div.attr('data-position', filters.length - 1);
            this.setVar('filter', filters);
            var index = this.getFieldIndex(field);
            if (index !== null)
                this.cachedData.fields.visible[index] = false;  
        },
        getFieldIndex: function (field) {
            for(var z=0; z < this.cachedData.fields.names.length; z++)
                if (field == this.cachedData.fields.names[z])
                    return z;
            return null;
        },
        regenerateSQL: function () {
            var filters = this.getVar('filter').concat(this.getVar('hidden_filter'));
            var sql = [];
            var escapeValue = function(val) {
                switch(typeof val) {
                    case 'string':
                        if (parseInt(val).toString() != val) {
                            val = "'" + val.replace("'", "''") + "'";
                        }                                           
                        break;
                    case 'boolean':
                        val = parseInt(val);
                        break;
                    case 'object':
                        val = "''";
                        break;
                }
                return val;
            }
            for(var i = 0; i < filters.length; i++) {            
                switch (filters[i][1]) {
                    case '>':
                    case '<':
                    case '=':
                        switch (this.getFieldType(filters[i][0])) {
                            case icms.consts['var'].type.datetime:
                                var dt = new Date(filters[i][2]);
                                sql.push('`' + filters[i][0] + '` ' 
                                    + filters[i][1] 
                                    + ' FROM_UNIXTIME(' 
                                    + Math.round(dt.getTime() / 1000).toString()
                                    + ')');
                                break;
                            default:
                                sql.push('`' + filters[i][0] + '` ' + filters[i][1] + ' ' + escapeValue(filters[i][2]));
                        }                    
                        break;
                    case 'starts with':
                        var val = filters[i][2];
                        val = val.replace('~', '~~');
                        val = val.replace('%', '~%');
                        val = val + '%';
                        sql.push('`' + filters[i][0] + '` LIKE ' + escapeValue(val) + ' ESCAPE \'~\'');
                        break;
                    case 'contains':
                        var val = filters[i][2];
                        val = val.replace('~', '~~');
                        val = val.replace('%', '~%');
                        val = '%' + val + '%';
                        sql.push('`' + filters[i][0] + '` LIKE ' + escapeValue(val) + ' ESCAPE \'~\'');
                        break;
                    case 'ends with':
                        var val = filters[i][2];
                        val = val.replace('~', '~~');
                        val = val.replace('%', '~%');
                        val = '%' + val;
                        sql.push('`' + filters[i][0] + '` LIKE ' + escapeValue(val) + ' ESCAPE \'~\'');
                        break;
                    case '≠':
                        sql.push('NOT `' + filters[i][0] + '` = ' + escapeValue(filters[i][2]));
                        break;
                    case '≪':
                        sql.push('`' + filters[i][0] + '` < (' + escapeValue(filters[i][2])) + ' * 10)';
                        break;
                    case '≫':
                        sql.push('`' + filters[i][0] + '` > (' + escapeValue(filters[i][2])) + ' * 10)';
                        break;
                    case '≤':
                        sql.push('`' + filters[i][0] + '` <= ' + escapeValue(filters[i][2]));
                        break;
                    case '≥':
                        sql.push('`' + filters[i][0] + '` >= ' + escapeValue(filters[i][2]));
                        break;
                }
            }
            sql = sql.join(' AND ');
            var control = this.getLinkedControlInstance();
            if (!control)
                return null;
            switch (this.getLinkedControlType()) {
                case 'icms/table':
                    control.setVar('criteria', sql);
                    control.update();
                    break;
            }
        }
    };

    return app;

});