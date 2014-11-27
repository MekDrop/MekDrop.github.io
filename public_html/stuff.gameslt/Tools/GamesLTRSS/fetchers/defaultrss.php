<?php

/**
 * Description of defaultrss
 *
 * @author Raimondas
 */
class fetchDefaultRSS {

    function getInterestingSpecialWords() {
        $db = gcDB::getInstance();
        $mwords = $db->quickFetch('1', 'magic_words', array('word'), true);
        if (empty($mwords)) {
            foreach (array(
                'gta',
                'konkursas',
                'laimėtojai',
                'blogo įrašas',
                'geek\'as iš rytų europos',
                'apžvalga',
                'cod',
                'pristatymas',
                'marvel'
            ) as $i => $word) {
                $db->quickInsert(array('word' => $word, 'id' => $i), 'magic_words');
            }
            $mwords = $this->getInterestingSpecialWords();
        } 
        return $mwords;
    }
    
    function getInterestingGames() {
        $db = gcDB::getInstance();
        $sql = 'SELECT SUM( score ) score, COUNT( * ) count, game
                FROM `top` 
                GROUP BY game
                ORDER BY score DESC 
                LIMIT 0 , 50';
        $rez = $db->query($sql);
        if ($db->errno)
            error_log(sprintf('MySQL ERROR #%d (%s; %s)', $db->errno, $db->error, $sql));
        if (!$rez)
            return null;  
        $ret = array();
        while ($row = $rez->fetch_assoc()) 
            $ret[] = strtolower($row['game']);
        return $ret;
    }
    
    function getKeywordsList() {
        static $keywords = null;
        if ($keywords == null) {
            $keywords = gcCache::get('magic_keywords');
            if (!$keywords) {
                $igames = $this->getInterestingGames();
                if (empty($igames))
                    $keywords = $this->getInterestingSpecialWords();
                else
                    $keywords = array_merge($this->getInterestingSpecialWords(), $igames);
                foreach (array_values($keywords) as $keyword) {
                    $parts = explode(':', $keyword);
                    if (count($parts) > 1) {
                        $keywords[] = $keyword2 = $parts[0];
                        $keyword3 = trim(str_replace(array('1', '2', '3', '4', '5', 
                                                  '6', '7', '8', '9', '0', 
                                                  ' I', ' II', ' III', 'IV',
                                                  ' V', ' VI', ' VII', ' VIII', 
                                                  ' IX', ' X', ' XI', ' XII',
                                                  ' XIII', ' XIV', ' XV'), '', $keyword2));
                        if ($keyword2 != $keyword3)
                            $keywords[] = $keyword3;
                        $keyword = $keyword2;
                    }
                    $keyword2 = trim(str_replace(array('1', '2', '3', '4', '5', 
                                                  '6', '7', '8', '9', '0', 
                                                  ' I', ' II', ' III', 'IV',
                                                  ' V', ' VI', ' VII', ' VIII', 
                                                  ' IX', ' X', ' XI', ' XII',
                                                  ' XIII', ' XIV', ' XV'), '', $keyword));
                    if ($keyword2 != $keyword)
                        $keywords[] = $keyword2;
                    $keyword3 = trim(str_replace('the ', '', $keyword2));
                    if ($keyword2 != $keyword3)
                            $keywords[] = $keyword3;
                }
                $keywords = array_unique($keywords);
                sort($keywords);
                gcCache::set('magic_keywords', $keywords);
            }
        }            
        return $keywords;
    }

    function getTable() {
        return 'data';
    }

    function getMode() {
        return array();
    }

    public function fetch() {
        $feed = new SimplePie();
        $feed->set_feed_url('http://feeds.feedburner.com/GamesLT');
        $feed->set_output_encoding('UTF-8');
        $feed->set_cache_location(sys_get_temp_dir());
        $feed->set_cache_duration(1);
        $feed->set_cache_name_function('sha1');
        $feed->init();
        $feed->handle_content_type();
        $ret = array();
        foreach ($feed->get_items() as $item) {
            $author = (array) $item->get_author();
            $desc = $item->get_description();
            if ($author['name'] == 'games.lt') {
                preg_match_all('/<p>Para&scaron;&#279; : <a href="([^"]+)"[^>]+>([^<]+)<\/a><\/p>/ui', $desc, $parts);
                $desc = str_replace($parts[0][0], '', $desc);
                $author['name'] = $parts[2][0];
                $author['link'] = $parts[1][0];
            }
            $ret[] = array(
                'link' => $item->get_id(),
                'text' => $desc,
                'date' => $item->get_date(),
                'title' => $item->get_title(),
                'author' => $author,
                'id' => $item->get_id(),
                'interesting' => $interesting = $this->isInteresting($item->get_title(), $desc),
                'image' => $interesting ? $this->getImage($item->get_id()) : null,
                'game' => null,
                'platform' => null
            );
        }
        return $ret;
    }

    public function getImage($news_url) {
        class_exists('simple_html_dom_node', true);

        $contents = $this->getURLContents($news_url);
        $html = str_get_html($contents);
        $images = array();
        foreach ($html->find('#article img') as $element) {
            if (isset($images[$element->width]))
                continue;
            $link = $element->src;
            if (substr($element->src, 0, 4) != 'http')
                $link = 'http://www.games.lt/' . $link;
            $images[$element->width] = $link;
        }

        if (!empty($images))
            return $images[max(array_keys($images))];

        return null;
    }

    public function getURLContents($url) {
        $ch = curl_init();

        // set the url to fetch
        curl_setopt($ch, CURLOPT_URL, $url);

        // don't give me the headers just the content
        curl_setopt($ch, CURLOPT_HEADER, 0);

        // return the value instead of printing the response to browser
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);

        // use a user agent to mimic a browser
        curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (Windows; U; Windows NT 5.1; en-US; rv:1.7.5) Gecko/20041107 Firefox/1.0');

        $content = curl_exec($ch);

        // remember to always close the session and free all resources 
        curl_close($ch);

        return $content;
    }

    public function isInteresting($title, $desc) {
        $mt = strtolower(html_entity_decode($title)) . ' ' . strtolower(html_entity_decode($desc));
        foreach ($this->getKeywordsList() as $word)
            if (strpos($mt, $word))
                return true;
        return false;
    }

}
