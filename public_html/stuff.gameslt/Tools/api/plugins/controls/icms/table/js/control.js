define(['app/controls/uri/url/update', 'jquery'], function (updateCurrentURL, jQuery) {

    var app = {
        pager: null,
        head: null,
        selectedHead: null,
        controlInitialized: function () {
            var obj = jQuery(this);
            var self = this;
            this.pager = jQuery('#' + this.getVar('id') + '_pager').getControl()[0];
            this.pager.bind(
                'change',
                function () {
                    var page = self.pager.getVar('page');
                    self.setVar('page', page);
                    self.update();
                    updateCurrentURL();
                }
                );
            this.head = jQuery('thead th', obj).filter(
                function () {
                    var obj = jQuery(this);
                    return !obj.hasClass('notselectable');
                }
                );
            this.selectedHead = jQuery('thead .selected', obj);
            this.head.click(
                function () {
                    var columns = self.getVar('columns');
                    var index = self.head.index(this);
                    if (columns[index] == self.getVar('order_by')) {
                        self.setVar('asc_sorting', !self.getVar('asc_sorting'));
                    } else {
                        self.setVar('order_by', columns[index]);
                        self.setVar('asc_sorting', true);
                    }
                    self.update();
                    updateCurrentURL();
                }
                );        
            this.bind({
                changedVar: function (event, name, value) {
                    switch (name) {
                        case 'order_by':
                            self.selectedHead.removeClass('desc');
                            self.selectedHead.removeClass('asc');
                            self.selectedHead.removeClass('selected');
                            var columns = self.getVar('columns');                        
                            var i = 0;
                            for(i = 0; i< columns.length; i++)
                                if (columns[i] == value)
                                    break;
                            var obj = jQuery(self.head[i]);
                            obj.addClass(self.getVar('asc_sorting')?'asc':'desc');
                            obj.addClass('selected');
                            self.selectedHead = obj;
                            break;
                        case 'asc_sorting':
                            if (value) {
                                self.selectedHead.removeClass('desc');
                                self.selectedHead.addClass('asc');
                            } else {
                                self.selectedHead.removeClass('asc');
                                self.selectedHead.addClass('desc');
                            }
                            break;
                        case 'page':
                            if (value.toString() != self.pager.getVar('page').toString())
                                self.pager.setVar('page', value);
                            break;
                    }
                }
            });
            this.makeActionsAlive();
        },
        makeActionsAlive: function () {
            var self = this;
            jQuery('a[data-question]', jQuery(this)).bind(
                'click',
                function (event) {
                    var obj = jQuery(this);
                    var msg = obj.attr('data-question');
                    if (!confirm(msg)) {
                        if (!obj.hasClass('stop-action')) {
                            obj.addClass('stop-action');
                            setTimeout(function() {
                                obj.removeClass('stop-action')
                            }, 500);
                        }            
                        event.preventDefault();
                        event.stopPropagation();
                        return false;
                    } else {
                        if (obj.hasClass('stop-action'))
                            obj.removeClass('stop-action');
                    }
                }
                );
            jQuery('a[data-action]', jQuery(this)).bind(
                'click',
                function (event) {
                    var obj = jQuery(this);
                    if (obj.hasClass('stop-action'))
                        return false;
                
                    var action = obj.attr('data-action');
                    var id = self.findIDByObject(obj);
                    self[action](id);
                }
                );
        },
        findIDByObject: function (obj) {
            var findTR = function (obj) {
                var pr = obj.parent();
                var tag = pr.get(0).nodeName.toLowerCase();
                if (tag == 'tr')
                    return pr;
                else
                    return findTR(pr);
            };
            obj = jQuery(obj);
            var trNode = (obj.get(0).nodeName.toLowerCase() == 'tr')?obj:findTR(obj);
            var classes = trNode.attr('class').split(' ');
            for(var i = 0; i < classes.length; i++)
                if (classes[i].substr(0, 2) == 'r_') {
                    var id = parseInt(classes[i].substr(2));
                    if (id > 0)
                        return id;
                }
            return null;
        },
        update: function () {
            var oldHTML = this.html();
            var self = this;
            this.exec('update');
            var func = function (event, data) {
                // self.makeActionsAlive();
                if (self.html() == oldHTML)
                    return;
                self.pager.setVar('records_count', data.recordsCount);
                self.trigger('change');
            };
            this.bind('execFinished', func);
        },
        storeField: function (id, field) {
            var name = '.r_' + id.toString().replace(/[^a-zA-Z0-9]/g, '_'); 
            var row = jQuery(name, jQuery(this));
            var cell = jQuery('.' + field, row);
            var input = jQuery('input', cell);
            var val = '';
            if (input.length > 0) {
                if (input.attr('type') == 'checkbox' || input.attr('type') == 'radio')
                    val = (input.attr('checked')?1:0);
                else
                    val = input.val();
            } else {
                val = input.val();
            }
            this.exec({
                action: 'storefield', 
                params: {
                    item_id: id, 
                    field:field, 
                    value:val
                }, 
                noAnimation: true
            });
        },
        'delete': function (id) {
            var name = '.r_' + id.toString(); 
            var row = jQuery(name, jQuery(this));
            row.hide();
            this.exec({
                action: 'delete', 
                params: {
                    item_id:id
                }, 
                noAnimation: true
            });
            var func = function (event, data) {
                self.makeActionsAlive();
                self.pager.setVar('records_count', data.recordsCount);
                self.trigger('change');
            };
            this.bind('execFinished', func);
        }
    
    };

    return app;

});