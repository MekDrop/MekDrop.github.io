<?php

namespace ImpressCMS\Controls\icms\Table;

/**
 * This control handles table
 *
 * @author mekdrop
 * 
 * @property array $columns
 * @property string $order_by
 * @property bool $asc_sorting
 * @property icms_ipf_Handler $source
 * @property icms_db_criteria_Item $criteria
 * @property int $per_page
 * @property int $page
 * @property bool $show_controls
 * @property string $name_link
 * @property array $actions 
 */
class Control
    extends \icms_controls_Base 
    implements \icms_controls_iHasContent {         
    
    protected $controls = array();
    
    public function __construct($params) {       
        
        $this->initVar('columns', self::DTYPE_LIST, array(), true, self::RENDER_TYPE_DATA);
        $this->initVar('order_by', self::DTYPE_STRING, '', false, self::RENDER_TYPE_DATA);
        $this->initVar('asc_sorting', self::DTYPE_BOOLEAN, true, false, self::RENDER_TYPE_DATA);
        $this->initVar('source', self::DTYPE_DATA_SOURCE, null, false, self::RENDER_TYPE_DATA);
        $this->initVar('criteria', self::DTYPE_CRITERIA, null, false, self::RENDER_TYPE_DATA);
        $this->initVar('per_page', self::DTYPE_INTEGER, 20, false, self::RENDER_TYPE_DATA);
        $this->initVar('page', self::DTYPE_INTEGER, 0, false, self::RENDER_TYPE_DATA);
        $this->initVar('show_controls', self::DTYPE_BOOLEAN, false, false, self::RENDER_TYPE_DATA);
        $this->initVar('name_link', self::DTYPE_STRING, null, false, self::RENDER_TYPE_DATA);
        $this->initVar('actions', self::DTYPE_ARRAY, null, false, self::RENDER_TYPE_DATA);
        $this->initVar('show_pager', self::DTYPE_BOOLEAN, true, false, self::RENDER_TYPE_DATA);
        
        parent::__construct($params);        
        
        $this->baseTag = 'table';
        
        $this->controls['pager'] = $this->makeControl('pager', array('auto_title' => true, 'id' => $this->id . '_pager'));
        
        
    }
    
    /**
     * Returns dummy instance of current object
     *
     * @return icms_ipf_Object
     */
    public function getDummyObject() {    
        return $this->source->create();
    }
    
    public function renderHeader() {
        icms_loadLanguageFile($this->source->_moduleName, 'common');
        $item = $this->getDummyObject();
        $prefix = '_CO_'.strtoupper($this->source->getModuleItemString()). '_';
        $rez = '<tr>';
        $order = $this->getSorting();
        foreach ($this->columns as $column) {
            $title = $item->getVarInfo($column,'form_caption');
            if (empty($title)) {
                $const = $prefix . strtoupper($column);
                if (defined($const)) 
                    $title = constant($const);
                else
                    $title = $column;
            }
            $rez .= '<th'.(($order == $column)?' class="selected '.($this->asc_sorting?'asc':'desc').'"':'').'>' . $title . '</th>';
        }
        if (!empty($this->actions))
            $rez .= '<th class="notselectable"></th>';
        $rez .= '</tr>';
        return $rez;
    }
    
    public function getSorting() {
        return in_array($this->order_by, $this->columns)?$this->order_by:current($this->columns);
    }
    
    protected function formatURL($url, \icms_ipf_Object &$record) {
        preg_match_all('/\{\$([^\}]+)\}/ui', $url, $ret);
        $row = $record->toArray();        
        $keys = array_unique($ret[1]);
        foreach ($keys as $key) {            
            $parts = explode('.', $key);
            $cnt = count($parts);
            if ($parts[0] == 'smarty') {
                if ($parts[1] == 'const') {
                    $url = str_replace('{$' . $key . '}', constant($parts[2]), $url );
                    return $url;
                } else {
                    $key2 = '_' . $parts[1];
                    for($i = 2; $i < $cnt; $i++)
                        if (!is_numeric($parts[$i]))
                            $key2 .= '[\'' . $parts[$i] . '\']';
                        else
                            $key2 .= '[' . $parts[$i] . ']';
                }                
            } else {
                $key2 = $parts[0];
                for($i = 1; $i < $cnt; $i++)
                    if (!is_numeric($parts[$i]))
                        $key2 .= '[\'' . $parts[$i] . '\']';
                    else
                        $key2 .= '[' . $parts[$i] . ']';
            }
            $url = str_replace('{$' . $key . '}', eval('return rawurlencode(json_encode($'.$key2.'));'), $url );
        }
        return $url;
    }
    
    protected function renderActionsBar(\icms_ipf_Object &$record) {        
        $controller = new \icms_ipf_Controller($record->handler);
        $ret = '';
        foreach ($this->actions as $action) {
            $line = array();
            if (is_array($action)) {                
                @list($title, $action_url, $icon_url, $question, $action_name) = $action;                
                $action_url = $this->formatURL($action_url, $record);
                $icon_url = $this->formatURL($icon_url, $record);
            } else
                switch (strtolower($action)) {
                    case 'edit':
                    case 'mod':
                    case 'modify':                        
                        $title = _EDIT;                        
                        $action_url = $controller->getEditItemLink($record, false, true);
                        $icon_url = ICMS_URL . '/images/edit.gif';
                        $question = null;
                        $action_name = null;
                    break;
                    case 'print':
                    case 'print&mail':
                        $title = '';                        
                        $action_url = $controller->getPrintAndMailLink($record);
                        $icon_url = ICMS_URL . '/images/print.gif';
                        $question = null;
                        $action_name = null;
                    break;
                    case 'delete':
                    case 'del':
                        $title = _DELETE;                        
                        $id = $record->id();
                        $action_url = 'control://' . $this->id . '/delete?item_id=' . $id;
                        $icon_url = ICMS_URL . '/images/delete.gif';                        
                        $question = sprintf(_CO_ICMS_DELETE_CONFIRM, $id);
                    break;
                    default:
                        continue;
                }
           $crl = $this->makeControl('link', array(
               'href'           => $action_url,
               'title'          => $title,
               'question'       => $question,
               'id'             => $this->id . '_link_' . $record->id()
           ));
           $crl->html = (!empty($icon_url))?'<img src="' . $icon_url . '" alt="' . $title .'" />':$title;
           $this->controls[$crl->id] = $crl;
           $ret .= '<{control:'.$crl->id.'}> ';
        }
        return trim($ret);
    }
    
    protected function renderExtCell($record, $column, &$class) {
        $class = 'plain_text';
        if (isset($record->controls)) {
            if (isset($record->controls[$column]['itemHandler']))
                $handler = icms_getModuleHandler($record->controls[$column]['itemHandler'], $record->controls[$column]['module']);
            else {
                if (!isset($record->controls[$column]['name']) || !$record->controls[$column]['name']) {
                    $record->controls[$column]['name'] = $record->getVarInfo($column, self::VARCFG_DEP_DATA_TYPE);
                    switch ($record->controls[$column]['name']) {
                        case self::DTYPE_DEP_IMAGE:
                        case self::DTYPE_DEP_FILE:
                            $record->controls[$column]['name'] = 'file';
                        break;
                    }
                    if (empty($record->controls[$column]['name']) || is_numeric($record->controls[$column]['name']))
                        $record->controls[$column]['name'] = 'text';
                }
                switch ($record->controls[$column]['name']) {
                    case 'user':
                    case 'users':
                        $handler = \icms::handler('\icms_member_user');
                    break;
                    case 'file':
                        $handler = \icms::handler('\icms_data_file');
                        $class = 'view_image';                        
                    break;
                    default:
                        $handler = null;
                }
            }
        } 
        
        if ($handler) {
            $o = $record->getVar($column, 'n');
            $item = $handler->get($o);
            
            if (method_exists($item, 'name')) {
                $ret = $item->name();
            } elseif (isset($item->name)) {
                $ret = $item->name;
            } else {
                $ret = ' ';
            }            
            
        } else
            $ret = $record->getVar($column, 's');
        
        switch ($class) {
            case 'view_image':
                $src = $item->getVar('url', 'n'); 
                if (!$src)
                    return '';
                $ctl = array(
                    'id' => $this->id . '_image_' . strval($record->id()) . '_' . $column,
                    'width' => 24,
                    'height' => 24,
                    'alt' => method_exists($record, 'name')?$record->name():' ',
                    'src' => $src
                );
                $this->controls[$ctl['id']] = $this->makeControl('image', $ctl);                
                
                return '<{control:' . $ctl['id'] .'}>';            
            
            default:
                
               return '<div class="content">' . $ret . '</div>';
        }
    }
    
    public function renderData() {
        if (!$this->source)
            return null;
        
        $rez = '';
        $cr = clone $this->criteria;                    

        //$cr->add(new \icms_db_criteria_SQLItem('1'));
        $cr->setOrder($this->asc_sorting?'ASC':'DESC');
        $order = $this->getSorting();
        $cr->setSort($order);
        $cr->setLimit($this->per_page);
        $cr->setStart($this->page * $this->per_page);
        $pager = $this->controls['pager'];
        $this->controls = array('pager' => $pager);
        $id_name = method_exists($this->source, 'getIdentifierName')?$this->source->getIdentifierName(false):null;
        $objs = $this->source->getObjects($cr);
        if (count($objs) > 0) {
            foreach ($objs as $record) {
                $rez .= '<tr class="r_'.preg_replace('/[^a-zA-Z0-9]/ui', '_', $record->id()).'">';
                foreach ($this->columns as $column) {
                    $rez .= '<td class="'.htmlentities($column);
                    if ($this->name_link && ($id_name == $column)) {
                        $ret = $this->renderExtCell($record, $column, $class);
                        $rez .= ' link '.$class.'">' . '<a href="'. str_replace('{id}', $record->id(), $this->name_link) . '">' . $ret . '</a>';                    
                    } else {
                        if ($this->show_controls) {
                            if (method_exists($record, 'getControl')) {
                                $ctl = $record->getControl($column);                      
                            } else {
                                $ctl = array('name' => 'text');
                            }
                            switch ($ctl['name']) {
                                case 'yesno':
                                    $ctl['name'] = 'checkbox';
                                break;
                            }
                            if (in_array($ctl['name'], array('checkbox'))) {
                                $ctl['value'] = $record->getVar($column, 'n');
                                $id = $record->id();
                                $ctl['change_action'] = $this->makeJSCodeForControl($this->id, 'storeField', array($id, $column));
                                $ctl['id'] = $this->id . '_'.$ctl['name'].'_' . strval($id) . '_' . $column;
                                $this->controls[$ctl['id']] = $this->makeControl($ctl['name'], $ctl);
                                $rez .= ' input '.htmlentities($ctl['name']).'"><{control:'.$ctl['id'].'}>';//$this->controls[$ctl['id']]->render();
                            } else {
                                $ret = $this->renderExtCell($record, $column, $class);
                                $rez .= ' '.$class.'">' . $ret;
                            }                                          
                        } else {
                            $ret = $this->renderExtCell($record, $column, $class);
                            $rez .= ' '.$class.'">' . $ret;
                        }
                    }                             
                    $rez .= '</td>';
                }
                if (!empty($this->actions))
                    $rez .= '<td class="actions_bar">' . $this->renderActionsBar($record) . '</td>';
                $rez .= '</tr>';
            }
        } else {
             $count = count($this->columns);
             if (!empty($this->actions))
                 $count++;
             $rez .= '<tr class="empty"><td colspan="'.$count.'">'._CO_ICMS_NO_OBJECT.'</td></tr>';            
        }
        return $rez;
    }
    
    public function renderFooter() {        
        $this->controls['pager']->per_page = $this->per_page;
        $this->controls['pager']->records_count = $this->source->getCount($this->criteria);
        $this->controls['pager']->page = $this->page;        
        $this->controls['pager']->hidden = !$this->show_pager;
        $this->controls['pager']->autoupdate_url = false;                
        
        $count = count($this->columns);
        if (!empty($this->actions))
            $count++;
        
        return '<tr><td colspan="'.strval($count).'" style="width: 100%; text-align: center;"><{control:pager}></td></tr>';
    }
    
    public function getContent() {
        return '<thead>' . $this->renderHeader() . '</thead><tbody>' . $this->renderData() . '</tbody><tfoot>' . $this->renderFooter() . '</tfoot>';
    }
    
}