<?php 
/*
Plugin Name: Adspace Platform
Plugin URI: http://www.AdspacePlatform.com
Description: Plugin/Widget for showing a banner and/or "Advertise With Us" button.
Author: Adspace Platform
Version: 1.5
Author URI: http://www.adspaceplatform.com
*/

class adspace_platform_widget extends WP_Widget 
{
	public static $instanceParams = null;
	public static $map = null;
	
	/**
	 * Register widget with WordPress.
	 */
	public function __construct() 
	{
		parent::__construct(
	 		'adspace_platform_widget', // Base ID
			'Adspace Platform', // Name
			array('description' => __('Plugin/Widget for displaying a banner and/or "Advertise With Us" button.', 'adspace_platform')) // Args
		);
	}
	
	/**
	 * Front-end display of widget.
	 *
	 * @see WP_Widget::widget()
	 *
	 * @param array $args     Widget arguments.
	 * @param array $instance Saved values from database.
	 */
	public function widget($args, $instance) 
	{
		extract($args);
		
		// Populate default values
		if(!isset($instance['adspace_api_key'])) $instance['adspace_api_key'] = '';
		if(!isset($instance['should_show_banner'])) $instance['should_show_banner'] = 'true';
		if(!isset($instance['should_show_advertise_with_us_button'])) $instance['should_show_advertise_with_us_button'] = 'null';
		if(!isset($instance['banner_refresh_rate'])) $instance['banner_refresh_rate'] = '30';
		if(!isset($instance['advertise_with_us_button_position'])) $instance['advertise_with_us_button_position'] = 'right';
		if(!isset($instance['advertise_with_us_button_YAxis_position'])) $instance['advertise_with_us_button_YAxis_position'] = '55%';
		if(!isset($instance['html_mode'])) $instance['html_mode'] = 'xhtml';
		if(!isset($instance['integration_mode'])) $instance['integration_mode'] = 'javascript';
		if(!isset($instance['is_paid_acct'])) $instance['is_paid_acct'] = 0;
		
		if(empty(adspace_platform_widget::$instanceParams)) adspace_platform_widget::$instanceParams = $instance;
		
		if(isset($before_widget)) echo $before_widget;
		
		if(empty($instance['adspace_api_key']))
		{
			echo __('Please supply a valid Adspace API Key to activate this widget.');
		}
		elseif(!empty($instance['adspace_api_key']) && $instance['integration_mode'] == 'javascript')
		{
			echo <<<EOF
<script type="text/javascript">
	(function (d) {
		/*
			The values defined below are perfect for most cases, so please
			refrain from changing them, unless you know what you are doing.
		*/
		var shouldShowBanner = {$instance['should_show_banner']}; // Set this to false to NOT actually display banner
		var shouldShowAdvertiseWithUsButton = {$instance['should_show_advertise_with_us_button']}; // Set this to true or false to override global setting for adspace
		var bannerRefreshRateInSeconds = {$instance['banner_refresh_rate']}; // Set to 0 to disable refreshing of banners on an interval basis
		var advertiseWithUsButtonPosition = '{$instance['advertise_with_us_button_position']}'; // Valid values: left or right
		var advertiseWithUsButtonYPosition = '{$instance['advertise_with_us_button_YAxis_position']}'; // Initial Y-Axis Position of Advertise With Us Button
		var htmlMode = '{$instance['html_mode']}'; // xhtml or html mode

		// This variable holds ALL the page banners
		if (!window.bp_page_banners) { window.bp_page_banners = []; }

		// load adspace main js file since it hasn't been loaded yet
		var bpUrlScheme = window.location.protocol;

		// Check if running from file: protocol, set to http instead
		if (bpUrlScheme != 'http:' && bpUrlScheme != 'https:') { bpUrlScheme = 'http:'; }

		var newBannerInfo = {
			banner_wrapper_id: 'bp_'+(window.bp_page_banners.length+1),
			adspace_id: {$instance['adspace_id']},
			should_show_banner: shouldShowBanner,
			should_show_advertise_with_us_button: shouldShowAdvertiseWithUsButton,
			html_mode: htmlMode,
			urlScheme: bpUrlScheme,
			refresh_rate: bannerRefreshRateInSeconds,
			advertise_with_us_position: advertiseWithUsButtonPosition,
			advertise_with_us_position_y: advertiseWithUsButtonYPosition
		};

		window.bp_page_banners.push(newBannerInfo)

		d.write('<span id="'+newBannerInfo.banner_wrapper_id+'" class="bp_banner"></span>');

		var js = d.createElement('script'); js.async = true; js.type = 'text/javascript';
		js.src = bpUrlScheme+'//www.buyselladmanager.com/banners/{$instance['user_id']}/{$instance['adspace_id']}_bp.js';

		d.getElementsByTagName('head')[0].appendChild(js);
	}(document));
</script>
EOF;
		}
		elseif(!empty($instance['adspace_api_key']) && $instance['integration_mode'] == 'html')
		{
			$advertiseHereCSS = ($instance['advertise_with_us_button_position'] == 'right') ? 'right: -1px' : 'left: -1px';
			$dimensions = ((int)$instance['adspace_width'] > 0 && (int)$instance['adspace_height'] > 0) ? 'width="'.$instance['adspace_width'].'" height="'.$instance['adspace_height'].'"' : '';
			
			echo <<<EOF
<style type="text/css">
.bp_advertise_with_us_button { display: inline-block; width: 47px; height: 155px; position: absolute; position: fixed; border: 1px solid #6B6E7F; {$advertiseHereCSS}; top: 55%; text-decoration: none !important; }
.bp_banner { width: auto; display: block; text-align: center; }
</style>
<a href="http://www.adspaceplatform.com/~{$instance['seller_username']}" target="_blank" class="bp_advertise_with_us_button"><img src="//www.buyselladmanager.com/images/advertise_with_us_button-en.gif" width="47" height="155" border="0" alt="" /></a>
<a href="http://www.buyselladmanager.com/banners/{$instance['user_id']}/{$instance['adspace_id']}_bp.php?mode=click" target="_blank" class="bp_banner"><img src="//www.buyselladmanager.com/banners/{$instance['user_id']}/{$instance['adspace_id']}_bp.php" alt="" border="0" {$dimensions} /></a>   
EOF;
		}
		
		if(isset($after_widget)) echo $after_widget;
	}
	
	/**
	 * Back-end widget form.
	 *
	 * @see WP_Widget::form()
	 *
	 * @param array $instance Previously saved values from database.
	 */
	public function form($instance) 
	{
		// Populate default values
		if(!isset($instance['adspace_api_key'])) $instance['adspace_api_key'] = '';
		if(!isset($instance['should_show_banner'])) $instance['should_show_banner'] = 'true';
		if(!isset($instance['should_show_advertise_with_us_button'])) $instance['should_show_advertise_with_us_button'] = 'null';
		if(!isset($instance['banner_refresh_rate'])) $instance['banner_refresh_rate'] = '30';
		if(!isset($instance['advertise_with_us_button_position'])) $instance['advertise_with_us_button_position'] = 'right';
		if(!isset($instance['advertise_with_us_button_YAxis_position'])) $instance['advertise_with_us_button_YAxis_position'] = '55%';
		if(!isset($instance['html_mode'])) $instance['html_mode'] = 'xhtml';
		if(!isset($instance['integration_mode'])) $instance['integration_mode'] = 'javascript';
		?>
		<p>
			<span style="font-size: 1.155em; font-weight: bold; color: #49475D;">Required Settings</span>
			<br /><br />
			<label for="<?php echo $this->get_field_id('adspace_api_key'); ?>"><a href="http://www.buyselladmanager.com/ad-manager.html#myadspaces" target="_blank" style="text-decoration: none;"><?php _e('Adspace API Key:'); ?></a></label> 
			<input class="widefat" id="<?php echo $this->get_field_id('adspace_api_key'); ?>" name="<?php echo $this->get_field_name('adspace_api_key'); ?>" type="password" value="<?php echo esc_attr($instance['adspace_api_key']); ?>" />
			<br /><br />
			<span style="font-size: 1.155em; font-weight: bold; color: #49475D;">Optional Advanced Settings</span>
			<br /><br />
			<label for="<?php echo $this->get_field_id('should_show_banner'); ?>"><?php _e('Should Display Banner:'); ?></label> 
			<select id="<?php echo $this->get_field_id('should_show_banner'); ?>" name="<?php echo $this->get_field_name('should_show_banner'); ?>">
				<option value="true"<?php if($instance['should_show_banner'] == 'true') { ?> selected="selected"<?php } ?>>Yes</option>
				<option value="false"<?php if($instance['should_show_banner'] == 'false') { ?> selected="selected"<?php } ?>>No</option>
			</select>
			<br /><br />
			<label for="<?php echo $this->get_field_id('should_show_advertise_with_us_button'); ?>"><?php _e('Should Display "Advertise With Us" Button:'); ?></label> 
			<select id="<?php echo $this->get_field_id('should_show_advertise_with_us_button'); ?>" name="<?php echo $this->get_field_name('should_show_advertise_with_us_button'); ?>">
				<option value="null"<?php if($instance['should_show_advertise_with_us_button'] == 'null') { ?> selected="selected"<?php } ?>>(Use Adspace Default)</option>
				<option value="true"<?php if($instance['should_show_advertise_with_us_button'] == 'true') { ?> selected="selected"<?php } ?>>Yes</option>
				<option value="false"<?php if($instance['should_show_advertise_with_us_button'] == 'false') { ?> selected="selected"<?php } ?>>No</option>
			</select>
			<br /><br />
			<label for="<?php echo $this->get_field_id('banner_refresh_rate'); ?>"><?php _e('Rotate Banner Interval (in seconds):'); ?></label> 
			<input size="3" id="<?php echo $this->get_field_id('banner_refresh_rate'); ?>" name="<?php echo $this->get_field_name('banner_refresh_rate'); ?>" type="text" value="<?php echo esc_attr($instance['banner_refresh_rate']); ?>" />
			<span style="font-size: 0.9em;">(0 to disable)</span>
			<br /><br />
			<label for="<?php echo $this->get_field_id('advertise_with_us_button_position'); ?>"><?php _e('"Advertise With Us" Button Position:'); ?></label> 
			<select id="<?php echo $this->get_field_id('advertise_with_us_button_position'); ?>" name="<?php echo $this->get_field_name('advertise_with_us_button_position'); ?>">
				<option value="left"<?php if($instance['advertise_with_us_button_position'] == 'left') { ?> selected="selected"<?php } ?>>Left</option>
				<option value="right"<?php if($instance['advertise_with_us_button_position'] == 'right') { ?> selected="selected"<?php } ?>>Right</option>
			</select>
			
			<br /><br />
			<label for="<?php echo $this->get_field_id('advertise_with_us_button_YAxis_position'); ?>"><?php _e('"Advertise With Us" Button Y-Axis Position:'); ?></label> 
			<input size="4" id="<?php echo $this->get_field_id('advertise_with_us_button_YAxis_position'); ?>" name="<?php echo $this->get_field_name('advertise_with_us_button_YAxis_position'); ?>" type="text" value="<?php echo esc_attr($instance['advertise_with_us_button_YAxis_position']); ?>" />
			<br /><br />
			<label for="<?php echo $this->get_field_id('html_mode'); ?>"><?php _e('HTML Mode:'); ?></label> 
			<select id="<?php echo $this->get_field_id('html_mode'); ?>" name="<?php echo $this->get_field_name('html_mode'); ?>">
				<option value="xhtml"<?php if($instance['html_mode'] == 'xhtml') { ?> selected="selected"<?php } ?>>XHTML Style Tags</option>
				<option value="html"<?php if($instance['html_mode'] == 'html') { ?> selected="selected"<?php } ?>>HTML Style Tags</option>
			</select>
			<br /><br />
			<label for="<?php echo $this->get_field_id('integration_mode'); ?>"><?php _e('Integration Mode:'); ?></label> 
			<select class="widefat" id="<?php echo $this->get_field_id('integration_mode'); ?>" name="<?php echo $this->get_field_name('integration_mode'); ?>">
				<option value="javascript"<?php if($instance['integration_mode'] == 'javascript') { ?> selected="selected"<?php } ?>>JavaScript (Recommended)</option>
				<option value="html"<?php if($instance['integration_mode'] == 'html') { ?> selected="selected"<?php } ?>>HTML</option>
			</select>
		</p>
		<?php 
	}
	
	public function update($new_instance, $old_instance) 
	{
		// Populate default values
		if(!isset($new_instance['adspace_api_key'])) $new_instance['adspace_api_key'] = '';
		if(!isset($new_instance['should_show_banner'])) $new_instance['should_show_banner'] = 'true';
		if(!isset($new_instance['should_show_advertise_with_us_button'])) $new_instance['should_show_advertise_with_us_button'] = 'null';
		if(!isset($new_instance['banner_refresh_rate'])) $new_instance['banner_refresh_rate'] = '30';
		if(!isset($new_instance['advertise_with_us_button_position'])) $new_instance['advertise_with_us_button_position'] = 'right';
		if(!isset($new_instance['advertise_with_us_button_YAxis_position'])) $new_instance['advertise_with_us_button_YAxis_position'] = '55%';
		if(!isset($new_instance['html_mode'])) $new_instance['html_mode'] = 'xhtml';
		if(!isset($new_instance['integration_mode'])) $new_instance['integration_mode'] = 'javascript';
		if(!isset($new_instance['is_paid_acct'])) $new_instance['is_paid_acct'] = 0;
		
		if(!empty($new_instance['adspace_api_key']))
		{
			// Validate API Key
			$apiUrl = 'https://www.buyselladmanager.com/?option=com_bannerplatform&view=api&task=get_adspace_sdk_data&no_html=1&tmpl=component&adspace_api_key='.urlencode($new_instance['adspace_api_key']);
			
			$response = wp_remote_get($apiUrl);
			
			if(!is_wp_error($response)) 
			{
			   // Request was successful
				$sdkData = json_decode(wp_remote_retrieve_body($response), true);
				
				if(isset($sdkData['success']))
				{
					if($sdkData['success']) return array_merge($new_instance, $sdkData['success']); // Validation successful
				}
			}
			
			return false;
		}
		
		return $new_instance;
	}
}

// register widget
add_action('widgets_init', create_function('', 'register_widget( "adspace_platform_widget" );'));