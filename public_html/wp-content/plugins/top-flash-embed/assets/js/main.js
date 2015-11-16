var TopFlashEmbed=(function(window, $, config){
    
    // private sector
    var isTinyMce = function($textarea)
    {
        var editor, ed=$textarea.attr('id');
        if (ed && ed.charAt(0)=='#') ed=ed.substring(1);
        
        // if tinyMCE
        if (
            window.tinyMCE && ed &&
            null != (editor=window.tinyMCE.get(ed)) && 
            false == editor.isHidden()
        )
            return editor;
        return false;
    };
    
    var isCodeMirror = function($textarea)
    {
        var textareaNext = $textarea[0].nextSibling;
        // if CodeMirror
        if (
            textareaNext && $textarea.is('textarea')&&
            textareaNext.CodeMirror &&
            $textarea[0]==textareaNext.CodeMirror.getTextArea()
        )
            return textareaNext.CodeMirror;
        return false;
    };
    var getContent = function()
    {
        var content='';
        var canvas = document.getElementById(window.wpActiveEditor);
        if ( !canvas ) return content;
        
        var $canvas=$(canvas);
        var tinymce=isTinyMce($canvas);
        var codemirror=isCodeMirror($canvas);
        
        if (tinymce)
        {
            content=tinymce.selection.getContent({ 'format' : 'raw' });
        }
        else if (codemirror)
        {
            content=codemirror.getSelection();
        }
        else
        {
            var sel, startPos, endPos, scrollTop, text;
            
            if ( document.selection ) 
            { //IE
                canvas.focus();
                sel = document.selection.createRange();
                content = sel.text;
            } 
            else if ( canvas.selectionStart || canvas.selectionStart == '0' ) 
            { // FF, WebKit, Opera
                text = canvas.value;
                startPos = canvas.selectionStart;
                endPos = canvas.selectionEnd;

                content = text.substring(startPos, endPos);
            } 
            else 
            {
                content = ''; //canvas.value;
            }
        }
        return content;
    };
    
    var setContent = function(content)
    {
        var canvas = document.getElementById(window.wpActiveEditor);
        if ( !canvas ) return false;
        
        var $canvas=$(canvas);
        var tinymce=isTinyMce($canvas);
        var codemirror=isCodeMirror($canvas);
        
        if (tinymce)
        {
            tinymce.execCommand( "mceInsertContent", false, content);
        }
        else if (codemirror)
        {
            if (!codemirror.somethingSelected())
            {
                // set at current cursor
                var current_cursor=codemirror.getCursor(true);
                codemirror.setSelection(current_cursor, current_cursor);
            }
            codemirror.replaceSelection(content);
        }
        else
        {
            var sel, startPos, endPos, scrollTop, text;

            if ( document.selection ) 
            { //IE
                canvas.focus();
                sel = document.selection.createRange();
                sel.text = content;
                canvas.focus();
            } 
            else if ( canvas.selectionStart || canvas.selectionStart == '0' ) 
            { // FF, WebKit, Opera
                text = canvas.value;
                startPos = canvas.selectionStart;
                endPos = canvas.selectionEnd;
                scrollTop = canvas.scrollTop;

                canvas.value = text.substring(0, startPos) + content + text.substring(endPos, text.length);

                canvas.focus();
                canvas.selectionStart = startPos + content.length;
                canvas.selectionEnd = startPos + content.length;
                canvas.scrollTop = scrollTop;
            }
            else 
            {
                canvas.value += content;
                canvas.focus();
            }
        }
        return true;
    };
    
    var insert = function(text1, text2)
    {
        if (text2)
            return setContent(text1 + getContent() + text2);
        else
            return setContent(text1);
    };
    
    return {
        Config : TopFlashEmbedConfig,
        App : {
            insert : insert
        }
    };
})(window, jQuery, TopFlashEmbedConfig);