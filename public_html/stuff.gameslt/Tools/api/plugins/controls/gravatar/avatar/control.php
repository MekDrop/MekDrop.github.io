<?php

namespace ImpressCMS\Controls\gravatar\avatar;

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
        
        $this->initVar('rating', self::DTYPE_INTEGER, false, false, self::RENDER_TYPE_DATA);
        $this->initVar('size', self::DTYPE_INTEGER, 32, false, self::RENDER_TYPE_DATA);
        $this->initVar('default', self::DTYPE_STRING, null, false, self::RENDER_TYPE_DATA);
        $this->initVar('border', self::DTYPE_BOOLEAN, '', false, self::RENDER_TYPE_DATA);
        $this->initVar('email', self::DTYPE_STRING, '', false, self::RENDER_TYPE_DATA);              
        
        parent::__construct($params);       
        
        $this->baseTag = 'img';
        
    }
    
    public function makeURL() {
        $params = array(
            'size' => $this->size, 
            'd' => 'identicon'
        );
        if ($this->rating)
            $params['rating'] = $this->rating;
        if ($this->default)
            $params['default'] = $this->default;
        if ($this->border)
            $params['border'] = $this->border;
        return 'http://www.gravatar.com/avatar/' . md5(strtolower($this->email)) . '?' . http_build_query($params);
    }
    
    public function getAttributes($skipFalse = true) {                
        return array(
            'img' => $this->makeURL(),
            'width' => $this->size,
            'height' => $this->size
        );
    }
    
}