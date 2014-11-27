<?php

abstract class icms_session_provider_abstract
    implements SessionHandlerInterface {
    
    /**
     * Handler linked to this provider
     * 
     * @var icms_session_Handler
     */
    protected $handler = null;
    
    /**
     * Constructor
     * 
     * @param icms_session_Handler $handler
     */
    public function __construct(icms_session_Handler &$handler) {
        $this->handler = $handler;
    }    

}