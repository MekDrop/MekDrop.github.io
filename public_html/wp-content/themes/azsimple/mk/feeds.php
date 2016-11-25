<?php

/**
 * Description of feeds
 *
 * @author mekdrop
 */
class mkFeeds {
    
    public $source = [
        [
            'url' => 'https://gdata.youtube.com/feeds/api/users/mekdrop/uploads',
            'type' => 'youtube_channel',
            'fetcher' => 'rss',
            'class' => 'fa fa-youtube'
        ],
        [
            'url' => 'http://twitrss.me/twitter_user_to_rss/?user=MekDrop&replies=on',
            'type' => 'twitter',
            'fetcher' => 'rss',
            'class' => 'fa fa-twitter',
        ],
        [
            'url' => 'https://gdata.youtube.com/feeds/api/users/mekdrop/playlists',
            'type' => 'youtube_playlist',
            'fetcher' => 'rss',
            'class' => 'fa fa-youtube'
        ],
        [
            'url' => 'http://www.games.lt/RSS/blog/160112.xml',
            'type' => 'blog',
            'fetcher' => 'rss',
            'class' => 'fa fa-file-o'
        ],
        [
            'url' => 'http://www.linkedin.com/in/mekdrop',
            'type' => 'linkedin',
            'fetcher' => 'linkedin',
            'class' => 'fa fa-linkedin'
        ],
        [
            'url' => 'http://fbrss.com/f/59bfb50f053fcd4c0808d70b38f8105e.xml',
            'type' => 'facebook',
            'fetcher' => 'rss',
            'class' => 'fa fa-facebook-square'
        ],
        [
            'url' => 'http://www.slideshare.net/rss/user/MekDrop',
            'type' => 'slideshare',
            'fetcher' => 'rss',
            'class' => 'fa fa-slideshare'
        ],
        [
            'url' => 'http://pipes.yahoo.com/pipes/pipe.run?_id=fe86a86d950536686b2ad99ed515887f&_render=rss&linkToPost=1&user=106599915349754933069',
            'type' => 'g+',
            'fetcher' => 'rss',
            'class' => 'fa fa-google-plus'
        ],
        [
            'url' => 'https://github.com/MekDrop.atom',
            'type' => 'github',
            'fetcher' => 'rss',
            'class' => 'fa fa-github'
        ]
    ];
    
    protected $fetcher_type = [], $url_type = [], $url_class = [];    
    
    public function __construct() {
        foreach ($this->source as $i => $source) {
            $this->fetcher_type[$source['fetcher']][] = $source['url'];
            $this->url_type[htmlentities($source['url'])] = $source['type'];
            $this->url_class[htmlentities($source['url'])] = $source['class'];
        }                
    }
    
    public function useFilterForTwitrssMe(&$formatedItem, &$rssItem) {
        $formatedItem['title'] = trim(substr($formatedItem['title'],  strpos($formatedItem['title'], ':') + 1));
    }
    
    public function useFilterForGdataYoutubeCom(&$formatedItem, &$rssItem) {
        switch ($formatedItem['type']) {
            case 'youtube_channel':
                $formatedItem['title'] = 'Naujas video: ' . $formatedItem['title'];
            break;
            case 'youtube_playlist':
                $formatedItem['title'] = 'Naujas grojaraštis: ' . $formatedItem['title'];
            break;
        }        
    }

    public function fetchRSSFeeds($count = 5) {
        $rss = fetch_feed($this->fetcher_type['rss']);
        $ret = [];
        if ( ! is_wp_error( $rss ) ) {
            $maxitems = $rss->get_item_quantity( $count );
            $rss_items = $rss->get_items( 0, $maxitems );
            foreach ($rss_items as $item) {                
                $surl = $item->get_feed()->subscribe_url();
                $func = 'useFilterFor' . implode('', array_map('ucfirst', explode('.', parse_url($surl, PHP_URL_HOST))));
                if (!isset($this->url_type[$surl])) {
                    $this->url_type[$surl] = 'unknown';
                }
                $ritem = [
                    'url' => $item->get_permalink(),
                    'title' => $item->get_title(),
                    'type' => $this->url_type[$surl],
                    'subscribe_url' => $surl,
                    'class' => $this->url_class[$surl],
                ];
                if (method_exists($this, $func)) {
                    $this->$func($ritem, $item);                    
                }
                array_push($ret, $ritem);
            }
        }
        return $ret;
    }
    
    public static function fetch($count = 5) {
        $instance = new self();
        $ret = $instance->fetchRSSFeeds($count);
        return $ret;
    }
    
}
