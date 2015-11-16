 <div id="top_flash_popup_wrapper">
 <div id="top_flash_popup" style="position:absolute;margin:0;padding:10px 10px 30px 30px;top:30px;bottom:0px;left:0px;right:0px;overflow-y:auto;">
    <p><h2><?php _e('Embed Flash Movie', 'top-flash'); ?></h2></p>
    <p>
        <label>
            <span style="margin-right:15px;"><?php _e('Select Movie from Media Library:', 'top-flash'); ?></span>
            <select name="top_flash_options[swf]">
                <option value=""><?php _e('-- none --', 'top-flash'); ?></option>
                <?php foreach(TopFlashEmbed::getSwfs() as $swf): ?>
                    <?php if (isset($swf->_dimensions) && $swf->_dimensions) { ?>
                    <option data-width="<?php echo $swf->_dimensions['width']; ?>" data-height="<?php echo $swf->_dimensions['height']; ?>" value="<?php echo $swf->guid; ?>"><?php echo $swf->post_title; ?></option>
                    <?php } else { ?>
                    <option data-width="_notset_" data-height="_notset_" value="<?php echo $swf->guid; ?>"><?php echo $swf->post_title; ?></option>
                    <?php } ?>
                <?php endforeach; ?>
            </select>
        </label>
    </p>
    <p>
        <strong><?php _e('or', 'top-flash'); ?></strong>
        <label><span style="margin-right:15px;"><?php _e('External SWF URI:', 'top-flash'); ?></span>
        <input type="text" name="top_flash_options[swf_uri]" value="" /><span style="width:200px;margin-left:15px;font-style:italic;">(<?php _e('eg. Youtube, Vimeo, swf players etc..', 'top-flash'); ?>)</span>
        </label>
    </p>
    <p>
        <label><span style="margin-right:15px;"><?php _e('Keep Proportional', 'top-flash'); ?></span>
        <input type="checkbox" name="top_flash_options[proportional]" value="1" checked="checked"/>
        </label>
    </p>
    <p>
        <label><span style="margin-right:15px;"><?php _e('Width:', 'top-flash'); ?></span>
        <input type="text" name="top_flash_options[width]" value="" /> (px)
        </label>
    </p>
    <p>
        <label><span style="margin-right:15px;"><?php _e('Height:', 'top-flash'); ?></span>
        <input type="text" name="top_flash_options[height]" value="" /> (px)
        </label>
    </p>
    <!-- http://helpx.adobe.com/flash/kb/flash-object-embed-tag-attributes.html -->
    <p>
        <label><span style="margin-right:15px;"><?php _e('quality:', 'top-flash'); ?></span>
        <select name="top_flash_options[quality]">
            <option value="best"><?php _e('Best', 'top-flash'); ?></option>
            <option value="high"><?php _e('High', 'top-flash'); ?></option>
            <option value="medium"><?php _e('Medium', 'top-flash'); ?></option>
            <option value="autohigh"><?php _e('Auto High', 'top-flash'); ?></option>
            <option value="autolow"><?php _e('Auto Low', 'top-flash'); ?></option>
            <option value="low"><?php _e('Low', 'top-flash'); ?></option>
        </select>
        </label>
    </p>
    <p>
        <label><span style="margin-right:15px;"><?php _e('wmode:', 'top-flash'); ?></span>
        <select name="top_flash_options[wmode]">
            <option value="transparent"><?php _e('Transparent', 'top-flash'); ?></option>
            <option value="opaque"><?php _e('Opaque', 'top-flash'); ?></option>
        </select>
        </label>
    </p>
    <p>
        <label><span style="margin-right:15px;"><?php _e('scale:', 'top-flash'); ?></span>
        <select name="top_flash_options[scale]">
            <option value="default"><?php _e('Show All (default)', 'top-flash'); ?></option>
            <option value="noborder"><?php _e('No Border', 'top-flash'); ?></option>
            <option value="exactfit"><?php _e('Exact Fit', 'top-flash'); ?></option>
            <option value="noscale"><?php _e('No Scale', 'top-flash'); ?></option>
        </select>
        </label>
    </p>
    <p>
        <label><span style="margin-right:15px;"><?php _e('flashVars:', 'top-flash'); ?></span>
        <input type="text" size='80' name="top_flash_options[flashvars]" value="" />
        </label>
    </p>
    <p>
        <strong><span><?php _e('allowFullScreen:', 'top-flash'); ?></span></strong>
        <select name="top_flash_options[allowfullscreen]">
            <option value="false"><?php _e('No', 'top-flash'); ?></option>
            <option value="true"><?php _e('Yes', 'top-flash'); ?></option>
        </select>
    </p>
	<p>
        <input type="submit" name="top_flash_options[embed]" class="button button-primary button-large" value="<?php _e('Embed Movie', 'top-flash'); ?>" />
    </p>
</div>
</div>
<script type="text/javascript">
(function(window, $){
    $(function(){
        var parent=$('#top_flash_popup'), submit=parent.find('input[name="top_flash_options[embed]"]'), w_h=0, h_w=0;
        // defines the options and their default values
        // again, this is not the most elegant way to do this
        // but well, this gets the job done nonetheless
        var optionFields = {
            'swf'    : parent.find('[name="top_flash_options[swf]"]'),
            'swf_uri'    : parent.find('[name="top_flash_options[swf_uri]"]'),
            'proportional' : parent.find('[name="top_flash_options[proportional]"]'),
            'width' : parent.find('[name="top_flash_options[width]"]'),
            'height' : parent.find('[name="top_flash_options[height]"]'),
            'quality' : parent.find('[name="top_flash_options[quality]"]'),
            'wmode' : parent.find('[name="top_flash_options[wmode]"]'),
            'scale' : parent.find('[name="top_flash_options[scale]"]'),
            'flashvars' : parent.find('[name="top_flash_options[flashvars]"]'),
            'allowfullscreen' : parent.find('[name="top_flash_options[allowfullscreen]"]')
        };
        var options = { 
            'swf'    : '',
            'width' : '100',
            'height' : '100',
            'quality' : 'best',
            'wmode' : 'transparent',
            'scale' : 'default',
            'flashvars' : '',
            'allowfullscreen' : 'false'
        };
        optionFields.width.change(function(e){
            if (''!=optionFields.swf_uri.val())
                return;
            if (h_w && optionFields.proportional.prop('checked'))
            {
                optionFields.height.val(Math.floor(parseInt(optionFields.width.val(), 10)*h_w));
            }
        });
        optionFields.height.change(function(e){
            if (''!=optionFields.swf_uri.val())
                return;
            if (w_h && optionFields.proportional.prop('checked'))
            {
                optionFields.width.val(Math.floor(parseInt(optionFields.height.val(), 10)*w_h));
            }
        });
        optionFields.swf.change(function(e){
            var val=$(this).val(), option, w='',h='';
            if (''!=val)
            {
                option=$(this).find('option:selected');
                if (option)
                {
                    w=option.attr('data-width');
                    h=option.attr('data-height');
                    w_h=w/h;
                    h_w=h/w;
                    if (w && '_notset_'!=w)
                        optionFields.width.val(w);
                    if (h && '_notset_'!=h)
                        optionFields.height.val(h);
                }
            }
            else
            {
                w_h=0;
                h_w=0;
                optionFields.width.val('');
                optionFields.height.val('');
            }
        
        });
        // handles the click event of the submit button
        submit.click(function(e){	
            e.preventDefault();
            var shortcode = '[topswf';
            var val;
            for( var opt in options) 
            {
                if ('allowfullscreen'==opt)
                {
                    val=$.trim(optionFields[opt].val());
                }
                else if ('swf'==opt)
                {
                    val=$.trim(optionFields['swf_uri'].val());
                    if (!val || ''==val) 
                        val=$.trim(optionFields[opt].val());
                }
                else
                {
                    val = $.trim(optionFields[opt].val());
                }
                if (!val || ''==val) val=options[opt];
                shortcode += ' ' + opt + '=\'' + val + '\'';
            }
            shortcode += ']';
            
            // inserts the shortcode into the active editor
            window.TopFlashEmbed.App.insert(shortcode);
            // closes Thickbox
            //tb_close();
            tb_remove();
            return false;
        });
    });
})(window, jQuery);
</script>