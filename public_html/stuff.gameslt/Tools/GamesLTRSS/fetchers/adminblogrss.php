<?php

/**
 * Description of defaultrss
 *
 * @author Raimondas
 */
class fetchAdminBlogRSS {

    function getTable() {
        return 'data';
    }
    
    function getMode() {
        return array();
    }

    function fetch() {
        $feed = new SimplePie();
        $feed->set_feed_url('http://www.games.lt/RSS/blog/160005.xml');
        $feed->set_output_encoding('UTF-8');
        $feed->set_cache_location(sys_get_temp_dir());
        $feed->set_cache_duration(1);
        $feed->set_cache_name_function('sha1');
        $feed->init();
        $feed->handle_content_type();
        $ret = array();
        foreach ($feed->get_items() as $item) {
            $author = (array) $item->get_author();
            $ret[] = array(
                'link' => $item->get_id(),
                'text' => $item->get_description(),
                'date' => $item->get_date(),
                'title' => $item->get_title(),
                'author' => $author,
                'id' => $item->get_id(),
                'image' => null,
                'interesting' => true,
                'game' => null,
                'platform' => null,
                'author' => array(
                    'name' => 'Games.lt Administracija',
                    'link' => 'http://www.games.lt/g/user.apie/160005'
                )
            );
        }
        return $ret;
    }

}
