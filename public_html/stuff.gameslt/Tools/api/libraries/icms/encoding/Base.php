<?php

/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */

/**
 *
 * @author mekdrop
 */
abstract class icms_encoding_Base {   
    
    abstract function encode($str);
    abstract function decode($str);    
    
}