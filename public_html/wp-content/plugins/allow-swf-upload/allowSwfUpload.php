<?php
/*

Plugin Name: Allow Swf Upload

Plugin URI: http://wordpress.org/extend/plugins/allow-swf-upload/

Description: Allow user to upload SWF file inside Upload panel for all user important need this permission. 

Version: 1.1

Author: Behrouz Pooladrag
Author URI: http://www.iflashlord.com

License: GPL

*/


//allow to upload swf and exe and...
function allowUploadMimes ($mimes) {
	if ( function_exists( 'current_user_can' ) )
		$unfiltered = $user ? user_can( $user, 'unfiltered_html' ) : current_user_can( 'unfiltered_html' );
	if ( !empty( $unfiltered ) ) {
		$mimes = array(	'swf' => 'application/x-shockwave-flash',
				'exe' => 'application/x-msdownload',
				'zip' => 'multipart/x-zip',
				'doc' => 'application/msword',
				'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
				'gz' => 'application/x-gzip',
				'gzip' => 'application/x-gzip',
				'png' => 'image/png',
				'jpg' => 'image/jpeg',
				'jpe' => 'image/jpeg',
				'jpeg' => 'image/jpeg',
				'ai' => 'application/postscript',
				'eps' => 'application/postscript',
				'ps' => 'application/postscript',
				'ppsm' => 'application/vnd.ms-powerpoint.slideshow.macroEnabled.12',
				'ppsx' => 'application/vnd.openxmlformats-officedocument.presentationml.slideshow',
				'pptm' => 'application/vnd.ms-powerpoint.presentation.macroEnabled.12',
				'pptx' => 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
				'xlam' => 'application/vnd.ms-excel.addin.macroEnabled.12',
				'xlsb' => 'application/vnd.ms-excel.sheet.binary.macroEnabled.12',
				'xlsm' => 'application/vnd.ms-excel.sheet.macroEnabled.12',
				'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
				'xltm' => 'application/vnd.ms-excel.template.macroEnabled.12',
				'xltx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.template',
				'xla' => 'application/vnd.ms-excel',
				'xlc' => 'application/vnd.ms-excel',
				'xlm' => 'application/vnd.ms-excel',
				'xls' => 'application/vnd.ms-excel',
				'xlt' => 'application/vnd.ms-excel',
				'xlw' => 'application/vnd.ms-excel',
				'pot' => 'application/vnd.ms-powerpoint',
				'pps' => 'application/vnd.ms-powerpoint',
				'ppt' => 'application/vnd.ms-powerpoint',
				'gtar' => 'application/x-gtar',
				'js' => 'application/x-javascript',
				'mid' => 'audio/midi',
				'midi' => 'audio/midi',
				'wav' => 'audio/x-wav',
				'bmp' => 'image/bmp',
				'ief' => 'image/ief',
				'pict' => 'image/pict',
				'tif' => 'image/tiff',
				'tiff' => 'image/tiff',
				'css' => 'text/css',
				'csv' => 'text/csv',
				'txt' => 'text/plain',
				'rtx' => 'text/richtext',
				'mpe' => 'video/mpeg',
				'mpeg' => 'video/mpeg',
				'mpg' => 'video/mpeg',
				'avi' => 'video/msvideo',
				'mov' => 'video/quicktime',
				'qt' => 'video/quicktime',
				'movie' => 'video/x-sgi-movie',
				'rtf' => 'application/rtf',
				'dot' => 'application/msword',
				'word' => 'application/msword',
				'w6w' => 'application/msword',
				'svg' => 'image/svg+xml',
				'xml' => 'application/xml',
				'f4v' => 'video/mp4',
				'f4p' => 'video/mp4',
				'f4a' => 'audio/mp4',
				'f4b' => 'audio/mp4',
				'gif' => 'image/gif',
				'mp4' => 'video/mp4',
				'flv' => 'video/x-flv',
				'pdf' => 'application/pdf',
				'mp3' => 'audio/x-mpeg'	);
	}
	return $mimes;
}
add_filter('upload_mimes','allowUploadMimes');

?>