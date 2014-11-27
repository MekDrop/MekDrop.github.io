<?php

/**
 * Description of defaultrss
 *
 * @author Raimondas
 */
class fetchReviews {

     public function getMessages() {
        static $msgs = null;
        if ($msgs === null) {
            $msgs = gcCache::get('review_messages');
            if (!$msgs) {
                $db = gcDB::getInstance();
                $msgs = $db->quickFetch('1', 'review_messages', array('msg'), true);
                if (empty($msgs)) {
                    foreach (array(
                'Žinot ką? Ogi turime "{game}" apžvalgą!',
                'Yey!!! "{game}" ką tik sulaukė apžvalgos!',
                '{author} ką tik iškepė naują "{game}" žaidimo apžvalgą!',
                '"{game}"!!!',
                    ) as $msg)
                        $db->quickInsert(array('msg' => $msg), 'review_messages');
                    $msgs = $db->quickFetch('1', 'review_messages', array('msg'), true);
                }
                gcCache::set('review_messages', $msgs);
            }
        }
        return $msgs;
    }

    function getTable() {
        return 'data';
    }
    
    function getMode() {
        return array();
    }

    public function fetch() {

        class_exists('simple_html_dom_node', true);
        $html = str_get_html($this->getReviewsPageHTML());
        $ret = array();
        foreach ($html->find('a.s2, div.s1') as $element) {
            if (isset($element->href)) {
                $line = array(
                    'link' => $element->href,
                    'title' => $element->plaintext,
                    'date' => trim(substr($element->title, strlen('Patalpinimo data:'))),
                    'image' => $this->getImageForURL($element->href),
                    'author' => ($author = $this->getAuthor($element->href)),
                    'interesting' => true
                );
            } else {
                list($line['platform'], $line['game']) = array_map('trim', explode(',', $element->plaintext, 2));
            }
            if (isset($line['game']))
                $ret[] = $line;
        }

        $msgs = $this->getMessages();
        $count = count($msgs) - 1;
        $f1 = array(
            '{title}',
            '{platform}',
            '{author}',
            '{game}'
        );
        foreach ($ret as $i => $line) {
            $f2 = array(
                $line['title'],
                $line['platform'],
                $line['author']['name'],
                $line['game']
            );
            $ret[$i]['text'] = str_replace(
                    $f1, $f2, $msgs[mt_rand(0, $count)]
            );
        }

        return $ret;
    }

    public function getAuthor($review_url) {
        $html = str_get_html($this->getURLContents($review_url));
        foreach ($html->find('.s1 a') as $element) {
            $ret = array(
                'link' => $element->href,
                'name' => $element->plaintext
            );
            if (substr($ret['link'], 0, strlen('javascript:user(\'')) == 'javascript:user(\'') {
                $ret['link'] = 'http://www.games.lt/g/user.apie/' . substr($ret['link'], strlen('javascript:user(\''), -3);
            }
            return $ret;
        }
        return null;
    }

    public function getImageForURL($review_url) {
        $html = str_get_html($this->getURLContents($review_url));
        foreach ($html->find('.img img') as $element)
            return $element->src;
        $photos_url = str_replace(array('.apzvalgos/', '.apzvalga/'), '.foto/', $review_url);
        $html = str_get_html($this->getURLContents($photos_url));
        foreach ($html->find('a img') as $element) {
            if (substr($element->src, 0, 8) == 'w/gshot/')
                return 'http://games.lt/' . $element->src;
        }
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

    public function getReviewsPageHTML() {
        return $this->getURLContents('http://www.games.lt/g/all.apzvalgos');
    }

}