<?php if(preg_match('#' . basename(__FILE__) . '#', $_SERVER['PHP_SELF'])) { die('You are not allowed to call this page directly.'); } ?>
<div class="about_wrap">

	<style>
	.about_wrap {
		right: 1.3em;
		background-color: transparent;
		margin: 25px 40px 0 20px;
		box-shadow: none;
		-webkit-box-shadow: none;
	}

	.about_header {
		background-color: #FFF;
		padding: 1em 1em 0.5em 1em;
		-webkit-box-shadow: 0 0 7px 0 rgba(0, 0, 0, .2);
		box-shadow: 0 0 7px 0 rgba(0, 0, 0, .2);
	}

	.es-ltr {
		width: 20em;
	}
	</style>

	<div class="about_header">

		<h1><?php _e('Welcome to Email Subscribers!', 'email-subscribers'); ?></h1>

		<div><?php _e( 'Thanks for installing and we hope you will enjoy using Email Subscribers.', 'email-subscribers'); ?></div>

		<div class="wrap">
	        <table class="form-table">
	             <tr>
	                <th scope="row"><?php _e( 'For more help and tips...', 'email-subscribers' ) ?></th>
	                <td>
	                    <form name="klawoo_subscribe" action="#" method="POST" accept-charset="utf-8">
	                        <input class="es-ltr" type="text" name="email" id="email" placeholder="Email" />
	                        <input type="hidden" name="list" value="hN8OkYzujUlKgDgfCTEcIA"/>
	                        <input type="submit" name="submit" id="submit" class="button button-primary" value="Subscribe">
	                        <br/>
	                        <div id="klawoo_response"></div>
	                    </form>
	                </td>
	            </tr>
	        </table>
		</div>
	</div>
    <script type="text/javascript">
        jQuery(function () {
            jQuery("form[name=klawoo_subscribe]").submit(function (e) {
                e.preventDefault();
                
                jQuery('#klawoo_response').html('');
                params = jQuery("form[name=klawoo_subscribe]").serializeArray();
                params.push( {name: 'action', value: 'es_klawoo_subscribe' });
                
                jQuery.ajax({
                    method: 'POST',
                    type: 'text',
                    url: "<?php echo admin_url( 'admin-ajax.php' ); ?>",
                    async: false,
                    data: params,
                    success: function(response) {

                        if (response != '') {
                            jQuery('#klawoo_response').html(response);
                        } else {
                            jQuery('#klawoo_response').html('error!');
                        }
                    }
                });
            });
        });
    </script>

	<br/>
    <h1><?php _e( 'Frequently Asked Questions', 'email-subscribers' ); ?></h1>
</div>

<div class="wrap about-wrap">
	<?php

		$subbox_code = esc_html( '<?php es_subbox( $namefield = "YES", $desc = "", $group = "" ); ?>' );
		$unsub_link = esc_html( "<a href='###LINK###'>click here</a>");

		$faqs = array(
					array(
							'que' => __( 'How to setup subscription box widget?', 'email-subscribers' ),
							'ans' => __( '1. Use following shortcode in any page/post <br><strong>[email-subscribers namefield="YES" desc="" group="Public"]</strong><br>OR<br>
										  2. Go to Dashboard->Appearance->Widgets. You will see a widget called Email subscribers. Click Add Widget button or drag it to the sidebar on the right.<br>OR<br>
										  3. Copy and past this php code to your desired template location : <br><strong>'. $subbox_code .'</strong><br><br>
											Read more from <a target="_blank" href="http://www.gopiplus.com/work/2014/05/06/email-subscribers-wordpress-plugin-subscription-box/">here</a>.<br>', 'email-subscribers' )
						),
					array(
							'que' => __( 'How to add unsubscribe link in welcome email?', 'email-subscribers' ),
							'ans' => __( 'Please make sure Email Subscribers version is 3.1.2+. <br>
											Then go to WordPress -> Email Subscribers -> Settings -> Subscriber welcome mail content.<br>
											Add the following code at the end of welcome email content : <br><br>
											<strong>Please '. $unsub_link .' to unsubscribe.</strong><br><br>
											& then click on Save Settings button.', 'email-subscribers' ),
						),
					array(
							'que' => __( 'How to change/update/translate any text from the plugin?', 'email-subscribers' ),
							'ans' => __( 'Email Subscribers has a POT file named <code>email-subscribers.pot</code> present at /wp-content/plugins/email-subscribers/languages/. Use that with <strong>Loco Translate</strong> plugin and change/update/translate any text that you want.<br>
											Refer steps from <a target="_blank" href="http://www.storeapps.org/support/documentation/translating-storeapps-plugins/">here</a>.<br>', 'email-subscribers' )
						),
					array(
							'que' => __( 'How to setup auto emails using CRON Job through the cPanel or Plesk?', 'email-subscribers' ),
							'ans' => __( ' 1. <a target="_blank" href="http://www.gopiplus.com/work/2015/08/02/how-to-schedule-auto-emails-for-email-subscribers-wordpress-plugin-in-parallels-plesk/">Setup cron job in Plesk</a><br>
										   2. <a target="_blank" href="http://www.gopiplus.com/work/2015/08/04/how-to-schedule-auto-emails-for-email-subscribers-wordpress-plugin-in-cpanel/">Setup cron job in cPanal</a><br>
										   3. <a target="_blank" href="http://www.gopiplus.com/work/2015/08/08/email-subscribers-wordpress-plugin-how-to-schedule-auto-mails-cron-mails/">Hosting doesnt support cron jobs?</a>', 'email-subscribers' )
						),
					array(
							'que' => __( 'Notification Emails are not being received by Subscribers?', 'email-subscribers' ),
							'ans' => sprintf(__( 'Confirm steps from %s.', 'email-subscribers' ), '<a href="https://wordpress.org/plugins/email-subscribers/faq/" target="_blank">' . __( 'here', 'email-subscribers' ) . '</a>' )
						),
					array(
							'que' => __( 'How to import and export email address to subscriber list?', 'email-subscribers' ),
							'ans' => sprintf(__( 'Refer %s.', 'email-subscribers' ), '<a href="http://www.gopiplus.com/work/2014/05/06/email-subscribers-wordpress-plugin-subscriber-management-and-import-and-export-email-address/" target="_blank">' . __( 'here', 'email-subscribers' ) . '</a>' )
						),
					array(
							'que' => __( 'How to compose static newsletter?', 'email-subscribers' ),
							'ans' => sprintf(__( 'Refer %s.', 'email-subscribers' ), '<a href="http://www.gopiplus.com/work/2014/05/06/email-subscribers-wordpress-plugin-compose-html-emails/" target="_blank">' . __( 'here', 'email-subscribers' ) . '</a>' )
						),
					array(
							'que' => __( 'How to send static newsletter manually?', 'email-subscribers' ),
							'ans' => sprintf(__( 'Refer %s.', 'email-subscribers' ), '<a href="http://www.gopiplus.com/work/2014/05/06/email-subscribers-wordpress-plugin-send-email-newsletters/" target="_blank">' . __( 'here', 'email-subscribers' ) . '</a>' )
						),
					array(
							'que' => __( 'How to configure notification email to subscribers when new posts are published?', 'email-subscribers' ),
							'ans' => sprintf(__( 'Refer %s.', 'email-subscribers' ), '<a href="http://www.gopiplus.com/work/2014/05/06/email-subscribers-wordpress-plugin-notifications-settings/" target="_blank">' . __( 'here', 'email-subscribers' ) . '</a>' )
						),
					array(
							'que' => __( 'How to install and activate Email Subscribers on multisite installations?', 'email-subscribers' ),
							'ans' => sprintf(__( 'Refer %s.', 'email-subscribers' ), '<a href="http://www.gopiplus.com/work/2014/08/31/email-subscribers-wordpress-plugin-network-activation-for-multisite-installation/" target="_blank">' . __( 'here', 'email-subscribers' ) . '</a>' )
						),
					array(
							'que' => __( 'Where to check sent mails?', 'email-subscribers' ),
							'ans' => sprintf(__( 'Refer %s.', 'email-subscribers' ), '<a href="http://www.gopiplus.com/work/2014/05/06/email-subscribers-wordpress-plugin-send-email-newsletters/" target="_blank">' . __( 'here', 'email-subscribers' ) . '</a>' )
						),
					array(
							'que' => __( 'Is Mail not working in Email Subscribers?', 'email-subscribers' ),
							'ans' => sprintf(__( 'Refer %s.', 'email-subscribers' ), '<a href="http://www.gopiplus.com/work/2014/08/17/mail-not-working-on-email-subscribers-wordpress-plugin/" target="_blank">' . __( 'here', 'email-subscribers' ) . '</a>' )
						),
					array(
							'que' => __( 'How to modify the existing mails (Opt-in mail, Welcome mail, Admin mails) content?', 'email-subscribers' ),
							'ans' => sprintf(__( 'Refer %s.', 'email-subscribers' ), '<a href="http://www.gopiplus.com/work/2014/05/06/email-subscribers-wordpress-plugin-general-settings/" target="_blank">' . __( 'here', 'email-subscribers' ) . '</a>' )
						),
					array(
							'que' => __( 'How to add new subscribers group? How to bulk update Subscribers group?', 'email-subscribers' ),
							'ans' => sprintf(__( 'Refer %s.', 'email-subscribers' ), '<a href="http://www.gopiplus.com/work/2014/05/06/email-subscribers-wordpress-plugin-subscriber-management-and-import-and-export-email-address/" target="_blank">' . __( 'here', 'email-subscribers' ) . '</a>' )
						),
					array(
							'que' => __( 'I can\'t find a way to do X...', 'email-subscribers' ),
							'ans' => sprintf(__( 'If you can\'t find your favorite feature (or have a suggestion) %s.', 'email-subscribers' ), '<a href="http://www.storeapps.org/support/contact-us/" target="_blank">' . __( 'contact us', 'email-subscribers' ) . '</a>' )
						)
				);

		$faqs = array_chunk( $faqs, 2 );

		echo '<div>';
		foreach ( $faqs as $fqs ) {
			echo '<div class="two-col">';
			foreach ( $fqs as $index => $faq ) {
				echo '<div' . ( ( $index == 1 ) ? ' class="col last-feature"' : ' class="col"' ) . '>';
				echo '<h4>' . $faq['que'] . '</h4>';
				echo '<p>' . $faq['ans'] . '</p>';
				echo '</div>';
			}
			echo '</div>';
		}
		echo '</div>';
	?>
</div>