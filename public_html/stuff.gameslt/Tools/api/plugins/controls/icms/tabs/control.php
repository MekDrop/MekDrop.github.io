<?php

namespace ImpressCMS\Controls\icms\Tabs;

/**
 * This control handles table
 *
 * @author mekdrop
 * 
 * @property array $tabs Tabs for this
 * @property array $selected Selected tabs
 */
class Control
    extends \icms_controls_Base {
    
    protected $controls = array();
    
    public function __construct($params) {
        
        $this->initVar('tabs', self::DTYPE_LIST, array(), true, self::RENDER_TYPE_DATA);
        $this->initVar('selected', self::DTYPE_INTEGER, 0, false, self::RENDER_TYPE_DATA);
                
        parent::__construct($params);
    }    
    
    public function getContent() {
        $ret = '<ul class="nav nav-tabs">';
        $r2 = '';
        foreach ($this->tabs as $index => $tab) {
            $area_id = $this->id . '_tab_' . $index;
            $ret .= '<li data-click_area="'.$area_id.'"';
            $r2 .= '<div id="'.$area_id.'" class="tab-pane';
            if ($index == $this->selected) {
                $ret .= ' class="active"';
                $r2 = ' active';
                if (isset($tab['action'])) {
                    // TODO: Somehow fetch action
                }
            }
            $r2 .= '">';
            if (isset($tab['content']))
                $r2 .= $tab['content'];
            $r2 .= '</div>';
            if (isset($tab['action']))
                $ret .= ' data-select_action="' . $tab['action'] ."'";
            if (isset($tab['title']))
                $ret .= ' title="' . htmlentities($tab['title']) ."'";
            $ret .= '>' . $tab['name'] . '</li>';            
        }
        $ret .= '</ul>' . $r2;
        return $ret;
    }
    
}