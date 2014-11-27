<?php

namespace ImpressCMS\Controls\icms\ObjForm;

require_once dirname(__DIR__) . '/form/control.php';

/**
 * This control handles form created from object
 *
 * @author mekdrop
 * 
 * @property \icms_ipf_Handler  $source     Handler from where get object
 * @property string             $title      Title of form
 * @property int                $item_id    Item ID of object
 */
class Control
    extends \ImpressCMS\Controls\icms\Form\Control
    implements \icms_controls_iHasContent {
    
    protected $controls = array();
    protected $obj = null;
    protected $keyName = null;
    protected $keys = array();

    public function __construct($params) {       
        
        $this->initVar('source', self::DTYPE_DATA_SOURCE, null, true);
        $this->initVar('title', self::DTYPE_STRING, '', false);
        $this->initVar('item_id', self::DTYPE_INTEGER, 0, false);
        $this->initVar('button', self::DTYPE_STRING, 'Submit', false);
        
        parent::__construct($params);
        
        $this->updateObj();
        $this->updateControls();
    }
    
    public function __set($name, $value) {
        parent::__set($name, $value);
        if ($name == 'source') {
            $this->updateObj();
            $this->updateControls();
        }            
    }
    
    protected function updateObj() {
        if (!$this->source) {
            $this->obj = null;
            $this->keyName = null;
        } elseif ($this->item_id > 0) {
            $this->obj = $this->source->get($this->item_id);
            $this->keyName = $this->source->keyName;
        } else {
            $this->obj = $this->source->create();        
            $this->keyName = $this->source->keyName;
        }
    }
    
    protected function updateControls() {
        if (!$this->obj) {
            $this->controls = array();
            return;
        }

        $isnew = $this->obj->isNew();
        $ctl_handler = \icms::handler('icms_controls');
        $this->keys = array();
        foreach ($this->obj->getVars() as $key => $info) {
            $ctl = $this->obj->getControl($key);       
            $params = array(                
                'value'     => ($isnew)?'':$obj->getVar($key)
            );
            if ($key == $this->keyName) {
                $params['disabled'] = true;
                if ($isnew)
                    $params['value'] = '???';
            }
            if (isset($ctl['itemHandler'])) {
                if (!isset($ctl['name']))
                    $ctl['name'] = 'combobox';
                if (!isset($ctl['module']))
                    $ctl['module'] = \icms::$module->getVar('name');
                $handler = icms_getModuleHandler($ctl['itemHandler'], $ctl['module']);
                $params['items'] = call_user_func(array($handler, $ctl['method']));
            } elseif (isset($ctl['object']) && isset($ctl['method'])) {                
                if (!isset($ctl['name']))
                    $ctl['name'] = 'combobox';
                $params['items'] = call_user_func(array($ctl['object'], $ctl['method']));
            }            
            switch ($ctl['name']) {
                case 'select':
                    $ctl['name'] = 'combobox';
                break;
            }            
            if (isset($ctl['form_editor']))
                $ctl['name'] = $ctl['form_editor'] . '/' . $ctl['name']; 
            $this->controls['f' . $key] = $ctl_handler->make($ctl['name'], $params);
            $this->controls['l' . $key] = $ctl_handler->make('label', array(
                'title' => isset($info['form_dsc'])?$info['form_dsc']:'',
                'for'   => $this->controls['f' . $key]->getVar('id'),
                'text'  => (isset($info['form_caption']) && !empty($info['form_caption']))?$info['form_caption']:$key,
                'class' => $info['required']?array('required'):null
            ));
            $this->keys[] = $key;
        }
    }
    
    public function getContent() {
        if (!$this->source)
            return '';
        $ret = '<table style="width: 100%" class="outer" cellspacing="1">';
        if ($this->title)
            $ret .= '<thead><tr><th>'.$this->title.'</th></tr></thead>';
        $ret .= '<tbody>';//$var['form_dsc']
        foreach ($this->keys as $key) {
            $ret .= '<tr id="'.$key.'_row"><td class="head"><{control:l' . $key . '}></td><td class="even"><{control:f' . $key . '}>' . '</td></tr>';
        }       
        $ret .= '</tbody><tfoot><tr><td colspan="2"><button type="submit">'.$this->button.'</button></td></tr></tfoot></table>';
        return $ret;
    }
    
    
}