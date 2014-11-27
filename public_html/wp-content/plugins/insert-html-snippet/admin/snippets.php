<?php 
global $wpdb;
$_GET = stripslashes_deep($_GET);
$xyz_ihs_message = '';
if(isset($_GET['xyz_ihs_msg'])){
	$xyz_ihs_message = $_GET['xyz_ihs_msg'];
}
if($xyz_ihs_message == 1){

	?>
<div class="system_notice_area_style1" id="system_notice_area">
HTML Snippet successfully added.&nbsp;&nbsp;&nbsp;<span
id="system_notice_area_dismiss">Dismiss</span>
</div>
<?php

}
if($xyz_ihs_message == 2){

	?>
<div class="system_notice_area_style0" id="system_notice_area">
HTML Snippet not found.&nbsp;&nbsp;&nbsp;<span
id="system_notice_area_dismiss">Dismiss</span>
</div>
<?php

}
if($xyz_ihs_message == 3){

	?>
<div class="system_notice_area_style1" id="system_notice_area">
HTML Snippet successfully deleted.&nbsp;&nbsp;&nbsp;<span
id="system_notice_area_dismiss">Dismiss</span>
</div>
<?php

}
if($xyz_ihs_message == 4){

	?>
<div class="system_notice_area_style1" id="system_notice_area">
HTML Snippet status successfully changed.&nbsp;&nbsp;&nbsp;<span
id="system_notice_area_dismiss">Dismiss</span>
</div>
<?php

}
if($xyz_ihs_message == 5){

	?>
<div class="system_notice_area_style1" id="system_notice_area">
HTML Snippet successfully updated.&nbsp;&nbsp;&nbsp;<span
id="system_notice_area_dismiss">Dismiss</span>
</div>
<?php

}
?>


<div >


	<form method="post">
		<fieldset
			style="width: 99%; border: 1px solid #F7F7F7; padding: 10px 0px;">
			<legend><h3>HTML Snippets</h3></legend>
			<?php 
			global $wpdb;
			$pagenum = isset( $_GET['pagenum'] ) ? absint( $_GET['pagenum'] ) : 1;
			$limit = get_option('xyz_ihs_limit');			
			$offset = ( $pagenum - 1 ) * $limit;
			
			
			$entries = $wpdb->get_results( "SELECT * FROM ".$wpdb->prefix."xyz_ihs_short_code  ORDER BY id DESC LIMIT $offset,$limit" );
			
			?>
			<input  id="submit_ihs"
				style="cursor: pointer; margin-bottom:10px; margin-left:8px;" type="button"
				name="textFieldButton2" value="Add New HTML Snippet"
				 onClick='document.location.href="<?php echo admin_url('admin.php?page=insert-html-snippet-manage&action=snippet-add');?>"'>
			<table class="widefat" style="width: 99%; margin: 0 auto; border-bottom:none;">
				<thead>
					<tr>
						<th scope="col" >Tracking Name</th>
						<th scope="col" >Snippet Short Code</th>
						<th scope="col" >Status</th>
						<th scope="col" colspan="3" style="text-align: center;">Action</th>
					</tr>
				</thead>
				<tbody>
					<?php 
					if( count($entries)>0 ) {
						$count=1;
						$class = '';
						foreach( $entries as $entry ) {
							$class = ( $count % 2 == 0 ) ? ' class="alternate"' : '';
							?>
					<tr <?php echo $class; ?>>
						<td><?php 
						echo esc_html($entry->title);
						?></td>
						<td><?php 
						if($entry->status == 2){echo 'NA';}
						else
						echo '[xyz-ihs snippet="'.esc_html($entry->title).'"]';
						?></td>
						<td>
							<?php 
								if($entry->status == 2){
									echo "Inactive";	
								}elseif ($entry->status == 1){
								echo "Active";	
								}
							
							?>
						</td>
						<?php 
								if($entry->status == 2){
						?>
						<td style="text-align: center;"><a
							href='<?php echo admin_url('admin.php?page=insert-html-snippet-manage&action=snippet-status&snippetId='.$entry->id.'&status=1&pageno='.$pagenum); ?>'><img
								id="img" title="Activate"
								src="<?php echo plugins_url('insert-html-snippet/images/activate.png')?>">
						</a>
						</td>
							<?php 
								}elseif ($entry->status == 1){
								?>
						<td style="text-align: center;"><a
							href='<?php echo admin_url('admin.php?page=insert-html-snippet-manage&action=snippet-status&snippetId='.$entry->id.'&status=2&pageno='.$pagenum); ?>'><img
								id="img" title="Deactivate"
								src="<?php echo plugins_url('insert-html-snippet/images/pause.png')?>">
						</a>
						</td>		
								<?php 	
								}
							
							?>
						
						<td style="text-align: center;"><a
							href='<?php echo admin_url('admin.php?page=insert-html-snippet-manage&action=snippet-edit&snippetId='.$entry->id.'&pageno='.$pagenum); ?>'><img
								id="img" title="Edit Snippet"
								src="<?php echo plugins_url('insert-html-snippet/images/edit.png')?>">
						</a>
						</td>
						<td style="text-align: center;" ><a
							href='<?php echo admin_url('admin.php?page=insert-html-snippet-manage&action=snippet-delete&snippetId='.$entry->id.'&pageno='.$pagenum); ?>'
							onclick="javascript: return confirm('Please click \'OK\' to confirm ');"><img
								id="img" title="Delete Snippet"
								src="<?php echo plugins_url('insert-html-snippet/images/delete.png')?>">
						</a></td>
					</tr>
					<?php
					$count++;
						}
					} else { ?>
					<tr>
						<td colspan="6" >HTML Snippets not found</td>
					</tr>
					<?php } ?>
				</tbody>
			</table>
			
			<input  id="submit_ihs"
				style="cursor: pointer; margin-top:10px;margin-left:8px;" type="button"
				name="textFieldButton2" value="Add New HTML Snippet"
				 onClick='document.location.href="<?php echo admin_url('admin.php?page=insert-html-snippet-manage&action=snippet-add');?>"'>
			
			<?php
			$total = $wpdb->get_var( "SELECT COUNT(`id`) FROM ".$wpdb->prefix."xyz_ihs_short_code" );
			$num_of_pages = ceil( $total / $limit );

			$page_links = paginate_links( array(
					'base' => add_query_arg( 'pagenum','%#%'),
				    'format' => '',
				    'prev_text' =>  '&laquo;',
				    'next_text' =>  '&raquo;',
				    'total' => $num_of_pages,
				    'current' => $pagenum
			) );



			if ( $page_links ) {
				echo '<div class="tablenav" style="width:99%"><div class="tablenav-pages" style="margin: 1em 0">' . $page_links . '</div></div>';
			}

			?>

		</fieldset>

	</form>

</div>

