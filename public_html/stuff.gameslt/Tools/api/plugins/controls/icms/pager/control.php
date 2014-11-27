<?php

namespace ImpressCMS\Controls\icms\Pager;

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
    extends \icms_controls_Base 
    implements \icms_controls_iHasContent {   
    
    protected $controls = array();
    
    public function __construct($params) {       
        
        $this->initVar('per_page', self::DTYPE_INTEGER, 20, false, self::RENDER_TYPE_DATA);
        $this->initVar('page', self::DTYPE_INTEGER, 0, false, self::RENDER_TYPE_DATA);        
        $this->initVar('records_count', self::DTYPE_INTEGER, 0, true, self::RENDER_TYPE_DATA);
        $this->initVar('autoupdate_url', self::DTYPE_BOOLEAN, true, false, self::RENDER_TYPE_DATA);
        
        parent::__construct($params);
        
        $this->controls['prev'] = $this->makeControl('button', array('html' => _PREV));
        $this->controls['slider'] = $this->makeControl('slider');
        $this->controls['next'] = $this->makeControl('button', array('html' => _NEXT));
        
    }
    
    public function getContent() {        
        $pagesCount = ceil($this->records_count / $this->per_page) - 1;        
        if ($this->page > $pagesCount)
            $this->page = $pagesCount - 1;
        if ($this->page < 0)
            $this->page = 0;
        
        $this->controls['prev']->disabled = !($this->page > 0);
        $this->controls['next']->disabled = !($this->page < $pagesCount);
        $this->controls['slider']->max = $pagesCount;
        $this->controls['slider']->value = $this->page;
        
        return 'Page: <{control:prev}> <{control:slider}> <{control:next}>';
    }
    
}