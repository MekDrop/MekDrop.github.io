<?php
/*
*
*   Main Class
*
*/
class TopFlashEmbed
{

    private static $mimeTypes=array('application/x-shockwave-flash');
    
    public static function init()
    {
        if(is_admin())
        {    
            //API
            add_action('admin_init', array('TopFlashEmbed', 'adminInit'), 5);
            add_action('admin_enqueue_scripts', array('TopFlashEmbed', 'adminScript'), 100);
            add_action('wp_ajax_top_flash_Popup', array('TopFlashEmbed', 'doPopup'));
        }
        // add extra info about swf movies, as custom fields
        add_action('add_attachment', array('TopFlashEmbed', 'extraSWfFields'), 10, 1 );
        add_action('edit_attachment', array('TopFlashEmbed', 'extraSWfFields'), 10, 1 );
        add_filter("attachment_fields_to_edit", array('TopFlashEmbed', 'extraFieldsToEdit'), 2, 2);  
        //add_filter("attachment_fields_to_save", array('TopFlashEmbed', 'extraFieldsToSave'), 4, 2);  
        
        add_shortcode( 'topswf', array('TopFlashEmbed', 'doShortcode') );
    }
    
    public static function extraSwfFields($attachment_id)
    {
        $attachment=get_post($attachment_id);
        if (
            $attachment && 
            in_array($attachment->post_mime_type, self::$mimeTypes) && 
            isset($attachment->guid)
        )
        {
            try{
                $dims=getimagesize($attachment->guid);
                list($w, $h)=$dims;
                $dims=array('width'=>$w, 'height'=>$h);
                update_post_meta($attachment_id, '_top_flash_dims', $dims);
            }catch (Exception $e) {}
        }
    }
    
    public static function extraFieldsToEdit($form_fields, $attachment) 
    {  
        global $pagenow;
        if (
            !in_array($pagenow, array('post.php', 'post-new.php')) && 
            in_array($attachment->post_mime_type, self::$mimeTypes)
        )
        {
            $dims=get_post_meta($attachment->ID, '_top_flash_dims', true);
            $html=self::renderTemplate('media-fields', array(
                'attachment'=>$attachment,
                'dims'=>$dims
            ));
            $form_fields["top_flash"] = array(  
                "label" =>'',  
                "input" => "html",
                "html" => $html
            );
        }
        return $form_fields;  
    }  

    /*public static function extraFieldsToSave($post, $attachment) 
    {
        // do nothing
        return $post;
    }*/
    
    public static function getSwfs()
    {
        static $swfs=null;
        if (null===$swfs)
        {
            $swfs=get_posts(array(
                'numberposts'     => -1,
                'orderby'         => 'title',
                'order'           => 'ASC',
                'post_type'       =>'attachment',
                'post_mime_type'  =>'application/x-shockwave-flash',
                'post_status'     => null,
                'post_parent'     => null
            ));
            if ($swfs)
            {
                foreach ($swfs as $ii=>$swf)
                    $swfs[$ii]->_dimensions=get_post_meta($swf->ID, '_top_flash_dims', true);
            }
        }
        return $swfs;
    }
    
    public static function adminInit() 
    {
        if ( current_user_can( 'edit_posts' ) && current_user_can( 'edit_pages' ) ) 
        {
            add_filter( 'mce_buttons', array('TopFlashEmbed', 'mceButton'), 5 );
            add_filter( 'mce_external_plugins', array('TopFlashEmbed', 'mcePlugin'), 5 );
        }
    }

    public static function mceButton( $buttons ) 
    {
        array_push( $buttons, 'separator', 'top_flash_button' );
        return $buttons;
    }

    public static function mcePlugin( $plugins ) 
    {
        $plugins['TopFlashEmbed'] = TOPFLASH_PLUGIN_URL.'/assets/js/editor/plugin.js';
        return $plugins;
    }

    public static function adminScript() 
    {
        wp_enqueue_script('top-flash-embed', TOPFLASH_PLUGIN_URL.'/assets/js/main.min.js', array('jquery'), TOPFLASH_PLUGIN_VERSION, true);
        wp_localize_script('top-flash-embed', 'TopFlashEmbedConfig', array(
            'Settings'=>array(
                'url'=>TOPFLASH_PLUGIN_URL,
                'popup'=>admin_url('admin-ajax.php?action=top_flash_Popup')
            ),
            'Locale'=>array(
                'title'=>__('Embed Flash Movie', 'top-flash'),
                'icon'=>TOPFLASH_PLUGIN_URL.'/assets/images/flash_embed_24x24.gif'
            )
        ));
    }

    public static function doPopup()
    {
        include TOPFLASH_PLUGIN_PATH.'/assets/js/editor/popup.php';
        die();
    }
    
    // [topswf] shortcode
    public static function doShortcode( $atts, $content='' ) 
    {
        extract( 
            shortcode_atts(
                array(
                    'swf' => '',
                    'width' => '100',
                    'height' => '100',
                    'quality' => 'best',
                    'wmode' => 'transparent',
                    'scale' => 'default',
                    'flashvars' => '',
                    'allowfullscreen'=>'false'
                ), 
                $atts 
            ) 
        );
     
        $swfoutput='';
        $swf=trim($swf);
        if ($swf && ''!=$swf)
        {
            ob_start(); ?>
<!-- top flash embed swf tag start-->
<object width="<?php echo $width; ?>" height="<?php echo $height; ?>" data="<?php echo $swf; ?>" type="application/x-shockwave-flash">
    <param name="movie" value="<?php echo $swf; ?>" /> 
    <param name="quality" value="<?php echo $quality; ?>" /> 
    <param name="wmode" value="<?php echo $wmode; ?>" /> 
    <param name="scale" value="<?php echo $scale; ?>" /> 
    <param name="FlashVars" value="<?php echo $flashvars; ?>" /> 
    <param name="allowFullScreen" value="<?php echo $allowfullscreen; ?>" /> 
</object>
<!-- top flash embed swf tag end-->
            <?php
            $swfoutput=ob_get_clean();
        }
        return $swfoutput;
    }
    // USE WP Object_Cache API to cache templates (so 3rd-party cache plugins can be used also)
    private static function renderTemplate($template, array $args=array(), $cache=false/*, $template_base_path=false*/)
    {
        $template_path = TOPFLASH_PLUGIN_PATH . DIRECTORY_SEPARATOR . 'templates' . DIRECTORY_SEPARATOR . $template . '.tpl.php';
        
        // use caching of templates
        $output=false;
        if ($cache)
        {
            $group='_TopFlashEmbed_';
            $key=sha1(serialize(array($template_path, $args)));
            $output=wp_cache_get( $key, $group );
        }
        
        if (false === $output)
        {
            if (!is_file($template_path))
            {
                printf(__('File "%s" doesn\'t exist!', 'top-flash'), $template_path);
                return '';
            }
            $output = self::getTemplateOutput($template_path, $args);
            if ($cache) wp_cache_set( $key, $output, $group/*, $expire*/ );
        }
        return $output;
    }
    
    private static function getTemplateOutput($______templatepath________, array $______args______=array())
    {
        ob_start();
            if (!empty($______args______)) extract($______args______);
            include($______templatepath________);
        return ob_get_clean();
    }
}
