<?php

/**
 * Description of logger
 *
 * @author mekdrop
 */
class XLogger {

    private static $textMode = false;
    private static $lastMinute = -1;
    private static $lastNr = 1;

    /**
     * Indents a flat JSON string to make it more human-readable.
     *
     * @param string $json The original JSON string to process.
     *
     * @return string Indented version of the original JSON string.
     */
    private static function indent($json) {

        $result = '';
        $pos = 0;
        $strLen = strlen($json);
        $indentStr = '  ';
        $newLine = "\n";
        $prevChar = '';
        $outOfQuotes = true;

        for ($i = 0; $i <= $strLen; $i++) {

            // Grab the next character in the string.
            $char = substr($json, $i, 1);

            // Are we inside a quoted string?
            if ($char == '"' && $prevChar != '\\') {
                $outOfQuotes = !$outOfQuotes;

                // If this character is the end of an element, 
                // output a new line and indent the next line.
            } else if (($char == '}' || $char == ']') && $outOfQuotes) {
                $result .= $newLine;
                $pos--;
                for ($j = 0; $j < $pos; $j++) {
                    $result .= $indentStr;
                }
            }

            // Add the character to the result string.
            $result .= $char;

            // If the last character was the beginning of an element, 
            // output a new line and indent the next line.
            if (($char == ',' || $char == '{' || $char == '[') && $outOfQuotes) {
                $result .= $newLine;
                if ($char == '{' || $char == '[') {
                    $pos++;
                }

                for ($j = 0; $j < $pos; $j++) {
                    $result .= $indentStr;
                }
            }

            $prevChar = $char;
        }

        return $result;
    }

    public static function log($message) {
         if (!self::$textMode) {
             header('Content-Type: text/plain');
             header("Connection: Keep-alive");
             self::$textMode = true;
         }         
         $args = func_get_args();
         $min = floor(time() / 60);
         $date = date('r');
         $istr = str_repeat(' ', strlen($date) + 3);
         if (self::$lastMinute == $min) {
             self::$lastNr++;
             $str = ' \__#' . strval(self::$lastNr);
             echo $str;
             echo substr($istr, 0, strlen($istr) - strlen($str));
         } else {
             self::$lastMinute = $min;
             echo '[' . $date . '] ';
             self::$lastNr = 1;
         }
         foreach ($args as $i => $arg)
             if (is_array($arg))
                 $args[$i] = self::indent(json_encode($arg)); 
          echo implode( "\r\n" . $istr, explode("\n", call_user_func_array('sprintf', $args))) . "\r\n";
         @ob_flush();
         @flush();
     }
    
     private function __construct() {}
    
}