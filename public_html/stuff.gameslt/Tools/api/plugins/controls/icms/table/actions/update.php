<?php

namespace ImpressCMS\Controls\icms\Table\Actions;

/**
 * Updates table
 *
 * @author mekdrop
 */
class Update
    extends \icms_action_base_Control {
    
     public function exec(icms_action_Response &$response) {  
         if (!$this->control->source)
             return $response->error('Bad source specified!');
         
         $response->add(self::RESPONSE_KEY_SELECTOR, 'tbody');
         $ret = $this->control->replaceMagicTags($this->control->renderData());
         $response->add(self::RESPONSE_KEY_INNER_HTML, $ret);
         $response->add('recordsCount', $this->control->source->getCount($this->control->criteria));
         
     }
    
}