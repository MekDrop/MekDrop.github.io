<?php

/**
 * XMLRPC Support for actions
 */
class icms_action_format_xmlrpc
    implements icms_action_IFormat {
    
    /**
     * Content type for this format
     * 
     * @return string
     */
    public function getContentType() {
        return 'text/xml';
    }
    
    /**
     * Parse array to string and returns
     * 
     * @param array $data   Data to parse
     * 
     * @return string
     */
    public function render(Array &$data) {
        unset($data['isOK']);
        $xml = new XMLWriter();
        $xml->openMemory();
        $xml->setIndent(true);
        $xml->setIndentString("\t");
        $xml->startDocument('1.0', 'UTF-8');
        $xml->startElement('methodResponse');
        if (isset($data['error'])) {
            $xml->startElement('fault');            
            $this->writeStruct(array('faultCode' => 0, 'faultString' => $data['error']), $xml);
            $xml->endElement('value');
            $xml->endElement('fault');
        } else {
            $xml->startElement('params');
            $this->writeVar($data, $xml, true);
            $xml->endElement('params');
        }        
        $xml->endElement('methodResponse');
        $xml->endDocument();        
        return (string)$xml->outputMemory();
    }
    
    protected function writeStruct($data, XMLWriter &$xml) {
        $xml->startElement('struct');
        foreach ($data as $key => $value) {
            $xml->startElement('member');
            $xml->writeRaw('<name>' . $key . '</name>');
            $this->writeVar($value, $xml);
            $xml->endElement();
        }
        $xml->endElement();
    }
    
    protected function writeVar($data, XMLWriter &$xml, $write_param = false) {
        if ($write_param)
            $xml->startElement('param');
        $xml->startElement('value');
        if (is_string($data)) {
            $xml->writeRaw('<string>' . $data . '</string>');
        } elseif (is_integer($data)) {
            $xml->writeRaw('<int>' . $data . '</int>');
        } elseif (is_float($data)) {
            $xml->writeRaw('<double>' . $data . '</double>');
        } elseif (is_bool($data)) {
            $xml->writeRaw('<boolean>' . (int)$data . '</boolean>');
        } elseif (is_null($data)) {
            $xml->writeRaw('<string></string>');
        } elseif (is_array($data)) {
            if (array_values($data) == $data) {
                $xml->startElement('array');
                $xml->startElement('data');
                foreach ($data as $value) {
                    $this->writeVar($value, $xml);
                }
                $xml->endElement();
                $xml->endElement();
            } else {
                $this->writeStruct($data, $xml);
            }
        }
        if ($write_param)
            $xml->endElement();
        $xml->endElement();        
    }
    
}