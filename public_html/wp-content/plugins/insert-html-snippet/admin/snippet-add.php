<?php 

global $wpdb;

$_POST = stripslashes_deep($_POST);
$_POST = xyz_trim_deep($_POST);

if(isset($_POST) && isset($_POST['addSubmit'])){

// 		echo '<pre>';
// 		print_r($_POST);
// 		die("JJJ");

	$temp_xyz_ihs_title = str_replace(' ', '', $_POST['snippetTitle']);
	$temp_xyz_ihs_title = str_replace('-', '', $temp_xyz_ihs_title);
	
	$xyz_ihs_title = str_replace(' ', '-', $_POST['snippetTitle']);
	$xyz_ihs_content = $_POST['snippetContent'];

	if($xyz_ihs_title != "" && $xyz_ihs_content != ""){
		if(ctype_alnum($temp_xyz_ihs_title))
		{
		
		$snippet_count = $wpdb->query( 'SELECT * FROM '.$wpdb->prefix.'xyz_ihs_short_code WHERE title="'.$xyz_ihs_title.'"' ) ;
		if($snippet_count == 0){
			$xyz_shortCode = '[xyz-ihs snippet="'.$xyz_ihs_title.'"]';
			$wpdb->insert($wpdb->prefix.'xyz_ihs_short_code', array('title' =>$xyz_ihs_title,'content'=>$xyz_ihs_content,'short_code'=>$xyz_shortCode,'status'=>'1'),array('%s','%s','%s','%d'));
			
			header("Location:".admin_url('admin.php?page=insert-html-snippet-manage&xyz_ihs_msg=1'));
		}else{
			?>
			<div class="system_notice_area_style0" id="system_notice_area">
			HTML Snippet already exists. &nbsp;&nbsp;&nbsp;<span id="system_notice_area_dismiss">Dismiss</span>
			</div>
			<?php	
	
		}
		}
		else
		{
			?>
		<div class="system_notice_area_style0" id="system_notice_area">
		HTML Snippet title can have only alphabets,numbers or hyphen. &nbsp;&nbsp;&nbsp;<span id="system_notice_area_dismiss">Dismiss</span>
		</div>
		<?php
		
		}
		
		
	}else{
?>		
		<div class="system_notice_area_style0" id="system_notice_area">
			Fill all mandatory fields. &nbsp;&nbsp;&nbsp;<span id="system_notice_area_dismiss">Dismiss</span>
		</div>
<?php 
	}

}

?>

<div >
	<fieldset
		style="width: 99%; border: 1px solid #F7F7F7; padding: 10px 0px;">
		<legend>
			<b>Add HTML Snippet</b>
		</legend>
		<form name="frmmainForm" id="frmmainForm" method="post">
			
			<div>
				<table
					style="width: 99%; background-color: #F9F9F9; border: 1px solid #E4E4E4; border-width: 1px;margin: 0 auto">
					<tr><td><br/>
					<div id="shortCode"></div>
					<br/></td></tr>
					<tr valign="top">
						<td style="border-bottom: none;width:20%;">&nbsp;&nbsp;&nbsp;Tracking Name&nbsp;<font color="red">*</font></td>
						<td style="border-bottom: none;width:1px;">&nbsp;:&nbsp;</td>
						<td><input style="width:80%;"
							type="text" name="snippetTitle" id="snippetTitle"
							value="<?php if(isset($_POST['snippetTitle'])){ echo esc_attr($_POST['snippetTitle']);}?>"></td>
					</tr>
					<tr>
						<td style="border-bottom: none;width:20%; ">&nbsp;&nbsp;&nbsp;HTML code &nbsp;<font color="red">*</font></td>
						<td style="border-bottom: none;width:1px;">&nbsp;:&nbsp;</td>
						<td >
							<textarea name="snippetContent" style="width:80%;height:150px;"><?php if(isset($_POST['snippetContent'])){ echo esc_textarea($_POST['snippetContent']);}?></textarea>
						</td>
					</tr>				

				<tr>
				<td></td><td></td>
					<td><input class="button-primary" style="cursor: pointer;"
							type="submit" name="addSubmit" value="Create"></td>
				</tr>
				<tr><td><br/></td></tr>
				</table>
			</div>

		</form>
	</fieldset>

</div>
