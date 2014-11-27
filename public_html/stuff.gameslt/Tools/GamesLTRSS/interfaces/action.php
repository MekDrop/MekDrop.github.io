<?php

interface iAction {
    
    function getVars();
    
    function exec(array $params);    
        
}