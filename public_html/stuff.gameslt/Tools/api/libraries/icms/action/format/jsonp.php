<?php

/**
 * XMLRPC Support for actions
 */
class icms_action_format_jsonp
    implements icms_action_IFormat {
    
    /**
     * Content type for this format
     * 
     * @return string
     */
    public function getContentType() {
        return 'application/json';
    }
    
    /**
     * Parse array to string and returns
     * 
     * @param array $data   Data to parse
     * @param array $options Options for renderer
     * 
     * @return string
     */
    public function render(Array &$data, Array &$options) {
        return $options['callback'] . '(' . json_encode($data) . ')';
    }    
    
}