<?php
	$options = get_option( ISINTOPTIONNAME );
	
	if( !array_key_exists( 'notification_frequency', $options ) ) 
		{
		$options['notification_frequency'] = 360;
		}
		
	if( !function_exists( 'imagecreatetruecolor' ) && !class_exists( 'Imagick' ) )
		{
		echo '<div id="message" class="error fade"><p>' . __( 'PHP GD/Image Magic library is not installed, you will not be able to generate images!' ) . '</p></div>' . "\n";
		}

	if( !function_exists( 'imagecreatetruecolor' ) && class_exists( 'Imagick' ) )
		{
		echo '<div id="message" class="error fade"><p>' . __( 'PHP GD not installed! Image Magic library will be used, however this is still experimental and may not work.' ) . '</p></div>' . "\n";
		}
		
?>
<div class="wrap">
	<style type="text/css">
		table.form-table {
			clear: none;
			float: left;
			width: 100%;
		}
	</style>
	<script type="text/javascript">jQuery(document).ready(function() { jQuery("#tabs").tabs(); } );</script>
	<h2>OS Integration Settings</h2>
	<br>
	<?php if( osintegration_getOption( 'error_message', $options ) ) { echo '<div class="error">' . osintegration_getOption( 'error_message', $options ) . '</div>'; } ?>
	<form method="post" action="options.php" >	
		<?php settings_fields( 'osintegration_plugin_options' ); ?>
		<div id="tabs">
			<ul>
				<li><a href="#fragment-1"><span><?php _e('General');?></span></a></li>
				<li><a href="#fragment-2"><span><?php _e('Fav Icon');?></span></a></li>
				<li><a href="#fragment-3"><span><?php _e('Windows');?></span></a></li>
				<li><a href="#fragment-4"><span><?php _e('iOS');?></span></a></li>
				<li><a href="#fragment-5"><span><?php _e('Advanced');?></span></a></li>
				<li><a href="#fragment-6"><span><?php _e('About');?></span></a></li>
			</ul>

			<div id="fragment-1">
				<table class="form-table">
					<tr>
						<th scope="row">Square Image<br/></th>
						<td>
							<input type="url" id="squareimgurl" name="osintegration_options[squareimgurl]" value="<?php echo $options['squareimgurl']; ?>" size="100"/>
							<br>
							<input type="button" class="button" name="square_img_button" id="square_img_button" value="Select Image" />
							<br><br>
							<em>This image will be cropped and resized for the various image sizes, you must use a PNG image larger than 450x450 px.</em>
						</td>
					</tr>
					<tr>
						<th scope="row">Wide Image<br/></th>
						<td>
							<input type="url" id="wideimgurl" name="osintegration_options[wideimgurl]" value="<?php echo $options['wideimgurl']; ?>" size="100"/>
							<br>
							<input type="button" class="button" name="wide_img_button" id="wide_img_button" value="Select Image" />
							<br><br>
							<em>This image will be cropped and resized for the various image sizes, you must use a PNG image larger than 450x218 px.</em>
						</td>
					</tr>
					<tr>
						<th scope="row">Background Color</th>
						<td colspan="2">
							<input type="text" id="color" class="color-field" name="osintegration_options[background-color]" value="<?php echo $options['background-color']; ?>" />
						</td>
					</tr>
					<tr>
						<th scope="row">Site Title</th>
						<td>
							<input type="text" id="title" name="osintegration_options[title]" value="<?php echo $options['title']; ?>" />
							<br><br>
							<em>This will be used in Windows Live Tiles and iOS instead of the default WordPress site title.</em>
						</td>
					</tr>
					<tr>
						<td>
							<p class="submit">
								<input type="submit" class="button-primary" value="Save Changes" />
							</p>
						</td>
					</tr>
				</table>
			</div>
			<div id="fragment-2">
				<table class="form-table">
					<tr>
						<th scope="row">Enable Fav Icon</th>
						<td>
							<input type="checkbox" id="enablefavicon" name="osintegration_options[enablefavicon]"<?php if( $options['enablefavicon'] ) { echo " CHECKED"; } ?>/>
						</td>
					</tr>
					<tr>
						<th scope="row">Fav Icon Path</th>
						<td>
							<input type="text" id="faviconpath" name="osintegration_options[faviconpath]" value="<?php if( $options['faviconpath'] ) { echo $options['faviconpath']; } else { echo str_replace( '\\', '/', ABSPATH ); } ?>" size="50"/>
						</td>
					</tr>
					<tr>
						<th scope="row">Include 64px Image</th>
						<td>
							<input type="checkbox" id="favicon64" name="osintegration_options[favicon64]"<?php if( $options['favicon64'] ) { echo " CHECKED"; } ?>/>
						</td>
					</tr>
					<tr>
						<th scope="row">Include 96px Image</th>
						<td>
							<input type="checkbox" id="favicon96" name="osintegration_options[favicon96]"<?php if( $options['favicon96'] ) { echo " CHECKED"; } ?>/>
						</td>
					</tr>
					<tr>
						<td>
							<p class="submit">
								<input type="submit" class="button-primary" value="Save Changes" />
							</p>
						</td>
					</tr>
				</table>
			</div>
			<div id="fragment-3">
				<table class="form-table">
					<tr>
						<th scope="row">Enable Live Tile</th>
						<td>
							<input type="checkbox" id="enablelivetile" name="osintegration_options[enablelivetile]"<?php if( $options['enablelivetile'] ) { echo " CHECKED"; } ?>/>
						</td>
					</tr>
					<tr>
						<th scope="row">RSS Feed URL</th>
						<td>
							<input type="url" id="rssurl" name="osintegration_options[rssurl]" value="<?php if( !isset( $options['rssurl'] ) ) { echo  get_bloginfo( 'rss2_url' ); } else { echo $options['rssurl']; } ?>" size="50" />
						</td>
					</tr>
					<tr>
						<th scope="row">Local XML file</th>
						<td>
							<input type="checkbox" id="localxml" name="osintegration_options[localxml]"<?php if( $options['localxml'] ) { echo " CHECKED"; } ?>/>
						</td>
					</tr>
					<tr>
						<th>Update Interval</th>
						<td><select name="osintegration_options[notification_frequency]">
								<option value="30" <?php selected( $options['notification_frequency'], 30 ); ?>>30 minutes</option>
								<option value="60" <?php selected( $options['notification_frequency'], 60 ); ?>>1 hour</option>
								<option value="360" <?php selected( $options['notification_frequency'], 360 ); ?>>6 hours</option>
								<option value="720" <?php selected( $options['notification_frequency'], 720 ); ?>>12 hours</option>
								<option value="1440" <?php selected( $options['notification_frequency'], 1440 ); ?>>1 day</option>
							</select>
						</p></td>
					</tr>
					<tr>
						<td>
							<p class="submit">
								<input type="submit" class="button-primary" value="Save Changes" />
							</p>
						</td>
					</tr>
				</table>
			</div>
			<div id="fragment-4">
				<table class="form-table">
					<tr>
						<th scope="row">Enable iOS Support</th>
						<td>
							<input type="checkbox" id="enableios" name="osintegration_options[enableios]"<?php if( $options['enableios'] ) { echo " CHECKED"; } ?>/>
						</td>
					</tr>
					<tr>
						<th scope="row">Enable Web App Support</th>
						<td>
							<input type="checkbox" id="enablewebapp" name="osintegration_options[enablewebapp]"<?php if( $options['enablewebapp'] ) { echo " CHECKED"; } ?>/>
						</td>
					</tr>
					<tr>
						<th scope="row">Enable Link Override</th>
						<td>
							<input type="checkbox" id="enablelinkoverride" name="osintegration_options[enablelinkoverride]"<?php if( $options['enablelinkoverride'] ) { echo " CHECKED"; } ?>/>
						</td>
					</tr>
					<tr>
						<th scope="row">Use wide image for web app loading screen</th>
						<td>
							<input type="checkbox" id="widewebapp" name="osintegration_options[widewebapp]"<?php if( $options['widewebapp'] ) { echo " CHECKED"; } ?>/>
						</td>
					</tr>
					<tr>
						<th scope="row">Web App Logo Location</th>
						<td>
							<select name="osintegration_options[logo-position]">
								<option value="1" <?php selected( $options['logo-position'], 1 ); ?>>Top Left</option>
								<option value="2" <?php selected( $options['logo-position'], 2 ); ?>>Top Middle</option>
								<option value="3" <?php selected( $options['logo-position'], 3 ); ?>>Top Right</option>
								<option value="4" <?php selected( $options['logo-position'], 4 ); ?>>Center Left</option>
								<option value="5" <?php selected( $options['logo-position'], 5 ); ?>>Center Middle</option>
								<option value="6" <?php selected( $options['logo-position'], 6 ); ?>>Center Right</option>
								<option value="7" <?php selected( $options['logo-position'], 7 ); ?>>Bottom Left</option>
								<option value="8" <?php selected( $options['logo-position'], 8 ); ?>>Bottom Middle</option>
								<option value="9" <?php selected( $options['logo-position'], 9 ); ?>>Bottom Right</option>
							</select>
						</td>
					</tr>
					<tr>
						<th scope="row">Web App Status Bar Style</th>
						<td>
							<select name="osintegration_options[statusbarstyle]">
								<option value="2" <?php selected( $options['statusbarstyle'], 2 ); ?>>Default</option>
								<option value="1" <?php selected( $options['statusbarstyle'], 1 ); ?>>Black</option>
								<option value="0" <?php selected( $options['statusbarstyle'], 0 ); ?>>Translucent</option>
							</select>
						</td>
					</tr>
					<tr>
						<td>
							<p class="submit">
								<input type="submit" class="button-primary" value="Save Changes" />
							</p>
						</td>
					</tr>
				</table>
			</div>
			<div id="fragment-5">
				<table class="form-table">
					<tr>
						<th scope="row">Force rebuild</th>
						<td>
							<input type="checkbox" id="forcerebuild" name="osintegration_options[forcerebuild]"/><br>
							<br>
							<i>OS Integration only builds new icons/images when the selected square/wide images change, this option will force a one time rebuild of everything when you select "Save Changes".</i>
						</td>
					</tr>
					<tr>
						<td colspan=2>
							<h2>Override individual image files to be used</h2>
						</td>
					</tr>
<?php
foreach( $options as $key => $option ) 
	{
	if( substr( $key, 0, 4 ) == 'img_' || substr( $key, 0, 4) == 'ios_' )
		{
?>
					<tr>
						<th scope="row"><?php echo $key; ?>:</th>
						<td>
							<input type="url" id="adv_<?php echo $key;?>" name="osintegration_options[adv_<?php echo $key;?>]" value="<?php echo $options['adv_' . $key];?>" size="100"/>
						</td>
					</tr>
<?php
		}
	}
?>
					<tr>
						<td>
							<p class="submit">
								<input type="submit" class="button-primary" value="Save Changes" />
							</p>
						</td>
					</tr>
				</table>
			</div>
			<div id="fragment-6">
				<h2><?php printf( __( 'OS Integration Version %s' ), OSINTVER );?></h2>
				<p><?php _e( 'by' );?> <a href="https://profiles.wordpress.org/gregross" target=_blank>Greg Ross</a></p>
				<p>&nbsp;</p>
				<p><?php printf( __( 'Licenced under the %sGPL Version 2%s' ), '<a href="http://www.gnu.org/licenses/gpl-2.0.html" target=_blank>', '</a>' );?></p>
				<p><?php printf( __( 'To find out more, please visit the %sWordPress Plugin Directory page%s or the plugin home page on %sToolStack.com%s' ), '<a href="http://wordpress.org/plugins/os-integration/" target=_blank>', '</a>', '<a href="http://toolstack.com/os-integration" target=_blank>', '</a>' );?></p>
				<p>&nbsp;</p>
				<p><?php printf( __( "Don't forget to %srate and review%s it too!" ), '<a href="http://wordpress.org/support/view/plugin-reviews/os-integration" target=_blank>', '</a>' );?></p>
			</div>
		</div>

	</form>
</div>