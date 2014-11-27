<?php
/**
 * Description of actionFetch
 *
 * @author mekdrop
 */
class actionRSS implements iAction {    
    
    public function getVars() {
        return array('type' => 'string', 'interesting' => 'int');
    }
    
    public function exec(array $params) {
        $db = gcDB::getInstance();
        $ret = '<?xml version="1.0" encoding="UTF-8" ?>';
        $ret .= $this->renderXMLStartTag('rss', array('version' => '2.0'));
        $ret .= $this->renderXMLStartTag('channel');
        $ret .= $this->renderXMLFastTag('title', 'Games.lt data' . ($params['type']?' - ' . $params['type']:''));
        $ret .= $this->renderXMLFastTag('description', 'Games.lt data feed');
        $ret .= $this->renderXMLFastTag('link', 'http://www.games.lt');
        if ($params['interesting'] > -1) {
            if (!empty($params['type']))
                $sql = sprintf('type = \'%s\' AND interesting = %d ORDER BY date DESC LIMIT %d', str_replace('\'', '\'\'', $params['type']), $params['interesting'], 10);
            else
                $sql = sprintf('interesting = %d ORDER BY date DESC LIMIT %d', $params['interesting'], 10);
        } else {
            if (!empty($params['type']))
                $sql = sprintf('type = \'%s\' ORDER BY date DESC LIMIT %d', str_replace('\'', '\'\'', $params['type']), 10);
            else
                $sql = sprintf('1 ORDER BY date DESC LIMIT %d', 10);
        }        
        foreach ($db->quickFetch($sql) as $record) {
            $ret .= $this->renderXMLStartTag('item');
            $ret .= $this->renderXMLFastTag('title', '<![CDATA[ ' . $record['title'] . ']]>');
            $ret .= $this->renderXMLFastTag('link', $record['link']);
            $desc = $record['text'];
            if (!empty($record['image']))
                $desc .= '<p><img src="' . $record['image'] . '" alt="'.htmlentities($record['title']).'" /></p>';
            $ret .= $this->renderXMLFastTag('description', '<![CDATA[ ' . $desc . ']]>');
            $ret .= $this->renderXMLFastTag('guid', $record['id'], array('isPermaLink' => 'false'));
            $ret .= $this->renderXMLFastTag('pubDate', date('r', $record['date']));
            $ret .= $this->renderXMLCloseTag('item');
        }
        $ret .= $this->renderXMLCloseTag('channel');
        $ret .= $this->renderXMLCloseTag('rss');
        
        return $ret;
    }
    
    public function renderXMLFastTag($tag, $content, $params = array()) {
        return $this->renderXMLStartTag($tag, $params) . $content . $this->renderXMLCloseTag($tag);
    }
    
    public function renderXMLStartTag($tag, $params = array()) {
        $tag = '<' . $tag;
        if (!empty($params)) {
            $sparams = array();
            foreach ($params as $key => $value)
                $sparams[] = $key .'="' . addslashes($value) .'"';
            $tag .= ' ' . implode(' ', $sparams);
        }
        return $tag . '>';
    }
    
    public function renderXMLCloseTag($tag) {
        return '</' . $tag . '>';
    }
    
}

/*

 <rss version="2.0">

 <channel>
   <title>W3Schools Home Page</title>
   <link>http://www.w3schools.com</link>
   <description>Free web building tutorials</description>
   <item>
     <title>RSS Tutorial</title>
     <link>http://www.w3schools.com/rss</link>
     <description>New RSS tutorial on W3Schools</description>
   </item>
   <item>
     <title>XML Tutorial</title>
     <link>http://www.w3schools.com/xml</link>
     <description>New XML tutorial on W3Schools</description>
   </item>
 </channel>

 </rss>*/