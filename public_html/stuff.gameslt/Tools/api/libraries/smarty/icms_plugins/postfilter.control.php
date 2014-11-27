<?php

function smarty_postfilter_control($source, &$smarty) {
    $source = str_replace('</body>', '
            <?php                        
                if (isset($this->_controls)) {                    
                    $load = $this->_controlHandler->getRequiredURLs($this->_controls);
                    unset($this->_controls, $this->_controlsNum, $this->_controlHandler);
                    $manifest = icms_cache_Manifest::getInstance();
                    if (isset($load['.icms_controls_Base::URL_TYPE_CSS.'])) {
                        echo \'<style type="text/css">\';
                        foreach ($load['.icms_controls_Base::URL_TYPE_CSS.'] as $url) {
                            echo \'@import url("\'.$url.\'");\';
                            $manifest->add($url);
                        }
                        echo \'</style>\';
                    }
                    if (isset($load['.icms_controls_Base::URL_TYPE_JS.'])) {
                        foreach ($load['.icms_controls_Base::URL_TYPE_JS.'] as $url) {
                           echo \'<script type="text/javascript" src="\'.$url.\'" defer="defer"></script>\';
                        }
                        $manifest->add($url);
                    }
                    if (isset($load['.icms_controls_Base::URL_TYPE_JS_INLINE.'])) {
                        echo \'<script type="text/javascript">\';
                        foreach ($load['.icms_controls_Base::URL_TYPE_JS_INLINE.'] as $url) {
                           echo $url;
                        }
                        echo \'</script>\';
                        $manifest->add($url);
                    }                    
                    unset($load, $manifest);
                }
            ?></body>
        ', $source);
    return $source;
}