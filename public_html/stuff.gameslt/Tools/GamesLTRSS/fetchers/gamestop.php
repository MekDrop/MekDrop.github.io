<?php

/**
 * Description of defaultrss
 *
 * @author Raimondas
 */
class fetchGamesTop {
    
    const PLATFORM_URL = 'http://www.games.lt/g/%s.home';
    
    public function getPlatforms() {
        static $platforms = null;
        if ($platforms === null) {
            $platforms = gcCache::get('platforms');
            if (!$platforms) {
                $db = gcDB::getInstance();
                $mwords = $db->quickFetch('1', 'platforms', array('platform', 'rating'), false);
                if (empty($mwords)) {
                    $db->quickInsert(array('platform' => 'pc', 'rating' => 0), 'platforms');
                    $db->quickInsert(array('platform' => 'ps2', 'rating' => 2000), 'platforms');
                    $db->quickInsert(array('platform' => 'ps3', 'rating' => 2007), 'platforms');
                    $db->quickInsert(array('platform' => 'psp', 'rating' => 2005), 'platforms');
                    $db->quickInsert(array('platform' => 'ds', 'rating' => 2005), 'platforms');
                    $db->quickInsert(array('platform' => 'xbox', 'rating' => 2002), 'platforms');
                    $db->quickInsert(array('platform' => '3ds', 'rating' => 2011), 'platforms');
                    $db->quickInsert(array('platform' => 'psvita', 'rating' => 2012), 'platforms');
                    $db->quickInsert(array('platform' => 'x360', 'rating' => 2005), 'platforms');
                    $db->quickInsert(array('platform' => 'rev', 'rating' => 2006), 'platforms');
                    $db->quickInsert(array('platform' => 'mobile', 'rating' => 0), 'platforms');
                    $db->quickInsert(array('platform' => 'gboy', 'rating' => 1989), 'platforms');
                    $db->quickInsert(array('platform' => 'gcube', 'rating' => 2002), 'platforms');
                    $mwords = $db->quickFetch('1', 'platforms', array('platform', 'rating'));
                }
                $platforms = array();
                foreach ($mwords as $word) {
                    $platforms[$word['platform']] = (float)$word['rating'];
                }
                gcCache::set('platforms', $platforms);
            }
        }
        return $platforms;
    }

    function getTable() {
        return 'top';
    }
    
    function getMode() {
        return array(
            'lastpos' => 'update',
            'score' => 'increase'
        );
    }

    function fetch() {
        class_exists('simple_html_dom_node', true);
        $games = array();
        foreach ($this->getPlatforms() as $platform => $rating) {
            if ($rating == 0)
                $rating = 1;
            else
                $rating = 1 / (intval(date('Y')) - $rating);
            $url = sprintf(self::PLATFORM_URL, $platform);
            $contents = $this->getURLContents($url);
            $html = str_get_html($contents);            
            $first = $html->find('.down', 0);
            $no = 0;
            $time = time();
            foreach ($first->find('tr td div.spalva, tr td a') as $element) {
                switch ($no++) {
                    case 1:
                        $no++;
                        continue;
                    case 0:
                        $games[] = array(
                            'game' => trim(substr($element->plaintext, 2)),
                            'link' => 'http://games.lt/' .  $element->href,
                            'platform' => $platform,
                            'score' => floor(pow(log(30), 3) * 1000 * $rating),
                            'lastpos' => 1,
                            'lastfetchdate' => $time
                        );
                    break;
                    default:
                        if ($element->tag == 'div') {
                            $number = intval($element->plaintext);
                        } else {
                            $games[] = array(
                                'game' => $element->plaintext,
                                'link' => 'http://games.lt/' . $element->href,
                                'platform' => $platform,
                                'score' => floor(pow(log(30 - $number), 3) * 1000* $rating),
                                'lastpos' => $number,
                                'lastfetchdate' => $time
                            );
                        }
                }
            }
        }
        return $games;
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

}
