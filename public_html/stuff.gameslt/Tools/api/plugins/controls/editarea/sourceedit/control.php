<?php

namespace ImpressCMS\Controls\editarea\sourceedit;

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
    public $editorURL = '';
    
    public function __construct($params) {       
        
        $this->initVar('syntax', self::DTYPE_STRING, 'php', false, self::RENDER_TYPE_DATA);        
        $this->initVar('disabled', self::DTYPE_BOOLEAN, false, false, self::RENDER_TYPE_DATA);
        $this->initVar('width', self::DTYPE_INTEGER, '750', false, self::RENDER_TYPE_STYLE);
        $this->initVar('height', self::DTYPE_INTEGER, '400', false, self::RENDER_TYPE_STYLE);
        
        $this->initVar('start_highlight', self::DTYPE_BOOLEAN, true, false, self::RENDER_TYPE_DATA);
        $this->initVar('allow_resize', self::DTYPE_BOOLEAN, false, false, self::RENDER_TYPE_DATA);
        $this->initVar('allow_toggle', self::DTYPE_BOOLEAN, false, false, self::RENDER_TYPE_DATA);
        $this->initVar('autocompletion', self::DTYPE_BOOLEAN, true, false, self::RENDER_TYPE_DATA);
        
        parent::__construct($params);       
        
        $this->baseTag = 'button';
        $this->editorURL = ICMS_CONTROLS_URL . '/editarea/sourceedit/editor';
        
    }
    
    public function __set($name, $value) {
        if ($name == 'syntax')
            switch ($value) {
                case 'html':
                case 'xhtml':
                    $value = 'xml'; // take xml for html rendering
                break;
                case 'javascript':
                    $value = 'js';
                break;
            }
        parent::__set($name, $value);
    }    
    
    public function getRequiredURLs() {
        $ret = parent::getRequiredURLs();
        
        $ret['js'][] = $this->editorURL . '/edit_area_full_with_plugins.js';
        
		// @todo this still has to be added like this - until someone figures it out
		$ret .= '
<script language="javascript" type="text/javascript">
editAreaLoader.init({
	id: "' . $this->getName() . '_tarea",
	syntax: "' . (!isset($this->config['syntax']) ? 'php' : $this->config['syntax']) . '",
	language: "' . (!isset($this->config['language']) ? 'en' : $this->config['language']) . '",
	start_highlight: ' . (!isset($this->config['start_highlight']) ? 'true' : ($this->config['start_highlight'] ? 'true' : 'false')) . ',
	allow_resize: ' . (!isset($this->config['allow_resize']) ? 'false' : ($this->config['allow_resize'] ? 'true' : 'false')) . ',
	allow_toggle: ' . (!isset($this->config['allow_toggle']) ? 'false' : ($this->config['allow_toggle'] ? 'true' : 'false')) . ',
	fullscreen: ' . (!isset($this->config['fullscreen']) ? 'false' : ($this->config['fullscreen'] ? 'true' : 'false')) . ',
	is_editable: ' . (!isset($this->config['is_editable']) ? 'true' : ($this->config['is_editable'] ? 'true' : 'false')) . ',
	autocompletion: ' . (!isset($this->config['autocompletion']) ? 'true' : ($this->config['autocompletion'] ? 'true' : 'false')) . '
});
</script>';
        
        //some global includes
        $ret['css'][] = $this->editorURL . '/css/editor.css';
        $ret['js'][] = $this->editorURL . '/js/codemirror.js';
        
        //some current includes
        switch ($this->config['syntax']) {
            case 'php':
                $ret['js'][] = $this->editorURL . '/contrib/' . $this->syntax . '/js/tokenizephp.js';
            case 'lua':
            case 'python':
                $ret['css'][] = $this->editorURL . '/contrib/' . $this->syntax . '/css/' . $this->syntax . 'colors.css';
                $ret['js'][] = $this->editorURL . '/contrib/' . $this->syntax . '/js/parse' . $this->syntax . '.js';
                break;
            case 'xml':
            case 'css':
            case 'javascript':
            case 'js':
            case 'sparql':
                $ret['js'][] = $this->editorURL . '/js/parse' . $this->syntax . '.js';
                $ret['css'][] = $this->editorURL . '/css/' . $this->syntax . 'colors.css';
                break;
            case 'mixed':
                $ret['js'][] = $this->editorURL . '/js/parsexml.js"';
                $ret['js'][] = $this->editorURL .'/js/parsecss.js"';
                $ret['js'][] = $this->editorURL . '/js/tokenizejavascript.js"';
                $ret['js'][] = $this->editorURL .'/js/parsejavascript.js"';
                $ret['js'][] = $this->editorURL .'/js/parsehtmlmixed.js"';
                $ret['css'][] = $this->editorURL . '/css/csscolors.css';
                $ret['css'][] = $this->editorURL . '/css/jscolors.css';
                $ret['css'][] = $this->editorURL . '/css/xmlcolors.css';
                break;
        }
        $ret['css'][] = $this->editorURL . '/css/docs.css';
        
        return $ret;
    }
    
    public function getAttributes() {
        $ret = parent::getAttributes();
        $ret['data-editor-url'] = $this->editorURL;
        return $ret;
    }   
    
}