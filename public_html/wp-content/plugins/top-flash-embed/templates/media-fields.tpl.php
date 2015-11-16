<div class="top-flash-container">
<p><strong><?php _e('Top Flash Embed Options', 'top-flash'); ?></strong></p>
<input type="hidden" name="_top_flash_options[swf]" value="<?php echo $attachment->guid; ?>" />
<p><label style="float:none;"><span style="float:none;margin-right:7px;"><?php _e('Width', 'top-flash'); ?></span><input type="text" name="_top_flash_options[width]" value="<?php echo ($dims)?$dims['width']:''; ?>" /></label></p>
<p><label style="float:none;"><span style="float:none;margin-right:7px;"><?php _e('Height', 'top-flash'); ?></span><input type="text" name="_top_flash_options[height]" value="<?php echo ($dims)?$dims['height']:''; ?>" /></label></p>
<p>
    <label style="float:none;">
        <span style="float:none;margin-right:7px;"><?php _e('quality', 'top-flash'); ?></span>
        <select name="_top_flash_options[quality]">
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
    <label style="float:none;">
        <span style="float:none;margin-right:7px;"><?php _e('wmode', 'top-flash'); ?></span>
        <select name="_top_flash_options[wmode]">
            <option value="transparent" selected="selected"><?php _e('Transparent', 'top-flash'); ?></option>
            <option value="opaque"><?php _e('Opaque', 'top-flash'); ?></option>
        </select>
    </label>
</p>
<p>
    <label style="float:none;">
        <span style="float:none;margin-right:7px;"><?php _e('scale', 'top-flash'); ?></span>
        <select name="_top_flash_options[scale]">
            <option value="default"><?php _e('Show All (default)', 'top-flash'); ?></option>
            <option value="noborder"><?php _e('No Border', 'top-flash'); ?></option>
            <option value="exactfit"><?php _e('Exact Fit', 'top-flash'); ?></option>
            <option value="noscale"><?php _e('No Scale', 'top-flash'); ?></option>
        </select>
    </label>
</p>
<p><label style="float:none;"><span style="float:none;margin-right:7px;"><?php _e('flashVars', 'top-flash'); ?></span><input type="text" name="_top_flash_options[flashvars]" value="" /></label></p>
<p>
    <label style="float:none;"><strong style="float:none;margin-right:7px;"><?php _e('allowFullScreen:', 'top-flash'); ?></strong>
    <select name="_top_flash_options[allowfullscreen]">
        <option value="false" selected="selected"><?php _e('No', 'top-flash'); ?></option>
        <option value="true"><?php _e('Yes', 'top-flash'); ?></option>
    </select></label>
</p>
<p><input type='button' name="_top_flash_options[embed]" class='top-flash-embed button media-button button-primary button-large' value='<?php _e('Embed Movie', 'top-flash'); ?>' /></p>
</div>
<script type="text/javascript">
/* <![CDATA[ */
(function(window, $){
    $(function(){
        // handles the click event of the submit button
        $(document).off('click', '.top-flash-embed.button');	
        $(document).on('click', '.top-flash-embed.button', function(event){	
            event.preventDefault();
            event.stopPropagation();
            var parent=$(this).closest('.top-flash-container');
            var optionFields = {
                'swf'    : parent.find('input[name="_top_flash_options[swf]"]'),
                'width' : parent.find('input[name="_top_flash_options[width]"]'),
                'height' : parent.find('input[name="_top_flash_options[height]"]'),
                'quality' : parent.find('select[name="_top_flash_options[quality]"]'),
                'wmode' : parent.find('select[name="_top_flash_options[wmode]"]'),
                'scale' : parent.find('select[name="_top_flash_options[scale]"]'),
                'flashvars' : parent.find('input[name="_top_flash_options[flashvars]"]'),
                'allowfullscreen' : parent.find('select[name="_top_flash_options[allowfullscreen]"]')
            };
            var shortcode = '[topswf';
            var val;
            for( var opt in optionFields) 
            {
                val = $.trim(optionFields[opt].val());
                shortcode += ' ' + opt + '=\'' + val + '\'';
            }
            shortcode += ']';
            
            // closes Thickbox
            if ($('#TB_window').length) tb_remove();
            else
                // nasty hack, maybe better in the future
                $(this).closest('.media-modal.wp-core-ui').find('.media-modal-close').eq(0).click();
            
            // inserts the shortcode into the active editor
            window.TopFlashEmbed.App.insert(shortcode);
            
            return false;
        });
    });
})(window, jQuery);
/* ]]> */
</script>