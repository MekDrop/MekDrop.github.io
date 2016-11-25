<?php
class es_cls_registerhook
{
	public static function es_activation()
	{
		global $wpdb;

		add_option('email-subscribers', "2.9");

		// Plugin tables
		$array_tables_to_plugin = array('es_emaillist','es_sentdetails','es_deliverreport','es_pluginconfig');
		$errors = array();
		
		// loading the sql file, load it and separate the queries
		$sql_file = ES_DIR.'sql'.DS.'es-createdb.sql';
		$prefix = $wpdb->prefix;
        $handle = fopen($sql_file, 'r');
        $query = fread($handle, filesize($sql_file));
        fclose($handle);
        $query=str_replace('CREATE TABLE IF NOT EXISTS ','CREATE TABLE IF NOT EXISTS '.$prefix, $query);
        $queries=explode('-- SQLQUERY ---', $query);

        // run the queries one by one
        $has_errors = false;
        foreach($queries as $qry)
		{
            $wpdb->query($qry);
        }
		
		// list the tables that haven't been created
        $missingtables=array();
        foreach($array_tables_to_plugin as $table_name)
		{
			if(strtoupper($wpdb->get_var("SHOW TABLES like  '". $prefix.$table_name . "'")) != strtoupper($prefix.$table_name))  
			{
                $missingtables[]=$prefix.$table_name;
            }
        }
		
		// add error in to array variable
        if($missingtables) 
		{
			$errors[] = __('These tables could not be created on installation ' . implode(', ',$missingtables), 'email-subscribers');
            $has_errors=true;
        }

		// if error call wp_die()
        if($has_errors) 
		{
			wp_die( __( $errors[0] , 'email-subscribers' ) );
			return false;
		}
		else
		{
			es_cls_default::es_pluginconfig_default();
			es_cls_default::es_subscriber_default();
			es_cls_default::es_template_default();
			es_cls_default::es_notifications_default();
		}

		if ( ! is_network_admin() && ! isset( $_GET['activate-multi'] ) ) {
			set_transient( '_es_activation_redirect', 1, 30 );
		}

        return true;
	}

	/**
	 * Sends user to the help & info page on activation.
	 */
	public static function es_welcome() {

       	if ( ! get_transient( '_es_activation_redirect' ) ) {
			return;
		}
		
		// Delete the redirect transient
		delete_transient( '_es_activation_redirect' );

		wp_redirect( admin_url( 'admin.php?page=es-general-information' ) );
		exit;
	}

	public static function es_synctables()
	{
		$es_c_email_subscribers_ver = get_option('email-subscribers');
		if($es_c_email_subscribers_ver <> "2.9")
		{
			global $wpdb;
			
			// loading the sql file, load it and separate the queries
			$sql_file = ES_DIR.'sql'.DS.'es-createdb.sql';
			$prefix = $wpdb->prefix;
			$handle = fopen($sql_file, 'r');
			$query = fread($handle, filesize($sql_file));
			fclose($handle);
			$query=str_replace('CREATE TABLE IF NOT EXISTS ','CREATE TABLE '.$prefix, $query);
			$query=str_replace('ENGINE=MyISAM /*!40100 DEFAULT CHARACTER SET utf8 COLLATE utf8_general_ci*/','', $query);
			$queries=explode('-- SQLQUERY ---', $query);
	
			// includes db upgrade file
			require_once( ABSPATH . 'wp-admin/includes/upgrade.php' );
			
			// run the queries one by one
			foreach($queries as $sSql)
			{
				dbDelta( $sSql );
			}
			
			$guid = es_cls_common::es_generate_guid(60);
			$home_url = home_url('/');
			$cronurl = $home_url . "?es=cron&guid=". $guid;
			add_option('es_c_cronurl', $cronurl);
			add_option('es_cron_mailcount', "50");
			add_option('es_cron_adminmail', "Hi Admin, \r\n\r\nCron URL has been triggered successfully on ###DATE### for the mail ###SUBJECT###. And it sent mail to ###COUNT### recipient. \r\n\r\nThank You");
			update_option('email-subscribers', "2.9" );
		}
	}
	
	public static function es_deactivation()
	{
		// do not generate any output here
	}
	
	public static function es_admin_option()
	{
		// do not generate any output here
	}

	public static function es_adminmenu()
	{
		$es_c_rolesandcapabilities = get_option('es_c_rolesandcapabilities', 'norecord');
		if($es_c_rolesandcapabilities == 'norecord' || $es_c_rolesandcapabilities == "")
		{
			$es_roles_subscriber = "manage_options";
			$es_roles_mail = "manage_options";
			$es_roles_notification = "manage_options";
			$es_roles_sendmail = "manage_options";
			$es_roles_setting = "manage_options";
			$es_roles_sentmail = "manage_options";
			$es_roles_help = "manage_options";
		}
		else
		{
			$es_roles_subscriber = $es_c_rolesandcapabilities['es_roles_subscriber'];
			$es_roles_mail = $es_c_rolesandcapabilities['es_roles_mail'];
			$es_roles_notification = $es_c_rolesandcapabilities['es_roles_notification'];
			$es_roles_sendmail = $es_c_rolesandcapabilities['es_roles_sendmail'];
			$es_roles_setting = $es_c_rolesandcapabilities['es_roles_setting'];
			$es_roles_sentmail = $es_c_rolesandcapabilities['es_roles_sentmail'];
			$es_roles_help = $es_c_rolesandcapabilities['es_roles_help'];
		}
		
		add_menu_page( __( 'Email Subscribers', 'email-subscribers' ), 
			__( 'Email Subscribers', 'email-subscribers' ), 'admin_dashboard', 'email-subscribers', array( 'es_cls_registerhook', 'es_admin_option'), ES_URL.'images/mail.png', 51 );

		add_submenu_page('email-subscribers', __( 'Subscribers', 'email-subscribers' ), 
		 	__( 'Subscribers', 'email-subscribers' ), $es_roles_subscriber, 'es-view-subscribers', array( 'es_cls_intermediate', 'es_subscribers' ));

		add_submenu_page('email-subscribers', __( 'Compose', 'email-subscribers' ), 
			__( 'Compose', 'email-subscribers' ), $es_roles_mail, 'es-compose', array( 'es_cls_intermediate', 'es_compose' ));

		add_submenu_page('email-subscribers', __( 'Notification', 'email-subscribers' ), 
			__( 'Notification', 'email-subscribers' ), $es_roles_notification, 'es-notification', array( 'es_cls_intermediate', 'es_notification' ));

		add_submenu_page('email-subscribers', __( 'Send Email', 'email-subscribers' ), 
			__( 'Send Email', 'email-subscribers' ), $es_roles_sendmail, 'es-sendemail', array( 'es_cls_intermediate', 'es_sendemail' ));

		add_submenu_page('email-subscribers', __( 'Cron', 'email-subscribers' ), 
			__( 'Cron Mail', 'email-subscribers' ), $es_roles_sendmail, 'es-cron', array( 'es_cls_intermediate', 'es_cron' ));

		add_submenu_page('email-subscribers', __( 'Settings', 'email-subscribers' ), 
			__( 'Settings', 'email-subscribers' ), $es_roles_setting, 'es-settings', array( 'es_cls_intermediate', 'es_settings' ));	

		add_submenu_page('email-subscribers', __( 'Roles', 'email-subscribers' ), 
			__( 'Roles', 'email-subscribers' ), 'administrator', 'es-roles', array( 'es_cls_intermediate', 'es_roles' ));	

		add_submenu_page('email-subscribers', __( 'Sent Mails', 'email-subscribers' ), 
			__( 'Sent Mails', 'email-subscribers' ), $es_roles_sentmail, 'es-sentmail', array( 'es_cls_intermediate', 'es_sentmail' ));	

		add_submenu_page('email-subscribers', __( 'Help & Info', 'email-subscribers' ), 
			__( '<span style="color:#f18500;font-weight:bolder;">Help & Info', 'email-subscribers' ), $es_roles_help, 'es-general-information', array( 'es_cls_intermediate', 'es_information' ));
	}

	public static function es_load_scripts() {

		if( !empty( $_GET['page'] ) ) {
			switch ( $_GET['page'] ) {
				case 'es-view-subscribers':
					wp_register_script( 'es-view-subscribers', ES_URL . 'subscribers/view-subscriber.js', '', '', true );
					wp_enqueue_script( 'es-view-subscribers', ES_URL . 'subscribers/view-subscriber.js' );
					$es_select_params = array(
						'es_subscriber_email'           => _x( 'Please enter subscriber email address.', 'view-subscriber-enhanced-select', 'email-subscribers' ),
						'es_subscriber_email_status'    => _x( 'Please select subscriber email status.', 'view-subscriber-enhanced-select', 'email-subscribers' ),
						'es_subscriber_group'           => _x( 'Please select or create group for this subscriber.', 'view-subscriber-enhanced-select', 'email-subscribers' ),
						'es_subscriber_delete_record'   => _x( 'Do you want to delete this record?', 'view-subscriber-enhanced-select', 'email-subscribers' ),
						'es_subscriber_bulk_action'     => _x( 'Please select the bulk action.', 'view-subscriber-enhanced-select', 'email-subscribers' ),
						'es_subscriber_delete_records'  => _x( 'Do you want to delete selected record(s)?', 'view-subscriber-enhanced-select', 'email-subscribers' ),
						'es_subscriber_confirm_delete'	=> _x( 'Are you sure you want to delete?', 'view-subscriber-enhanced-select', 'email-subscribers' ),
						'es_subscriber_resend_email'    => _x( 'Do you want to resend confirmation email? \nAlso please note, this will update subscriber current status to \'Unconfirmed\'.', 'view-subscriber-enhanced-select', 'email-subscribers' ),
						'es_subscriber_new_group'       => _x( 'Please select new subscriber group.', 'view-subscriber-enhanced-select', 'email-subscribers' ),
						'es_subscriber_group_update'    => _x( 'Do you want to update subscribers group?', 'view-subscriber-enhanced-select', 'email-subscribers' ),
						'es_subscriber_export'          => _x( 'Do you want to export the emails?', 'view-subscriber-enhanced-select', 'email-subscribers' ),
						'es_subscriber_csv_file'        => _x( 'Please select only csv file. Please check official website for csv structure..', 'view-subscriber-enhanced-select', 'email-subscribers' )
					);
					wp_localize_script( 'es-view-subscribers', 'es_view_subscriber_notices', $es_select_params );				
					break;
				case 'es-compose':
					wp_register_script( 'es-compose', ES_URL . 'compose/compose.js', '', '', true );
					wp_enqueue_script( 'es-compose', ES_URL . 'compose/compose.js' );
					$es_select_params = array(
						'es_configuration_name'     => _x( 'Please enter name for configuration.', 'compose-enhanced-select', 'email-subscribers' ),
						'es_configuration_template'	=> _x( 'Please select template for this configuration.', 'compose-enhanced-select', 'email-subscribers' ),
						'es_compose_delete_record'  => _x( 'Do you want to delete this record?', 'compose-enhanced-select', 'email-subscribers' )
					);
					wp_localize_script( 'es-compose', 'es_compose_notices', $es_select_params );
					break;
				case 'es-notification':
					wp_register_script( 'es-notification', ES_URL . 'notification/notification.js', '', '', true );
					wp_enqueue_script( 'es-notification', ES_URL . 'notification/notification.js' );
					$es_select_params = array(
						'es_notification_select_group'  => _x( 'Please select subscribers group.', 'notification-enhanced-select', 'email-subscribers' ),
						'es_notification_mail_subject'  => _x( 'Please select notification mail subject. Use compose menu to create new.', 'notification-enhanced-select', 'email-subscribers' ),
						'es_notification_status'	    => _x( 'Please select notification status.', 'notification-enhanced-select', 'email-subscribers' ),
						'es_notification_delete_record' => _x( 'Do you want to delete this record?', 'notification-enhanced-select', 'email-subscribers' )
					);
					wp_localize_script( 'es-notification', 'es_notification_notices', $es_select_params );
					break;
				case 'es-sendemail':
					wp_register_script( 'sendmail', ES_URL . 'sendmail/sendmail.js', '', '', true );
					wp_enqueue_script( 'sendmail', ES_URL . 'sendmail/sendmail.js' );
					$es_select_params = array(
					    'es_sendmail_subject'  => _x( 'Please select your mail subject.', 'sendmail-enhanced-select', 'email-subscribers' ),
					    'es_sendmail_status'   => _x( 'Please select subscriber email status.', 'sendmail-enhanced-select', 'email-subscribers' ),
					    'es_sendmail_confirm'  => _x( 'Are you sure you want to send email to all selected email address?', 'sendmail-enhanced-select', 'email-subscribers' )
					);
					wp_localize_script( 'sendmail', 'es_sendmail_notices', $es_select_params );
					break;
				case 'es-settings':
					wp_register_script( 'settings', ES_URL . 'settings/settings.js', '', '', true );
					wp_enqueue_script( 'settings', ES_URL . 'settings/settings.js' );
					break;
				case 'es-sentmail':
					wp_register_script( 'es-sentmail', ES_URL . 'sentmail/sentmail.js', '', '', true );
					wp_enqueue_script( 'es-sentmail', ES_URL . 'sentmail/sentmail.js' );
					$es_select_params = array(
						'es_sentmail_delete'      => _x( 'Do you want to delete this record?', 'sentmail-enhanced-select', 'email-subscribers' ),
						'es_sentmail_delete_all'  => _x( 'Do you want to delete all records except latest 10?', 'sentmail-enhanced-select', 'email-subscribers' )
					);
					wp_localize_script( 'es-sentmail', 'es_sentmail_notices', $es_select_params );
					break;
				case 'es-roles':
					wp_register_script( 'roles', ES_URL . 'roles/roles.js', '', '', true );
					wp_enqueue_script( 'roles', ES_URL . 'roles/roles.js' );
					$es_select_params = array(
					    'es_roles_email_address' => _x( 'Please enter subscriber email address.', 'roles-enhanced-select', 'email-subscribers' ),
					    'es_roles_email_status'  => _x( 'Please select subscriber email status.', 'roles-enhanced-select', 'email-subscribers' ),
					    'es_roles_email_group'   => _x( 'Please select or create group for this subscriber.', 'roles-enhanced-select', 'email-subscribers' )
					);
					wp_localize_script( 'roles', 'es_roles_notices', $es_select_params );
					break;
				case 'es-cron':
					wp_register_script( 'cron', ES_URL . 'cron/cron.js', '', '', true );
					wp_enqueue_script( 'cron', ES_URL . 'cron/cron.js' );
					$es_select_params = array(
					    'es_cron_number'           => _x( 'Please select enter number of mails you want to send per hour/trigger.', 'cron-enhanced-select', 'email-subscribers' ),
					    'es_cron_input_type'       => _x( 'Please enter the mail count, only number.', 'cron-enhanced-select', 'email-subscribers' )
					);
					wp_localize_script( 'cron', 'es_cron_notices', $es_select_params );
					break;
			}
		}	
	}

	public static function es_load_widget_scripts_styles() {
		wp_register_script( 'es-widget', ES_URL . 'widget/es-widget.js', '', '', true );
		wp_enqueue_script( 'es-widget', ES_URL . 'widget/es-widget.js' );
		$es_select_params = array(
			'es_email_notice'       => _x( 'Please enter email address.', 'widget-enhanced-select', 'email-subscribers' ),
			'es_incorrect_email'	=> _x( 'Please provide a valid email address.', 'widget-enhanced-select', 'email-subscribers' ),
			'es_load_more'          => _x( 'loading...', 'widget-enhanced-select', 'email-subscribers' ),
			'es_ajax_error'         => _x( 'Cannot create XMLHTTP instance', 'widget-enhanced-select', 'email-subscribers' ),
			'es_success_message'    => _x( 'Subscribed successfully.', 'widget-enhanced-select', 'email-subscribers' ),
			'es_success_notice'    	=> _x( 'You have successfully subscribed to the newsletter. You will receive a confirmation email in a few minutes. Please follow the link in it to confirm your subscription. If the email takes more than 15 minutes to appear in your mailbox, please check your spam folder.', 'widget-enhanced-select', 'email-subscribers' ),
			'es_email_exists'     	=> _x( 'Email already exist.', 'widget-enhanced-select', 'email-subscribers' ),
			'es_error'     			=> _x( 'Oops.. Unexpected error occurred.', 'widget-enhanced-select', 'email-subscribers' ),
			'es_invalid_email' 		=> _x( 'Invalid email address.', 'widget-enhanced-select', 'email-subscribers' ),
			'es_try_later' 			=> _x( 'Please try after some time.', 'widget-enhanced-select', 'email-subscribers' ),
			'es_problem_request'    => _x( 'There was a problem with the request.', 'widget-enhanced-select', 'email-subscribers' )
		);
		wp_localize_script( 'es-widget', 'es_widget_notices', $es_select_params );

		wp_register_script( 'es-widget-page', ES_URL . 'widget/es-widget-page.js', '', '', true );
		wp_enqueue_script( 'es-widget-page', ES_URL . 'widget/es-widget-page.js' );
		$es_select_params = array(
			'es_email_notice'       => _x( 'Please enter email address.', 'widget-page-enhanced-select', 'email-subscribers' ),
			'es_incorrect_email'	=> _x( 'Please provide a valid email address.', 'widget-page-enhanced-select', 'email-subscribers' ),
			'es_load_more'          => _x( 'loading...', 'widget-page-enhanced-select', 'email-subscribers' ),
			'es_ajax_error'         => _x( 'Cannot create XMLHTTP instance', 'widget-page-enhanced-select', 'email-subscribers' ),
			'es_success_message'    => _x( 'Subscribed successfully.', 'widget-page-enhanced-select', 'email-subscribers' ),
			'es_success_notice'    	=> _x( 'You have successfully subscribed to the newsletter. You will receive a confirmation email in a few minutes. Please follow the link in it to confirm your subscription. If the email takes more than 15 minutes to appear in your mailbox, please check your spam folder.', 'widget-page-enhanced-select', 'email-subscribers' ),
			'es_email_exists'     	=> _x( 'Email already exist.', 'widget-page-enhanced-select', 'email-subscribers' ),
			'es_error'     			=> _x( 'Oops.. Unexpected error occurred.', 'widget-page-enhanced-select', 'email-subscribers' ),
			'es_invalid_email' 		=> _x( 'Invalid email address.', 'widget-page-enhanced-select', 'email-subscribers' ),
			'es_try_later' 			=> _x( 'Please try after some time.', 'widget-page-enhanced-select', 'email-subscribers' ),
			'es_problem_request'    => _x( 'There was a problem with the request.', 'widget-page-enhanced-select', 'email-subscribers' )
		);
		wp_localize_script( 'es-widget-page', 'es_widget_page_notices', $es_select_params );

		wp_register_style( 'es-widget-css', ES_URL . 'widget/es-widget.css' );
		wp_enqueue_style( 'es-widget-css', ES_URL . 'widget/es-widget.css' );
	}

	public static function es_widget_loading() {
		register_widget( 'es_widget_register' );
	}

	public static function klawoo_subscribe() {
        $url = 'http://app.klawoo.com/subscribe';

        if( !empty( $_POST ) ) {
            $params = $_POST;
        } else {
            exit();
        }
        $method = 'POST';
        $qs = http_build_query( $params );

        $options = array(
            'timeout' => 15,
            'method' => $method
        );

        if ( $method == 'POST' ) {
            $options['body'] = $qs;
        } else {
            if ( strpos( $url, '?' ) !== false ) {
                $url .= '&'.$qs;
            } else {
                $url .= '?'.$qs;
            }
        }

        $response = wp_remote_request( $url, $options );

        if ( wp_remote_retrieve_response_code( $response ) == 200 ) {
            $data = $response['body'];
            if ( $data != 'error' ) {
                             
                $message_start = substr( $data, strpos( $data,'<body>' ) + 6 );
                $remove = substr( $message_start, strpos( $message_start,'</body>' ) );
                $message = trim( str_replace( $remove, '', $message_start ) );
                echo ( $message );
                exit();                
            }
        }
        exit();
    }
}

function es_sync_registereduser( $user_id )
{        
	$es_c_emailsubscribers = get_option('es_c_emailsubscribers', 'norecord');
	if($es_c_emailsubscribers == 'norecord' || $es_c_emailsubscribers == "")
	{
		// No action is required
	}
	else
	{
		if(($es_c_emailsubscribers['es_registered'] == "YES") && ($user_id <> ""))
		{
			$es_registered = $es_c_emailsubscribers['es_registered'];
			$es_registered_group = $es_c_emailsubscribers['es_registered_group'];

			$user_info = get_userdata($user_id);
			$user_firstname = $user_info->user_firstname;
			if($user_firstname == "")
			{
				$user_firstname = $user_info->user_login;
			}
			$user_mail = $user_info->user_email;
			
			$form['es_email_name'] = $user_firstname;
			$form['es_email_mail'] = $user_mail;
			$form['es_email_group'] = $es_c_emailsubscribers['es_registered_group'];
			$form['es_email_status'] = "Confirmed";
			$action = es_cls_dbquery::es_view_subscriber_ins($form, "insert");
			if($action == "sus")
			{
				//Inserted successfully. Below 3 line of code will send WELCOME email to subscribers.
				$subscribers = array();
				$subscribers = es_cls_dbquery::es_view_subscriber_one($user_mail);
				es_cls_sendmail::es_sendmail("welcome", $template = 0, $subscribers, "welcome", 0);
			}
		}
	}	
}
	
class es_widget_register extends WP_Widget 
{
	function __construct() 
	{
		$widget_ops = array('classname' => 'widget_text elp-widget', 'description' => __(ES_PLUGIN_DISPLAY, 'email-subscribers'), ES_PLUGIN_NAME);
		parent::__construct(ES_PLUGIN_NAME, __(ES_PLUGIN_DISPLAY, 'email-subscribers'), $widget_ops);
	}
	
	function widget( $args, $instance ) 
	{
		extract( $args, EXTR_SKIP );

		$es_title 	= apply_filters( 'widget_title', empty( $instance['es_title'] ) ? '' : $instance['es_title'], $instance, $this->id_base );
		$es_desc	= $instance['es_desc'];
		$es_name	= $instance['es_name'];
		$es_group	= $instance['es_group'];

		echo $args['before_widget'];
		if ( ! empty( $es_title ) )
		{
			echo $args['before_title'] . $es_title . $args['after_title'];
		}
		// display widget method
		$url = home_url();
		
		global $es_includes;
		if (!isset($es_includes) || $es_includes !== true) {
			$es_includes = true;
		}
		?>

		<div>
			<form class="es_widget_form">
			<?php if( $es_desc <> "" ) { ?>
				<div class="es_caption"><?php echo $es_desc; ?></div>
				<?php } ?>
				<div class="es_msg"><span id="es_msg"></span></div>
				<?php if( $es_name == "YES" ) { ?>
				<div class="es_lablebox"><?php _e('Name', 'email-subscribers'); ?></div>
				<div class="es_textbox">
					<input class="es_textbox_class" name="es_txt_name" id="es_txt_name" value="" maxlength="225" type="text">
				</div>
				<?php } ?>
				<div class="es_lablebox"><?php _e('Email *', 'email-subscribers'); ?></div>
				<div class="es_textbox">
					<input class="es_textbox_class" name="es_txt_email" id="es_txt_email" onkeypress="if(event.keyCode==13) es_submit_page('<?php echo $url; ?>')" value="" maxlength="225" type="text">
				</div>
				<div class="es_button">
					<input class="es_textbox_button" name="es_txt_button" id="es_txt_button" onClick="return es_submit_page('<?php echo $url; ?>')" value="<?php _e('Subscribe', 'email-subscribers'); ?>" type="button">
				</div>
				<?php if( $es_name != "YES" ) { ?>
					<input name="es_txt_name" id="es_txt_name" value="" type="hidden">
				<?php } ?>
				<input name="es_txt_group" id="es_txt_group" value="<?php echo $es_group; ?>" type="hidden">
			</form>
		</div>
		<?php
		echo $args['after_widget'];
	}
	
	function update( $new_instance, $old_instance ) 
	{
		$instance 				= $old_instance;
		$instance['es_title'] 	= ( ! empty( $new_instance['es_title'] ) ) ? strip_tags( $new_instance['es_title'] ) : '';
		$instance['es_desc'] 	= ( ! empty( $new_instance['es_desc'] ) ) ? strip_tags( $new_instance['es_desc'] ) : '';
		$instance['es_name'] 	= ( ! empty( $new_instance['es_name'] ) ) ? strip_tags( $new_instance['es_name'] ) : '';
		$instance['es_group'] 	= ( ! empty( $new_instance['es_group'] ) ) ? strip_tags( $new_instance['es_group'] ) : '';
		return $instance;
	}
	
	function form( $instance ) 
	{
		$defaults = array(
			'es_title' => '',
            'es_desc' 	=> '',
            'es_name' 	=> '',
			'es_group' 	=> ''
        );
		$instance 		= wp_parse_args( (array) $instance, $defaults);
		$es_title 		= $instance['es_title'];
        $es_desc 		= $instance['es_desc'];
        $es_name 		= $instance['es_name'];
		$es_group 		= $instance['es_group'];
		?>
		<p>
			<label for="<?php echo $this->get_field_id('es_title'); ?>"><?php _e('Widget Title', 'email-subscribers'); ?></label>
			<input class="widefat" id="<?php echo $this->get_field_id('es_title'); ?>" name="<?php echo $this->get_field_name('es_title'); ?>" type="text" value="<?php echo $es_title; ?>" />
        </p>
		<p>
            <label for="<?php echo $this->get_field_id('es_name'); ?>"><?php _e('Display Name Field', 'email-subscribers'); ?></label>
			<select class="widefat" id="<?php echo $this->get_field_id('es_name'); ?>" name="<?php echo $this->get_field_name('es_name'); ?>">
				<option value="YES" <?php $this->es_selected($es_name == 'YES'); ?>>YES</option>
				<option value="NO" <?php $this->es_selected($es_name == 'NO'); ?>>NO</option>
			</select>
        </p>
		<p>
			<label for="<?php echo $this->get_field_id('es_desc'); ?>"><?php _e('Short Description', 'email-subscribers'); ?></label>
			<input class="widefat" id="<?php echo $this->get_field_id('es_desc'); ?>" name="<?php echo $this->get_field_name('es_desc'); ?>" type="text" value="<?php echo $es_desc; ?>" />
			<?php _e('Short description about your subscription form.', 'email-subscribers'); ?>
        </p>
		<p>
			<label for="<?php echo $this->get_field_id('es_group'); ?>"><?php _e('Subscriber Group', 'email-subscribers'); ?></label>
			<input class="widefat" id="<?php echo $this->get_field_id('es_group'); ?>" name="<?php echo $this->get_field_name('es_group'); ?>" type="text" value="<?php echo $es_group; ?>" />
        </p>
		<?php
	}
	
	function es_selected($var) 
	{
		if ($var==1 || $var==true) 
		{
			echo 'selected="selected"';
		}
	}
}
?>