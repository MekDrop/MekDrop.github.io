<?php

namespace ImpressCMS\Controls\icms\Missing;

/**
 * This control is used if other control is missing
 *
 * @author mekdrop
 */
class Control
    extends \icms_controls_Base 
    implements \icms_controls_iHasContent {
        
    public function __construct($params) {
        $this->initVar('control', self::DTYPE_STRING, null, true, self::RENDER_TYPE_DATA);
        $this->initVar('author', self::DTYPE_STRING, null, true, self::RENDER_TYPE_DATA);
        $this->initVar('options', self::DTYPE_ARRAY, array(), false, self::RENDER_TYPE_DATA);

        parent::__construct($params);
    }

    public function getContent() {
        return sprintf('Control "%s" by "%s" author is missing on server', $this->control, $this->author);
    }        
    
}