<?php

namespace ImpressCMS\Controls\icms\Link;

/**
 * This control handles table
 *
 * @author mekdrop
 * 
 * @property int $recordsCount
 * @property int $perPage
 * @property int $page
 */
class Control
    extends \icms_controls_Base {   
    
    public $html = '';
    
    public function __construct($params) {       
        
        $this->initVar('href', self::DTYPE_STRING, '', false, self::RENDER_TYPE_ATTRIBUTE);
        $this->initVar('hreflang', self::DTYPE_STRING, '', false, self::RENDER_TYPE_ATTRIBUTE);        
        $this->initVar('media', self::DTYPE_STRING, '', false, self::RENDER_TYPE_ATTRIBUTE);
        $this->initVar('rel', self::DTYPE_STRING, '', false, self::RENDER_TYPE_ATTRIBUTE, array(
                                                                                                self::VARCFG_POSSIBLE_OPTIONS => array(
                                                                                                    'author',
                                                                                                    'bookmark',
                                                                                                    'help', 
                                                                                                    'license',
                                                                                                    'next',
                                                                                                    'nofollow',
                                                                                                    'noreferrer',
                                                                                                    'prefetch',
                                                                                                    'prev',
                                                                                                    'search',
                                                                                                    'tag'
                                                                                                )
                                                                                          ));
        $this->initVar('target', self::DTYPE_STRING, '_self', false, self::RENDER_TYPE_ATTRIBUTE);
        $this->initVar('type', self::DTYPE_STRING, 'text/html', true, self::RENDER_TYPE_ATTRIBUTE);
        $this->initVar('enabled', self::DTYPE_BOOLEAN, true, false, self::RENDER_TYPE_DATA);
        $this->initVar('question', self::DTYPE_STRING, false, false, self::RENDER_TYPE_DATA);
        
        parent::__construct($params);       
        
        $this->baseTag = 'a';
        
        if (empty($this->html))
            $this->html = $this->href;
        
    }
    
    public function getAttributes() {
        $ret = parent::getAttributes();
        if ($ret['href']) {
            $scheme = parse_url($ret['href'], PHP_URL_SCHEME);
            if ($scheme == 'control' || $scheme == 'module') {
                $ret['data-href'] = $ret['href'];
                $ret['href'] = 'javascript:window.close();';
            }
        }
        return $ret;
    } 
    
}