<?php
/**
 *Default interface for other formats
 * 
 * @author mekdrop
 */
interface icms_action_IFormat {
    
    public function getContentType();
    
    /**
     * Parse array to string and returns
     * 
     * @param array $data   Data to parse
     * @param array $options Options for renderer
     * 
     * @return string
     */
    public function render(Array &$data, Array &$options);
        
}