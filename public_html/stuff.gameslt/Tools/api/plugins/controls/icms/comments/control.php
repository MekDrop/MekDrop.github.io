<?php

namespace ImpressCMS\Controls\icms\Comments;

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

	public function __construct($params) {
        
        $this->initVar('area', self::DTYPE_INTEGER, 20, false, self::RENDER_TYPE_DATA);
        $this->initVar('itemid', self::DTYPE_INTEGER, 0, false, self::RENDER_TYPE_DATA);
        $this->initVar('module', self::DTYPE_STRING, null, true, self::RENDER_TYPE_DATA);
        
		 $this->controls['form'] = $this->makeControl('form', array());

        parent::__construct($params);
    }

	 public function getContent() {
			$this->controls['form']->action = 'control://'.$this->id.'/submit';
	 }

}