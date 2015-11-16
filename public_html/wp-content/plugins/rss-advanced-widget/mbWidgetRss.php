<?php 
/*
Plugin Name: RSS Advanced Widget
Plugin URI: http://www.wordpressor.com
Description: Create a widget to set the reading of RSS. It works with both RSS and XML. Easy to install and set up, just enter the URL of the desired RSS.
Version: 0.2
Author: Marco Brughi
Author URI: http://marcobrughi.com
License: GPLv2
*/

/*  Copyright 2014 Brughi Marco  (email : marco.brughi@gmail.com)

    This program is free software; you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation; either version 2 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program; if not, write to the Free Software
    Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
*/

// use widgets_init action hook to execute custom function
add_action( 'widgets_init', 'mbr_raw_register_widgets' );

//register our widget
function mbr_raw_register_widgets() {
    register_widget( 'mbr_raw_widget' );
}

//mbr_widget_my_info class
class mbr_raw_widget extends WP_Widget {

    //process the new widget
    function mbr_raw_widget() {
	
        $widget_ops = array( 
			'classname' => 'mbr_raw_widget_class', 
			'description' => 'Display an RSS feed with options.' 
			); 
			
        $this->WP_Widget( 'mbr_raw_widget', 'Advanced RSS Widget', $widget_ops );
    }
 
     //build the widget settings form
    function form($instance) {
        $defaults = array( 
			'title' => 'RSS Feed', 
			'rss_feed' => 'http://feeds.reuters.com/reuters/technologyNews', 
			'rss_items' => '2' 
		); 
        $instance = wp_parse_args( (array) $instance, $defaults );
        $title = $instance['title'];
        $rss_feed = $instance['rss_feed'];
        $rss_items = $instance['rss_items'];
		$rss_date = $instance['rss_date'];
		$rss_summary = $instance['rss_summary'];
        ?>
            <p>Title: <input class="widefat" name="<?php echo $this->get_field_name( 'title' ); ?>"  type="text" value="<?php echo esc_attr( $title ); ?>" /></p>
            <p>RSS Feed: <input class="widefat" name="<?php echo $this->get_field_name( 'rss_feed' ); ?>"  type="text" value="<?php echo esc_attr( $rss_feed ); ?>" /></p>
            <p>Items to Display:
            	<select name="<?php echo $this->get_field_name( 'rss_items' ); ?>">
                    <option value="1" <?php selected( $rss_items, 1 ); ?>>1</option>
                    <option value="2" <?php selected( $rss_items, 2 ); ?>>2</option>
                    <option value="3" <?php selected( $rss_items, 3 ); ?>>3</option>
                    <option value="4" <?php selected( $rss_items, 4 ); ?>>4</option>
                    <option value="5" <?php selected( $rss_items, 5 ); ?>>5</option>
                </select>
            </p>
            <p>Show Date?: <input name="<?php echo $this->get_field_name( 'rss_date' ); ?>"  type="checkbox" <?php checked( $rss_date, 'on' ); ?> /></p>
            <p>Show Summary?: <input name="<?php echo $this->get_field_name( 'rss_summary' ); ?>"  type="checkbox" <?php checked( $rss_summary, 'on' ); ?> /></p>
        <?php
    }
 
    //save the widget settings
    function update($new_instance, $old_instance) {
        $instance = $old_instance;
        $instance['title'] = strip_tags( $new_instance['title'] );
        $instance['rss_feed'] = strip_tags( $new_instance['rss_feed'] );
        $instance['rss_items'] = strip_tags( $new_instance['rss_items'] );
	$instance['rss_date'] = strip_tags( $new_instance['rss_date'] );
	$instance['rss_summary'] = strip_tags( $new_instance['rss_summary'] );
 
        return $instance;
    }
 
    //display the widget
    function widget($args, $instance) {
        extract($args);
 
        echo $before_widget;
		
		//load the widget settings
        $title = apply_filters( 'widget_title', $instance['title'] );
        $rss_feed = empty( $instance['rss_feed'] ) ? '' : $instance['rss_feed'];
        $rss_items = empty( $instance['rss_items'] ) ? 2 : $instance['rss_items'];
		$rss_date = empty( $instance['rss_date'] ) ? 0 : 1; 
		$rss_summary = empty( $instance['rss_summary'] ) ? 0 : 1; 
 
        if ( !empty( $title ) ) { echo $before_title . $title . $after_title; };

		if ( $rss_feed ) {
			//display the RSS feed
			wp_widget_rss_output( array(
				'url' => $rss_feed,
				'title' => $title,
				'items' => $rss_items,
				'show_summary' => $rss_summary,
				'show_author' => 0,
				'show_date' => $rss_date
			) );
		}

        echo $after_widget;
    }
}
?>